import test from "node:test";
import assert from "node:assert/strict";
import {canTransition,transitionSchema} from "./fulfillment.js";
test("enquiry may be confirmed",()=>assert.equal(canTransition("ENQUIRY","CONFIRMED"),true));
test("cannot skip to delivered",()=>assert.equal(canTransition("ENQUIRY","DELIVERED"),false));
test("cancelled orders cannot reopen",()=>assert.equal(canTransition("CANCELLED","CONFIRMED"),false));
test("invalid statuses rejected",()=>assert.equal(transitionSchema.safeParse({status:"PAID"}).success,false));
