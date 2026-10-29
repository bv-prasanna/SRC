import {Router} from "express";
import type {Pool} from "pg";
import {z} from "zod";
import {requireRole} from "./access.js";
const transition=z.object({status:z.enum(["PACKING","DISPATCHED","DELIVERED"])});
export function canAdvanceOrder(from:string,to:string){return (from==="PAID"&&to==="PACKING")||(from==="PACKING"&&to==="DISPATCHED")||(from==="DISPATCHED"&&to==="DELIVERED")}
export function paidOrdersRouter(db:Pool){
 const r=Router(),admin=requireRole(db,["ADMIN"]);
 r.patch("/api/admin/checkout/orders/:id/status",admin,async(req,res)=>{
  const id=Number(req.params.id),v=transition.safeParse(req.body);
  if(!Number.isSafeInteger(id)||id<1||!v.success){res.status(400).json({error:"Invalid status transition"});return}
  const c=await db.connect().catch(()=>null);if(!c){res.status(503).json({error:"Database unavailable"});return}
  try{
   await c.query("BEGIN");
   const q=await c.query("SELECT status FROM customer_orders WHERE id=$1 AND section_slug<>'crackers' FOR UPDATE",[id]);
   if(!q.rowCount){await c.query("ROLLBACK");res.status(404).json({error:"Order not found"});return}
   if(!canAdvanceOrder(q.rows[0].status,v.data.status)){await c.query("ROLLBACK");res.status(409).json({error:"Invalid fulfilment sequence"});return}
   await c.query("UPDATE customer_orders SET status=$1 WHERE id=$2",[v.data.status,id]);
   await c.query("INSERT INTO checkout_status_events(order_id,previous_status,new_status,changed_by) VALUES($1,$2,$3,$4)",[id,q.rows[0].status,v.data.status,res.locals.user.id]);
   await c.query("COMMIT");res.json({id,status:v.data.status});
  }catch{await c.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Fulfilment update unavailable"})}finally{c.release()}
 });
 return r;
}
