(()=>{"use strict";
const role=document.body.dataset.role||"CUSTOMER";
const title={CUSTOMER:"Customer Portal",DELIVERY:"Delivery Workspace",PROCUREMENT:"Procurement Workspace",PACKING:"Packing Workspace",OPERATIONS:"Operations Control Centre"}[role]||"SRC Workspace";
const API=(window.SRC_API_BASE||((["localhost","127.0.0.1"].includes(location.hostname)&&location.port==="8000")?"http://localhost:8080":"")).replace(/\/$/,"");
const $=id=>document.getElementById(id),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let token="",user=null,items=[],staff=[];
$("portalTitle").textContent=title;$("loginTitle").textContent=title+" sign in";
async function api(path,options={}){
 const r=await fetch(API+path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...(options.headers||{})}});
 if(r.status===204)return {};
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"Request failed");return data
}
function status(text,failed=false){$("status").textContent=text;$("status").className=failed?"error":"success"}
$("signin").onsubmit=async e=>{
 e.preventDefault();status("Signing in…");
 const data=Object.fromEntries(new FormData(e.target));
 try{
  const result=await api("/api/auth/login",{method:"POST",body:JSON.stringify(data)});
  if(result.user?.role!==role&&result.user?.role!=="ADMIN")throw Error("This account does not have "+role+" access");
  token=result.token;user=result.user;e.target.reset();$("loginPanel").classList.add("hidden");$("workspace").classList.remove("hidden");$("identity").textContent=result.user.email+" · "+result.user.role;
  status("Signed in.");await refresh();
 }catch(err){status(err.message,true)}
};
$("logout").onclick=async()=>{await api("/api/auth/logout",{method:"POST"}).catch(()=>{});token="";location.reload()};
$("refresh").onclick=refresh;
function summary(){
 const total=items.length,completed=items.filter(t=>t.status==="COMPLETED").length,progress=items.filter(t=>t.status==="IN_PROGRESS").length;
 $("stats").innerHTML=[["Assigned / visible",total],["In progress",progress],["Completed",completed],["Pending",total-completed-progress]].map(([name,value])=>'<div class="stat"><small>'+esc(name)+'</small><strong>'+value+'</strong></div>').join("")
}
function staffOptions(kind,assigned){
 return '<option value="">Select '+esc(kind.toLowerCase())+' team member</option>'+staff.filter(x=>x.role===kind).map(x=>'<option value="'+Number(x.id)+'" '+(Number(x.id)===Number(assigned)?"selected":"")+'>'+esc(x.email)+'</option>').join("")
}
function taskCard(t){
 const controls=(role==="OPERATIONS"||user?.role==="ADMIN")?'<div class="task-action"><select aria-label="Assign task" id="assign-'+Number(t.id)+'">'+staffOptions(t.task_kind,t.assigned_to)+'</select><button class="alt" onclick="WORK.assign('+Number(t.id)+')">Assign</button></div>':'';
 const actions=t.status==="COMPLETED"?'':('<div class="task-action">'+(t.status==="PENDING"?'<button class="alt" onclick="WORK.update('+Number(t.id)+',\'IN_PROGRESS\')">Start</button>':'')+'<button onclick="WORK.update('+Number(t.id)+',\'COMPLETED\')">Complete stage</button></div>');
 return '<article class="panel task-card"><div><div class="task-title"><h3>Order #'+esc(t.order_id)+' · '+esc(t.task_kind)+'</h3><span class="tag '+(t.status==="COMPLETED"?"done":"")+'">'+esc(t.status)+'</span></div><p>'+esc(t.section_slug)+' · Order status: '+esc(t.order_status)+' · Task ID: '+Number(t.id)+'</p>'+(t.instructions?'<p>'+esc(t.instructions)+'</p>':'')+'<small>Assigned: '+esc(t.assigned_email||t.assigned_to||"Unassigned")+'</small></div><div>'+controls+actions+'</div></article>'
}
async function refresh(){
 try{
  if(role==="CUSTOMER"){
   const orders=await api("/api/checkout/orders");items=orders;
   $("stats").innerHTML=[["My orders",orders.length],["Paid",orders.filter(x=>x.status==="PAID").length],["In delivery",orders.filter(x=>x.status==="DISPATCHED").length],["Delivered",orders.filter(x=>x.status==="DELIVERED").length]].map(([k,v])=>'<div class="stat"><small>'+k+'</small><strong>'+v+'</strong></div>').join("");
   $("queueTitle").textContent="Your purchases";
   $("queue").innerHTML=orders.length?orders.map(x=>'<article class="panel"><h3>Order #'+esc(x.id)+' <span class="tag">'+esc(x.status)+'</span></h3><p>'+esc(x.section_slug)+' · ₹'+(Number(x.amount_paise)/100).toFixed(2)+'</p></article>').join(""):'<div class="empty">No purchases yet. Visit the SRC storefront to explore housekeeping and stationery.</div>';
   return
  }
  items=await api("/api/workspace/tasks");
  if(role==="OPERATIONS"||user?.role==="ADMIN")staff=await api("/api/workspace/staff");
  summary();$("queueTitle").textContent=role==="OPERATIONS"?"All active operational tasks":title+" · Assigned tasks";
  $("queue").innerHTML=items.length?items.map(taskCard).join(""):'<div class="empty">No tasks available for this role yet. Orders appear here after eligible standard-goods payment and task assignment.</div>'
 }catch(err){status(err.message,true)}
}
async function update(id,next){
 try{
  const notes=prompt("Optional completion / handover note:","")||"";
  await api("/api/workspace/tasks/"+id+"/status",{method:"PATCH",body:JSON.stringify({status:next,notes})});
  status("Stage updated and logged.");await refresh()
 }catch(err){status(err.message,true)}
}
async function assign(id){
 const member=Number($("assign-"+id)?.value);
 if(!Number.isSafeInteger(member)||member<1){status("Select a team member with the matching role",true);return}
 try{await api("/api/admin/workspace/tasks/"+id+"/assign",{method:"PATCH",body:JSON.stringify({userId:member})});status("Task assigned.");await refresh()}
 catch(err){status(err.message,true)}
}
async function startOrder(){
 const id=Number(prompt("Paid housekeeping/stationery order ID:"));
 if(!Number.isSafeInteger(id)||id<1)return;
 try{await api("/api/admin/workspace/orders/"+id+"/start",{method:"POST"});status("Workflow created.");await refresh()}
 catch(err){status(err.message,true)}
}
if(role==="OPERATIONS")$("operatorActions").classList.remove("hidden");
$("startOrder").onclick=startOrder;
window.WORK={update,assign};
})();