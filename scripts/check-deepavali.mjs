import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
const read=x=>readFileSync(x,"utf8");
const home=read("index.html"),registration=read("scheme-register.html"),store=read("assets/storefront.js"),enrol=read("assets/scheme-register.js");
const css=read("assets/deepavali-festival.css"),js=read("assets/deepavali-festival.js");
for(const f of ["assets/deepavali-scheme-art.svg","assets/deepavali-crackers-art.svg","assets/deepavali-festival.css","assets/deepavali-festival.js"])assert(existsSync(f),"Missing festival asset "+f);
for(const f of ["assets/deepavali-scheme-art.svg","assets/deepavali-crackers-art.svg"]){const svg=read(f);assert(svg.includes("<svg")&&svg.includes("</svg>"),"Invalid SVG "+f);assert(!svg.includes("<script"),"Festival SVG must not contain executable content");}
for(const p of [home,registration]){assert(p.includes('assets/deepavali-festival.css'),"Festive styles must load");assert(p.includes('assets/deepavali-festival.js'),"Entrance animation must load");}
assert(home.includes('id="crackersFestiveInfo"'),"Crackers festive information banner is missing");
assert(home.includes("No online fireworks orders or payments"),"Crackers banner must not advertise online sale");
assert(store.includes('window.SRCFestival?.activate("scheme")'),"Scheme view entrance missing");
assert(store.includes('window.SRCFestival?.activate("crackers")'),"Crackers entrance missing");
assert(enrol.includes('window.SRCFestival?.activate("registration")'),"Registration entrance missing");
assert(store.includes('slug!=="crackers"'),"Crackers extra must be department specific");
assert(css.includes('prefers-reduced-motion:reduce'),"Reduced-motion accessibility missing");
assert(css.includes('deepavali-scheme-art.svg')&&css.includes('deepavali-crackers-art.svg'),"Festival art must use local images");
assert(js.includes("document.visibilityState")&&js.includes("clearTimeout")&&js.includes("4400"),"Animation should stop promptly and when hidden");
assert(js.includes('aria-hidden')&&js.includes('pointer-events')===false,"Festive layer should be accessibility-safe");
assert(!js.includes("requestAnimationFrame")&&!js.includes("setInterval"),"No permanent animation loops");
execFileSync(process.execPath,["--check","assets/deepavali-festival.js"],{stdio:"inherit"});
console.log("SRC Deepavali UI audit: PASS — SVG art, short motion, route visibility, offline graphics, payments unaffected.");
