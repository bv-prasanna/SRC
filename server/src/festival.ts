import {Router} from "express";
import {randomBytes} from "node:crypto";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import type {Pool} from "pg";
import {requireRole} from "./access.js";
import {encryptedPan,maskedPan,panEncryptionConfigured,panLastFourDigits} from "./pan-security.js";

export const festivalRegistrationSchema=z.object({
 fullName:z.string().trim().min(2).max(120),
 phone:z.string().regex(/^[6-9][0-9]{9}$/,"Use a 10-digit Indian mobile number"),
 email:z.string().trim().email().max(254),
 schemePlanId:z.number().int().positive(),
 addressLine1:z.string().trim().min(8).max(200),
 addressLine2:z.string().trim().max(200).default(""),
 city:z.string().trim().min(2).max(100),
 state:z.string().trim().min(2).max(100),
 pincode:z.string().regex(/^[1-9][0-9]{5}$/),
 pan:z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/,"Enter a valid 10-character PAN"),
 consent:z.literal(true),
 panConsent:z.literal(true)
}).strict();
const verifySchema=z.object({phoneLast4:z.string().regex(/^[0-9]{4}$/)}).strict();
const visitSchema=verifySchema.extend({notes:z.string().max(500).default("")});
const counterReceiptSchema=visitSchema.extend({receiptReference:z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{2,59}$/)});
export function newFestivalCode(year:number){
 return "SRC-"+year+"-"+randomBytes(12).toString("hex").toUpperCase();
}
export function festivalRouter(db:Pool){
 const r=Router(),shop=requireRole(db,["ADMIN","OPERATIONS"]);
 const limiter=rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many registration attempts. Please visit SRC directly."}});
 r.post("/api/festival/enrol",limiter,async(req,res)=>{
  const data=festivalRegistrationSchema.safeParse(req.body);
  if(!data.success){res.status(400).json({error:"Enter the published scheme, name, mobile, email, address, PAN and required consents"});return}
  if(!panEncryptionConfigured()){res.status(503).json({error:"Secure registration is not configured. Contact SRC support."});return}
  const v=data.data;
  let client;
  try{
   client=await db.connect();await client.query("BEGIN");
   // The customer cannot choose or override the plan's configured duration or amount.
   // Lock the plan while checking its capacity, preventing concurrent over-enrolment.
   const pq=await client.query(
    "SELECT id,code,name,scheme_year,duration_months,frequency,billing_cycles,amount_paise,max_members FROM src_scheme_plans WHERE id=$1 AND status='PUBLISHED' AND (start_date IS NULL OR start_date<=current_date) AND (end_date IS NULL OR end_date>=current_date) FOR UPDATE",
    [v.schemePlanId]);
   if(!pq.rowCount){await client.query("ROLLBACK");res.status(409).json({error:"This scheme is not currently open for registration"});return}
   const plan=pq.rows[0],year=Number(plan.scheme_year);
   if(plan.max_members!==null){
    const count=await client.query("SELECT COUNT(*)::int AS count FROM festival_members WHERE scheme_plan_id=$1",[v.schemePlanId]);
    if(Number(count.rows[0].count)>=Number(plan.max_members)){
     await client.query("ROLLBACK");res.status(409).json({error:"This scheme has reached its registration limit"});return;
    }
   }
   const code=newFestivalCode(year);
   const ciphertext=encryptedPan(v.pan,code);
   const snapshot={code:plan.code,name:plan.name,schemeYear:year,durationMonths:Number(plan.duration_months),frequency:plan.frequency,billingCycles:Number(plan.billing_cycles),amountPaise:Number(plan.amount_paise),collectionEnabled:false};
   const q=await client.query(
    "INSERT INTO festival_members(membership_code,scheme_year,full_name,phone,email,duration_months,consented_at,scheme_plan_id,address_line1,address_line2,city,state,pincode,pan_ciphertext,pan_digits,pan_consent_at,scheme_snapshot) VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10,$11,$12,$13,$14,now(),$15::jsonb) ON CONFLICT DO NOTHING RETURNING membership_code,scheme_year,duration_months,status,scheme_plan_id",
    [code,year,v.fullName,v.phone,v.email,Number(plan.duration_months),v.schemePlanId,v.addressLine1,v.addressLine2,v.city,v.state,v.pincode,ciphertext,panLastFourDigits(v.pan),JSON.stringify(snapshot)]);
   if(!q.rowCount){await client.query("ROLLBACK");res.status(409).json({error:"This mobile number is already registered for the selected scheme. Contact SRC to retrieve your membership ID."});return}
   await client.query("COMMIT");
   res.status(201).json({membershipCode:q.rows[0].membership_code,schemePlanId:q.rows[0].scheme_plan_id,year:q.rows[0].scheme_year,durationMonths:q.rows[0].duration_months,status:q.rows[0].status,plan:snapshot,message:"Registration recorded. No UPI mandate or financial payment has been created."});
  }catch{if(client)await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Registration temporarily unavailable"})}
  finally{client?.release()}
 });
 r.get("/api/admin/festival/members",shop,async(req,res)=>{
  const search=String(req.query.search||"").trim().slice(0,80);
  try{
   const q=await db.query(
    "SELECT m.id,m.membership_code,m.scheme_year,m.full_name,m.phone,m.email,m.duration_months,m.status,m.created_at,m.verified_at,m.address_line1,m.address_line2,m.city,m.state,m.pincode,m.pan_digits,(SELECT COUNT(*)::int FROM festival_store_visits v WHERE v.member_id=m.id) AS store_visits, sp.code AS plan_code, sp.name AS plan_name FROM festival_members m LEFT JOIN src_scheme_plans sp ON sp.id=m.scheme_plan_id WHERE $1='' OR m.membership_code ILIKE '%'||$1||'%' OR m.phone LIKE '%'||$1||'%' ORDER BY m.id DESC LIMIT 200",[search]);
   res.json(q.rows.map(({pan_digits,...member}:any)=>({...member,pan_masked:maskedPan(pan_digits)})));
  }catch{res.status(503).json({error:"Member list unavailable"})}
 });
 r.patch("/api/admin/festival/members/:code/verify",shop,async(req,res)=>{
  const data=verifySchema.safeParse(req.body),code=String(req.params.code||"");
  if(!data.success||!/^SRC-[0-9]{4}-[A-F0-9]{24}$/.test(code)){res.status(400).json({error:"Invalid membership ID or phone verification"});return}
  try{
   const q=await db.query(
    "UPDATE festival_members SET status='VERIFIED',verified_at=now(),verified_by=$1 WHERE membership_code=$2 AND RIGHT(phone,4)=$3 AND status='REGISTERED' RETURNING membership_code,status,verified_at",
    [res.locals.user.id,code,data.data.phoneLast4]);
   res.status(q.rowCount?200:409).json(q.rows[0]||{error:"Not found, phone mismatch, or already verified/cancelled"});
  }catch{res.status(503).json({error:"Verification unavailable"})}
 });
 r.post("/api/admin/festival/members/:code/visit",shop,async(req,res)=>{
  const data=visitSchema.safeParse(req.body),code=String(req.params.code||"");
  if(!data.success||!/^SRC-[0-9]{4}-[A-F0-9]{24}$/.test(code)){res.status(400).json({error:"Invalid visit details"});return}
  try{
   const q=await db.query(
    "INSERT INTO festival_store_visits(member_id,recorded_by,notes) SELECT id,$1,$2 FROM festival_members WHERE membership_code=$3 AND RIGHT(phone,4)=$4 AND status='VERIFIED' RETURNING id,visited_at",
    [res.locals.user.id,data.data.notes,code,data.data.phoneLast4]);
   res.status(q.rowCount?201:403).json(q.rows[0]||{error:"Verify member code and phone before logging an in-store visit"});
  }catch{res.status(503).json({error:"Store visit could not be recorded"})}
 });
 r.post("/api/admin/festival/members/:code/counter-receipt",shop,async(req,res)=>{
  const data=counterReceiptSchema.safeParse(req.body),code=String(req.params.code||"");
  if(!data.success||!/^SRC-[0-9]{4}-[A-F0-9]{24}$/.test(code)){res.status(400).json({error:"Valid member code, phone and physical receipt number are required"});return}
  try{
   // A licensed shop completes the purchase and issues its own receipt BEFORE this reference is logged.
   const q=await db.query(
    "INSERT INTO festival_counter_receipts(member_id,receipt_reference,recorded_by,notes) SELECT id,$1,$2,$3 FROM festival_members WHERE membership_code=$4 AND RIGHT(phone,4)=$5 AND status='VERIFIED' RETURNING id,receipt_reference,recorded_at",
    [data.data.receiptReference,res.locals.user.id,data.data.notes,code,data.data.phoneLast4]);
   res.status(q.rowCount?201:403).json(q.rows[0]||{error:"Membership must first be verified at the shop"});
  }catch(e:any){res.status(e?.code==="23505"?409:503).json({error:e?.code==="23505"?"Physical receipt reference is already linked":"Unable to record receipt reference"})}
 });
 return r;
}
