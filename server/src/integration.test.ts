import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {randomUUID} from "node:crypto";
import type {AddressInfo} from "node:net";
import pg from "pg";
import {createApp} from "./app.js";
const url=process.env.SRC_TEST_DATABASE_URL;
if(!url)throw Error("SRC_TEST_DATABASE_URL is required. Use a disposable database named *_test.");
const db=new pg.Pool({connectionString:url});
test("SRC integration against isolated PostgreSQL test database",async()=>{
 const name=await db.query("SELECT current_database() AS name");
 assert.match(name.rows[0].name,/_test$/,"Refusing to test against a non-test database");
 const dir=resolve(dirname(fileURLToPath(import.meta.url)),"../sql");
 for(let i=1;i<=15;i++){
  const file=resolve(dir,String(i).padStart(3,"0")+"_"+({
   1:"init",2:"business_sections",3:"scheme_drafts",4:"content",5:"standard_orders",6:"inventory",7:"identity",8:"fulfillment",9:"commerce",10:"paid_fulfillment",11:"operational_roles",12:"festival_members",13:"festival_counter_receipts",14:"standalone_scheme_section",15:"scheme_management"
  } as Record<number,string>)[i]+".sql");
  await db.query(readFileSync(file,"utf8"));
 }
 const token="local-admin-test-"+randomUUID().replaceAll("-","")+"-long";
 const app=createApp(db,{adminToken:token,corsOrigin:"http://localhost:8000"});
 const server=app.listen(0);
 try{
  const port=(server.address() as AddressInfo).port;
  const call=async(path:string,method="GET",body?:object,bearer?:string)=>{
   const res=await fetch("http://127.0.0.1:"+port+path,{method,headers:{"Content-Type":"application/json",...(bearer?{Authorization:"Bearer "+bearer}:{})},body:body?JSON.stringify(body):undefined});
   return {code:res.status,data:await res.json().catch(()=>({}))};
  };
  assert.equal((await call("/health")).code,200);
  const sections=await call("/api/catalog/sections");
  assert.equal(sections.code,200);assert.equal(sections.data.some((s:any)=>s.slug==="crackers"),true);
  assert.deepEqual(sections.data.slice(0,4).map((section:any)=>section.slug),["scheme","stationery","housekeeping","crackers"]);
    const email="uat-"+randomUUID()+"@example.org",pass="LongUatPassword!2026";
  assert.equal((await call("/api/auth/register","POST",{email,password:pass})).code,201);
  const login=await call("/api/auth/login","POST",{email,password:pass});
  assert.equal(login.code,200);const userToken=login.data.token as string;
  assert.equal((await call("/api/auth/me","GET",undefined,userToken)).code,200);
  assert.equal((await call("/api/admin/products","GET",undefined,userToken)).code,403);
  const product=await call("/api/admin/products","POST",{name:"UAT "+randomUUID(),category:"Cleaning",description:"Integration test",published:true,fireworks:false,sectionSlug:"housekeeping",pricePaise:12500},token);
  assert.equal(product.code,201);
  const id=Number(product.data.id);
  const stock=await call("/api/admin/inventory","POST",{productId:id,warehouseCode:"MAIN",reorderLevel:3},token);
  assert.equal(stock.code,201);
  const movement=await call("/api/admin/inventory/movements","POST",{productId:id,warehouseCode:"MAIN",delta:10,reason:"UAT receiving"},token);
  assert.equal(movement.code,200);
  const enquiry=await call("/api/enquiries","POST",{customerName:"Example Buyer",email,phone:"9876543210",sectionSlug:"housekeeping",lines:[{productId:id,quantity:1}]});
  assert.equal(enquiry.code,201);
  const bad=await call("/api/enquiries","POST",{customerName:"Example Buyer",email,phone:"9876543210",sectionSlug:"crackers",lines:[{productId:id,quantity:1}]});
  assert.equal(bad.code,400);
  // Payment must remain disabled until explicit merchant configuration exists.
  assert.equal((await call("/api/payments/config")).data.enabled,false);
  const checkout=await call("/api/checkout/orders","POST",{sectionSlug:"housekeeping",address:"Example Street Bengaluru Karnataka",idempotencyKey:randomUUID(),items:[{productId:id,quantity:1}]},userToken);
  assert.equal(checkout.code,503);
  // Role-based operational flow is tested with database-scoped synthetic paid orders.
  // No gateway payment is initiated and the test DB name is checked above.
  await db.query("UPDATE app_users SET role='ADMIN' WHERE email=$1",[email]);
  const elevated=await call("/api/auth/login","POST",{email,password:pass});
  assert.equal(elevated.code,200);
  const adminSession=elevated.data.token as string;
  assert.equal((await call("/api/admin/dashboard","GET",undefined,adminSession)).code,200);
  const procurementEmail="proc-"+randomUUID()+"@example.org";
  assert.equal((await call("/api/auth/register","POST",{email:procurementEmail,password:pass})).code,201);
  const procUser=await db.query("UPDATE app_users SET role='PROCUREMENT' WHERE email=$1 RETURNING id",[procurementEmail]);
  const procLogin=await call("/api/auth/login","POST",{email:procurementEmail,password:pass});
  assert.equal(procLogin.code,200);
  const procSession=procLogin.data.token as string;
  const customerId=(await db.query("SELECT id FROM app_users WHERE email=$1",[email])).rows[0].id;
  const order=(await db.query("INSERT INTO customer_orders(user_id,section_slug,status,amount_paise,address,idem_key) VALUES($1,'housekeeping','PAID',12500,'Integration test delivery address',$2) RETURNING id",[customerId,randomUUID()])).rows[0];
  const started=await call("/api/admin/workspace/orders/"+order.id+"/start","POST",{},adminSession);
  assert.equal(started.code,201);
  const taskId=started.data.id;
  assert.equal((await call("/api/workspace/tasks","GET",undefined,procSession)).data.length,0);
  assert.equal((await call("/api/admin/workspace/tasks/"+taskId+"/assign","PATCH",{userId:Number(procUser.rows[0].id)},adminSession)).code,200);
  const queue=await call("/api/workspace/tasks","GET",undefined,procSession);
  assert.equal(queue.code,200);assert.equal(queue.data.some((t:any)=>String(t.id)===String(taskId)),true);
  assert.equal((await call("/api/workspace/tasks/"+taskId+"/status","PATCH",{status:"COMPLETED",notes:"Integration-only procurement signoff"},procSession)).code,200);
  const progressed=await db.query("SELECT status FROM customer_orders WHERE id=$1",[order.id]);
  assert.equal(progressed.rows[0].status,"PACKING");
  // Scheme plan lifecycle, public registration listing, and no gateway transactions.
  const code="DEEPAVALI_UAT_"+randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
  const year=new Date().getUTCFullYear();
  const plan={code,name:"UAT Deepavali Plan",schemeYear:year,durationMonths:10,frequency:"MONTHLY",amountPaise:100000,description:"Free member registration",benefits:"Proposed benefit",termsSummary:"Subject to review",internalNotes:"UAT only",startDate:null,endDate:null,maxMembers:30};
  const unauthorized=await call("/api/admin/scheme-plans","GET",undefined,procSession);
  assert.equal(unauthorized.code,403);
  const createdPlan=await call("/api/admin/scheme-plans","POST",plan,adminSession);
  assert.equal(createdPlan.code,201);
  const planId=Number(createdPlan.data.id);
  const draftPublic=await call("/api/scheme/plans");
  assert.equal(draftPublic.code,200);assert.equal(draftPublic.data.some((p:any)=>Number(p.id)===planId),false);
  const reviewed=await call("/api/admin/scheme-plans/"+planId+"/status","PATCH",{status:"IN_REVIEW",version:1},adminSession);
  assert.equal(reviewed.code,200);
  const published=await call("/api/admin/scheme-plans/"+planId+"/status","PATCH",{status:"PUBLISHED",version:2},adminSession);
  assert.equal(published.code,200);
  const visible=await call("/api/scheme/plans");
  assert.equal(visible.code,200);assert.equal(visible.data.some((p:any)=>Number(p.id)===planId&&p.collectionEnabled===false),true);
  const planPhone="8"+Math.floor(Math.random()*1_000_000_000).toString().padStart(9,"0");
  const linked=await call("/api/festival/enrol","POST",{fullName:"Plan test",phone:planPhone,email:"",durationMonths:10,schemePlanId:planId,consent:true});
  assert.equal(linked.code,201);
  const members=await db.query("SELECT scheme_plan_id FROM festival_members WHERE membership_code=$1",[linked.data.membershipCode]);
  assert.equal(Number(members.rows[0].scheme_plan_id),planId);
  assert.equal((await call("/api/admin/scheme-plans/summary","GET",undefined,adminSession)).data.gateway.subscriptionCollectionEnabled,false);
  // Free festival registration, private member lookup and in-store verification only.
  const mobile="9"+Math.floor(Math.random()*1_000_000_000).toString().padStart(9,"0");
  const freeRegistration=await call("/api/festival/enrol","POST",{fullName:"Festival UAT Customer",phone:mobile,email:"",durationMonths:10,consent:true});
  assert.equal(freeRegistration.code,201);
  assert.match(freeRegistration.data.membershipCode,/^SRC-[0-9]{4}-[A-F0-9]{24}$/);
  const privateList=await call("/api/admin/festival/members?search="+mobile,"GET",undefined,procSession);
  assert.equal(privateList.code,403);
  const lookup=await call("/api/admin/festival/members?search="+mobile,"GET",undefined,adminSession);
  assert.equal(lookup.code,200);
  assert.equal(lookup.data.some((m:any)=>m.membership_code===freeRegistration.data.membershipCode),true);
  const verify=await call("/api/admin/festival/members/"+freeRegistration.data.membershipCode+"/verify","PATCH",{phoneLast4:mobile.slice(-4)},adminSession);
  assert.equal(verify.code,200);
  const visit=await call("/api/admin/festival/members/"+freeRegistration.data.membershipCode+"/visit","POST",{phoneLast4:mobile.slice(-4),notes:"UAT-only shop verification"},adminSession);
  assert.equal(visit.code,201);
  const receiptReference="SHOP-UAT-"+randomUUID().replaceAll("-","").slice(0,12);
  const counter=await call("/api/admin/festival/members/"+freeRegistration.data.membershipCode+"/counter-receipt","POST",{phoneLast4:mobile.slice(-4),receiptReference,notes:"Test-only physical shop receipt"},adminSession);
  assert.equal(counter.code,201);
  const out=await call("/api/auth/logout","POST",{},userToken);assert.equal(out.code,204);
  assert.equal((await call("/api/auth/me","GET",undefined,userToken)).code,401);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await db.end()}
});
