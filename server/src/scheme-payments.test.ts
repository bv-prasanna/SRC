import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {schemeTestPaymentsEnabled,makeSchemePaymentProof,verifySchemePaymentProof,verifySchemeCheckoutSignature,verifySchemeWebhook,schemePaymentStart} from "./scheme-payments.js";
const code="SRC-2027-ABCDEF123456ABCDEF123456";
const keys=["SRC_JWT_SECRET","RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","RAZORPAY_WEBHOOK_SECRET","SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED"] as const;
function withGateway(fn:()=>void){
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  process.env.SRC_JWT_SECRET="test-secret-"+"x".repeat(70);
  process.env.RAZORPAY_KEY_ID="rzp_test_unit";
  process.env.RAZORPAY_KEY_SECRET="test_only_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET="test_webhook";
  process.env.SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED="true";
  fn();
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}}
}
test("test gateway is opt-in, never enabled by keys alone",()=>withGateway(()=>{
 assert.equal(schemeTestPaymentsEnabled(),true);
 process.env.SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED="false";
 assert.equal(schemeTestPaymentsEnabled(),false);
 assert.equal(makeSchemePaymentProof(code),null);
 process.env.SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED="true";
 process.env.RAZORPAY_KEY_ID="rzp_live_do_not_use";
 assert.equal(schemeTestPaymentsEnabled(),false);
}));
test("scheme checkout proof binds membership and expires",()=>withGateway(()=>{
 const proof=makeSchemePaymentProof(code)!;
 assert.equal(verifySchemePaymentProof(code,proof),true);
 assert.equal(verifySchemePaymentProof("SRC-2027-FFFFFFFFFFFFFFFFFFFFFFFF",proof),false);
 assert.equal(verifySchemePaymentProof(code,"0."+proof.split(".")[1]),false);
 assert.equal(verifySchemePaymentProof(code,proof.slice(0,-1)+"0"),false);
}));
test("checkout HMAC cannot be forged or applied to another subscription",()=>withGateway(()=>{
 const id="pay_123456",sub="sub_123456";
 const sig=createHmac("sha256",process.env.RAZORPAY_KEY_SECRET!).update(id+"|"+sub).digest("hex");
 assert.equal(verifySchemeCheckoutSignature(id,sub,sig),true);
 assert.equal(verifySchemeCheckoutSignature(id,"sub_other",sig),false);
 assert.equal(verifySchemeCheckoutSignature(id,sub,"f".repeat(64)),false);
}));
test("webhook HMAC verifies exact raw bytes",()=>withGateway(()=>{
 const raw=Buffer.from('{"event":"subscription.charged"}');
 const sig=createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest("hex");
 assert.equal(verifySchemeWebhook(raw,sig),true);
 assert.equal(verifySchemeWebhook(Buffer.from('{"event":"subscription.cancelled"}'),sig),false);
 assert.equal(verifySchemeWebhook(raw,"not-a-signature"),false);
}));
test("payment start rejects forged additional amounts",()=>{
 const valid={membershipCode:code,paymentProof:"proof"};
 assert.equal(schemePaymentStart.safeParse(valid).success,true);
 assert.equal(schemePaymentStart.safeParse({...valid,amountPaise:100}).success,false);
 assert.equal(schemePaymentStart.safeParse({...valid,planId:4}).success,false);
});
