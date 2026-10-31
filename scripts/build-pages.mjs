// Publish an explicit allowlist to Cloudflare Pages. Never expose server sources, SQL or .env.
import {existsSync,mkdirSync,rmSync,copyFileSync,cpSync,readFileSync} from "node:fs";
import {join,resolve} from "node:path";
const root=resolve(import.meta.dirname,".."),out=join(root,".pages-dist");
const html=["index.html","admin.html","scheme-admin.html","agent.html","customer.html","procurement.html","packing.html","delivery.html","operations.html","reset.html"];
const files=[...html,"config.js","src-cart.js","_headers"];
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const f of files){const from=join(root,f);if(!existsSync(from))throw Error("Required Pages asset missing: "+f);copyFileSync(from,join(out,f))}
cpSync(join(root,"assets"),join(out,"assets"),{recursive:true,filter:p=>!/(?:^|[\\/])(?:\.env|node_modules|\.git)(?:[\\/]|$)/.test(p)});
const config=readFileSync(join(out,"config.js"),"utf8");
if(!config.includes("api.srcenterprises.in"))throw Error("Production API hostname not configured");
for(const h of html){const src=readFileSync(join(out,h),"utf8");if(!src.includes("</html>"))throw Error("Invalid published HTML: "+h)}
console.log("Cloudflare Pages output:",out);
console.log("Only approved web assets were copied; backend/database files excluded.");
