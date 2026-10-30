(()=>{"use strict";
const API=(window.SRC_API_BASE||((location.hostname==="localhost"||location.hostname==="127.0.0.1")&&location.port==="8000"?"http://localhost:8080":"")).replace(/\/$/,"");
const photos={scheme:"https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1200&q=85&fit=crop",crackers:"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=85&fit=crop",housekeeping:"https://images.unsplash.com/photo-1585421514738-01798e348b17?w=1200&q=85&fit=crop",stationery:"https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=1200&q=85&fit=crop"};
const defaults=[{slug:"scheme",name:"Scheme",description:"Deepavali membership registration with a unique SRC reference for in-store verification. No online contributions.",commerceMode:"CATALOGUE_ONLY"},{slug:"stationery",name:"Stationery",description:"School, office and workplace supplies.",commerceMode:"STANDARD"},{slug:"housekeeping",name:"Housekeeping Materials",description:"Hygiene, cleaning and building-maintenance essentials.",commerceMode:"STANDARD"},{slug:"crackers",name:"Crackers",description:"Fireworks catalogue and demonstrations for licensed in-person retail only.",commerceMode:"CATALOGUE_ONLY"}];
const state={sections:defaults,products:[],media:[],promotions:[],schemePlans:[],active:"home",department:"housekeeping",slide:0,slides:[],sectionSlides:[],sectionSlide:0,token:"",user:null,authMode:"login",payment:{enabled:false},cart:[]};
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeURL=x=>{try{const u=new URL(x);return u.protocol==="https:"?u.href:""}catch{return ""}};
const price=n=>Number(n)>0?"₹"+(Number(n)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}):"Price on enquiry";
try{const stored=JSON.parse(sessionStorage.getItem("src_cart")||"[]");if(Array.isArray(stored))state.cart=stored.filter(x=>["housekeeping","stationery"].includes(x.section)&&Number.isSafeInteger(x.productId)&&Number.isSafeInteger(x.quantity)&&x.quantity>=1)}catch{}
function saveCart(){sessionStorage.setItem("src_cart",JSON.stringify(state.cart));$("cartCount").textContent=state.cart.reduce((sum,x)=>sum+x.quantity,0)}
async function request(path,options={}){
 const headers={Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(state.token?{Authorization:"Bearer "+state.token}:{}),...(options.headers||{})};
 const resp=await fetch(API+path,{...options,headers});if(resp.status===204)return {};
 const data=await resp.json().catch(()=>({}));if(!resp.ok)throw Error(data.error||"Request failed: "+resp.status);return data;
}
function badge(name){return name==="scheme"?"Free membership registration":name==="crackers"?"Catalogue only":"Products & enquiries"}
function nav(){
 const current=state.active==="department"?state.department:state.active;
 const deptButtons=state.sections.map(sec=>'<button data-route="'+esc(sec.slug)+'" onclick="SRC.openDepartment(\''+esc(sec.slug)+'\')">'+esc(sec.name)+(sec.slug==="crackers"?' <span class="nav-info">Info</span>':'')+'</button>').join('');
 $("mainNav").innerHTML='<div class="nav-category"><button type="button" aria-expanded="false" onclick="SRC.toggleCategories()">☰ &nbsp; All Categories <span aria-hidden="true">⌄</span></button><div class="nav-category-panel" id="allCategoryMenu">'+state.sections.map(sec=>'<button onclick="SRC.openDepartment(\''+esc(sec.slug)+'\')">'+esc(sec.name)+' <span aria-hidden="true">›</span></button>').join('')+'</div></div><button data-route="home" onclick="SRC.go(\'home\')">Home</button>'+deptButtons+'<button data-route="offers" onclick="SRC.go(\'offers\')">Deals & Offers</button><button onclick="SRC.openDepartment(\'housekeeping\')">Bulk Enquiries</button>';
 $("footerSections").innerHTML=state.sections.map(x=>'<button onclick="SRC.openDepartment(\''+esc(x.slug)+'\')">'+esc(x.name)+'</button>').join("");
 document.querySelectorAll(".nav-inner>button").forEach(b=>b.classList.toggle("active",b.dataset.route===current));
}
function toggleCategories(){
 const menu=$("allCategoryMenu"),button=document.querySelector(".nav-category>button");if(!menu||!button)return;
 const open=menu.classList.toggle("open");button.setAttribute("aria-expanded",String(open));
}
function sectionsCards(){
 $("departmentCards").innerHTML=state.sections.map(s=>{
 const img=photos[s.slug]||"https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1000&q=80&fit=crop";
 return '<article class="department" data-section="'+esc(s.slug)+'"><div class="department-photo"><img loading="lazy" src="'+esc(img)+'" alt="'+esc(s.name)+' collection"></div><div class="department-body"><span class="tag '+(s.slug==="crackers"?"warn":"")+'">'+badge(s.slug)+'</span><h3>'+esc(s.name)+'</h3><p>'+esc(s.description||"Discover SRC products in this department.")+'</p><button class="text-action" onclick="SRC.openDepartment(\''+esc(s.slug)+'\')">Explore department &nbsp; ↗</button></div></article>'
 }).join("")
}
const fallbackSlides=[
 {title:"Everyday essentials<br>for a <span>Brighter Tomorrow.</span>",subtitle:"Housekeeping, stationery, festive moments and more — discover what SRC Enterprises offers.",url:photos.housekeeping,category:"housekeeping"},
 {title:"Everything for<br><span>Bright Ideas.</span>",subtitle:"Stationery and office essentials for schools, businesses and everyday needs.",url:photos.stationery,category:"stationery"},
 {title:"Festival moments,<br><span>beautifully planned.</span>",subtitle:"Explore fireworks catalogue information and demonstrations. Licensed in-person sales only.",url:photos.crackers,category:"crackers"}
];
function hero(){
 const published=state.media.filter(x=>x.type==="HERO"&&(!x.category||["home","Home"].includes(x.category))&&safeURL(x.url));
 state.slides=published.length?published.map(x=>({title:esc(x.title),subtitle:esc(x.subtitle||""),url:safeURL(x.url),category:state.sections.some(s=>s.slug===x.category)?x.category:"housekeeping"})):fallbackSlides;
 const label='SRC ENTERPRISES · BENGALURU';
 $("heroStage").innerHTML=state.slides.map((s,i)=>{
 const url=safeURL(s.url);const media=/\.mp4(\?|$)|\.webm(\?|$)/i.test(url)?
 '<video class="hero-img" src="'+esc(url)+'" autoplay muted loop playsinline preload="none" aria-hidden="true"></video>':
 '<img class="hero-img" src="'+esc(url)+'" alt="" aria-hidden="true">';
 return '<article class="hero-slide '+(i===0?"active":"")+'" data-slide="'+i+'">'+media+'<div class="wrap hero-content"><div class="eyebrow">'+label+'</div><h1>'+s.title+'</h1><p>'+s.subtitle+'</p><button class="btn orange" onclick="SRC.openDepartment(\''+esc(s.category)+'\')">Explore department &nbsp; →</button></div></article>'
 }).join("");
 state.slide=0;drawDots();
}
function drawDots(){
 $("heroDots").innerHTML=state.slides.map((_,i)=>'<button class="'+(i===state.slide?"active":"")+'" aria-label="View slide '+(i+1)+'" onclick="SRC.jumpSlide('+i+')"></button>').join("");
 document.querySelectorAll(".hero-slide").forEach((el,i)=>el.classList.toggle("active",i===state.slide));
}
function slide(delta){if(!state.slides.length)return;state.slide=(state.slide+delta+state.slides.length)%state.slides.length;drawDots()}
function jumpSlide(i){state.slide=i;drawDots()}
function show(view){state.active=view;document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===view));nav();window.scrollTo(0,0)}
function go(view){show(view);history.replaceState(null,"","#"+view);if(view==="cart")renderCart();if(view==="orders")renderOrders();if(view==="offers")renderOffers();if(view==="account")renderAuth()}
const sectionCampaigns={
 crackers:[
  {title:"Make every celebration memorable.",description:"Discover festive collections, educational product demonstrations and in-store information.",photo:photos.crackers},
  {title:"Crackers catalogue & product demonstrations.",description:"Learn about festive effects and product information before visiting a licensed store.",photo:"https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1600&q=85&fit=crop"},
  {title:"Celebrate with safety in mind.",description:"Learn about product effects and safety guidance before visiting a licensed retail outlet.",photo:"https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=1600&q=85&fit=crop"}
 ],
 housekeeping:[
  {title:"Clean spaces. Better everyday.",description:"Discover essentials for housekeeping, facility care and workplace hygiene.",photo:photos.housekeeping},
  {title:"Supplies for homes and businesses.",description:"From everyday cleaning tools to facility-maintenance products — one focused department.",photo:"https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1600&q=85&fit=crop"},
  {title:"Professional cleaning essentials.",description:"Compare product categories and request a quotation for your organisation.",photo:"https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&q=85&fit=crop"}
 ],
 stationery:[
  {title:"Everything for bright ideas.",description:"Explore notebooks, writing instruments and school & office essentials.",photo:photos.stationery},
  {title:"Ready for the school day.",description:"Practical classroom and stationery essentials for students and educators.",photo:"https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=1600&q=85&fit=crop"},
  {title:"Set up your workspace.",description:"Office paper, folders and everyday writing essentials.",photo:"https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1600&q=85&fit=crop"}
 ]
};
function catalogueFor(section){
 const live=state.products.filter(p=>p.sectionSlug===section);
 return live.length?live:(window.SRC_PREVIEW_PRODUCTS||[]).filter(p=>p.sectionSlug===section);
}
function renderDepartmentHero(slug){
 const configured=state.media.filter(x=>x.type==="HERO"&&x.category===slug&&safeURL(x.url)).map(x=>({
  title:x.title,description:x.subtitle||"",photo:safeURL(x.url)
 }));
 state.sectionSlides=configured.length?configured:(sectionCampaigns[slug]||[{title:state.sections.find(x=>x.slug===slug)?.name||"SRC Enterprises",description:"Discover our specialist business collection.",photo:photos.housekeeping}]);
 state.sectionSlide=0;
 $("deptHeroStage").innerHTML=state.sectionSlides.map((x,i)=>{
  const src=safeURL(x.photo);
  const media=/\.(mp4|webm)(\?|$)/i.test(src)?
   '<video class="dept-hero-media" src="'+esc(src)+'" muted loop autoplay playsinline preload="none" aria-hidden="true"></video>':
   '<img class="dept-hero-media" src="'+esc(src)+'" alt="" aria-hidden="true">';
  return '<div class="dept-hero-image '+(i===0?"active":"")+'">'+media+'</div>'
 }).join("");
 $("deptBanner").dataset.section=slug;
 updateDepartmentSlide()
}
function updateDepartmentSlide(){
 const item=state.sectionSlides[state.sectionSlide];if(!item)return;
 $("deptTitle").textContent=item.title;$("deptDescription").textContent=item.description;
 document.querySelectorAll(".dept-hero-image").forEach((el,i)=>el.classList.toggle("active",i===state.sectionSlide));
 $("deptHeroDots").innerHTML=state.sectionSlides.map((_,i)=>'<button type="button" class="'+(i===state.sectionSlide?"active":"")+'" aria-label="Department slide '+(i+1)+'" onclick="SRC.jumpDepartmentSlide('+i+')"></button>').join("");
}
function departmentSlide(delta){if(state.active!=="department"||!state.sectionSlides.length)return;state.sectionSlide=(state.sectionSlide+delta+state.sectionSlides.length)%state.sectionSlides.length;updateDepartmentSlide()}
function jumpDepartmentSlide(i){if(i<0||i>=state.sectionSlides.length)return;state.sectionSlide=i;updateDepartmentSlide()}
function openDepartment(slug){
 if(slug==="scheme"){openScheme();return}
 const sec=state.sections.find(s=>s.slug===slug);if(!sec)return;
 state.department=slug;show("department");history.replaceState(null,"","#section/"+slug);
 $("deptLabel").textContent="SRC ENTERPRISES / "+sec.name;
 $("deptCrumb").textContent=sec.name;$("deptHeading").textContent=sec.name+" catalogue";
 $("crackersExtra").classList.toggle("hide",slug!=="crackers");
 $("deptSearch").value="";$("deptCategory").value="";
 renderDepartmentHero(slug);renderProducts();renderDepartmentSpotlight(slug);
 if(slug==="crackers")renderVideos()
}
function renderDepartmentSpotlight(slug){
 const promos={
  crackers:{eyebrow:"Festival collection",title:"Explore. Learn. Celebrate responsibly.",text:"Approved demonstrations, catalogue information and safety guidance. Visit licensed stores for permitted in-person purchases.",button:"Browse crackers catalogue",photo:"https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1000&q=78&fit=crop"},
  housekeeping:{eyebrow:"Bulk & institutional supplies",title:"Cleaner homes. Better workplaces.",text:"Discover a wide selection of practical maintenance, cleaning and hygiene essentials for homes, offices and facilities.",button:"Explore floor care",photo:"https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1000&q=78&fit=crop"},
  stationery:{eyebrow:"For classrooms and offices",title:"Good ideas deserve great essentials.",text:"Explore notebooks, writing instruments, files, paper and classroom essentials curated in SRC's stationery division.",button:"Browse stationery",photo:"https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=1000&q=78&fit=crop"}
 };
 const item=promos[slug]||{eyebrow:"SRC Enterprises",title:"Products for every need.",text:"Explore this SRC business division.",button:"Browse catalogue",photo:photos.housekeeping};
 $("deptSpotlight").innerHTML='<div class="spotlight-copy"><span class="eyebrow">'+esc(item.eyebrow)+'</span><h2>'+esc(item.title)+'</h2><p>'+esc(item.text)+'</p><button class="btn orange" onclick="'+"document.getElementById(&quot;deptProducts&quot;).scrollIntoView({behavior:&quot;smooth&quot;})"+'">'+esc(item.button)+' →</button></div><div class="spotlight-art"><img loading="lazy" src="'+esc(item.photo)+'" alt=""></div>';
}
function setDepartmentCategory(category){$("deptCategory").value=category;renderProducts()}
function renderProducts(){
 const section=state.department,q=$("deptSearch").value.trim().toLowerCase(),category=$("deptCategory").value;
 const all=catalogueFor(section);
 const cats=[...new Set(all.map(p=>p.category).filter(Boolean))].sort();
 $("deptCategory").innerHTML='<option value="">All categories</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
 $("deptCategory").value=cats.includes(category)?category:"";
 $("deptCategoryChips").innerHTML=['',...cats].map(c=>'<button type="button" class="'+(category===c?"active":"")+'" onclick="SRC.setDepartmentCategory(\''+esc(c).replace(/'/g,"&#39;")+'\')">'+esc(c||"All products")+'</button>').join("");
 const shown=all.filter(p=>(!category||p.category===category)&&(!q||(p.name+" "+p.category+" "+(p.description||"")).toLowerCase().includes(q)));
 $("resultCount").textContent=shown.length+" items";
 const preview=all.some(p=>p.previewOnly);
 $("deptDemoNote").innerHTML=preview?'<div class="notice">DEMO CATALOGUE · These are illustrative products and images for design review, not confirmed prices or inventory. Add and publish products through SRC Admin for the live catalogue.</div>':'';
 $("deptProducts").innerHTML=shown.length?shown.map(p=>{
  const img=productImage(p);
  const isPreview=!!p.previewOnly||String(p.name).endsWith(" - Demo")||String(p.name).endsWith("(DEMO)");
  const authorized=!isPreview&&["housekeeping","stationery"].includes(section)&&state.sections.find(s=>s.slug===section)?.commerceMode==="STANDARD";
  return '<article class="product product-card"><div class="product-photo">'+(img?'<img loading="lazy" src="'+esc(img)+'" alt="'+esc(p.name)+'">':'<span class="photo-fallback">'+esc(p.category||section)+'</span>')+(isPreview?'<span class="preview-ribbon">DEMO</span>':'')+'</div><div class="product-info"><span class="tag '+(section==="crackers"?"warn":"")+'">'+esc(p.category||section)+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||"Explore product details with SRC.")+'</p>'+
   (section==="crackers"?'<span class="tag warn">In-store information only</span>':
   '<strong>'+price(p.pricePaise)+'</strong>'+(authorized?'<button class="btn orange" onclick="SRC.addToCart('+Number(p.id)+')">Add to enquiry →</button>':'<button class="btn light" disabled>'+(p.previewOnly?"Illustrative preview":"Contact for details")+'</button>'))+'</div></article>'
 }).join(""):'<div class="empty"><h3>No matching products</h3><p class="muted">Try another category or search term.</p></div>';
}
const demoPhotos={
 "floor cleaning":"https://images.unsplash.com/photo-1585421514738-01798e348b17?w=520&q=78&fit=crop",
 "microfiber":"https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=520&q=78&fit=crop",
 "garbage bags":"https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=520&q=78&fit=crop",
 "broom":"https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=520&q=78&fit=crop",
 "notebook":"https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=520&q=78&fit=crop",
 "pen":"https://images.unsplash.com/photo-1455390582262-044cdead277a?w=520&q=78&fit=crop",
 "copy paper":"https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=520&q=78&fit=crop",
 "pencil":"https://images.unsplash.com/photo-1455390582262-044cdead277a?w=520&q=78&fit=crop"
};
function productImage(p){
 const official=safeURL(p.imageUrl);if(official)return official;
 if(!String(p.name||"").endsWith(" - Demo"))return "";
 const k=Object.keys(demoPhotos).find(k=>p.name.toLowerCase().includes(k));return k?demoPhotos[k]:"";
}
let selectedFeatured="housekeeping";
function featured(section){
 if(!["housekeeping","stationery"].includes(section))return;
 selectedFeatured=section;
 for(const id of ["housekeeping","stationery"]){const btn=$("feat-"+id);if(btn){btn.classList.toggle("active",id===section);btn.setAttribute("aria-pressed",String(id===section))}}
 const products=catalogueFor(section).slice(0,5);
 $("featuredViewAll").textContent="View all "+(section==="stationery"?"stationery":"housekeeping")+" products →";
 $("featuredViewAll").onclick=()=>openDepartment(section);
 $("featuredProducts").innerHTML=products.length?products.map(p=>{
 const src=productImage(p),demo=!!p.previewOnly||String(p.name||"").endsWith(" - Demo")||String(p.name||"").endsWith("(DEMO)");
 return '<article class="product"><div class="product-photo">'+(src?'<img loading="lazy" src="'+esc(src)+'" alt="'+esc(p.name)+'">':'<span class="photo-fallback">'+esc(p.category||section)+'</span>')+'</div><div class="product-info"><span class="tag">'+esc(p.category||section)+'</span><h3>'+esc(p.name)+'</h3>'+(demo?'<span class="demo-label">Demo item · illustrative image</span>':'')+'<strong>'+price(p.pricePaise)+'</strong>'+(demo?'<button class="btn light" onclick="SRC.openDepartment(\''+section+'\')">View demo collection</button>':'<button class="btn orange" onclick="SRC.addToCart('+Number(p.id)+')">Add to enquiry</button>')+'</div></article>'
 }).join(""):'<div class="empty"><h3>Products arriving soon</h3><p class="muted">No published '+esc(section)+' products are available yet. SRC administrators can publish products and images in the catalogue.</p><button class="btn" onclick="SRC.openDepartment(\''+section+'\')">Browse '+esc(section)+'</button></div>';
}
function openScheme(){show("scheme");history.replaceState(null,"","#section/scheme")}
function renderSchemePlans(){
 const plans=state.schemePlans;
 $("schemeLivePlans").innerHTML=plans.length?plans.map((p,i)=>{
  const frequency=p.frequency==="QUARTERLY"?"quarter":"month",amount="₹"+(Number(p.amountPaise)/100).toLocaleString("en-IN");
  return '<article class="scheme-option"><span class="tag">Registration open · '+esc(p.schemeYear)+'</span><h3>'+esc(p.name)+'</h3><strong>'+Number(p.durationMonths)+' months</strong><p class="muted">'+esc(p.description||"SRC Deepavali membership plan")+'</p><p><b>Proposed:</b> '+amount+' per '+frequency+' · '+Number(p.durationMonths)+'-month duration</p><p class="muted">'+esc(p.benefits||"Benefits subject to confirmed terms")+'</p><button type="button" class="btn light" onclick="SRC.selectSchemePlan('+i+')">Register free for this plan</button></article>'
 }).join(""):'';
 $("schemeExamplePlans").classList.toggle("hide",plans.length>0);
}
function selectSchemePlan(index){
 const plan=state.schemePlans[index];if(!plan)return;
 $("schemePlanId").value=String(plan.id);$("festivalDuration").value=String(plan.durationMonths);
 $("schemeRegistration")?.scrollIntoView({behavior:"smooth",block:"center"});
}
let lastFestivalCode="";
function selectFestivalDuration(months){
 $("schemePlanId").value="";
 const input=$("festivalDuration");
 if(![6,10,12].includes(months)||!input)return;
 input.value=String(months);
 $("schemeRegistration")?.scrollIntoView({behavior:"smooth",block:"center"});
}
async function registerFestival(e){
 e.preventDefault();
 const form=e.currentTarget,data=Object.fromEntries(new FormData(form));
 const result=$("festivalEnrolResult"),button=$("festivalEnrolButton");
 if(!form.reportValidity())return;
 button.disabled=true;result.textContent="Registering your scheme ID…";
 try{
  const body={fullName:data.fullName,phone:data.phone,email:data.email||"",durationMonths:Number(data.durationMonths),...(data.schemePlanId?{schemePlanId:Number(data.schemePlanId)}:{}),consent:data.consent==="on"};
  const response=await request("/api/festival/enrol",{method:"POST",body:JSON.stringify(body)});
  lastFestivalCode=response.membershipCode;
  result.innerHTML='<div class="festival-receipt"><span class="tag">Registration received</span><h3>Your SRC membership ID</h3><div class="festival-code">'+esc(lastFestivalCode)+'</div><p>Selected duration: '+Number(response.durationMonths)+' months · '+Number(response.year)+'</p><p>Save this ID and bring it with your registered mobile to the SRC shop for verification. No money has been collected and this is not a fireworks order.</p><button type="button" class="btn light" onclick="SRC.copyFestivalCode()">Copy membership ID</button></div>';
  form.reset();
 }catch(err){result.textContent=err.message}
 finally{button.disabled=false}
}
async function copyFestivalCode(){
 if(!lastFestivalCode)return;
 try{await navigator.clipboard.writeText(lastFestivalCode);$("festivalEnrolResult").querySelector(".festival-receipt .tag").textContent="ID copied"}
 catch{$("festivalEnrolResult").querySelector(".festival-receipt .tag").textContent="Select and copy the ID above"}
}

function renderOffers(){
 const root=$("offersGrid");if(!root)return;
 const promos=state.promotions.filter(p=>p.published!==false);
 root.innerHTML=promos.length?promos.map(p=>{
 const img=safeURL(p.image_url||p.imageUrl);
 return '<article class="department offer-card">'+(img?'<div class="department-photo"><img src="'+esc(img)+'" alt="'+esc(p.title)+'" loading="lazy"></div>':'')+'<div class="department-body"><span class="tag">SRC promotion</span><h3>'+esc(p.title)+'</h3><p>'+esc(p.description||"Promotion details available from SRC.")+'</p><span class="muted" style="font-size:11px">'+esc(p.category||"Department offer")+'</span></div></article>'
 }).join(""):'<div class="empty"><h3>No active offers published yet</h3><p class="muted">SRC administrators can publish promotions under the relevant department.</p><button class="btn" onclick="SRC.openDepartment(\'housekeeping\')">Explore housekeeping</button></div>';
}
function renderVideos(){
 const list=state.media.filter(m=>m.type==="VIDEO"&&safeURL(m.url));
 $("crackerVideos").innerHTML=list.length?list.map(v=>'<article class="product"><div class="product-photo"><span class="photo-fallback">VIDEO</span></div><div class="product-info"><h3>'+esc(v.title)+'</h3><p>'+esc(v.subtitle||"Approved demonstration")+'</p><a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(safeURL(v.url))+'">View media ↗</a></div></article>').join(''):'<div class="empty"><h3>Demonstration media coming soon</h3><p class="muted">Only administrator-approved videos are displayed.</p></div>';
}
function addToCart(id){
 const p=state.products.find(x=>Number(x.id)===id);
 if(!p||p.fireworks||p.sectionSlug==="crackers"||!["housekeeping","stationery"].includes(p.sectionSlug)){alert("This item is not eligible for an online cart.");return}
 const line=state.cart.find(x=>x.productId===id&&x.section===p.sectionSlug);
 if(line)line.quantity=Math.min(100,line.quantity+1);else state.cart.push({productId:id,quantity:1,section:p.sectionSlug});
 sessionStorage.removeItem('src_checkout_idem_'+p.sectionSlug);saveCart();go("cart");
}
function removeCart(index){const old=state.cart[index];if(old)sessionStorage.removeItem("src_checkout_idem_"+old.section);state.cart.splice(index,1);saveCart();renderCart()}
function renderCart(){
 if(!state.cart.length){$("cartContent").innerHTML='<div class="empty"><h3>Your cart is empty</h3><p>Choose housekeeping or stationery to add products.</p><button class="btn" onclick="SRC.openDepartment(\'housekeeping\')">Browse housekeeping</button></div>';return}
 $("cartContent").innerHTML=['housekeeping','stationery'].filter(s=>state.cart.some(x=>x.section===s)).map(section=>{
 const items=state.cart.filter(x=>x.section===section);
 return '<div class="panel" style="margin:20px 0"><h2>'+esc(state.sections.find(s=>s.slug===section)?.name||section)+'</h2>'+items.map(x=>{const p=state.products.find(p=>Number(p.id)===x.productId);const i=state.cart.indexOf(x);return '<div class="cart-item"><div><b>'+esc(p?.name||"Product")+'</b><br><span class="muted">Quantity: '+x.quantity+' &nbsp; · &nbsp; '+price(p?.pricePaise)+'</span></div><button onclick="SRC.removeCart('+i+')">Remove</button></div>'}).join("")+
 '<h3 style="margin:25px 0 14px">Contact & delivery details</h3><form onsubmit="SRC.submitCart(event,\''+section+'\')"><div class="field"><label>Full name<input name="customerName" required minlength="2" maxlength="120"></label></div><div class="field"><label>Email<input name="email" type="email" required></label></div><div class="field"><label>Mobile<input name="phone" required minlength="8"></label></div><div class="field"><label>Delivery address (for checkout)<textarea name="address" rows="3" minlength="15" maxlength="1200"></textarea></label></div><button class="btn orange" type="submit">'+(state.payment.enabled?"Continue to payment / enquiry":"Submit product enquiry")+'</button><p class="muted" style="margin-top:12px">Checkout applies only to published, priced, stocked non-fireworks items. Payment availability depends on merchant configuration.</p></form></div>'
 }).join("")
}
async function ensureRazorpay(){if(window.Razorpay)return;await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function submitCart(event,section){
 event.preventDefault();const form=event.target,info=Object.fromEntries(new FormData(form));
 const lines=state.cart.filter(x=>x.section===section);
 if(!lines.length)return;
 const canPay=state.payment.enabled&&!!state.user&&lines.every(x=>Number(state.products.find(p=>Number(p.id)===x.productId)?.pricePaise)>0)&&info.address?.trim().length>=15;
 const btn=form.querySelector("button[type=submit]");btn.disabled=true;
 try{
  if(canPay){
   const checkout=await request("/api/checkout/orders",{method:"POST",body:JSON.stringify({sectionSlug:section,address:info.address,warehouseCode:"MAIN",items:lines.map(x=>({productId:x.productId,quantity:x.quantity})),idempotencyKey:(sessionStorage.getItem("src_checkout_idem_"+section)||(()=>{const v=crypto.randomUUID();sessionStorage.setItem("src_checkout_idem_"+section,v);return v})())})});
   await ensureRazorpay();
   const instance=new window.Razorpay({key:checkout.keyId,order_id:checkout.razorpayOrderId,amount:checkout.amountPaise,currency:"INR",name:"SRC Enterprises",description:"Standard goods only",handler:async p=>{
    try{await request("/api/payments/verify",{method:"POST",body:JSON.stringify({orderId:Number(checkout.orderId),...p})});state.cart=state.cart.filter(x=>x.section!==section);sessionStorage.removeItem("src_checkout_idem_"+section);saveCart();go("orders");alert("Payment captured and order confirmed.")}
    catch(err){alert("Payment status requires reconciliation. Do not retry until you check your orders. "+err.message)}
   },prefill:{name:info.customerName,email:info.email,contact:info.phone}});
   instance.open();
  }else{
   const enquiry=await request("/api/enquiries",{method:"POST",body:JSON.stringify({customerName:info.customerName,email:info.email,phone:info.phone,sectionSlug:section,lines:lines.map(x=>({productId:x.productId,quantity:x.quantity}))})});
   state.cart=state.cart.filter(x=>x.section!==section);sessionStorage.removeItem("src_checkout_idem_"+section);saveCart();go("cart");alert("Enquiry #"+enquiry.id+" submitted. No payment collected.");
  }
 }catch(err){alert("Unable to submit: "+err.message)}finally{btn.disabled=false}
}
async function renderOrders(){
 const root=$("orderResults");if(!state.token){root.innerHTML='<div class="empty">Sign in to view orders. <button class="btn" onclick="SRC.go(\'account\')">Sign in</button></div>';return}
 try{const orders=await request("/api/checkout/orders");root.innerHTML=orders.length?orders.map(o=>'<div class="panel" style="margin:12px 0"><b>Order #'+esc(o.id)+'</b> &nbsp; <span class="tag">'+esc(o.status)+'</span><p>'+esc(o.section_slug)+' · '+price(o.amount_paise)+'</p>'+(o.status==="PAID"?'<button class="btn light" onclick="SRC.invoice(\''+esc(o.id)+'\')">View draft invoice</button>':'')+'</div>').join(''):'<div class="empty">No purchases yet.</div>'}catch(e){root.textContent=e.message}
}
async function invoice(id){try{const i=await request("/api/checkout/orders/"+id+"/invoice");alert(i.invoice_number+" — "+i.kind+"\nAmounts are provisional until GST/HSN configuration is approved.")}catch(e){alert(e.message)}}
function renderAuth(){
 $("authHeading").textContent=state.user?"Signed in: "+state.user.email:(state.authMode==="login"?"Sign in to your account":"Create a customer account");
 $("authForm").classList.toggle("hide",!!state.user);$("logoutButton").classList.toggle("hide",!state.user);$("userLinks").classList.toggle("hide",!state.user);
 if(state.user){const links=$("userLinks").querySelectorAll("a");links[0].classList.toggle("hide",state.user.role!=="ADMIN");links[1].classList.toggle("hide",state.user.role!=="AGENT"&&state.user.role!=="ADMIN");links.forEach(a=>{if(a.dataset.allowed)a.classList.toggle("hide",!a.dataset.allowed.split(",").includes(state.user.role))})}
 $("authModeToggle").textContent=state.authMode==="login"?"Create a customer account":"Have an account? Sign in";
 $("authSubmit").textContent=state.authMode==="login"?"Sign in":"Create account";
 $("accountLabel").textContent=state.user?"My SRC":'My Account';
}
async function authSubmit(e){
 e.preventDefault();const email=$("authEmail").value.trim(),password=$("authPassword").value;const message=$("authFeedback");message.textContent="Processing…";
 try{const response=await request("/api/auth/"+(state.authMode==="login"?"login":"register"),{method:"POST",body:JSON.stringify({email,password})});
 if(state.authMode==="login"){state.token=response.token;state.user=response.user;message.textContent="Signed in.";renderAuth()}else{message.textContent="Account created. Sign in now.";state.authMode="login";renderAuth()}
 }catch(e){message.textContent=e.message}
}
async function recoverSubmit(e){e.preventDefault();const email=new FormData(e.target).get("email");try{const d=await request("/api/auth/password/forgot",{method:"POST",body:JSON.stringify({email})});$("recoverFeedback").textContent=d.message}catch(err){$("recoverFeedback").textContent=err.message}}
async function load(){
 const calls=await Promise.allSettled([
   request("/api/catalog/sections"),
   request("/api/catalog/products"),
   request("/api/catalog/media"),
   request("/api/payments/config"),
   request("/api/catalog/promotions"),
   request("/api/scheme/plans")
 ]);
 const [sections,products,media,payments,promotions,schemePlans]=calls;
 if(sections.status==="fulfilled"&&Array.isArray(sections.value)&&sections.value.length)state.sections=sections.value.filter(x=>x.slug&&x.name);
 if(products.status==="fulfilled"&&Array.isArray(products.value))state.products=products.value;
 if(media.status==="fulfilled"&&Array.isArray(media.value))state.media=media.value;
 if(payments.status==="fulfilled"&&payments.value)state.payment=payments.value;
 if(promotions.status==="fulfilled"&&Array.isArray(promotions.value))state.promotions=promotions.value;
 if(schemePlans.status==="fulfilled"&&Array.isArray(schemePlans.value))state.schemePlans=schemePlans.value;
 if(calls.some(x=>x.status==="rejected"))console.warn("Some SRC APIs are unavailable. Other departments remain browsable.");
 sectionsCards();hero();nav();saveCart();featured(selectedFeatured);renderOffers();renderSchemePlans();
 const route=location.hash.slice(1);
 if(route.startsWith("section/"))openDepartment(route.split("/")[1]);
 else go(["home","cart","account","orders","recover","offers"].includes(route)?route:"home");
}
$("deptSearch").addEventListener("input",renderProducts);$("deptCategory").addEventListener("change",renderProducts);
$("globalSearch").addEventListener("submit",e=>{e.preventDefault();const term=$("siteSearch").value.trim();const found=state.products.find(p=>(p.name+" "+p.category).toLowerCase().includes(term.toLowerCase()));if(found){openDepartment(found.sectionSlug);$("deptSearch").value=term;renderProducts()}else alert("No matching published product found. Choose a department to browse.")});
$("authForm").addEventListener("submit",authSubmit);$("authModeToggle").addEventListener("click",()=>{state.authMode=state.authMode==="login"?"register":"login";renderAuth()});
$("logoutButton").addEventListener("click",async()=>{await request("/api/auth/logout",{method:"POST"}).catch(()=>{});state.token="";state.user=null;renderAuth()});
$("recoverForm").addEventListener("submit",recoverSubmit);
$("festivalEnrolForm").addEventListener("submit",registerFestival);
window.SRC={go,openDepartment,openScheme,selectFestivalDuration,selectSchemePlan,copyFestivalCode,toggleCategories,featured,slide,jumpSlide,departmentSlide,jumpDepartmentSlide,setDepartmentCategory,addToCart,removeCart,submitCart,invoice};
load();setInterval(()=>{if(state.active==="home")slide(1);else if(state.active==="department")departmentSlide(1)},6500);
})();