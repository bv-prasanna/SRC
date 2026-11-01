import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
const read=p=>readFileSync(p,"utf8");
const pages=["index.html","admin.html","scheme-admin.html","billing-admin.html","customer.html","agent.html","procurement.html","packing.html","delivery.html","operations.html","reset.html"];
const sharedScripts=["assets/storefront.js","assets/workspaces.js","assets/scheme-admin.js","assets/billing-admin.js","assets/receipt.js"];
for(const s of sharedScripts)execFileSync(process.execPath,["--check",s],{stdio:"pipe"});
for(const page of pages){
 const html=read(page);
 assert(/<meta[^>]+name="viewport"/.test(html),page+": viewport meta missing");
 assert(html.includes("</html>")&&html.includes("</body>"),page+": incomplete HTML");
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size,page+": duplicate IDs");
 assert.equal((html.match(/<form\b/g)||[]).length,(html.match(/<\/form>/g)||[]).length,page+": unclosed forms");
 assert.equal((html.match(/<section\b/g)||[]).length,(html.match(/<\/section>/g)||[]).length,page+": unclosed sections");
 for(const [,resource] of html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/g)){
  if(/^(?:https?:|data:|#)/.test(resource))continue;
  const local=resource.replace(/^\.\//,"").split(/[?#]/)[0];
  if(local&&!(local.startsWith("mailto:")||local.startsWith("tel:")))assert(existsSync(local),page+": asset missing "+local);
 }
 for(const [,link] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
  if(/^(?:https?:|mailto:|tel:|#)/.test(link))continue;
  const local=link.replace(/^\.\//,"").split(/[?#]/)[0];
  if(local)assert(existsSync(local),page+": internal route missing "+local);
 }
 const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
 for(const script of inline){
  // Syntax check without executing arbitrary page code.
  new Function(script);
 }
}
const rolePages=["CUSTOMER","PROCUREMENT","PACKING","DELIVERY","OPERATIONS"];
for(const role of rolePages){
 const page=read(role.toLowerCase()+".html");
 assert(page.includes('data-role="'+role+'"'),"Wrong role page: "+role);
 for(const id of ["loginPanel","workspace","refresh","logout","queue","stats","taskDetailDialog","closeTaskDetails"])assert(page.includes('id="'+id+'"'),role+" page missing "+id);
}
const workspaces=read("assets/workspaces.js");
for(const marker of ['function details(id)','taskDetailDialog','if(note===null)return','downloadInvoice(id)'])assert(workspaces.includes(marker),"Workspace missing "+marker);
const storefront=read("assets/storefront.js");
for(const marker of ['function changeCartQuantity(','function previewCart(','function renderCart(','decodeURIComponent('])assert(storefront.includes(marker),"Storefront missing "+marker);
const billing=read("server/src/billing.ts");
assert(billing.includes("Number(r.product_id)===Number(p.id)")&&billing.includes("productId:Number(p.id)"),"Bigint quote normalization absent");
const ops=read("server/src/workspaces.ts");
assert(ops.includes('["ADMIN","SUPER_ADMIN","OPERATIONS"].includes(user.role)?[]'),"Super Admin workflow query parameters incorrect");
assert(read("admin.html").includes("/api/admin/checkout/orders/"),"Admin order details not wired");
assert(read("reset.html").includes("confirmPassword"),"Password reset confirmation missing");
assert(read("agent.html").includes("assets/auth-pages.css"),"Agent design not updated");
const deploy=read("scripts/build-pages.mjs");
for(const page of pages)assert(deploy.includes('"'+page+'"'),"Cloudflare Pages build excludes "+page);
console.log("SRC page audit passed: 11 routes, responsive viewport, local asset/link integrity, scripts, role controls and critical workflow wiring.");
