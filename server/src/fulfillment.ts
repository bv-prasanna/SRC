import {Router} from "express";
import {z} from "zod";
import type {Pool} from "pg";
import type {RequestHandler} from "express";
const statuses=["ENQUIRY","CONFIRMED","PACKING","READY","DISPATCHED","DELIVERED","CANCELLED","CLOSED"] as const;
export const transitionSchema=z.object({status:z.enum(statuses),note:z.string().max(500).default("")});
const allowed:Record<string,string[]>={ENQUIRY:["CONFIRMED","CANCELLED"],CONFIRMED:["PACKING","CANCELLED"],PACKING:["READY","CANCELLED"],READY:["DISPATCHED","CLOSED"],DISPATCHED:["DELIVERED"],DELIVERED:["CLOSED"],CANCELLED:[],CLOSED:[]};
export function canTransition(from:string,to:string){return (allowed[from]||[]).includes(to)}
export function fulfillmentRouter(db:Pool,admin:RequestHandler){
 const r=Router();
 r.get("/api/admin/orders/:id/lines",admin,async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1){res.status(400).json({error:"Invalid order"});return}try{res.json((await db.query("SELECT l.product_id,p.name,l.quantity,l.unit_price_paise FROM standard_order_lines l JOIN products p ON p.id=l.product_id WHERE l.order_id=$1",[id])).rows)}catch{res.status(503).json({error:"Order unavailable"})}});
 r.patch("/api/admin/orders/:id/status",admin,async(req,res)=>{
  const id=Number(req.params.id),parsed=transitionSchema.safeParse(req.body);
  if(!Number.isSafeInteger(id)||id<1||!parsed.success){res.status(400).json({error:"Invalid status update"});return}
  let client;try{client=await db.connect();await client.query("BEGIN");
   const q=await client.query("SELECT status,section_slug FROM standard_orders WHERE id=$1 FOR UPDATE",[id]);
   if(!q.rowCount){await client.query("ROLLBACK");res.status(404).json({error:"Order not found"});return}
   if(q.rows[0].section_slug==="crackers"||!canTransition(q.rows[0].status,parsed.data.status)){await client.query("ROLLBACK");res.status(409).json({error:"Transition not allowed"});return}
   await client.query("UPDATE standard_orders SET status=$1,updated_at=now() WHERE id=$2",[parsed.data.status,id]);
   await client.query("INSERT INTO order_status_events(order_id,old_status,new_status,note) VALUES($1,$2,$3,$4)",[id,q.rows[0].status,parsed.data.status,parsed.data.note]);
   await client.query("COMMIT");res.json({id,status:parsed.data.status});
  }catch{if(client)await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Order update failed"})}finally{client?.release()}
 });
 return r;
}
