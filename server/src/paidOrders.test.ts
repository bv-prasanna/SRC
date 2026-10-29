import test from "node:test";
import assert from "node:assert/strict";
import {canAdvanceOrder} from "./paidOrders.js";
test("paid order enters packing",()=>assert.equal(canAdvanceOrder("PAID","PACKING"),true));
test("dispatch follows packing",()=>assert.equal(canAdvanceOrder("PACKING","DISPATCHED"),true));
test("delivery follows dispatch",()=>assert.equal(canAdvanceOrder("DISPATCHED","DELIVERED"),true));
test("unpaid orders cannot ship",()=>assert.equal(canAdvanceOrder("PENDING_PAYMENT","DISPATCHED"),false));
test("no arbitrary skipping",()=>assert.equal(canAdvanceOrder("PAID","DELIVERED"),false));
