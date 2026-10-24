import test from "node:test";
import assert from "node:assert/strict";
import {schemeDraftSchema} from "./schemes.js";
test("internal draft accepts monthly crackers planning",()=>assert.equal(schemeDraftSchema.safeParse({name:"Future Diwali plan",sectionSlug:"crackers",durationMonths:10,frequency:"MONTHLY",amountPaise:100000}).success,true));
test("rejects unsupported frequency",()=>assert.equal(schemeDraftSchema.safeParse({name:"Draft",sectionSlug:"crackers",durationMonths:10,frequency:"DAILY",amountPaise:100000}).success,false));
test("rejects negative contribution",()=>assert.equal(schemeDraftSchema.safeParse({name:"Draft",sectionSlug:"crackers",durationMonths:10,frequency:"MONTHLY",amountPaise:-1}).success,false));
