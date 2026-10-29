(()=>{"use strict";
const API=(window.SRC_API_BASE||((location.hostname==="localhost"||location.hostname==="127.0.0.1")&&location.port==="8000"?"http://localhost:8080":"")).replace(/\/$/,"");
const photos={crackers:"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=85&fit=crop",housekeeping:"https://images.unsplash.com/photo-1585421514738-01798e348b17?w=1200&q=85&fit=crop",stationery:"https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=1200&q=85&fit=crop"};
const defaults=[{slug:"crackers",name:"Crackers",description:"Festive collections, demonstrations and scheme information. Catalogue only.",commerceMode:"CATALOGUE_ONLY"},{slug:"housekeeping",name:"Housekeeping Materials",description:"Hygiene, cleaning and building-maintenance essentials.",commerceMode:"STANDARD"},{slug:"stationery",name:"Stationery",description:"School, office and workplace supplies.",commerceMode:"STANDARD"}];
const state={sections:defaults,products:[],media:[],promotions:[],active:"home",department:"housekeeping",slide:0,slides:[],token:"",user:null,authMode:"login",payment:{enabled:false},cart:[]};
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
function badge(name){return name==="crackers"?"Catalogue only":"Products & enquiries"}
function nav(){
 const current=state.active==="department"?state.department:state.active;
 const deptButtons=state.sections.map(sec=>'<button data-route="'+esc(sec.slug)+'" onclick="SRC.openDepartment(\''+esc(sec.slug)+'\')">'+esc(sec.name)+(sec.slug==="crackers"?' <span class="nav-info">Info</span>':'')+'</button>').join('');
 $("mainNav").innerHTML='<div class="nav-category"><button type="button" aria-expanded="false" onclick="SRC.toggleCategories()">☰ &nbsp; All Categories <span aria-hidden="true">⌄</span></button><div class="nav-category-panel" id="allCategoryMenu">'+state.sections.map(sec=>'<button onclick="SRC.openDepartment(\''+esc(sec.slug)+'\')">'+esc(sec.name)+' <span aria-hidden="true">›</span></button>').join('')+'</div></div><button data-route="home" onclick="SRC.go(\'home\')">Home</button>'+deptButtons+'<button onclick="SRC.go(\'offers\')">Deals & Offers</button><button onclick="SRC.openDepartment(\'housekeeping\')">Bulk Enquiries</button>';
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
 {title:"Festival moments,<br><span>beautifully planned.</span>",subtitle:"Explore fireworks catalogue information and the proposed SRC scheme. Licensed in-person sales only.",url:photos.crackers,category:"crackers"}
];
function hero(){
 const published=state.media.filter(x=>x.type==="HERO"&&safeURL(x.url));
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
function openDepartment(slug){
 const sec=state.sections.find(s=>s.slug===slug);if(!sec)return;
 state.department=slug;show("department");history.replaceState(null,"","#section/"+slug);
 $("deptTitle").textContent=sec.name;$("deptLabel").textContent="SRC / "+sec.name;$("deptDescription").textContent=sec.description;
 $("deptCrumb").textContent=sec.name;$("deptHeading").textContent=sec.name+" products";
 const img=photos[slug]||photos.housekeeping;
 $("deptBanner").style.setProperty("--banner-image",'url("'+img+'")');
 $("crackersExtra").classList.toggle("hide",slug!=="crackers");
 $("deptSearch").value="";$("deptCategory").value="";renderProducts();
 if(slug==="crackers")renderVideos()
}
function renderProducts(){
 const section=state.department;const q=$("deptSearch").value.trim().toLowerCase(),category=$("deptCategory").value;
 const all=state.products.filter(p=>p.sectionSlug===section);
 const cats=[...new Set(all.map(p=>p.category).filter(Boolean))].sort();
 $("deptCategory").innerHTML='<option value="">All categories</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
 $("deptCategory").value=cats.includes(category)?category:"";
 const shown=all.filter(p=>(!category||p.category===category)&&(!q||(p.name+" "+p.category+" "+(p.description||"")).toLowerCase().includes(q)));
 $("resultCount").textContent=shown.length+" product"+(shown.length!==1?"s":"");
 $("deptProducts").innerHTML=shown.length?shown.map(p=>{
  const image=safeURL(p.imageUrl);const authorized=section!=="crackers"&&state.sections.find(s=>s.slug===section)?.commerceMode==="STANDARD";
  return '<article class="product"><div class="product-photo">'+(image?'<img loading="lazy" src="'+esc(image)+'" alt="'+esc(p.name)+'">':'<span class="photo-fallback">'+esc(p.category||section)+'</span>')+'</div><div class="product-info"><span class="tag '+(section==="crackers"?"warn":"")+'">'+esc(p.category||section)+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||"See product details with SRC.")+'</p>'+(section==="crackers"?'<span class="tag warn">Licensed in-person information only</span>':'<strong>'+price(p.pricePaise)+'</strong>'+(authorized?'<button class="btn" onclick="SRC.addToCart('+Number(p.id)+')">Add to cart</button>':''))+'</div></article>'
 }).join(""):'<div class="empty"><h3>No published products here yet</h3><p class="muted">An SRC administrator can publish products for this department. Demo items must be explicitly added to your local database.</p></div>';
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
 const products=state.products.filter(x=>x.sectionSlug===section).slice(0,5);
 $("featuredViewAll").textContent="View all "+(section==="stationery"?"stationery":"housekeeping")+" products →";
 $("featuredViewAll").onclick=()=>openDepartment(section);
 $("featuredProducts").innerHTML=products.length?products.map(p=>{
 const src=productImage(p),demo=String(p.name||"").endsWith(" - Demo");
 return '<article class="product"><div class="product-photo">'+(src?'<img loading="lazy" src="'+esc(src)+'" alt="'+esc(p.name)+'">':'<span class="photo-fallback">'+esc(p.category||section)+'</span>')+'</div><div class="product-info"><span class="tag">'+esc(p.category||section)+'</span><h3>'+esc(p.name)+'</h3>'+(demo?'<span class="demo-label">Demo item · illustrative image</span>':'')+'<strong>'+price(p.pricePaise)+'</strong><button class="btn orange" onclick="SRC.addToCart('+Number(p.id)+')">Add to enquiry</button></div></article>'
 }).join(""):'<div class="empty"><h3>Products arriving soon</h3><p class="muted">No published '+esc(section)+' products are available yet. SRC administrators can publish products and images in the catalogue.</p><button class="btn" onclick="SRC.openDepartment(\''+section+'\')">Browse '+esc(section)+'</button></div>';
}
function openScheme(){openDepartment("crackers");setTimeout(()=>document.getElementById("crackersScheme")?.scrollIntoView({behavior:"smooth",block:"start"}),80)}
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
 if(state.user){const links=$("userLinks").querySelectorAll("a");links[0].classList.toggle("hide",state.user.role!=="ADMIN");links[1].classList.toggle("hide",state.user.role!=="AGENT"&&state.user.role!=="ADMIN")}
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
   request("/api/catalog/promotions")
 ]);
 const [sections,products,media,payments,promotions]=calls;
 if(sections.status==="fulfilled"&&Array.isArray(sections.value)&&sections.value.length)state.sections=sections.value.filter(x=>x.slug&&x.name);
 if(products.status==="fulfilled"&&Array.isArray(products.value))state.products=products.value;
 if(media.status==="fulfilled"&&Array.isArray(media.value))state.media=media.value;
 if(payments.status==="fulfilled"&&payments.value)state.payment=payments.value;
 if(promotions.status==="fulfilled"&&Array.isArray(promotions.value))state.promotions=promotions.value;
 if(calls.some(x=>x.status==="rejected"))console.warn("Some SRC APIs are unavailable. Other departments remain browsable.");
 sectionsCards();hero();nav();saveCart();featured(selectedFeatured);renderOffers();
 const route=location.hash.slice(1);
 if(route.startsWith("section/"))openDepartment(route.split("/")[1]);
 else go(["home","cart","account","orders","recover","offers"].includes(route)?route:"home");
}
$("deptSearch").addEventListener("input",renderProducts);$("deptCategory").addEventListener("change",renderProducts);
$("globalSearch").addEventListener("submit",e=>{e.preventDefault();const term=$("siteSearch").value.trim();const found=state.products.find(p=>(p.name+" "+p.category).toLowerCase().includes(term.toLowerCase()));if(found){openDepartment(found.sectionSlug);$("deptSearch").value=term;renderProducts()}else alert("No matching published product found. Choose a department to browse.")});
$("authForm").addEventListener("submit",authSubmit);$("authModeToggle").addEventListener("click",()=>{state.authMode=state.authMode==="login"?"register":"login";renderAuth()});
$("logoutButton").addEventListener("click",async()=>{await request("/api/auth/logout",{method:"POST"}).catch(()=>{});state.token="";state.user=null;renderAuth()});
$("recoverForm").addEventListener("submit",recoverSubmit);
window.SRC={go,openDepartment,openScheme,toggleCategories,featured,slide,jumpSlide,addToCart,removeCart,submitCart,invoice};
load();setInterval(()=>{if(state.active==="home")slide(1)},6500);
})();