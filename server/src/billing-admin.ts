import {Router} from "express";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import type {Pool} from "pg";
import {requireRole} from "./access.js";
import {quoteFromDb} from "./billing.js";

const scope=z.enum(["SECTION","CATEGORY","PRODUCT","ITEM"]);
const baseFields={
 name:z.string().trim().min(3).max(120),
 scope,
 sectionSlug:z.enum(["stationery","housekeeping"]),
 category:z.string().trim().min(1).max(100).nullable().default(null),
 productId:z.number().int().positive().nullable().default(null),
 active:z.boolean().default(false),
 validFrom:z.string().datetime({offset:true}).optional(),
 validUntil:z.string().datetime({offset:true}).nullable().default(null)
};
const taxSchema=z.object({...baseFields,
 component:z.enum(["CGST","SGST","IGST","CESS","OTHER"]),
 rateBps:z.number().int().min(0).max(10000),
 taxInclusive:z.boolean().default(false),
 hsnSac:z.string().regex(/^[0-9A-Za-z.-]{2,16}$/).nullable().default(null)
}).strict();
const priceSchema=z.object({...baseFields,
 adjustmentBps:z.number().int().min(-9000).max(20000),
 minQuantity:z.number().int().min(1).max(100).default(1),
 maxQuantity:z.number().int().min(1).max(100).nullable().default(null),
 reason:z.string().trim().min(5).max(250)
}).strict();
const offerSchema=z.object({...baseFields,
 code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,36}$/).nullable().default(null),
 kind:z.enum(["PERCENT","FIXED"]),
 value:z.number().int().positive(),
 minSubtotalPaise:z.number().int().min(0).default(0),
 maxDiscountPaise:z.number().int().positive().nullable().default(null),
 description:z.string().max(400).default("")
}).strict();
const merchantSchema=z.object({
 sellerName:z.string().trim().min(3).max(150),
 sellerGstin:z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/).nullable(),
 sellerStateCode:z.string().regex(/^[0-9]{2}$/).nullable(),
 invoicePrefix:z.string().trim().regex(/^[A-Z0-9_-]{2,20}$/),
 emailInvoices:z.boolean().default(false)
}).strict();
export function validateBillingRule(kind:"taxes"|"pricing"|"offers",raw:unknown){
 const parsed=(kind==="taxes"?taxSchema:kind==="pricing"?priceSchema:offerSchema).safeParse(raw);
 if(!parsed.success)throw Error("INVALID_RULE");
 const v:any=parsed.data;
 if((v.scope==="SECTION"&&(v.category||v.productId))||
 (v.scope==="CATEGORY"&&(!v.category||v.productId))||
 (["PRODUCT","ITEM"].includes(v.scope)&&(!v.productId||v.category)))throw Error("INVALID_SCOPE");
 if(v.validFrom&&v.validUntil&&new Date(v.validUntil)<=new Date(v.validFrom))throw Error("INVALID_PERIOD");
 if(kind==="pricing"&&v.maxQuantity!==null&&v.maxQuantity<v.minQuantity)throw Error("INVALID_QUANTITY");
 if(kind==="offers"&&((v.kind==="PERCENT"&&v.value>10000)||(v.kind==="FIXED"&&v.value>100000000)))throw Error("INVALID_DISCOUNT");
 return v;
}
const tables={
 taxes:{table:"src_tax_rules",audit:"TAX",columns:["name","scope","section_slug","category","product_id","component","rate_bps","tax_inclusive","hsn_sac","active","valid_from","valid_until"],map:["name","scope","sectionSlug","category","productId","component","rateBps","taxInclusive","hsnSac","active","validFrom","validUntil"]},
 pricing:{table:"src_dynamic_pricing_rules",audit:"PRICING",columns:["name","scope","section_slug","category","product_id","adjustment_bps","min_quantity","max_quantity","reason","active","valid_from","valid_until"],map:["name","scope","sectionSlug","category","productId","adjustmentBps","minQuantity","maxQuantity","reason","active","validFrom","validUntil"]},
 offers:{table:"src_sales_offers",audit:"OFFER",columns:["name","scope","section_slug","category","product_id","code","kind","value","min_subtotal_paise","max_discount_paise","description","active","valid_from","valid_until"],map:["name","scope","sectionSlug","category","productId","code","kind","value","minSubtotalPaise","maxDiscountPaise","description","active","validFrom","validUntil"]}
} as const;
const idValue=(v:string)=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
export function billingRouter(db:Pool){
 const r=Router(),admin=requireRole(db,["ADMIN"]);
 const quoteLimiter=rateLimit({windowMs:15*60*1000,limit:60,standardHeaders:"draft-7",legacyHeaders:false});
 r.get("/api/billing/offers",async(_req,res)=>{
  try{
   const q=await db.query("SELECT name,section_slug AS \"sectionSlug\",scope,kind,value,description,min_subtotal_paise AS \"minSubtotalPaise\",max_discount_paise AS \"maxDiscountPaise\" FROM src_sales_offers WHERE active=true AND code IS NULL AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now()) ORDER BY id DESC LIMIT 60");
   res.json(q.rows);
  }catch{res.status(503).json({error:"Offers temporarily unavailable"})}
 });
 r.post("/api/billing/quote",quoteLimiter,async(req,res)=>{
  try{const quote=await quoteFromDb(db,req.body);res.json(quote)}
  catch(e){const msg=e instanceof Error?e.message:"INVALID_QUOTE";res.status(["INVALID_COUPON","INVALID_QUOTE","INVALID_PRODUCT","INVALID_AMOUNT","DUPLICATE_PRODUCT","MIXED_TAX_MODES","CONFLICTING_TAX_COMPONENTS","INVALID_SECTION"].includes(msg)?400:503).json({error:msg})}
 });
 for(const kind of ["taxes","pricing","offers"] as const){
  const config=tables[kind],path="/api/admin/billing/"+kind;
  r.get(path,admin,async(_req,res)=>{
   try{res.json((await db.query("SELECT * FROM "+config.table+" ORDER BY id DESC LIMIT 500")).rows)}
   catch{res.status(503).json({error:"Billing rules unavailable"})}
  });
  r.post(path,admin,async(req,res)=>{
   let v:any;try{v=validateBillingRule(kind,req.body)}catch(e){res.status(400).json({error:e instanceof Error?e.message:"INVALID_RULE"});return}
   let c;
   try{
    c=await db.connect();await c.query("BEGIN");
    if(v.productId){
     const product=await c.query("SELECT id FROM products WHERE id=$1 AND section_slug=$2 AND fireworks=false",[v.productId,v.sectionSlug]);
     if(!product.rowCount){await c.query("ROLLBACK");res.status(400).json({error:"Product must belong to the selected standard-goods section"});return}
    }
    const columns=config.columns.filter(x=>x!=="valid_from");
    const values=columns.map(col=>v[config.map[config.columns.indexOf(col)]]);
    const insert=await c.query("INSERT INTO "+config.table+"("+columns.join(",")+") VALUES("+columns.map((_,i)=>"$"+(i+1)).join(",")+") RETURNING *",values);
    if(v.validFrom)await c.query("UPDATE "+config.table+" SET valid_from=$1 WHERE id=$2",[v.validFrom,insert.rows[0].id]);
    const current=(await c.query("SELECT * FROM "+config.table+" WHERE id=$1",[insert.rows[0].id])).rows[0];
    await c.query("INSERT INTO src_billing_audit(entity,entity_id,action,actor_id,after_state) VALUES($1,$2,'CREATE',$3,$4::jsonb)",[config.audit,current.id,res.locals.user.id,JSON.stringify(current)]);
    await c.query("COMMIT");res.status(201).json(current);
   }catch(e:any){if(c)await c.query("ROLLBACK").catch(()=>{});res.status(e?.code==="23505"?409:503).json({error:"Could not create rule"})}finally{c?.release()}
  });
  r.put(path+"/:id",admin,async(req,res)=>{
   const id=idValue(req.params.id);let v:any;
   try{v=validateBillingRule(kind,req.body)}catch(e){res.status(400).json({error:e instanceof Error?e.message:"INVALID_RULE"});return}
   if(!id){res.status(400).json({error:"Invalid rule ID"});return}
   let c;
   try{
    c=await db.connect();await c.query("BEGIN");
    const prior=await c.query("SELECT * FROM "+config.table+" WHERE id=$1 FOR UPDATE",[id]);
    if(!prior.rowCount){await c.query("ROLLBACK");res.status(404).json({error:"Rule not found"});return}
    if(v.productId){
     const p=await c.query("SELECT id FROM products WHERE id=$1 AND section_slug=$2 AND fireworks=false",[v.productId,v.sectionSlug]);
     if(!p.rowCount){await c.query("ROLLBACK");res.status(400).json({error:"Invalid section or product scope"});return}
    }
    const columns=config.columns;
    const values=columns.map(col=>col==="valid_from"?(v.validFrom||prior.rows[0].valid_from):v[config.map[columns.indexOf(col)]]);
    const set=columns.map((col,i)=>col+"=$"+(i+1)).join(",");
    const update=await c.query("UPDATE "+config.table+" SET "+set+",updated_at=now() WHERE id=$"+(values.length+1)+" RETURNING *",[...values,id]);
    await c.query("INSERT INTO src_billing_audit(entity,entity_id,action,actor_id,before_state,after_state) VALUES($1,$2,'UPDATE',$3,$4::jsonb,$5::jsonb)",[config.audit,id,res.locals.user.id,JSON.stringify(prior.rows[0]),JSON.stringify(update.rows[0])]);
    await c.query("COMMIT");res.json(update.rows[0]);
   }catch(e:any){if(c)await c.query("ROLLBACK").catch(()=>{});res.status(e?.code==="23505"?409:503).json({error:"Could not update rule"})}finally{c?.release()}
  });
  r.delete(path+"/:id",admin,async(req,res)=>{
   const id=idValue(req.params.id);if(!id){res.status(400).json({error:"Invalid ID"});return}
   let c;try{
    c=await db.connect();await c.query("BEGIN");
    const before=await c.query("SELECT * FROM "+config.table+" WHERE id=$1 FOR UPDATE",[id]);
    if(!before.rowCount){await c.query("ROLLBACK");res.status(404).json({error:"Rule not found"});return}
    const after=await c.query("UPDATE "+config.table+" SET active=false,updated_at=now() WHERE id=$1 RETURNING *",[id]);
    await c.query("INSERT INTO src_billing_audit(entity,entity_id,action,actor_id,before_state,after_state) VALUES($1,$2,'DEACTIVATE',$3,$4::jsonb,$5::jsonb)",[config.audit,id,res.locals.user.id,JSON.stringify(before.rows[0]),JSON.stringify(after.rows[0])]);
    await c.query("COMMIT");res.json({message:"Rule deactivated; historical quotes remain unchanged",rule:after.rows[0]});
   }catch{if(c)await c.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Could not deactivate rule"})}finally{c?.release()}
  });
 }
 r.get("/api/admin/billing/merchant",admin,async(_req,res)=>{
  try{res.json((await db.query("SELECT * FROM src_billing_settings WHERE id=1")).rows[0])}catch{res.status(503).json({error:"Billing settings unavailable"})}
 });
 r.put("/api/admin/billing/merchant",admin,async(req,res)=>{
  const data=merchantSchema.safeParse(req.body);
  if(!data.success){res.status(400).json({error:"Invalid seller or tax information"});return}
  const v=data.data;try{
   const old=(await db.query("SELECT * FROM src_billing_settings WHERE id=1")).rows[0];
   const q=await db.query("UPDATE src_billing_settings SET seller_name=$1,seller_gstin=$2,seller_state_code=$3,invoice_prefix=$4,email_invoices=$5,updated_by=$6,updated_at=now() WHERE id=1 RETURNING *",
    [v.sellerName,v.sellerGstin,v.sellerStateCode,v.invoicePrefix,v.emailInvoices,res.locals.user.id]);
   await db.query("INSERT INTO src_billing_audit(entity,entity_id,action,actor_id,before_state,after_state) VALUES('MERCHANT',1,'SETTINGS',$1,$2::jsonb,$3::jsonb)",[res.locals.user.id,JSON.stringify(old),JSON.stringify(q.rows[0])]);
   res.json(q.rows[0]);
  }catch{res.status(503).json({error:"Could not save billing settings"})}
 });
 r.get("/api/admin/billing/audit",admin,async(_req,res)=>{
  try{res.json((await db.query("SELECT id,entity,entity_id,action,actor_id,created_at FROM src_billing_audit ORDER BY id DESC LIMIT 200")).rows)}
  catch{res.status(503).json({error:"Audit unavailable"})}
 });
 return r;
}
