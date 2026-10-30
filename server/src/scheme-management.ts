import {Router} from "express";
import {z} from "zod";
import type {Pool} from "pg";
import {requireRole} from "./access.js";

export const planForm=z.object({
 code:z.string().trim().regex(/^[A-Z][A-Z0-9_-]{2,39}$/),
 name:z.string().trim().min(3).max(120),
 schemeYear:z.number().int().min(2020).max(2100),
 durationMonths:z.union([z.literal(6),z.literal(10),z.literal(12)]),
 frequency:z.enum(["MONTHLY","QUARTERLY"]),
 amountPaise:z.number().int().min(100).max(100000000),
 description:z.string().trim().max(1000).default(""),
 benefits:z.string().trim().max(1000).default(""),
 termsSummary:z.string().trim().max(3000).default(""),
 internalNotes:z.string().trim().max(4000).default(""),
 startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
 endDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
 maxMembers:z.number().int().min(1).max(1000000).nullable().default(null)
}).strict().refine(p=>!p.startDate||!p.endDate||p.startDate<=p.endDate,{message:"End date cannot precede start date"}).refine(p=>p.frequency!=="QUARTERLY"||p.durationMonths%3===0,{message:"Quarterly billing requires a duration divisible by three months"});
const statusForm=z.object({status:z.enum(["DRAFT","IN_REVIEW","PUBLISHED","ARCHIVED"]),version:z.number().int().positive()}).strict();
const idParam=(s:string)=>{const id=Number(s);return Number.isSafeInteger(id)&&id>0?id:null};
export function billingCycles(duration:number,frequency:"MONTHLY"|"QUARTERLY"){
 return frequency==="MONTHLY"?duration:duration/3;
}
export function projectedTotal(amountPaise:number,duration:number,frequency:"MONTHLY"|"QUARTERLY"){
 return amountPaise*billingCycles(duration,frequency);
}
export function statusCanChange(from:string,to:string){
 return (from==="DRAFT"&&["IN_REVIEW","ARCHIVED"].includes(to))||
 (from==="IN_REVIEW"&&["DRAFT","PUBLISHED","ARCHIVED"].includes(to))||
 (from==="PUBLISHED"&&["ARCHIVED"].includes(to));
}
function publicRow(row:any){
 const {id,code,name,scheme_year,duration_months,frequency,amount_paise,description,benefits,terms_summary,start_date,end_date,max_members,status}=row;
 return {id,code,name,schemeYear:scheme_year,durationMonths:duration_months,frequency,
  amountPaise:amount_paise,projectedTotalPaise:projectedTotal(Number(amount_paise),Number(duration_months),frequency),
  description,benefits,termsSummary:terms_summary,startDate:start_date,endDate:end_date,maxMembers:max_members,status,
  collectionEnabled:false};
}
export function schemeManagementRouter(db:Pool){
 const r=Router(),admin=requireRole(db,["ADMIN"]);
 const columns="id,code,name,scheme_year,duration_months,frequency,billing_cycles,amount_paise,description,benefits,terms_summary,internal_notes,start_date,end_date,max_members,status,razorpay_plan_id,gateway_status,created_at,updated_at,version";
 r.get("/api/scheme/plans",async(_req,res)=>{
  try{
   const q=await db.query("SELECT "+columns+" FROM src_scheme_plans WHERE status='PUBLISHED' AND (start_date IS NULL OR start_date<=current_date) AND (end_date IS NULL OR end_date>=current_date) ORDER BY duration_months,amount_paise");
   res.json(q.rows.map(publicRow));
  }catch{res.status(503).json({error:"Scheme plans temporarily unavailable"})}
 });
 r.get("/api/admin/scheme-plans",admin,async(_req,res)=>{
  try{const q=await db.query("SELECT p.*, (SELECT COUNT(*)::int FROM festival_members fm WHERE fm.scheme_plan_id=p.id) AS registered_members FROM src_scheme_plans p ORDER BY p.scheme_year DESC,p.id DESC LIMIT 500");res.json(q.rows)}
  catch{res.status(503).json({error:"Could not load scheme plans"})}
 });
 r.get("/api/admin/scheme-plans/summary",admin,async(_req,res)=>{
  try{
   const [plans,members,byStatus]=await Promise.all([
    db.query("SELECT status,COUNT(*)::int AS count FROM src_scheme_plans GROUP BY status"),
    db.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE scheme_plan_id IS NOT NULL)::int AS assigned FROM festival_members"),
    db.query("SELECT sp.code,sp.name,COUNT(fm.id)::int AS registrations FROM src_scheme_plans sp LEFT JOIN festival_members fm ON fm.scheme_plan_id=sp.id GROUP BY sp.id ORDER BY registrations DESC,sp.id DESC LIMIT 15")
   ]);
   res.json({statuses:plans.rows,members:members.rows[0],planRegistrations:byStatus.rows,
    gateway:{configured:!!(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET),mode:(process.env.RAZORPAY_KEY_ID||"").startsWith("rzp_test_")?"TEST":(process.env.RAZORPAY_KEY_ID||"").startsWith("rzp_live_")?"LIVE":"NOT_CONFIGURED",subscriptionCollectionEnabled:false}});
  }catch{res.status(503).json({error:"Scheme summary unavailable"})}
 });
 r.post("/api/admin/scheme-plans",admin,async(req,res)=>{
  const parsed=planForm.safeParse(req.body);if(!parsed.success){res.status(400).json({error:"Invalid plan",details:parsed.error.flatten()});return}
  const p=parsed.data;
  try{
   const client=await db.connect();
   try{
    await client.query("BEGIN");
    const q=await client.query("INSERT INTO src_scheme_plans(code,name,scheme_year,duration_months,frequency,billing_cycles,amount_paise,description,benefits,terms_summary,internal_notes,start_date,end_date,max_members,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING *",
     [p.code,p.name,p.schemeYear,p.durationMonths,p.frequency,billingCycles(p.durationMonths,p.frequency),p.amountPaise,p.description,p.benefits,p.termsSummary,p.internalNotes,p.startDate,p.endDate,p.maxMembers,res.locals.user.id]);
    await client.query("INSERT INTO src_scheme_plan_audit(scheme_plan_id,actor_id,action,next_state) VALUES($1,$2,'CREATE',$3::jsonb)",[q.rows[0].id,res.locals.user.id,JSON.stringify(q.rows[0])]);
    await client.query("COMMIT");res.status(201).json(q.rows[0]);
   }catch(err){await client.query("ROLLBACK").catch(()=>{});throw err}finally{client.release()}
  }catch(err:any){res.status(err?.code==="23505"?409:503).json({error:err?.code==="23505"?"Scheme code already exists":"Cannot create scheme plan"})}
 });
 r.put("/api/admin/scheme-plans/:id",admin,async(req,res)=>{
  const id=idParam(req.params.id),parsed=planForm.extend({version:z.number().int().positive()}).safeParse(req.body);
  if(!id||!parsed.success){res.status(400).json({error:"Invalid plan update"});return}
  const {version,...p}=parsed.data;
  let client;
  try{
   client=await db.connect();await client.query("BEGIN");
   const prior=await client.query("SELECT * FROM src_scheme_plans WHERE id=$1 FOR UPDATE",[id]);
   if(!prior.rowCount){await client.query("ROLLBACK");res.status(404).json({error:"Plan not found"});return}
   const existing=prior.rows[0];
   if(existing.version!==version){await client.query("ROLLBACK");res.status(409).json({error:"Plan changed; reload before editing"});return}
   if(existing.status==="ARCHIVED"||existing.status==="PUBLISHED"){await client.query("ROLLBACK");res.status(409).json({error:"Published or archived plans cannot be edited. Create a new version instead."});return}
   const q=await client.query("UPDATE src_scheme_plans SET code=$1,name=$2,scheme_year=$3,duration_months=$4,frequency=$5,billing_cycles=$6,amount_paise=$7,description=$8,benefits=$9,terms_summary=$10,internal_notes=$11,start_date=$12,end_date=$13,max_members=$14,version=version+1,updated_at=now(),updated_by=$15 WHERE id=$16 RETURNING *",
    [p.code,p.name,p.schemeYear,p.durationMonths,p.frequency,billingCycles(p.durationMonths,p.frequency),p.amountPaise,p.description,p.benefits,p.termsSummary,p.internalNotes,p.startDate,p.endDate,p.maxMembers,res.locals.user.id,id]);
   await client.query("INSERT INTO src_scheme_plan_audit(scheme_plan_id,actor_id,action,previous_state,next_state) VALUES($1,$2,'EDIT',$3::jsonb,$4::jsonb)",[id,res.locals.user.id,JSON.stringify(existing),JSON.stringify(q.rows[0])]);
   await client.query("COMMIT");res.json(q.rows[0]);
  }catch(err:any){if(client)await client.query("ROLLBACK").catch(()=>{});res.status(err?.code==="23505"?409:503).json({error:err?.code==="23505"?"Scheme code already exists":"Could not update scheme plan"})}finally{client?.release()}
 });
 r.patch("/api/admin/scheme-plans/:id/status",admin,async(req,res)=>{
  const id=idParam(req.params.id),parsed=statusForm.safeParse(req.body);
  if(!id||!parsed.success){res.status(400).json({error:"Invalid status change"});return}
  let client;
  try{
   client=await db.connect();await client.query("BEGIN");
   const prior=await client.query("SELECT * FROM src_scheme_plans WHERE id=$1 FOR UPDATE",[id]);
   if(!prior.rowCount){await client.query("ROLLBACK");res.status(404).json({error:"Plan not found"});return}
   const old=prior.rows[0];
   if(old.version!==parsed.data.version||!statusCanChange(old.status,parsed.data.status)){
    await client.query("ROLLBACK");res.status(409).json({error:"Invalid transition or stale plan version"});return
   }
   const q=await client.query("UPDATE src_scheme_plans SET status=$1,version=version+1,updated_at=now(),updated_by=$2 WHERE id=$3 RETURNING *",[parsed.data.status,res.locals.user.id,id]);
   await client.query("INSERT INTO src_scheme_plan_audit(scheme_plan_id,actor_id,action,previous_state,next_state) VALUES($1,$2,'STATUS',$3::jsonb,$4::jsonb)",[id,res.locals.user.id,JSON.stringify(old),JSON.stringify(q.rows[0])]);
   await client.query("COMMIT");res.json(q.rows[0]);
  }catch{if(client)await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Cannot change plan status"})}finally{client?.release()}
 });
 r.get("/api/admin/scheme-plans/:id/gateway-preview",admin,async(req,res)=>{
  const id=idParam(req.params.id);if(!id){res.status(400).json({error:"Invalid plan id"});return}
  try{
   const q=await db.query("SELECT code,name,frequency,billing_cycles,amount_paise,description,status FROM src_scheme_plans WHERE id=$1",[id]);
   if(!q.rowCount){res.status(404).json({error:"Plan not found"});return}
   const p=q.rows[0];
   res.json({dryRun:true,collectionEnabled:false,merchantApprovalRequired:true,
    proposedPlan:{period:p.frequency==="QUARTERLY"?"quarterly":"monthly",interval:1,
     item:{name:p.name,amount:p.amount_paise,currency:"INR",description:p.description},
     notes:{src_scheme_code:p.code}},
    proposedBillingCycles:p.billing_cycles,
    explanation:"This is a preview only. No Razorpay request, plan, mandate or subscription is created."});
  }catch{res.status(503).json({error:"Plan preview unavailable"})}
 });
 r.get("/api/admin/scheme-plans/:id/history",admin,async(req,res)=>{
  const id=idParam(req.params.id);if(!id){res.status(400).json({error:"Invalid id"});return}
  try{res.json((await db.query("SELECT id,action,actor_id,created_at FROM src_scheme_plan_audit WHERE scheme_plan_id=$1 ORDER BY id DESC LIMIT 100",[id])).rows)}
  catch{res.status(503).json({error:"Audit log unavailable"})}
 });
 return r;
}
