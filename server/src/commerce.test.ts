import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {checkoutSchema,validHmac,validPaymentSignature} from "./commerce.js";
const basic={sectionSlug:"stationery",address:"123 Example Road Bengaluru Karnataka 560040",warehouseCode:"MAIN",idempotencyKey:"d0cba8e1-d857-4a4a-9367-accc8464fd93",items:[{productId:5,quantity:2}]};
test("standard-goods checkout schema validates",()=>assert.equal(checkoutSchema.safeParse(basic).success,true));
test("fireworks cannot enter checkout",()=>assert.equal(checkoutSchema.safeParse({...basic,sectionSlug:"crackers"}).success,false));
test("invalid negative quantities rejected",()=>assert.equal(checkoutSchema.safeParse({...basic,items:[{productId:5,quantity:-1}]}).success,false));
test("requires long shipping address",()=>assert.equal(checkoutSchema.safeParse({...basic,address:"short"}).success,false));
test("idempotency key must be UUID",()=>assert.equal(checkoutSchema.safeParse({...basic,idempotencyKey:"bad"}).success,false));
test("payment HMAC matches provider signature",()=>{
 const sig=createHmac("sha256","server-only-secret").update("order_123|pay_123").digest("hex");
 assert.equal(validPaymentSignature("order_123","pay_123",sig,"server-only-secret"),true);
 assert.equal(validPaymentSignature("order_123","pay_wrong",sig,"server-only-secret"),false);
 assert.equal(validPaymentSignature("order_123","pay_123","not-signature","server-only-secret"),false);
});
test("webhook HMAC uses original bytes and rejects tampering",()=>{
 const raw='{"event":"payment.captured","payload":{"x":"é"}}';
 const sig=createHmac("sha256","webhook-secret").update(raw).digest("hex");
 assert.equal(validHmac(raw,sig,"webhook-secret"),true);
 assert.equal(validHmac(raw+" ",sig,"webhook-secret"),false);
 assert.equal(validHmac(raw,sig,""),false);
});
