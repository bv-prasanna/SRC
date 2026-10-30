import {Router} from "express";
import {createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import type {Pool,PoolClient} from "pg";
import type {RequestHandler} from "express";
import {requireRole} from "./access.js";

export const checkoutSchema=z.object({
 sectionSlug:z.enum(["housekeeping","stationery"]),
 address:z.string().trim().min(15).max(1200),
 warehouseCode:z.string().min(2).max(60).default("MAIN"),
 items:z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().min(1).max(100)})).min(1).max(40),
 idempotencyKey:z.string().uuid()
});
export const paymentSchema=z.object({
 orderId:z.number().int().positive(),
 razorpay_payment_id:z.string().regex(/^pay_[a-zA-Z0-9]+$/),
 razorpay_signature:z.string().regex(/^[a-f0-9]{64}$/i)
});
type GatewayPayment={id:string;order_id:string;amount:number;currency:string;status:string};
const keyId=()=>process.env.RAZORPAY_KEY_ID||"";
const keySecret=()=>process.env.RAZORPAY_KEY_SECRET||"";
export function paymentsEnabled(){return process.env.SRC_PAYMENTS_ENABLED==="true"&&!!keyId()&&!!keySecret()}
export function validHmac(body:string,signature:string,secret:string){
 if(!secret||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const a=Buffer.from(createHmac("sha256",secret).update(body).digest("hex"),"hex"),b=Buffer.from(signature,"hex");
 return a.length===b.length&&timingSafeEqual(a,b)
}
export function validPaymentSignature(orderId:string,paymentId:string,signature:string,secret:string){
 return validHmac(orderId+"|"+paymentId,signature,secret)
}
async function razorpay(path:string,options?:{method:"POST";data:object}):Promise<any>{
 const auth=Buffer.from(keyId()+":"+keySecret()).toString("base64");
 const response=await fetch("https://api.razorpay.com/v1/"+path,{
  method:options?.method||"GET",headers:{Authorization:"Basic "+auth,"Content-Type":"application/json"},
  body:options?JSON.stringify(options.data):undefined,signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error("Payment provider returned "+response.status);
 return response.json()
}
function fail(code:string):never{throw Error(code)}
function badRequest(error:unknown){return error instanceof Error&&["INVALID_PRODUCT","INVALID_STOCK","INVALID_SECTION","INVALID_AMOUNT","NOT_FOUND","PAYMENT_MISMATCH"].includes(error.message)}
export async function releaseUninitialized(db:Pool,orderId:string){
 const c=await db.connect();try{await c.query("BEGIN");
  const q=await c.query("SELECT id FROM customer_orders WHERE id=$1 AND status='PENDING_PAYMENT' AND razorpay_order_id IS NULL FOR UPDATE",[orderId]);
  if(!q.rowCount){await c.query("ROLLBACK");return}
  const items=await c.query("SELECT stock_level_id,qty FROM customer_order_items WHERE order_id=$1",[orderId]);
  for(const l of items.rows)await c.query("UPDATE stock_levels SET reserved=reserved-$1 WHERE id=$2 AND reserved>=$1",[l.qty,l.stock_level_id]);
  await c.query("UPDATE customer_orders SET status='CANCELLED' WHERE id=$1",[orderId]);await c.query("COMMIT");
 }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e}finally{c.release()}
}
export async function captureConfirmedPayment(db:Pool,rzOrder:string,rzPayment:string,amount:number,currency:string){
 const c=await db.connect();
 try{
  await c.query("BEGIN");
  const q=await c.query("SELECT id,status,amount_paise,currency,razorpay_payment_id FROM customer_orders WHERE razorpay_order_id=$1 FOR UPDATE",[rzOrder]);
  const order=q.rows[0];
  if(!order)fail("NOT_FOUND");
  if(Number(order.amount_paise)!==amount||order.currency!==currency)fail("PAYMENT_MISMATCH");
  if(order.status==="PAID"&&order.razorpay_payment_id===rzPayment){await c.query("COMMIT");return {orderId:order.id,status:"PAID",duplicate:true}}
  if(order.status!=="PENDING_PAYMENT")fail("PAYMENT_MISMATCH");
  const items=await c.query("SELECT stock_level_id,qty,product_id,name_snapshot,unit_price_paise FROM customer_order_items WHERE order_id=$1 ORDER BY product_id",[order.id]);
  for(const item of items.rows){
   const changed=await c.query("UPDATE stock_levels SET on_hand=on_hand-$1,reserved=reserved-$1,updated_at=now() WHERE id=$2 AND reserved>=$1 AND on_hand>=$1 RETURNING id",[item.qty,item.stock_level_id]);
   if(!changed.rowCount)fail("INVALID_STOCK");
   await c.query("INSERT INTO stock_movements(stock_level_id,delta,reason) VALUES($1,$2,$3)",[item.stock_level_id,-item.qty,"Paid SRC order "+order.id]);
  }
  await c.query("UPDATE customer_orders SET status='PAID',paid_at=now(),razorpay_payment_id=$1 WHERE id=$2",[rzPayment,order.id]);
  await c.query("INSERT INTO operations_tasks(order_id,task_kind) VALUES($1,'PROCUREMENT') ON CONFLICT (order_id,task_kind) DO NOTHING",[order.id]);
  // DRAFT until seller GSTIN, HSN and tax split are configured and validated.
  await c.query("INSERT INTO customer_invoices(order_id,invoice_number,kind,snapshot) VALUES($1,$2,'DRAFT',$3::jsonb) ON CONFLICT(order_id) DO NOTHING",
   [order.id,"SRC-DRAFT-"+order.id,JSON.stringify({orderId:order.id,amountPaise:amount,currency,items:items.rows.map(x=>({productId:x.product_id,name:x.name_snapshot,quantity:x.qty,unitPricePaise:x.unit_price_paise}))})]);
  await c.query("COMMIT");return {orderId:order.id,status:"PAID",duplicate:false};
 }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e}finally{c.release()}
}
export function commerceRouter(db:Pool){
 const r=Router(),authenticated=requireRole(db,["CUSTOMER","AGENT","ADMIN"]),admin=requireRole(db,["ADMIN"]);
 r.get("/api/payments/config",(_req,res)=>res.json({enabled:paymentsEnabled(),keyId:paymentsEnabled()?keyId():null,provider:"razorpay",fireworksEnabled:false}));
 r.post("/api/checkout/orders",authenticated,async(req,res)=>{
  if(!paymentsEnabled()){res.status(503).json({error:"Checkout is disabled until Razorpay is configured"});return}
  const parsed=checkoutSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:"Invalid checkout",details:parsed.error.flatten()});return}
  const v=parsed.data;if(new Set(v.items.map(i=>i.productId)).size!==v.items.length){res.status(400).json({error:"Duplicate product"});return}
  let c:PoolClient|undefined;let orderId:string|undefined;
  try{
   c=await db.connect();await c.query("BEGIN");
   const prev=await c.query("SELECT id,status,razorpay_order_id,amount_paise FROM customer_orders WHERE user_id=$1 AND idem_key=$2",[res.locals.user.id,v.idempotencyKey]);
   if(prev.rowCount){await c.query("ROLLBACK");const old=prev.rows[0];res.status(old.status==="PENDING_PAYMENT"&&old.razorpay_order_id?200:409).json(old.status==="PENDING_PAYMENT"&&old.razorpay_order_id?{orderId:old.id,razorpayOrderId:old.razorpay_order_id,amountPaise:old.amount_paise,keyId:keyId()}:{error:"Checkout key already used"});return}
   const section=await c.query("SELECT commerce_mode,active FROM business_sections WHERE slug=$1",[v.sectionSlug]);
   if(!section.rowCount||section.rows[0].commerce_mode!=="STANDARD"||!section.rows[0].active)fail("INVALID_SECTION");
   let total=0;const lines:{productId:number;stockId:string;qty:number;price:number;name:string}[]=[];
   for(const i of [...v.items].sort((a,b)=>a.productId-b.productId)){
    const q=await c.query("SELECT p.id,p.name,p.price_paise,p.fireworks,p.published,p.section_slug,s.id AS stock_id,s.on_hand,s.reserved FROM products p JOIN stock_levels s ON s.product_id=p.id AND s.warehouse_code=$2 WHERE p.id=$1 FOR UPDATE OF s",[i.productId,v.warehouseCode]);
    const p=q.rows[0];if(!p||p.fireworks||!p.published||p.section_slug!==v.sectionSlug||Number(p.price_paise)<=0)fail("INVALID_PRODUCT");
    if(Number(p.on_hand)-Number(p.reserved)<i.quantity)fail("INVALID_STOCK");
    total+=Number(p.price_paise)*i.quantity;
    if(!Number.isSafeInteger(total)||total>100000000||total<=0)fail("INVALID_AMOUNT");
    lines.push({productId:i.productId,stockId:p.stock_id,qty:i.quantity,price:Number(p.price_paise),name:p.name});
   }
   const inserted=await c.query("INSERT INTO customer_orders(user_id,section_slug,amount_paise,address,idem_key) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [res.locals.user.id,v.sectionSlug,total,v.address,v.idempotencyKey]);orderId=inserted.rows[0].id;
   for(const l of lines){
    await c.query("UPDATE stock_levels SET reserved=reserved+$1 WHERE id=$2",[l.qty,l.stockId]);
    await c.query("INSERT INTO customer_order_items(order_id,product_id,stock_level_id,name_snapshot,qty,unit_price_paise) VALUES($1,$2,$3,$4,$5,$6)",[orderId,l.productId,l.stockId,l.name,l.qty,l.price]);
   }
   await c.query("COMMIT");c.release();c=undefined;
   const gateway=await razorpay("orders",{method:"POST",data:{amount:total,currency:"INR",receipt:"SRC_"+orderId,notes:{src_order_id:String(orderId)}}});
   if(!gateway.id||Number(gateway.amount)!==total||gateway.currency!=="INR")fail("PAYMENT_MISMATCH");
   await db.query("UPDATE customer_orders SET razorpay_order_id=$1 WHERE id=$2 AND status='PENDING_PAYMENT' AND razorpay_order_id IS NULL",[gateway.id,orderId]);
   res.status(201).json({orderId,razorpayOrderId:gateway.id,amountPaise:total,currency:"INR",keyId:keyId()});
  }catch(e){
   if(c)await c.query("ROLLBACK").catch(()=>{});
   if(orderId)await releaseUninitialized(db,orderId).catch(()=>{});
   res.status(badRequest(e)?400:503).json({error:badRequest(e)?(e as Error).message:"Checkout could not be created; no payment should be attempted"});
  }finally{c?.release()}
 });
 r.post("/api/payments/verify",authenticated,async(req,res)=>{
  const v=paymentSchema.safeParse(req.body);if(!v.success){res.status(400).json({error:"Invalid payment"});return}
  const input=v.data;try{
   const q=await db.query("SELECT razorpay_order_id,user_id FROM customer_orders WHERE id=$1",[input.orderId]);
   if(!q.rowCount||String(q.rows[0].user_id)!==String(res.locals.user.id)){res.status(404).json({error:"Order not found"});return}
   const order=q.rows[0].razorpay_order_id;
   if(!order||!validPaymentSignature(order,input.razorpay_payment_id,input.razorpay_signature,keySecret())){res.status(403).json({error:"Invalid payment signature"});return}
   const payment=await razorpay("payments/"+encodeURIComponent(input.razorpay_payment_id)) as GatewayPayment;
   if(payment.id!==input.razorpay_payment_id||payment.order_id!==order||payment.status!=="captured"){res.status(409).json({error:"Payment not captured"});return}
   res.json(await captureConfirmedPayment(db,order,payment.id,Number(payment.amount),payment.currency));
  }catch{res.status(503).json({error:"Payment reconciliation pending; do not retry payment until status is checked"})}
 });
 r.get("/api/checkout/orders",authenticated,async(_req,res)=>{try{const q=await db.query("SELECT id,section_slug,status,amount_paise,currency,created_at,paid_at FROM customer_orders WHERE user_id=$1 ORDER BY id DESC LIMIT 100",[res.locals.user.id]);res.json(q.rows)}catch{res.status(503).json({error:"Orders unavailable"})}});
 r.get("/api/checkout/orders/:id/invoice",authenticated,async(req,res)=>{
  try{const q=await db.query("SELECT i.invoice_number,i.kind,i.snapshot,i.generated_at FROM customer_invoices i JOIN customer_orders o ON o.id=i.order_id WHERE o.id=$1 AND (o.user_id=$2 OR $3=true)",[req.params.id,res.locals.user.id,res.locals.user.role==="ADMIN"]);
   res.status(q.rowCount?200:404).json(q.rows[0]||{error:"Draft invoice unavailable"});
  }catch{res.status(503).json({error:"Invoice unavailable"})}
 });
 r.get("/api/admin/checkout/orders",admin,async(_req,res)=>{try{res.json((await db.query("SELECT id,section_slug,status,amount_paise,razorpay_order_id,created_at FROM customer_orders ORDER BY id DESC LIMIT 500")).rows)}catch{res.status(503).json({error:"Orders unavailable"})}});
 return r
}
export function paymentWebhook(db:Pool):RequestHandler{
 return async(req,res)=>{
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET||"";
  const signature=req.header("x-razorpay-signature")||"";
  const raw=Buffer.isBuffer(req.body)?req.body.toString("utf8"):"";
  if(!secret||!validHmac(raw,signature,secret)){res.status(401).json({error:"Invalid webhook"});return}
  const eventId=req.header("x-razorpay-event-id");
  if(!eventId||eventId.length>150){res.status(400).json({error:"Invalid event id"});return}
  let event:any;try{event=JSON.parse(raw)}catch{res.status(400).json({error:"Invalid event"});return}
  if(event.event!=="payment.captured"){res.status(200).json({ignored:true});return}
  const p=event.payload?.payment?.entity;
  if(!p?.id||!p?.order_id||p.status!=="captured"){res.status(400).json({error:"Invalid payment entity"});return}
  try{
   const seen=await db.query("SELECT 1 FROM payment_webhook_events WHERE event_id=$1",[eventId]);if(seen.rowCount){res.json({duplicate:true});return}
   await captureConfirmedPayment(db,p.order_id,p.id,Number(p.amount),p.currency);
   await db.query("INSERT INTO payment_webhook_events(event_id) VALUES($1) ON CONFLICT DO NOTHING",[eventId]);res.json({processed:true});
  }catch{res.status(503).json({error:"Webhook processing pending retry"})}
 }
}
