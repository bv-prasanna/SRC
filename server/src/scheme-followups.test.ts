import test from "node:test";
import assert from "node:assert/strict";
import {followupMessage,followupReason} from "./scheme-followups.js";

test("registered member without a subscription can be followed up",()=>{
 assert.equal(followupReason(null),"AWAITING_SETUP");
});
test("incomplete or failed mandates are visible to Scheme Manager",()=>{
 for(const state of ["INITIATING","CREATED","AUTHENTICATED"])assert.equal(followupReason(state),"MANDATE_PENDING");
 for(const state of ["FAILED","HALTED"])assert.equal(followupReason(state),"MANDATE_FAILED");
});
test("already active or completed mandates are not chased",()=>{
 for(const state of ["ACTIVE","COMPLETED","CANCELLED"])assert.equal(followupReason(state),null);
});
test("email messages do not request or imply approved payment collection",()=>{
 for(const reason of ["AWAITING_SETUP","MANDATE_PENDING","MANDATE_FAILED"] as const){
  const msg=followupMessage("UAT Member","SRC Demo",reason);
  assert.match(msg.text,/registration is safely recorded/i);
  assert.match(msg.text,/Do not share your UPI PIN/i);
  assert.match(msg.text,/necessary approvals/i);
  assert.doesNotMatch(msg.text,/pay now|click to pay|approved for collection/i);
 }
});
