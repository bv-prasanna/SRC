import test from "node:test";
import assert from "node:assert/strict";
import {digestToken,requireRole} from "./access.js";
import {issueJwt,newJti} from "./jwt.js";
process.env.SRC_JWT_SECRET="test-auth-"+ "b".repeat(64);
test("session digests deterministic",()=>{assert.equal(digestToken("hello").length,64);assert.notEqual(digestToken("hello"),digestToken("world"))});
function response(){let status=0,json:any;const res={locals:{},status:(s:number)=>{status=s;return res},json:(x:any)=>{json=x;return res}};return {res,read:()=>({status,json})}}
test("missing token rejected without database query",async()=>{const h=requireRole({query:async()=>{throw Error("unexpected")}} as any,["ADMIN"]),r=response();await h({header:()=>undefined} as any,r.res as any,()=>{});assert.equal(r.read().status,401)});
test("signed agent JWT denied admin access",async()=>{
 const token=issueJwt(12,newJti());
 const db={query:async()=>({rows:[{id:12,role:"AGENT",email:"agent@example.com"}]})};
 const r=response();let next=false;await requireRole(db as any,["ADMIN"])({header:()=> "Bearer "+token} as any,r.res as any,()=>{next=true});
 assert.equal(r.read().status,403);assert.equal(next,false)
});
test("Super Admin inherits admin privileges",async()=>{
 const token=issueJwt(3,newJti());
 const db={query:async()=>({rows:[{id:3,role:"SUPER_ADMIN",email:"sa@example.com"}]})};
 const r=response();let next=false;
 await requireRole(db as any,["ADMIN"])({header:()=> "Bearer "+token} as any,r.res as any,()=>{next=true});
 assert.equal(next,true);assert.equal(r.read().status,0)
});
test("missing or revoked JWT session rejected",async()=>{
 const token=issueJwt(3,newJti()),r=response();
 await requireRole({query:async()=>({rows:[]})} as any,["ADMIN"])({header:()=> "Bearer "+token} as any,r.res as any,()=>{});
 assert.equal(r.read().status,401)
});
