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
 for(let i=1;i<=10;i++){
  const file=resolve(dir,String(i).padStart(3,"0")+"_"+({
   1:"init",2:"business_sections",3:"scheme_drafts",4:"content",5:"standard_orders",6:"inventory",7:"identity",8:"fulfillment",9:"commerce",10:"paid_fulfillment"
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
  const out=await call("/api/auth/logout","POST",{},userToken);assert.equal(out.code,204);
  assert.equal((await call("/api/auth/me","GET",undefined,userToken)).code,401);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await db.end()}
});
