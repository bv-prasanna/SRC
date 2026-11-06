import test from "node:test";
import assert from "node:assert/strict";
import {normalizeStaffScopes} from "./staff-access.js";
test("allow scheme and specifically assigned sections",()=>assert.deepEqual(normalizeStaffScopes(["scheme","section:stationery","section:stationery"],["stationery","housekeeping"]),["scheme","section:stationery"]));
test("reject unknown/inactive sections",()=>assert.equal(normalizeStaffScopes(["section:inactive"],["housekeeping"]),null));
test("reject admin wildcard, malformed scope and privilege injection",()=>{for(const scope of ["all","ADMIN","section:scheme","section:../secrets","section:","section:crackers;DROP TABLE app_users"])assert.equal(normalizeStaffScopes([scope],["crackers"]),null)});
test("empty grant list revokes all scopes",()=>assert.deepEqual(normalizeStaffScopes([],["stationery"]),[]));
test("scope is exact per section; no cross-department privileges",()=>assert.equal(normalizeStaffScopes(["section:stationery"],["housekeeping"]),null));
