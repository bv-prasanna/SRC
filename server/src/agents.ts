import {Router} from "express";
import type {Pool} from "pg";
import {z} from "zod";
import {requireRole} from "./access.js";
const assign=z.object({agentId:z.number().int().positive()});
const note=z.object({note:z.string().trim().min(2).max(1000)});
const roleChange=z.object({role:z.enum(["CUSTOMER","AGENT","ADMIN","DELIVERY","PROCUREMENT","PACKING","OPERATIONS"]),active:z.boolean()});
export function agentsRouter(db:Pool){
 const r=Router(),admin=requireRole(db,["ADMIN"]),agent=requireRole(db,["AGENT","ADMIN"]);
 r.patch("/api/admin/users/:id/access",admin,async(req,res)=>{
  const id=Number(req.params.id),v=roleChange.safeParse(req.body);
  if(!Number.isSafeInteger(id)||id<1||!v.success){res.status(400).json({error:"Invalid account update"});return}
  if(id===Number(res.locals.user.id)){res.status(409).json({error:"Cannot modify your own role or status"});return}
  let client;
  try{
   client=await db.connect();await client.query("BEGIN");
   const target=await client.query("SELECT id,email,role FROM app_users WHERE id=$1 FOR UPDATE",[id]);
   if(!target.rowCount){await client.query("ROLLBACK");res.status(404).json({error:"User not found"});return}
   const old=target.rows[0];
   if(old.role==="SUPER_ADMIN"||((old.role==="ADMIN"||v.data.role==="ADMIN")&&res.locals.user.role!=="SUPER_ADMIN")){
    await client.query("ROLLBACK");res.status(403).json({error:"Only Super Admin can grant or modify admin access; Super Admin cannot be modified here"});return
   }
   const result=await client.query("UPDATE app_users SET role=$1,active=$2 WHERE id=$3 RETURNING id,email,role,active",[v.data.role,v.data.active,id]);
   await client.query("DELETE FROM user_sessions WHERE user_id=$1",[id]);
   await client.query("COMMIT");res.json(result.rows[0]);
  }catch{if(client)await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Access update unavailable"})}finally{client?.release()}
 });
 r.patch("/api/admin/enquiries/:id/assign",admin,async(req,res)=>{
  const id=Number(req.params.id),data=assign.safeParse(req.body);
  if(!Number.isSafeInteger(id)||id<1||!data.success){res.status(400).json({error:"Invalid assignment"});return}
  try{const q=await db.query("UPDATE standard_orders SET assigned_agent_id=$1 WHERE id=$2 AND section_slug<>'crackers' AND EXISTS(SELECT 1 FROM app_users WHERE id=$1 AND role='AGENT' AND active=true) RETURNING id,assigned_agent_id",[data.data.agentId,id]);res.status(q.rowCount?200:409).json(q.rows[0]||{error:"Enquiry or agent unavailable"})}catch{res.status(503).json({error:"Assignment unavailable"})}
 });
 r.get("/api/agent/enquiries",agent,async(_req,res)=>{try{const q=await db.query("SELECT id,section_slug,customer_name,email,phone,status,total_paise,created_at FROM standard_orders WHERE assigned_agent_id=$1 AND section_slug<>'crackers' ORDER BY created_at DESC LIMIT 200",[res.locals.user.id]);res.json(q.rows)}catch{res.status(503).json({error:"Agent enquiries unavailable"})}});
 r.post("/api/agent/enquiries/:id/notes",agent,async(req,res)=>{
  const id=Number(req.params.id),data=note.safeParse(req.body);if(!Number.isSafeInteger(id)||id<1||!data.success){res.status(400).json({error:"Invalid note"});return}
  try{const q=await db.query("INSERT INTO agent_enquiry_notes(enquiry_id,agent_id,note) SELECT id,$2,$3 FROM standard_orders WHERE id=$1 AND assigned_agent_id=$2 AND section_slug<>'crackers' RETURNING id,created_at",[id,res.locals.user.id,data.data.note]);res.status(q.rowCount?201:403).json(q.rows[0]||{error:"Not assigned"})}catch{res.status(503).json({error:"Note unavailable"})}
 });
 return r;
}
