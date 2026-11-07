import {Router} from "express";
import {rateLimit} from "express-rate-limit";
import nodemailer from "nodemailer";
import type {Pool} from "pg";
import {z} from "zod";
import {scopedAccess} from "./staff-access.js";

const sendSchema=z.object({memberId:z.number().int().positive()}).strict();
export type FollowupReason="AWAITING_SETUP"|"MANDATE_PENDING"|"MANDATE_FAILED";

export function followupReason(subscriptionStatus:string|null):FollowupReason|null{
 if(subscriptionStatus===null)return "AWAITING_SETUP";
 if(subscriptionStatus==="FAILED"||subscriptionStatus==="HALTED")return "MANDATE_FAILED";
 if(["INITIATING","CREATED","AUTHENTICATED"].includes(subscriptionStatus))return "MANDATE_PENDING";
 return null;
}
export function followupMessage(name:string,scheme:string,reason:FollowupReason){
 const greeting="Hello "+name+",\n\n";
 const intro="Thank you for registering for "+scheme+" with SRC Enterprises. Your registration is safely recorded.\n\n";
 const state=reason==="MANDATE_FAILED"
  ?"We could not confirm an earlier test authorization attempt. No successful mandate is confirmed on your SRC account.\n\n"
  :reason==="MANDATE_PENDING"
  ?"Your subscription authorization is not yet confirmed as active.\n\n"
  :"UPI AutoPay enrollment is not available for this scheme at present. No UPI mandate or payment is required to retain your registration.\n\n";
 const ending="Do not share your UPI PIN, OTP, or bank password with anyone. Do not make a payment based solely on this email. If a payment option becomes available after necessary approvals, SRC will provide verified instructions through its official website.\n\nRegards,\nSRC Enterprises";
 return {subject:"SRC scheme registration update — "+scheme,text:greeting+intro+state+ending};
}
const mailConfigured=()=>Boolean(process.env.SMTP_HOST&&process.env.SMTP_FROM);
export function schemeFollowupsRouter(db:Pool){
 const r=Router(),schemeAccess=scopedAccess(db,"scheme");
 const limiter=rateLimit({windowMs:60*60*1000,limit:30,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many follow-up requests. Please try again later."}});
 r.get("/api/admin/scheme-followups",...schemeAccess,async(req,res)=>{
  const schemeId=Number(req.query.schemePlanId||0);
  if(!Number.isSafeInteger(schemeId)||schemeId<0){res.status(400).json({error:"Invalid scheme filter"});return}
  try{
   const q=await db.query(
    `SELECT m.id AS "memberId",m.membership_code AS "membershipCode",m.full_name AS "fullName",
       m.email,p.id AS "schemePlanId",p.name AS "schemeName",
       s.status AS "subscriptionStatus",
       (SELECT MAX(f.sent_at) FROM src_scheme_member_followups f WHERE f.member_id=m.id AND f.delivery_status='SENT') AS "lastSentAt"
     FROM festival_members m
     JOIN src_scheme_plans p ON p.id=m.scheme_plan_id
     LEFT JOIN src_scheme_subscriptions s ON s.member_id=m.id
     WHERE ($1=0 OR m.scheme_plan_id=$1)
       AND m.status IN ('REGISTERED','VERIFIED')
       AND (s.id IS NULL OR s.status IN ('INITIATING','FAILED','CREATED','AUTHENTICATED','HALTED'))
     ORDER BY m.id DESC LIMIT 250`,[schemeId]);
   res.json({emailConfigured:mailConfigured(),members:q.rows.map(x=>({
    ...x,reason:followupReason(x.subscriptionStatus)
   }))});
  }catch{res.status(503).json({error:"Unable to load pending scheme follow-ups"})}
 });
 r.post("/api/admin/scheme-followups/send",...schemeAccess,limiter,async(req,res)=>{
  const v=sendSchema.safeParse(req.body);
  if(!v.success){res.status(400).json({error:"Select a valid member"});return}
  if(!mailConfigured()){res.status(503).json({error:"SMTP email is not configured. No reminder was sent."});return}
  const memberId=v.data.memberId;
  let client;
  let attemptId:number|undefined;
  let item:any;
  try{
   client=await db.connect();
   await client.query("BEGIN");
   await client.query("SELECT pg_advisory_xact_lock(62021107,$1)",[memberId]);
   const m=await client.query(
    `SELECT m.id,m.email,m.full_name,p.id AS plan_id,p.name AS plan_name,
       s.status AS subscription_status
     FROM festival_members m JOIN src_scheme_plans p ON p.id=m.scheme_plan_id
     LEFT JOIN src_scheme_subscriptions s ON s.member_id=m.id
     WHERE m.id=$1 AND m.status IN ('REGISTERED','VERIFIED') FOR UPDATE OF m`,[memberId]);
   item=m.rows[0];
   const reason=item?followupReason(item.subscription_status):null;
   if(!item||!reason){await client.query("ROLLBACK");res.status(409).json({error:"No pending mandate follow-up for this member"});return}
   const prior=await client.query(
    "SELECT 1 FROM src_scheme_member_followups WHERE member_id=$1 AND ((delivery_status='SENT' AND created_at>now()-interval '24 hours') OR (delivery_status='PENDING' AND created_at>now()-interval '10 minutes')) LIMIT 1",
    [memberId]);
   if(prior.rowCount){await client.query("ROLLBACK");res.status(429).json({error:"A reminder was sent recently or is being delivered. Please try later."});return}
   const inserted=await client.query(
    "INSERT INTO src_scheme_member_followups(member_id,scheme_plan_id,actor_user_id,reason,delivery_status) VALUES($1,$2,$3,$4,'PENDING') RETURNING id",
    [memberId,item.plan_id,res.locals.user.id,reason]);
   attemptId=Number(inserted.rows[0].id);
   await client.query("COMMIT");
  }catch{
   if(client)await client.query("ROLLBACK").catch(()=>{});
   res.status(503).json({error:"Could not prepare the follow-up email"});return
  }finally{client?.release()}
  try{
   const port=Number(process.env.SMTP_PORT||587);
   const transporter=nodemailer.createTransport({
    host:process.env.SMTP_HOST,port,secure:port===465,
    auth:process.env.SMTP_USER&&process.env.SMTP_PASS?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined
   });
   const msg=followupMessage(String(item.full_name),String(item.plan_name),followupReason(item.subscription_status)!);
   await transporter.sendMail({from:process.env.SMTP_FROM,to:item.email,subject:msg.subject,text:msg.text});
   await db.query("UPDATE src_scheme_member_followups SET delivery_status='SENT',sent_at=now() WHERE id=$1",[attemptId]);
   res.json({message:"Follow-up email accepted by the email server.",deliveryStatus:"SENT",memberId});
  }catch{
   await db.query("UPDATE src_scheme_member_followups SET delivery_status='FAILED',failed_at=now() WHERE id=$1",[attemptId]).catch(()=>{});
   res.status(503).json({error:"Email could not be sent. Check SMTP settings and retry."})
  }
 });
 return r;
}
