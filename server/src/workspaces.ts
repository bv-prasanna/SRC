import {Router} from "express";
import type {Pool,PoolClient} from "pg";
import {z} from "zod";
import {requireRole} from "./access.js";
import type {Role} from "./access.js";

const kindSchema=z.enum(["PROCUREMENT","PACKING","DELIVERY"]);
const updateSchema=z.object({status:z.enum(["IN_PROGRESS","COMPLETED"]),notes:z.string().max(1000).default("")});
const assignSchema=z.object({userId:z.number().int().positive()});
const taskRole:Record<string,Role>={PROCUREMENT:"PROCUREMENT",PACKING:"PACKING",DELIVERY:"DELIVERY"};
export function mayAccessTask(role:Role,kind:string,assignee:number|null,userId:number){
 if(role==="ADMIN"||role==="OPERATIONS")return true;
 return taskRole[kind]===role&&assignee!==null&&assignee===userId;
}
export function nextTask(kind:string):"PACKING"|"DELIVERY"|null{
 if(kind==="PROCUREMENT")return "PACKING";
 if(kind==="PACKING")return "DELIVERY";
 return null;
}
export function canUpdateTask(current:string,next:string){
 return (current==="PENDING"&&next==="IN_PROGRESS")||
  ((current==="PENDING"||current==="IN_PROGRESS")&&next==="COMPLETED");
}
export function workspacesRouter(db:Pool){
 const r=Router();
 const operator=requireRole(db,["ADMIN","OPERATIONS"]);
 const worker=requireRole(db,["ADMIN","OPERATIONS","PROCUREMENT","PACKING","DELIVERY"]);
 r.get("/api/admin/dashboard",requireRole(db,["ADMIN"]),async(_req,res)=>{
  try{
   const [products,users,enquiries,orders,tasks,stock,festival]=await Promise.all([
    db.query("SELECT section_slug,COUNT(*)::int AS count FROM products WHERE published=true GROUP BY section_slug ORDER BY section_slug"),
    db.query("SELECT role,COUNT(*)::int AS count FROM app_users WHERE active=true GROUP BY role ORDER BY role"),
    db.query("SELECT section_slug,status,COUNT(*)::int AS count FROM standard_orders GROUP BY section_slug,status ORDER BY section_slug,status"),
    db.query("SELECT section_slug,status,COUNT(*)::int AS count FROM customer_orders GROUP BY section_slug,status ORDER BY section_slug,status"),
    db.query("SELECT task_kind,status,COUNT(*)::int AS count FROM operations_tasks GROUP BY task_kind,status ORDER BY task_kind,status"),
    db.query("SELECT COUNT(*)::int AS sku_count,COALESCE(SUM(on_hand),0)::int AS units,COALESCE(SUM(reserved),0)::int AS reserved,COUNT(*) FILTER (WHERE on_hand-reserved<=reorder_level)::int AS low_stock FROM stock_levels"),
    db.query("SELECT status,COUNT(*)::int AS count FROM festival_members GROUP BY status")
   ]);
   res.json({products:products.rows,users:users.rows,enquiries:enquiries.rows,orders:orders.rows,tasks:tasks.rows,inventory:stock.rows[0],festivalMembers:festival.rows});
  }catch{res.status(503).json({error:"Dashboard temporarily unavailable"})}
 });
 r.get("/api/workspace/staff",operator,async(_req,res)=>{
  try{res.json((await db.query("SELECT id,email,role FROM app_users WHERE active=true AND role IN ('PROCUREMENT','PACKING','DELIVERY','OPERATIONS') ORDER BY role,email")).rows)}
  catch{res.status(503).json({error:"Staff directory unavailable"})}
 });
 r.get("/api/workspace/tasks",worker,async(_req,res)=>{
  const user=res.locals.user;
  try{
   const query=user.role==="ADMIN"||user.role==="OPERATIONS"?
    "SELECT t.id,t.order_id,t.task_kind,t.status,t.assigned_to,t.instructions,t.created_at,o.section_slug,o.status AS order_status,u.email AS assigned_email FROM operations_tasks t JOIN customer_orders o ON o.id=t.order_id LEFT JOIN app_users u ON u.id=t.assigned_to WHERE o.section_slug<>'crackers' ORDER BY t.created_at DESC LIMIT 300":
    "SELECT t.id,t.order_id,t.task_kind,t.status,t.assigned_to,t.instructions,t.created_at,o.section_slug,o.status AS order_status FROM operations_tasks t JOIN customer_orders o ON o.id=t.order_id WHERE t.assigned_to=$1 AND t.task_kind=$2 AND o.section_slug<>'crackers' ORDER BY t.created_at DESC LIMIT 150";
   const params=user.role==="ADMIN"||user.role==="OPERATIONS"?[]:[user.id,user.role];
   res.json((await db.query(query,params)).rows);
  }catch{res.status(503).json({error:"Task queue unavailable"})}
 });
 // Reconciles previously paid orders into the operational workflow.
 r.post("/api/admin/workspace/orders/:orderId/start",operator,async(req,res)=>{
  const id=Number(req.params.orderId);if(!Number.isSafeInteger(id)||id<1){res.status(400).json({error:"Invalid order"});return}
  try{
   const q=await db.query("INSERT INTO operations_tasks(order_id,task_kind) SELECT id,'PROCUREMENT' FROM customer_orders WHERE id=$1 AND section_slug IN ('housekeeping','stationery') AND status='PAID' ON CONFLICT(order_id,task_kind) DO NOTHING RETURNING id",[id]);
   res.status(q.rowCount?201:409).json(q.rows[0]||{error:"Order is not paid/eligible, or workflow already created"});
  }catch{res.status(503).json({error:"Unable to start order workflow"})}
 });
 r.get("/api/workspace/tasks/:id/details",worker,async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1){res.status(400).json({error:"Invalid task"});return}
  try{
   const q=await db.query("SELECT t.id,t.task_kind,t.assigned_to,o.id AS order_id,o.section_slug,o.address FROM operations_tasks t JOIN customer_orders o ON o.id=t.order_id WHERE t.id=$1 AND o.section_slug<>'crackers'",[id]);
   const t=q.rows[0];if(!t){res.status(404).json({error:"Task unavailable"});return}
   if(!mayAccessTask(res.locals.user.role,t.task_kind,t.assigned_to?Number(t.assigned_to):null,Number(res.locals.user.id))){res.status(403).json({error:"Not assigned"});return}
   const lines=await db.query("SELECT product_id,name_snapshot AS name,qty AS quantity FROM customer_order_items WHERE order_id=$1 ORDER BY product_id",[t.order_id]);
   const canSeeAddress=["DELIVERY","OPERATIONS","ADMIN"].includes(res.locals.user.role);
   res.json({orderId:t.order_id,section:t.section_slug,items:lines.rows,...(canSeeAddress?{deliveryAddress:t.address}:{})});
  }catch{res.status(503).json({error:"Task details unavailable"})}
 });
 r.patch("/api/admin/workspace/tasks/:id/assign",operator,async(req,res)=>{
  const id=Number(req.params.id),v=assignSchema.safeParse(req.body);if(!Number.isSafeInteger(id)||id<1||!v.success){res.status(400).json({error:"Invalid assignment"});return}
  try{
   const q=await db.query("UPDATE operations_tasks t SET assigned_to=$1 FROM app_users u WHERE t.id=$2 AND t.status<>'COMPLETED' AND u.id=$1 AND u.active=true AND u.role=t.task_kind RETURNING t.id,t.task_kind,t.assigned_to",[v.data.userId,id]);
   res.status(q.rowCount?200:409).json(q.rows[0]||{error:"User must have the matching active role or task is unavailable"});
  }catch{res.status(503).json({error:"Assignment unavailable"})}
 });
 r.patch("/api/workspace/tasks/:id/status",worker,async(req,res)=>{
  const id=Number(req.params.id),v=updateSchema.safeParse(req.body);
  if(!Number.isSafeInteger(id)||id<1||!v.success){res.status(400).json({error:"Invalid task update"});return}
  let client:PoolClient|undefined;
  try{
   client=await db.connect();await client.query("BEGIN");
   const q=await client.query("SELECT t.*,o.section_slug,o.status AS order_status FROM operations_tasks t JOIN customer_orders o ON o.id=t.order_id WHERE t.id=$1 FOR UPDATE OF t,o",[id]);
   const task=q.rows[0];if(!task){await client.query("ROLLBACK");res.status(404).json({error:"Task not found"});return}
   if(task.section_slug==="crackers"||!mayAccessTask(res.locals.user.role,task.task_kind,task.assigned_to?Number(task.assigned_to):null,Number(res.locals.user.id))){await client.query("ROLLBACK");res.status(403).json({error:"Not assigned to this task"});return}
   if(!canUpdateTask(task.status,v.data.status)){await client.query("ROLLBACK");res.status(409).json({error:"Invalid task transition"});return}
   const expectedStatus:Record<string,string>={PROCUREMENT:"PAID",PACKING:"PACKING",DELIVERY:"DISPATCHED"};
   if(task.order_status!==expectedStatus[task.task_kind]){await client.query("ROLLBACK");res.status(409).json({error:"Order stage does not match task stage"});return}
   await client.query("UPDATE operations_tasks SET status=$1,completed_at=CASE WHEN $1='COMPLETED' THEN now() ELSE NULL END WHERE id=$2",[v.data.status,id]);
   await client.query("INSERT INTO operations_task_events(task_id,actor_id,old_status,new_status,notes) VALUES($1,$2,$3,$4,$5)",[id,res.locals.user.id,task.status,v.data.status,v.data.notes]);
   if(v.data.status==="COMPLETED"){
    const following=nextTask(task.task_kind);
    if(following)await client.query("INSERT INTO operations_tasks(order_id,task_kind) VALUES($1,$2) ON CONFLICT (order_id,task_kind) DO NOTHING",[task.order_id,following]);
    const nextStatus:Record<string,string>={PROCUREMENT:"PACKING",PACKING:"DISPATCHED",DELIVERY:"DELIVERED"};
    await client.query("UPDATE customer_orders SET status=$1 WHERE id=$2",[nextStatus[task.task_kind],task.order_id]);
    await client.query("INSERT INTO checkout_status_events(order_id,previous_status,new_status,changed_by) VALUES($1,$2,$3,$4)",[task.order_id,task.order_status,nextStatus[task.task_kind],res.locals.user.id]);
   }
   await client.query("COMMIT");res.json({id,taskKind:task.task_kind,status:v.data.status,orderId:task.order_id});
  }catch{if(client)await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Task update unavailable"})}finally{client?.release()}
 });
 return r;
}
