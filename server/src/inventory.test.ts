import test from "node:test";
import assert from "node:assert/strict";
import {stockSchema,movementSchema} from "./inventory.js";
test("valid warehouse record",()=>assert.equal(stockSchema.safeParse({productId:1,warehouseCode:"BLR-01"}).success,true));
test("cannot use negative reorder levels",()=>assert.equal(stockSchema.safeParse({productId:1,warehouseCode:"BLR-01",reorderLevel:-1}).success,false));
test("movement requires nonzero delta and reason",()=>assert.equal(movementSchema.safeParse({productId:1,warehouseCode:"BLR-01",delta:0,reason:"sale"}).success,false));
test("negative movement allowed for inventory decrement",()=>assert.equal(movementSchema.safeParse({productId:1,warehouseCode:"BLR-01",delta:-2,reason:"in-store sale"}).success,true));
