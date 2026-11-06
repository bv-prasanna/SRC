import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
const read=f=>readFileSync(f,"utf8");
for(const page of ["admin.html","scheme-admin.html","billing-admin.html","section-manager.html"]){
 const html=read(page);assert(html.includes("assets/operations-premium.css")&&html.includes('class="src-office"'),page+" not styled in new office theme");
 assert(html.includes("index.html#recover"),page+" missing password recovery");
}
for(const asset of ["assets/section-manager.css","assets/section-manager.js","assets/operations-premium.css","assets/everyday-premium.css","server/sql/020_scoped_staff_permissions.sql","server/src/staff-access.ts","server/src/staff-access.test.ts"])assert(existsSync(asset),"Missing "+asset);
assert(read("admin.html").includes("updateStaffScopes")&&read("admin.html").includes("user_staff_scopes")===false,"Admin user grants are not wired properly");
assert(read("admin.html").includes('/api/admin/users/')&&read("admin.html").includes('/scopes'),"Missing scoped permissions admin API");
assert(read("assets/scheme-admin.js").includes('access.scopes.includes("scheme")'),"Scheme Manager role grant check absent");
assert(read("server/src/scheme-management.ts").includes('scopedAccess(db,"scheme")'),"Scheme endpoints are not staff scoped");
assert(read("server/src/app.ts").includes("staffAccessRouter(pool as Pool)"),"Scoped auth routes not mounted");
assert(read("server/sql/020_scoped_staff_permissions.sql").includes("user_staff_scope_audit"),"Scope grants not audited");
assert(read("server/src/staff-access.ts").includes('section_slug=$9'),"Product update must be scoped to section");
assert(read("server/src/staff-access.ts").includes('scope=$2'),"Server must check exact staff grant");
assert(read("server/src/recovery.ts").includes('30 minutes')&&read("server/src/recovery.ts").includes("DELETE FROM user_sessions"),"Email reset needs expiry and session revocation");
const store=read("assets/storefront.js"),home=read("index.html");
for(const id of ["everydayCollection","everydayHighlights","everydayCategories","everydayPromos"])assert(home.includes('id="'+id+'"'),"Missing non-festive section UI "+id);
assert(store.includes("renderEverydayCollections(slug)")&&store.includes('button.dataset.category;renderProducts()'),"Category tiles must filter existing catalogue");
assert(store.includes('["housekeeping","stationery"].includes(slug)'),"Non-festive premium view must not affect Crackers");
assert(read("assets/everyday-premium.css").includes('@media(max-width:540px)'),"Mobile layout missing");
assert(read("scripts/build-pages.mjs").includes('"section-manager.html"'),"Missing staff app deployment route");
execFileSync(process.execPath,["--check","assets/storefront.js"],{stdio:"inherit"});
execFileSync(process.execPath,["--check","assets/section-manager.js"],{stdio:"inherit"});
console.log("SRC office, staff RBAC and everyday retail audit: PASS.");
