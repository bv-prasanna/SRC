import test from "node:test";
import assert from "node:assert/strict";
import { catalogueSchema } from "./app.js";
test("catalogue accepts valid product",()=>{assert.equal(catalogueSchema.safeParse({name:"Sparklers",category:"Festive"}).success,true)});
test("catalogue rejects blank product names",()=>{assert.equal(catalogueSchema.safeParse({name:"",category:"Festive"}).success,false)});
test("catalogue rejects insecure media URLs",()=>{assert.equal(catalogueSchema.safeParse({name:"Sparklers",category:"Festive",imageUrl:"http://example.org/a.png"}).success,false)});
