(()=>{"use strict";
const $=id=>document.getElementById(id),base=(window.SRC_API_BASE||(["localhost","127.0.0.1"].includes(location.hostname)?"http://localhost:8080":"")).replace(/\/$/,"");
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const inr=p=>"₹"+(Number(p||0)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
let token="",tab="taxes",rules=[],editing=null;
function message(text,bad=false){$("notice").textContent=text;$("notice").className=bad?"error":""}
async function api(path,options={}){
 const r=await fetch(base+path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...(options.headers||{})}});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||"Request failed with status "+r.status);
 return data;
}
$("loginForm").onsubmit=async e=>{
 e.preventDefault();
 try{const d=await api("/api/auth/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});
 if(!["ADMIN","SUPER_ADMIN"].includes(d.user?.role))throw Error("Admin role required");
 token=d.token;$("loginPanel").classList.add("hide");$("workspace").classList.remove("hide");$("logout").classList.remove("hide");e.target.reset();await showTab("taxes")}
 catch(err){message(err.message,true)}
};
$("logout").onclick=async()=>{await api("/api/auth/logout",{method:"POST"}).catch(()=>{});location.reload()};
function shape(){
 const s=$("scope").value;
 $("categoryField").classList.toggle("hide",s!=="CATEGORY");
 $("productField").classList.toggle("hide",!["PRODUCT","ITEM"].includes(s));
}
$("scope").onchange=shape;
function dateInput(d){if(!d)return"";const x=new Date(d);if(Number.isNaN(x.getTime()))return"";return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function utcDate(d){return d?new Date(d).toISOString():undefined}
function clean(){
 editing=null;$("ruleForm").reset();
 $("editorTitle").textContent=tab==="taxes"?"Create a tax rule":tab==="pricing"?"Create a pricing rule":"Create an offer";
 $("saveRule").textContent="Save rule";shape();
}
$("newRule").onclick=clean;$("resetRule").onclick=clean;
const fields={
 taxes:["component","rateBps","taxInclusive","hsnSac"],
 pricing:["adjustmentBps","minQuantity","maxQuantity","reason"],
 offers:["code","kind","value","minSubtotalPaise","maxDiscountPaise","description"]
};
function editRule(i){
 const r=rules[i];if(!r)return;editing=r.id;const f=$("ruleForm").elements;
 const values={name:r.name,sectionSlug:r.section_slug,scope:r.scope,category:r.category,productId:r.product_id,active:String(r.active),validFrom:dateInput(r.valid_from),validUntil:dateInput(r.valid_until),component:r.component,ratePercent:Number(r.rate_bps||0)/100,taxInclusive:String(r.tax_inclusive),hsnSac:r.hsn_sac,adjustmentPercent:Number(r.adjustment_bps||0)/100,minQuantity:r.min_quantity,maxQuantity:r.max_quantity,reason:r.reason,code:r.code,kind:r.kind,discountValue:r.kind==="FIXED"?Number(r.value||0)/100:Number(r.value||0)/100,minSubtotal:Number(r.min_subtotal_paise||0)/100,maxDiscount:r.max_discount_paise?Number(r.max_discount_paise)/100:"",description:r.description};
 for(const [k,v] of Object.entries(values)){const el=f.namedItem(k);if(el&&v!==undefined&&v!==null)el.value=String(v)}
 $("editorTitle").textContent="Edit · "+r.name;$("saveRule").textContent="Update rule";shape();
 window.scrollTo({top:80,behavior:"smooth"});
}
function payload(){
 const f=Object.fromEntries(new FormData($("ruleForm")));
 const p={name:f.name,scope:f.scope,sectionSlug:f.sectionSlug,category:f.scope==="CATEGORY"?f.category:null,productId:["PRODUCT","ITEM"].includes(f.scope)?Number(f.productId):null,
 active:f.active==="true",validUntil:utcDate(f.validUntil)||null};
 if(f.validFrom)p.validFrom=utcDate(f.validFrom);
 if(tab==="taxes")Object.assign(p,{component:f.component,rateBps:Math.round(Number(f.ratePercent)*100),taxInclusive:f.taxInclusive==="true",hsnSac:f.hsnSac||null});
 if(tab==="pricing")Object.assign(p,{adjustmentBps:Math.round(Number(f.adjustmentPercent)*100),minQuantity:Number(f.minQuantity||1),maxQuantity:f.maxQuantity?Number(f.maxQuantity):null,reason:f.reason});
 if(tab==="offers")Object.assign(p,{code:f.code?String(f.code).trim().toUpperCase():null,kind:f.kind,value:Math.round(Number(f.discountValue)*(f.kind==="FIXED"?100:100)),
 minSubtotalPaise:Math.round(Number(f.minSubtotal||0)*100),maxDiscountPaise:f.maxDiscount?Math.round(Number(f.maxDiscount)*100):null,description:f.description||""});
 return p;
}
$("ruleForm").onsubmit=async e=>{
 e.preventDefault();
 try{
  const rule=payload();
  if(["PRODUCT","ITEM"].includes(rule.scope)&&(!Number.isSafeInteger(rule.productId)||rule.productId<1))throw Error("Select a valid product ID");
  const path="/api/admin/billing/"+tab+(editing?"/"+editing:"");
  await api(path,{method:editing?"PUT":"POST",body:JSON.stringify(rule)});
  message(editing?"Rule updated and audited.":"Rule created successfully.");clean();await loadRules();
 }catch(err){message(err.message,true)}
};
async function deactivate(i){
 const r=rules[i];if(!r||!confirm("Deactivate "+r.name+"? This retains historical quote snapshots."))return;
 try{await api("/api/admin/billing/"+tab+"/"+r.id,{method:"DELETE"});await loadRules();message("Rule deactivated; history preserved")}
 catch(e){message(e.message,true)}
}
function renderRules(){
 const q=$("ruleSearch").value.toLowerCase(),st=$("ruleStatus").value;
 const shown=rules.map((r,i)=>({...r,i})).filter(r=>(!q||(r.name+" "+r.scope+" "+(r.category||"")+" "+(r.code||"")).toLowerCase().includes(q))&&(!st||(st==="active"===r.active)));
 $("ruleList").innerHTML=shown.length?shown.map(r=>{
 const value=tab==="taxes"?r.component+" · "+(r.rate_bps/100).toFixed(2)+"%":tab==="pricing"?(r.adjustment_bps>=0?"+":"")+(r.adjustment_bps/100).toFixed(2)+"%":r.kind==="PERCENT"?(r.value/100).toFixed(2)+"% off":inr(r.value)+" off";
 return '<article class="rule '+(r.active?"active":"")+'"><div class="line"><span class="tag '+(r.active?"":"off")+'">'+(r.active?"Active":"Inactive")+'</span><small>#'+r.id+' · '+esc(r.scope)+'</small></div><h3>'+esc(r.name)+'</h3><div class="line"><b>'+esc(value)+'</b><small>'+esc(r.section_slug)+'</small></div>'+(r.code?'<small>Coupon: '+esc(r.code)+'</small>':'')+'<div class="actions"><button class="quiet" onclick="SRCB.edit('+r.i+')">Edit</button>'+(r.active?'<button class="quiet" onclick="SRCB.disable('+r.i+')">Deactivate</button>':'')+'</div></article>'
 }).join(""):'<p class="help">No rules found. Create a rule to get started.</p>';
 $("kpis").innerHTML=[["Total "+tab,rules.length],["Active",rules.filter(r=>r.active).length],["Inactive",rules.filter(r=>!r.active).length],["Checkout status","OFF"]].map(x=>'<article class="metric"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></article>').join("");
}
$("ruleSearch").oninput=renderRules;$("ruleStatus").onchange=renderRules;
async function loadRules(){
 try{rules=await api("/api/admin/billing/"+tab);renderRules()}catch(e){message(e.message,true)}
}
async function showTab(name){
 tab=name;$("tabs").querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 $("rulesPanel").classList.toggle("hide",!["taxes","pricing","offers"].includes(name));
 $("merchantPanel").classList.toggle("hide",name!=="merchant");$("auditPanel").classList.toggle("hide",name!=="audit");
 if(["taxes","pricing","offers"].includes(name)){
  $("taxInputs").classList.toggle("hide",name!=="taxes");
  $("pricingInputs").classList.toggle("hide",name!=="pricing");
  $("offerInputs").classList.toggle("hide",name!=="offers");
  $("listTitle").textContent=name==="taxes"?"Tax rules":name==="pricing"?"Dynamic price adjustments":"Offers and coupons";
  $("formEyebrow").textContent=name==="taxes"?"Tax master":name==="pricing"?"Price master":"Promotion master";
  clean();await loadRules()
 }else if(name==="merchant")await loadMerchant();
 else if(name==="audit")await loadAudit();
}
$("tabs").querySelectorAll("button").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$("refreshRules").onclick=loadRules;
async function loadMerchant(){
 try{const v=await api("/api/admin/billing/merchant"),f=$("merchantForm").elements;for(const [k,value] of Object.entries({sellerName:v.seller_name,sellerGstin:v.seller_gstin||"",sellerStateCode:v.seller_state_code||"",invoicePrefix:v.invoice_prefix,emailInvoices:String(v.email_invoices)})){const el=f.namedItem(k);if(el)el.value=String(value??"")}}
 catch(e){message(e.message,true)}
}
$("merchantForm").onsubmit=async e=>{
 e.preventDefault();try{const f=Object.fromEntries(new FormData(e.target));await api("/api/admin/billing/merchant",{method:"PUT",body:JSON.stringify({sellerName:f.sellerName,sellerGstin:f.sellerGstin||null,sellerStateCode:f.sellerStateCode||null,invoicePrefix:f.invoicePrefix,emailInvoices:f.emailInvoices==="true"})});message("Merchant settings saved and audited")}
 catch(err){message(err.message,true)}
};
async function loadAudit(){
 try{const rows=await api("/api/admin/billing/audit");$("auditList").innerHTML='<table class="audit-table"><thead><tr><th>Timestamp</th><th>Module</th><th>Action</th><th>Rule</th><th>Actor</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(new Date(r.created_at).toLocaleString("en-IN"))+'</td><td>'+esc(r.entity)+'</td><td>'+esc(r.action)+'</td><td>'+esc(r.entity_id)+'</td><td>'+esc(r.actor_id)+'</td></tr>').join("")+'</tbody></table>'}catch(e){message(e.message,true)}
}
$("quoteForm").onsubmit=async e=>{
 e.preventDefault();
 try{
  const f=Object.fromEntries(new FormData(e.target));
  const payload={sectionSlug:f.sectionSlug,items:[{productId:Number(f.productId),quantity:Number(f.quantity)}],...(f.couponCode?{couponCode:String(f.couponCode).trim().toUpperCase()}:{})};
  const q=await api("/api/billing/quote",{method:"POST",body:JSON.stringify(payload)});
  const line=q.lines[0];
  const parts=[["Base catalogue total",line.baseUnitPaise*line.quantity],["Dynamic adjustment",q.dynamicAdjustmentPaise],["Offer / coupon discount",-q.discountPaise],["Calculated tax",q.taxPaise]];
  $("quoteResult").innerHTML='<h3>'+esc(line.name)+'</h3>'+parts.map(r=>'<div class="quote-row"><span>'+esc(r[0])+'</span><b>'+inr(r[1])+'</b></div>').join("")+
    line.taxes.map(t=>'<div class="quote-row"><span>'+esc(t.component)+' ('+(t.rateBps/100).toFixed(2)+'%)</span><b>'+inr(t.amountPaise)+'</b></div>').join("")+
    '<div class="quote-total">Total: '+inr(q.totalPaise)+'</div><p class="help">'+esc(line.dynamicReason||"No dynamic price rule")+' · Quote only. No payment performed.</p>';
 }catch(err){$("quoteResult").textContent=err.message}
};
window.SRCB={edit:editRule,disable:deactivate};shape();
})();