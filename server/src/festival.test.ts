import test from "node:test";
import assert from "node:assert/strict";
import {festivalRegistrationSchema,newFestivalCode} from "./festival.js";
const valid={fullName:"Example Customer",phone:"9876543210",email:"",durationMonths:10,consent:true};
test("free festival member registration accepts valid durations",()=>{
 for(const durationMonths of [6,10,12])assert.equal(festivalRegistrationSchema.safeParse({...valid,durationMonths}).success,true);
});
test("registration rejects missing consent",()=>assert.equal(festivalRegistrationSchema.safeParse({...valid,consent:false}).success,false));
test("registration rejects invalid mobile",()=>assert.equal(festivalRegistrationSchema.safeParse({...valid,phone:"1234567890"}).success,false));
test("registration rejects unsupported plan duration",()=>assert.equal(festivalRegistrationSchema.safeParse({...valid,durationMonths:24}).success,false));
test("registration rejects financial/price field injection",()=>assert.equal(festivalRegistrationSchema.safeParse({...valid,amountPaise:10000}).success,false));
test("scheme code has year prefix and unguessable random component",()=>{
 const a=newFestivalCode(2026),b=newFestivalCode(2026);
 assert.match(a,/^SRC-2026-[A-F0-9]{24}$/);assert.notEqual(a,b);
});
