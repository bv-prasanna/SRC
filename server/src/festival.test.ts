import test from "node:test";
import assert from "node:assert/strict";
import {festivalRegistrationSchema,newFestivalCode} from "./festival.js";
import {encryptedPan,maskedPan,panLastFourDigits} from "./pan-security.js";

const valid={fullName:"Example Customer",phone:"9876543210",email:"customer@example.org",schemePlanId:12,
 addressLine1:"12 Main Road, Vijayanagar",addressLine2:"Near main circle",city:"Bengaluru",
 state:"Karnataka",pincode:"560040",pan:"ABCDE1234F",consent:true,panConsent:true};

test("published scheme ID and KYC fields are required instead of a duration dropdown",()=>{
 assert.equal(festivalRegistrationSchema.safeParse(valid).success,true);
 assert.equal(festivalRegistrationSchema.safeParse({...valid,schemePlanId:undefined}).success,false);
 assert.equal(festivalRegistrationSchema.safeParse({...valid,durationMonths:10}).success,false);
});
test("registration rejects missing permissions",()=>{
 assert.equal(festivalRegistrationSchema.safeParse({...valid,consent:false}).success,false);
 assert.equal(festivalRegistrationSchema.safeParse({...valid,panConsent:false}).success,false);
});
test("registration rejects invalid mobile, email and address",()=>{
 assert.equal(festivalRegistrationSchema.safeParse({...valid,phone:"1234567890"}).success,false);
 assert.equal(festivalRegistrationSchema.safeParse({...valid,email:""}).success,false);
 assert.equal(festivalRegistrationSchema.safeParse({...valid,pincode:"000000"}).success,false);
});
test("registration validates PAN and uppercases letters",()=>{
 assert.equal(festivalRegistrationSchema.safeParse({...valid,pan:"abcde1234f"}).success,true);
 assert.equal(festivalRegistrationSchema.safeParse({...valid,pan:"ABCDE12345"}).success,false);
 assert.equal(festivalRegistrationSchema.safeParse({...valid,pan:"AAAA99999A"}).success,false);
});
test("scheme registration rejects financial field injection",()=>{
 assert.equal(festivalRegistrationSchema.safeParse({...valid,amountPaise:10000}).success,false);
 assert.equal(festivalRegistrationSchema.safeParse({...valid,razorpaySubscriptionId:"sub_123"}).success,false);
});
test("PAN is encrypted with random nonce and masked in administrative views",()=>{
 const old=process.env.SRC_PAN_ENCRYPTION_KEY;
 process.env.SRC_PAN_ENCRYPTION_KEY="a".repeat(64);
 try{
  const first=encryptedPan(valid.pan,"SRC-2027-123"),second=encryptedPan(valid.pan,"SRC-2027-123");
  assert.notEqual(first,second);
  assert.equal(first.includes(valid.pan),false);
  assert.equal(first.split(".").length,3);
  assert.equal(panLastFourDigits(valid.pan),"1234");
  assert.equal(maskedPan("1234"),"*****1234*");
 }finally{if(old===undefined)delete process.env.SRC_PAN_ENCRYPTION_KEY;else process.env.SRC_PAN_ENCRYPTION_KEY=old}
});
test("scheme code contains year prefix and unguessable random component",()=>{
 const a=newFestivalCode(2026),b=newFestivalCode(2026);
 assert.match(a,/^SRC-2026-[A-F0-9]{24}$/);assert.notEqual(a,b);
});
