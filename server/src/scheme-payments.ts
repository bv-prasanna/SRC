import {createHmac, timingSafeEqual} from "node:crypto";
import {Router} from "express";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import type {Pool} from "pg";

const basicSecret=()=>process.env.RAZORPAY_KEY_SECRET||"";
const keyId=()=>process.env.RAZORPAY_KEY_ID||"";
/** Actual money collection is NOT approved by a configured key. Only Razorpay TEST keys can be used here. */
export function schemeTestPaymentsEnabled(){
 return process.env.SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED==="true" &&
  keyId().startsWith("rzp_test_") && !!basicSecret() && !!process.env.RAZORPAY_WEBHOOK_SECRET &&
  !!process.env.SRC_JWT_SECRET && process.env.SRC_JWT_SECRET.length>=48;
}
export function makeSchemePaymentProof(code:string){
 if(!schemeTestPaymentsEnabled())return null;
 const expiry=Math.floor(Date.now()/1000)+1800;
 const signature=createHmac("sha256",process.env.SRC_JWT_SECRET!).update("scheme-checkout:"+code+":"+expiry).digest("hex");
 return expiry+"."+signature;
}
export function verifySchemePaymentProof(code:string,proof:string){
 if(!schemeTestPaymentsEnabled()||!/^\d{10}\.[a-f0-9]{64}$/.test(proof))return false;
 const [time,signature]=proof.split(".");
 const expiry=Number(time),now=Math.floor(Date.now()/1000);
 if(!Number.isSafeInteger(expiry)||expiry<now||expiry>now+1800)return false;
 const expected=createHmac("sha256",process.env.SRC_JWT_SECRET!).update("scheme-checkout:"+code+":"+time).digest();
 return timingSafeEqual(expected,Buffer.from(signature,"hex"));
}
export function verifySchemeCheckoutSignature(paymentId:string,subscriptionId:string,signature:string){
 if(!/^pay_[a-zA-Z0-9]+$/.test(paymentId)||!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const wanted=createHmac("sha256",basicSecret()).update(paymentId+"|"+subscriptionId).digest();
 return timingSafeEqual(wanted,Buffer.from(signature,"hex"));
}
export function verifySchemeWebhook(raw:Buffer,signature:string){
 if(!process.env.RAZORPAY_WEBHOOK_SECRET||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const wanted=createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest();
 return timingSafeEqual(wanted,Buffer.from(signature,"hex"));
}
type GatewayPlan={id:string};
type GatewaySubscription={id:string,status?:string};
export async function razorpaySchemeRequest<T>(path:"/plans"|"/subscriptions",body:unknown):Promise<T>{
 if(!schemeTestPaymentsEnabled())throw Error("Test gateway is unavailable");
 const auth=Buffer.from(keyId()+":"+basicSecret()).toString("base64");
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),10000);
 try{
  const response=await fetch("https://api.razorpay.com/v1"+path,{
   method:"POST",headers:{"Authorization":"Basic "+auth,"Content-Type":"application/json"},body:JSON.stringify(body),signal:ac.signal});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||typeof result?.id!=="string")throw Error("Razorpay test gateway rejected this request");
  return result as T;
 }finally{clearTimeout(timer)}
}
export const schemePaymentStart=z.object({
 membershipCode:z.string().regex(/^SRC-[0-9]{4}-[A-F0-9]{24}$/),
 paymentProof:z.string().max(128)
}).strict();
const confirmSchema=z.object({
 membershipCode:schemePaymentStart.shape.membershipCode,
 paymentProof:z.string().max(128),
 razorpay_payment_id:z.string().min(5).max(100),
 razorpay_subscription_id:z.string().min(5).max(100),
 razorpay_signature:z.string().length(64)
}).strict();
const webhookStates:Record<string,string>={
 "subscription.authenticated":"AUTHENTICATED",
 "subscription.activated":"ACTIVE",
 "subscription.halted":"HALTED",
 "subscription.cancelled":"CANCELLED",
 "subscription.completed":"COMPLETED"
};
export function schemePaymentRouter(db:Pool){
 const r=Router();
 const limiter=rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many payment attempts. Please retry later."}});
 r.get("/api/scheme/payments/readiness",(_req,res)=>res.json({testEnabled:schemeTestPaymentsEnabled(),liveEnabled:false}));
 r.post("/api/scheme/payments/start",limiter,async(req,res)=>{
  const checked=schemePaymentStart.safeParse(req.body);
  if(!checked.success){res.status(400).json({error:"Invalid membership payment request"});return}
  if(!schemeTestPaymentsEnabled()){res.status(403).json({error:"Scheme subscription collection is not available"});return}
  const {membershipCode,paymentProof}=checked.data;
  if(!verifySchemePaymentProof(membershipCode,paymentProof)){res.status(403).json({error:"Registration payment session expired. Contact SRC support."});return}
  try{
   const member=await db.query(
    "SELECT m.id,m.scheme_plan_id,m.status AS member_status,sp.name,sp.code,sp.status AS plan_status,sp.amount_paise,sp.frequency,sp.billing_cycles,sp.razorpay_plan_id FROM festival_members m JOIN src_scheme_plans sp ON sp.id=m.scheme_plan_id WHERE m.membership_code=$1",
    [membershipCode]);
   if(!member.rowCount||member.rows[0].member_status!=="REGISTERED"||member.rows[0].plan_status!=="PUBLISHED"){
    res.status(409).json({error:"Membership or selected scheme is unavailable for payment"});return
   }
   const p=member.rows[0];
   // One attempt per member. An uncertain provider request is never retried automatically.
   const reserved=await db.query(
    "INSERT INTO src_scheme_subscriptions(member_id,scheme_plan_id) VALUES($1,$2) ON CONFLICT(member_id) DO NOTHING RETURNING id",
    [p.id,p.scheme_plan_id]);
   if(!reserved.rowCount){
    const existing=await db.query("SELECT status,razorpay_subscription_id FROM src_scheme_subscriptions WHERE member_id=$1",[p.id]);
    const attempt=existing.rows[0];
    if(attempt?.razorpay_subscription_id){
     res.json({keyId:keyId(),subscriptionId:attempt.razorpay_subscription_id,status:attempt.status,testMode:true});return
    }
    res.status(409).json({error:"An earlier subscription attempt requires administrator reconciliation before retry."});return;
   }
   try{
    // An immutable published plan is mapped to a provider-side test plan.
    let providerPlanId=String(p.razorpay_plan_id||"");
    if(!providerPlanId){
     const created=await razorpaySchemeRequest<GatewayPlan>("/plans",{
      period:"monthly",interval:p.frequency==="QUARTERLY"?3:1,
      item:{name:p.name,amount:Number(p.amount_paise),currency:"INR",description:"SRC scheme test subscription"},
      notes:{src_scheme_code:p.code}});
     providerPlanId=created.id;
     await db.query("UPDATE src_scheme_plans SET razorpay_plan_id=$1 WHERE id=$2 AND razorpay_plan_id IS NULL",[providerPlanId,p.scheme_plan_id]);
     // A parallel enrollment may have mapped another provider plan; use the canonical value.
     const stored=await db.query("SELECT razorpay_plan_id FROM src_scheme_plans WHERE id=$1",[p.scheme_plan_id]);
     providerPlanId=stored.rows[0].razorpay_plan_id;
    }
    const sub=await razorpaySchemeRequest<GatewaySubscription>("/subscriptions",{
     plan_id:providerPlanId,total_count:Number(p.billing_cycles),quantity:1,customer_notify:0,
     notes:{src_membership_code:membershipCode,src_scheme_code:p.code}});
    if(!/^sub_[A-Za-z0-9]+$/.test(sub.id))throw Error("Invalid subscription identifier");
    await db.query("UPDATE src_scheme_subscriptions SET razorpay_plan_id=$1,razorpay_subscription_id=$2,status='CREATED',updated_at=now() WHERE id=$3",
     [providerPlanId,sub.id,reserved.rows[0].id]);
    res.status(201).json({keyId:keyId(),subscriptionId:sub.id,status:"CREATED",testMode:true});
   }catch{
    await db.query("UPDATE src_scheme_subscriptions SET status='FAILED',failure_reason='Provider request outcome requires reconciliation',updated_at=now() WHERE id=$1",[reserved.rows[0].id]).catch(()=>{});
    res.status(503).json({error:"Test subscription could not be initiated. Contact SRC before retrying."});
   }
  }catch{res.status(503).json({error:"Scheme subscription service unavailable"})}
 });
 r.post("/api/scheme/payments/confirm",limiter,async(req,res)=>{
  const c=confirmSchema.safeParse(req.body);
  if(!c.success||!schemeTestPaymentsEnabled()){res.status(400).json({error:"Invalid subscription confirmation"});return}
  const p=c.data;
  if(!verifySchemePaymentProof(p.membershipCode,p.paymentProof)||!verifySchemeCheckoutSignature(p.razorpay_payment_id,p.razorpay_subscription_id,p.razorpay_signature)){
   res.status(403).json({error:"Payment authorization signature could not be verified"});return;
  }
  try{
   const update=await db.query(
    "UPDATE src_scheme_subscriptions s SET status='AUTHENTICATED',updated_at=now() FROM festival_members m WHERE m.id=s.member_id AND m.membership_code=$1 AND s.razorpay_subscription_id=$2 AND s.status='CREATED' RETURNING s.status",
    [p.membershipCode,p.razorpay_subscription_id]);
   if(!update.rowCount){res.status(409).json({error:"Subscription could not be confirmed; check member status"});return}
   res.json({status:"AUTHENTICATED",message:"Authorization received. Charges are confirmed separately by signed Razorpay webhooks."});
  }catch{res.status(503).json({error:"Authorization status unavailable"})}
 });
 return r;
}
/** Mount before express.json(), with express.raw(), to verify the provider's exact bytes. */
export function schemePaymentWebhook(db:Pool){
 return async(req:import("express").Request,res:import("express").Response)=>{
  const raw=req.body;
  if(!Buffer.isBuffer(raw)||!verifySchemeWebhook(raw,String(req.header("x-razorpay-signature")||""))){
   res.status(401).json({error:"Invalid webhook signature"});return;
  }
  const eventId=String(req.header("x-razorpay-event-id")||"");
  if(!/^[A-Za-z0-9_-]{6,128}$/.test(eventId)){res.status(400).json({error:"Webhook event ID required"});return}
  let event:any;
  try{event=JSON.parse(raw.toString("utf8"))}catch{res.status(400).json({error:"Invalid webhook body"});return}
  const type=String(event?.event||"");
  const sub=String(event?.payload?.subscription?.entity?.id||"");
  if(!/^sub_[A-Za-z0-9]+$/.test(sub)){res.status(200).json({ignored:true});return}
  const client=await db.connect().catch(()=>null);
  if(!client){res.status(503).json({error:"Webhook storage unavailable"});return}
  try{
   await client.query("BEGIN");
   const logged=await client.query(
    "INSERT INTO src_scheme_subscription_events(provider_event_id,razorpay_subscription_id,event_type) VALUES($1,$2,$3) ON CONFLICT(provider_event_id) DO NOTHING RETURNING id",
    [eventId,sub,type]);
   if(!logged.rowCount){await client.query("COMMIT");res.json({duplicate:true});return}
   // Never trust a checkout callback for a completed instalment; charges arrive via webhook.
   const state=webhookStates[type];
   if(state){
    // Do not regress cancelled or completed subscriptions when events arrive out of order.
    await client.query(
     "UPDATE src_scheme_subscriptions SET status=$1,last_event_at=now(),updated_at=now() WHERE razorpay_subscription_id=$2 AND status NOT IN ('CANCELLED','COMPLETED')",
     [state,sub]);
   }else if(type==="subscription.charged"){
    // Provider's paid_count is cumulative; GREATEST makes reorders/retries idempotent.
    const paid=event?.payload?.subscription?.entity?.paid_count;
    if(Number.isSafeInteger(paid)&&paid>=0){
     await client.query(
      "UPDATE src_scheme_subscriptions SET cycles_paid=GREATEST(cycles_paid,$1),status=CASE WHEN status IN ('CANCELLED','COMPLETED') THEN status ELSE 'ACTIVE' END,last_event_at=now(),updated_at=now() WHERE razorpay_subscription_id=$2",
      [paid,sub]);
    }
   }
   await client.query("COMMIT");res.json({accepted:true});
  }catch{await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Webhook processing unavailable"})}
  finally{client.release()}
 };
}
