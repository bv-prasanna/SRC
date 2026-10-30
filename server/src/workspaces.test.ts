import test from "node:test";
import assert from "node:assert/strict";
import {mayAccessTask,nextTask,canUpdateTask} from "./workspaces.js";
test("procurement can see only its own assignment",()=>{
 assert.equal(mayAccessTask("PROCUREMENT","PROCUREMENT",7,7),true);
 assert.equal(mayAccessTask("PROCUREMENT","PROCUREMENT",8,7),false);
 assert.equal(mayAccessTask("DELIVERY","PROCUREMENT",7,7),false);
});
test("packing and delivery are segregated",()=>{
 assert.equal(mayAccessTask("PACKING","PACKING",2,2),true);
 assert.equal(mayAccessTask("PACKING","DELIVERY",2,2),false);
 assert.equal(mayAccessTask("DELIVERY","DELIVERY",3,3),true);
});
test("operations/admin may manage tasks; customers cannot",()=>{
 assert.equal(mayAccessTask("OPERATIONS","PROCUREMENT",null,4),true);
 assert.equal(mayAccessTask("ADMIN","DELIVERY",null,4),true);
 assert.equal(mayAccessTask("CUSTOMER","PACKING",4,4),false);
});
test("workflow transitions in expected order",()=>{
 assert.equal(nextTask("PROCUREMENT"),"PACKING");
 assert.equal(nextTask("PACKING"),"DELIVERY");
 assert.equal(nextTask("DELIVERY"),null);
});
test("task transitions reject reopen or skipping",()=>{
 assert.equal(canUpdateTask("PENDING","IN_PROGRESS"),true);
 assert.equal(canUpdateTask("IN_PROGRESS","COMPLETED"),true);
 assert.equal(canUpdateTask("PENDING","COMPLETED"),true);
 assert.equal(canUpdateTask("COMPLETED","PENDING"),false);
 assert.equal(canUpdateTask("COMPLETED","IN_PROGRESS"),false);
});
