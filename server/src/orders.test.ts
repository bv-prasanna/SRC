import test from "node:test";
import assert from "node:assert/strict";
import {enquirySchema} from "./orders.js";
const valid={customerName:"Demo User",email:"demo@example.org",phone:"9876543210",sectionSlug:"stationery",lines:[{productId:1,quantity:2}]};
test("stationery enquiry is valid",()=>assert.equal(enquirySchema.safeParse(valid).success,true));
test("housekeeping enquiry is valid",()=>assert.equal(enquirySchema.safeParse({...valid,sectionSlug:"housekeeping"}).success,true));
test("fireworks enquiry is blocked",()=>assert.equal(enquirySchema.safeParse({...valid,sectionSlug:"crackers"}).success,false));
test("invalid quantity is rejected",()=>assert.equal(enquirySchema.safeParse({...valid,lines:[{productId:1,quantity:-1}]}).success,false));
test("unknown section is rejected",()=>assert.equal(enquirySchema.safeParse({...valid,sectionSlug:"other"}).success,false));
