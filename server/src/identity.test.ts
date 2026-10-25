import test from "node:test";
import assert from "node:assert/strict";
import {hashPassword,verifyPassword} from "./identity.js";
test("password hashing uses random salt and verifies",async()=>{const a=await hashPassword("A really long password!");const b=await hashPassword("A really long password!");assert.notEqual(a,b);assert.equal(await verifyPassword("A really long password!",a),true);assert.equal(await verifyPassword("incorrect",a),false)});
