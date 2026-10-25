import { Router } from "express";
import type { Pool } from "pg";
import type { RequestHandler } from "express";
import { z } from "zod";
export const enquirySchema=z.object({
 customerName:z.string().trim().min(2).max(120),
 email:z.string().email().max(254),
 phone:z.string().regex(/^[+0-9 -]{8,20}$/),
 sectionSlug:z.enum(["housekeeping","stationery"]),
 lines:z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().min(1).max(100)})).min(1).max(40)
});
export function orderRouter(pool:Pool,admin:RequestHandler){
 const router=Router();
 // Enquiries only. No online payment or confirmed purchases until user auth,
 // stock reservation, pricing, fulfilment, and payment reconciliation are implemented.
 router.post("/api/enquiries",async(req,res)=>{
   const parsed=enquirySchema.safeParse(req.body);
   if(!parsed.success){res.status(400).json({error:"Invalid enquiry",details:parsed.error.flatten()});return}
   const input=parsed.data;
   const ids=new Set(input.lines.map(x=>x.productId));
   if(ids.size!==input.lines.length){res.status(400).json({error:"Duplicate product"});return}
   const client=await pool.connect().catch(()=>null);
   if(!client){res.status(503).json({error:"Database unavailable"});return}
   try{
     await client.query("BEGIN");
     const rows=await client.query('SELECT id,section_slug,price_paise,published,fireworks FROM products WHERE id=ANY($1::bigint[]) FOR SHARE',[...ids]);
     const map=new Map<number,any>(rows.rows.map(x=>[Number(x.id),x]));
     let total=0;
     for(const l of input.lines){
       const p=map.get(l.productId);
       if(!p||!p.published||p.fireworks||p.section_slug!==input.sectionSlug||p.price_paise<0)throw new Error("PRODUCT_UNAVAILABLE");
       total+=p.price_paise*l.quantity;
       if(!Number.isSafeInteger(total)||total>100000000)throw new Error("INVALID_TOTAL");
     }
     const order=await client.query("INSERT INTO standard_orders(customer_name,email,phone,section_slug,total_paise) VALUES($1,$2,$3,$4,$5) RETURNING id,status,total_paise",[input.customerName,input.email,input.phone,input.sectionSlug,total]);
     for(const l of input.lines){await client.query("INSERT INTO standard_order_lines(order_id,product_id,quantity,unit_price_paise) VALUES($1,$2,$3,$4)",[order.rows[0].id,l.productId,l.quantity,map.get(l.productId).price_paise])}
     await client.query("COMMIT");res.status(201).json({id:order.rows[0].id,status:"ENQUIRY",totalPaise:total,message:"Enquiry received. This is not a confirmed order and no payment has been collected."});
   }catch(e){await client.query("ROLLBACK").catch(()=>{});res.status(e instanceof Error&&["PRODUCT_UNAVAILABLE","INVALID_TOTAL"].includes(e.message)?400:503).json({error:e instanceof Error&&e.message==="PRODUCT_UNAVAILABLE"?"Product unavailable for this section":"Unable to create enquiry"})}
   finally{client.release()}
 });
 router.get("/api/admin/enquiries",admin,async(_req,res)=>{try{const r=await pool.query("SELECT id,customer_name,email,phone,section_slug,total_paise,status,created_at FROM standard_orders ORDER BY created_at DESC LIMIT 500");res.json(r.rows)}catch{res.status(503).json({error:"Database unavailable"})}});
 return router;
}
