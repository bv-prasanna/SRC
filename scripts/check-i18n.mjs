import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const pages=["index.html","admin.html","scheme-admin.html","billing-admin.html","customer.html","agent.html","procurement.html","packing.html","delivery.html","operations.html","reset.html"];
for(const file of pages){
 const html=readFileSync(file,"utf8");
 assert(html.includes('assets/site-i18n.css'),file+": language styles missing");
 assert(html.includes('assets/site-i18n.js'),file+": language behavior missing");
 assert(html.indexOf('assets/site-i18n.js')<html.indexOf('</body>'),file+": language script outside body");
}
const registration=readFileSync("assets/scheme-register.js","utf8");
assert(registration.includes('src_site_language'),"Scheme registration must share language preference");
const js=readFileSync("assets/site-i18n.js","utf8");
for(const expected of ["src_site_language","data-src-language","English","ಕನ್ನಡ","MutationObserver","characterData","placeholder","aria-label","originalText","originalAttrs","document.documentElement.lang","src:languagechange"])assert(js.includes(expected),"Missing translation behavior "+expected);
for(const translation of ["Admin dashboard","Scheme Management","Full name","Tax rules","My Purchases","Operations Dashboard","Sign in","Password reset","Cart","Join Deepavali Scheme"])assert(js.includes('"'+translation+'":'),"Missing cross-app term "+translation);
assert(readFileSync("assets/site-i18n.css","utf8").includes("#srcLanguageSwitcher"),"Language selector styles missing");
execFileSync(process.execPath,["--check","assets/site-i18n.js"],{stdio:"inherit"});
console.log("SRC sitewide i18n audit: PASS — 11 shared pages, scheme language persistence, dynamic UI translation and bilingual switch");
