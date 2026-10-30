import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
const read=p=>readFileSync(p,"utf8");
const demo=read("assets/demo-catalog.js").match(/window\.SRC_PREVIEW_PRODUCTS=([\s\S]+);\s*$/);
assert(demo,"Demo catalogue missing");
const products=JSON.parse(demo[1]);
assert.equal(products.length,96,"Expected exactly 96 showcase items");
for(const [section,expected] of [["crackers",24],["housekeeping",36],["stationery",36]]){
 const items=products.filter(p=>p.sectionSlug===section);
 assert.equal(items.length,expected);
 assert(items.every(p=>p.previewOnly===true&&p.pricePaise===0),"Demo must be read-only");
 assert(items.every(p=>p.fireworks===(section==="crackers")),"Incorrect fireworks classification");
}
const sql=read("server/sql/dev_seed_catalogue_v3.sql");
assert.equal((sql.match(/\(DEMO\)'/g)||[]).length,96,"SQL/demo item count mismatch");
const pages=["customer","delivery","procurement","packing","operations"];
for(const name of pages){
 const html=read(name+".html");
 assert(html.includes('data-role="'+name.toUpperCase()+'"'),"Wrong role page "+name);
 assert(html.includes("assets/workspaces.js"),"Missing shared role logic "+name);
}
execFileSync(process.execPath,["--check","assets/workspaces.js"],{stdio:"pipe"});
execFileSync(process.execPath,["--check","assets/storefront.js"],{stdio:"pipe"});
const migration=read("server/sql/011_operational_roles.sql");
for(const role of ["DELIVERY","PROCUREMENT","PACKING","OPERATIONS"])assert(migration.includes("'"+role+"'"),"Missing SQL role "+role);
const router=read("server/src/workspaces.ts");
for(const route of ["/api/admin/dashboard","/api/workspace/tasks","/api/admin/workspace/tasks/:id/assign","/api/workspace/tasks/:id/status"])assert(router.includes(route),"Missing API "+route);
assert(router.includes("section_slug<>'crackers'")||router.includes("section_slug IN ('housekeeping','stationery')"),"Fireworks processing guard missing");
const admin=read("admin.html");
assert(admin.includes("renderDashboard()")&&admin.includes("renderWorkflows()"),"Admin dashboard/workflow missing");
const setup=read("scripts/local-setup.ps1");
assert(setup.includes("npm run migrate")&&setup.includes("dev_seed_catalogue_v3.sql"),"Docker-free setup or 96 seed missing");
console.log("SRC role + 96-product smoke checks passed.");
