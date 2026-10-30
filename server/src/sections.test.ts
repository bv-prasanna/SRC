import test from "node:test";
import assert from "node:assert/strict";
import { canOrderSection,sectionSchema } from "./sections.js";
test("fireworks prohibited from online orders regardless of payment",()=>{assert.equal(canOrderSection("crackers","STANDARD"),false);assert.equal(canOrderSection("crackers","CATALOGUE_ONLY"),false)});
test("housekeeping and stationery may use standard commerce",()=>{assert.equal(canOrderSection("housekeeping","STANDARD"),true);assert.equal(canOrderSection("stationery","STANDARD"),true)});
test("new sections supported",()=>{assert.equal(sectionSchema.safeParse({slug:"office-furniture",name:"Office Furniture",commerceMode:"STANDARD"}).success,true)});
test("reject malformed sections",()=>{assert.equal(sectionSchema.safeParse({slug:"Crackers ",name:"x"}).success,false)});

test('scheme stays out of product checkout',()=>{assert.equal(canOrderSection('scheme','STANDARD'),false);assert.equal(canOrderSection('scheme','CATALOGUE_ONLY'),false)});
