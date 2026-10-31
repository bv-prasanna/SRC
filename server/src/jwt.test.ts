import test from "node:test";
import assert from "node:assert/strict";
import {issueJwt,newJti,verifyJwt,JWT_MAX_AGE_SECONDS} from "./jwt.js";
const old=process.env.SRC_JWT_SECRET;
process.env.SRC_JWT_SECRET="test-only-jwt-key-"+"c".repeat(64);
test("valid signed JWT is accepted before expiry",()=>{
 const jti=newJti(),now=1770000000,token=issueJwt(5,jti,now);
 const result=verifyJwt(token,now+100);
 assert.equal(result?.sub,5);assert.equal(result?.jti,jti);assert.equal(result?.exp,now+JWT_MAX_AGE_SECONDS);
});
test("JWT rejects tampered signature, wrong structure and expiration",()=>{
 const now=1770000000,jwt=issueJwt(1,newJti(),now);
 assert.equal(verifyJwt(jwt.slice(0,-1)+(jwt.at(-1)==="A"?"B":"A"),now),null);
 assert.equal(verifyJwt(jwt,now+JWT_MAX_AGE_SECONDS),null);
 assert.equal(verifyJwt("a.b.c",now),null);
});
test("JWT IDs are unpredictable",()=>assert.notEqual(newJti(),newJti()));
test("weak signing secrets fail closed",()=>{
 const prev=process.env.SRC_JWT_SECRET;process.env.SRC_JWT_SECRET="weak";
 assert.throws(()=>issueJwt(1,newJti()));
 process.env.SRC_JWT_SECRET=prev;
});
test.after(()=>{if(old===undefined)delete process.env.SRC_JWT_SECRET;else process.env.SRC_JWT_SECRET=old});
