(()=>{"use strict";
const $=id=>document.getElementById(id);
const base=(window.SRC_API_BASE||(["localhost","127.0.0.1"].includes(location.hostname)&&location.port==="8000"?"http://localhost:8080":"")).replace(/\/$/,"");
function friendlyError(err){if(err?.name==="AbortError")return "The request timed out. Please try again.";if(err instanceof TypeError)return "Cannot connect to SRC right now. Check your connection and try again.";return err?.message||"Unable to complete the request. Please try again."}
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let token="",sections=[],section="",rows=[],editing=null;
function notice(msg,bad=false){$("feedback").textContent=msg;$("feedback").className=bad?"error":"ok"}
async function api(path,options={}){
 const r=await fetch(base+path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...(options.headers||{})}});
 const data=r.status===204?{}:await r.json().catch(()=>({}));
 if(!r.ok){if(r.status===401&&token){token="";$("workspace").classList.add("hidden");$("loginPanel").classList.remove("hidden")}throw Error(r.status===429?"Too many requests. Please try later.":r.status>=500?"SRC service is temporarily unavailable. Please try again.":data.error||"Request could not be completed.")}
 return data;
}
function reset(){editing=null;$("productForm").reset();$("formHeading").textContent="Add a product";$("priceRupees").value="0";$("saveProduct").textContent="Save product";}
function productPayload(){
 const data=Object.fromEntries(new FormData($("productForm")));
 const price=Number(data.priceRupees);
 return {name:String(data.name||"").trim(),category:String(data.category||"").trim(),description:String(data.description||"").trim(),imageUrl:data.imageUrl||null,demoVideoUrl:data.demoVideoUrl||null,pricePaise:Math.round(price*100),published:data.published==="on"};
}
function render(){const q=$("productSearch").value.trim().toLowerCase(),visible=rows.filter(p=>(p.name+" "+p.category).toLowerCase().includes(q));
 $("productList").innerHTML=visible.length?visible.map(p=>'<article class="staff-product"><div><small>'+esc(p.category)+' · '+(p.published?"Published":"Draft")+'</small><h3>'+esc(p.name)+'</h3><p>'+esc((p.description||"").slice(0,130))+'</p><strong>'+(section==="crackers"?"Information only":"₹"+(Number(p.pricePaise||0)/100).toLocaleString("en-IN"))+'</strong></div><div class="actions"><button class="subtle" type="button" data-edit="'+Number(p.id)+'">Edit</button><button class="subtle" type="button" data-unpublish="'+Number(p.id)+'" '+(!p.published?"disabled":"")+'>Unpublish</button></div></article>').join(""):'<p class="muted">No products match this section or search. Add a product to get started.</p>';
}
async function loadProducts(){if(!section)return;try{rows=await api("/api/staff/sections/"+encodeURIComponent(section)+"/products");render()}catch(e){notice(friendlyError(e),true)}}
function switchSection(slug){
 if(!sections.some(x=>x.slug===slug))return;section=slug;editing=null;reset();
 $("accessLabel").textContent=sections.find(x=>x.slug===slug)?.name||slug;
 $("sectionTabs").innerHTML=sections.map(x=>'<button type="button" class="'+(x.slug===slug?"active":"")+'" data-section="'+esc(x.slug)+'">'+esc(x.name)+'</button>').join("");
 const crackers=slug==="crackers";$("crackerRestriction").classList.toggle("hidden",!crackers);$("priceRupees").disabled=crackers;$("priceRupees").value="0";$("productSearch").value="";loadProducts();
}
$("loginForm").onsubmit=async e=>{
 e.preventDefault();const f=e.currentTarget;let auth="";
 try{
  const d=Object.fromEntries(new FormData(f));const response=await api("/api/auth/login",{method:"POST",body:JSON.stringify(d)});
  auth=response.token;token=auth;
  const access=await api("/api/staff/scopes");sections=access.sections.filter(x=>access.isAdmin||access.scopes.includes("section:"+x.slug));
  if(!sections.length){token="";throw Error("No store section assigned. Ask SRC Super Admin to grant section access.")}
  f.reset();$("loginPanel").classList.add("hidden");$("workspace").classList.remove("hidden");$("logout").classList.remove("hidden");switchSection(sections[0].slug);notice("Signed in — assigned sections only");
 }catch(err){token="";notice(err.message||"Sign in unavailable",true)}
};
$("logout").onclick=async()=>{await api("/api/auth/logout",{method:"POST"}).catch(()=>{});token="";location.reload()};
$("sectionTabs").onclick=e=>{const b=e.target.closest("button[data-section]");if(b)switchSection(b.dataset.section)};
$("newRecord").onclick=reset;$("cancelEdit").onclick=reset;$("refresh").onclick=loadProducts;$("productSearch").oninput=render;
$("productList").onclick=async e=>{
 const edit=e.target.closest("button[data-edit]"),del=e.target.closest("button[data-unpublish]");
 if(edit){
  const p=rows.find(x=>Number(x.id)===Number(edit.dataset.edit));if(!p)return;
  editing=p.id;const form=$("productForm").elements;
  for(const key of ["name","category","description","imageUrl","demoVideoUrl"])form.namedItem(key).value=p[key]||"";
  form.namedItem("priceRupees").value=section==="crackers"?"0":(Number(p.pricePaise||0)/100).toFixed(2);
  form.namedItem("published").checked=!!p.published;$("formHeading").textContent="Edit "+p.name;$("saveProduct").textContent="Update product";$("productForm").scrollIntoView({behavior:"smooth"});return;
 }
 if(del&&confirm("Unpublish this item from the selected section?")){
  try{await api("/api/staff/sections/"+encodeURIComponent(section)+"/products/"+Number(del.dataset.unpublish)+"/unpublish",{method:"PATCH"});notice("Product unpublished");await loadProducts()}catch(err){notice(friendlyError(err),true)}
 }
};
$("productForm").onsubmit=async e=>{
 e.preventDefault();if(!e.target.reportValidity())return;
 const payload=productPayload();if(section==="crackers")payload.pricePaise=0;
 $("saveProduct").disabled=true;
 try{
  const url="/api/staff/sections/"+encodeURIComponent(section)+"/products"+(editing?"/"+Number(editing):"");
  await api(url,{method:editing?"PUT":"POST",body:JSON.stringify(payload)});
  notice(editing?"Product updated":"Product created");reset();await loadProducts();
 }catch(err){notice(friendlyError(err),true)}finally{$("saveProduct").disabled=false}
};
})();