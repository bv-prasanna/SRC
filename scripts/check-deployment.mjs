import assert from "node:assert/strict";
import {existsSync,readFileSync,statSync,readdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {join,resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
execFileSync(process.execPath,[join(root,"scripts/build-pages.mjs")],{cwd:root,stdio:"inherit"});
const site=join(root,".pages-dist");
for(const item of ["index.html","admin.html","scheme-admin.html","agent.html","customer.html","assets","config.js","_headers"]){
 assert(existsSync(join(site,item)),"Public deployment missing "+item)
}
for(const item of ["server","backend","docs","scripts",".github","render.yaml",".env",".gitignore"]){
 assert(!existsSync(join(site,item)),"Private or development asset exposed: "+item)
}
assert(statSync(join(site,"assets")).isDirectory());
const c=readFileSync(join(site,"config.js"),"utf8");
assert(c.includes("https://api.srcenterprises.in"),"Production API URL absent");
assert(!c.includes("SRC_JWT_SECRET")&&!c.includes("RAZORPAY_KEY_SECRET"),"Secret name in public config");
const files=readdirSync(site);
console.log("SRC deploy preflight passed: allowed static assets only.",files.join(", "));
