import test from "node:test";
import assert from "node:assert/strict";
import {digestToken,requireRole} from "./access.js";
test("sha256 session digests are deterministic",()=>{assert.equal(digestToken("hello").length,64);assert.notEqual(digestToken("hello"),digestToken("world"))});
test("admin access denied without token",async()=>{
 const handler=requireRole({query:async()=>{throw Error("should not query")}} as any,["ADMIN"]);
 let code=0;let next=false;
 await handler({header:()=>undefined} as any,{status:(n:number)=>{code=n;return {json:()=>{}}}} as any,()=>{next=true});
 assert.equal(code,401);assert.equal(next,false);
});
test("agent session cannot reach admin-only routes",async()=>{
 const handler=requireRole({query:async()=>({rows:[{id:1,role:"AGENT",email:"agent@example.org"}]})} as any,["ADMIN"]);
 let code=0,next=false;
 await handler({header:()=>("Bearer "+"a".repeat(64))} as any,{locals:{},status:(n:number)=>{code=n;return {json:()=>{}}}} as any,()=>{next=true});
 assert.equal(code,403);assert.equal(next,false);
});
