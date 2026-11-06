import test from "node:test";
import assert from "node:assert/strict";
import {normalizeStaffScopes,scopedAccess} from "./staff-access.js";
test("allow scheme and specifically assigned sections",()=>assert.deepEqual(normalizeStaffScopes(["scheme","section:stationery","section:stationery"],["stationery","housekeeping"]),["scheme","section:stationery"]));
test("reject unknown/inactive sections",()=>assert.equal(normalizeStaffScopes(["section:inactive"],["housekeeping"]),null));
test("reject admin wildcard, malformed scope and privilege injection",()=>{for(const scope of ["all","ADMIN","section:scheme","section:../secrets","section:","section:crackers;DROP TABLE app_users"])assert.equal(normalizeStaffScopes([scope],["crackers"]),null)});
test("empty grant list revokes all scopes",()=>assert.deepEqual(normalizeStaffScopes([],["stationery"]),[]));
test("scope is exact per section; no cross-department privileges",()=>assert.equal(normalizeStaffScopes(["section:stationery"],["housekeeping"]),null));

function response(user:any){let status=0,message:any;const res:any={locals:{user},status:(n:number)=>{status=n;return res},json:(x:any)=>{message=x;return res}};return {res,read:()=>({status,message})}}
test("unassigned customer cannot maintain any section",async()=>{
 const db:any={query:async()=>({rowCount:0,rows:[]})},req:any={params:{slug:"housekeeping"}},r=response({id:4,role:"CUSTOMER"});
 let next=false;await scopedAccess(db,x=>"section:"+x.params.slug)[1](req,r.res,()=>{next=true});
 assert.equal(next,false);assert.equal(r.read().status,403);
});
test("section maintenance cannot cross access another store",async()=>{
 const db:any={query:async(_sql:string,args:any[])=>({rowCount:args[1]==="section:stationery"?1:0})};
 const r=response({id:4,role:"CUSTOMER"});let next=false;
 await scopedAccess(db,x=>"section:"+x.params.slug)[1]({params:{slug:"housekeeping"}} as any,r.res,()=>{next=true});
 assert.equal(next,false);assert.equal(r.read().status,403);
});
test("named section grant permits its own store only",async()=>{
 const db:any={query:async(_sql:string,args:any[])=>({rowCount:args[1]==="section:stationery"?1:0})};
 const r=response({id:4,role:"CUSTOMER"});let next=false;
 await scopedAccess(db,x=>"section:"+x.params.slug)[1]({params:{slug:"stationery"}} as any,r.res,()=>{next=true});
 assert.equal(next,true);assert.equal(r.read().status,0);
});
test("Admin has scoped access without delegated grants",async()=>{
 const db:any={query:async()=>{throw Error("should not query grants")}};
 const r=response({id:2,role:"ADMIN"});let next=false;
 await scopedAccess(db,"scheme")[1]({params:{}} as any,r.res,()=>{next=true});
 assert.equal(next,true);
});
