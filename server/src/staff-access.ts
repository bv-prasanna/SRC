import {Router} from "express";
import type {Pool} from "pg";
import type {Request,RequestHandler} from "express";
import {z} from "zod";
import {requireAuthenticated,requireRole} from "./access.js";

const scopeName=/^section:[a-z][a-z0-9-]{1,63}$/;
const grantSchema=z.object({scopes:z.array(z.string().max(96)).max(30)}).strict();
export function normalizeStaffScopes(scopes:string[],allowedSections:string[]){
 const allowed=new Set(allowedSections.map(s=>"section:"+s));
 allowed.add("scheme");
 if(scopes.some(s=>!allowed.has(s)||!(s==="scheme"||scopeName.test(s))))return null;
 return [...new Set(scopes)].sort();
}
const userId=(s:string)=>{const n=Number(s);return Number.isSafeInteger(n)&&n>0?n:null};
export function scopedAccess(db:Pool,scope:string|((req:Request)=>string)):RequestHandler[]{
 return [requireAuthenticated(db),async(req,res,next)=>{
  const target=typeof scope==="string"?scope:scope(req);
  if(!(target==="scheme"||scopeName.test(target))){res.status(400).json({error:"Invalid staff scope"});return}
  if(["ADMIN","SUPER_ADMIN"].includes(res.locals.user.role)){next();return}
  try{
   const result=await db.query("SELECT 1 FROM user_staff_scopes WHERE user_id=$1 AND scope=$2",[res.locals.user.id,target]);
   if(!result.rowCount){res.status(403).json({error:"You do not have access to this SRC section"});return}
   next();
  }catch{res.status(503).json({error:"Staff access unavailable"})}
 }];
}
export function staffAccessRouter(db:Pool){
 const r=Router(),auth=requireAuthenticated(db),admin=requireRole(db,["ADMIN"]);
 r.get("/api/staff/scopes",auth,async(_req,res)=>{
  try{
   const [scopes,sections]=await Promise.all([
    db.query("SELECT scope FROM user_staff_scopes WHERE user_id=$1 ORDER BY scope",[res.locals.user.id]),
    db.query("SELECT slug,name FROM business_sections WHERE active=true ORDER BY sort_order,name")
   ]);
   res.json({isAdmin:["ADMIN","SUPER_ADMIN"].includes(res.locals.user.role),
    scopes:scopes.rows.map(x=>x.scope),sections:sections.rows,role:res.locals.user.role});
  }catch{res.status(503).json({error:"Staff scopes unavailable"})}
 });
 r.get("/api/admin/users/:id/scopes",admin,async(req,res)=>{
  const id=userId(req.params.id);if(!id){res.status(400).json({error:"Invalid user"});return}
  try{res.json({userId:id,scopes:(await db.query("SELECT scope FROM user_staff_scopes WHERE user_id=$1 ORDER BY scope",[id])).rows.map(x=>x.scope)})}
  catch{res.status(503).json({error:"User permissions unavailable"})}
 });
 r.put("/api/admin/users/:id/scopes",admin,async(req,res)=>{
  const id=userId(req.params.id),valid=grantSchema.safeParse(req.body);
  if(!id||!valid.success){res.status(400).json({error:"Invalid staff permissions"});return}
  if(id===Number(res.locals.user.id)){res.status(409).json({error:"You cannot modify your own staff permissions"});return}
  let client;
  try{
   client=await db.connect();await client.query("BEGIN");
   const user=await client.query("SELECT role FROM app_users WHERE id=$1 FOR UPDATE",[id]);
   if(!user.rowCount){await client.query("ROLLBACK");res.status(404).json({error:"User not found"});return}
   if(user.rows[0].role==="SUPER_ADMIN"){await client.query("ROLLBACK");res.status(403).json({error:"Super Admin privileges cannot be modified here"});return}
   const sections=await client.query("SELECT slug FROM business_sections WHERE active=true");
   const normalized=normalizeStaffScopes(valid.data.scopes,sections.rows.map(s=>s.slug));
   if(!normalized){await client.query("ROLLBACK");res.status(400).json({error:"Unknown or inactive section scope"});return}
   const existing=await client.query("SELECT scope FROM user_staff_scopes WHERE user_id=$1 ORDER BY scope FOR UPDATE",[id]);
   const prior=existing.rows.map(x=>x.scope);
   if(JSON.stringify(prior)!==JSON.stringify(normalized)){
    await client.query("DELETE FROM user_staff_scopes WHERE user_id=$1",[id]);
    for(const scope of normalized)await client.query("INSERT INTO user_staff_scopes(user_id,scope,granted_by) VALUES($1,$2,$3)",[id,scope,res.locals.user.id]);
    await client.query("INSERT INTO user_staff_scope_audit(target_user_id,actor_user_id,previous_scopes,next_scopes) VALUES($1,$2,$3::jsonb,$4::jsonb)",[id,res.locals.user.id,JSON.stringify(prior),JSON.stringify(normalized)]);
    await client.query("DELETE FROM user_sessions WHERE user_id=$1",[id]);
   }
   await client.query("COMMIT");
   res.json({userId:id,scopes:normalized,sessionsRevoked:JSON.stringify(prior)!==JSON.stringify(normalized)});
  }catch{if(client)await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Unable to update staff permissions"})}
  finally{client?.release()}
 });
 const product=z.object({
  name:z.string().trim().min(2).max(150),
  category:z.string().trim().min(2).max(100),
  description:z.string().max(1500).default(""),
  imageUrl:z.string().url().refine(s=>s.startsWith("https://")).nullable().optional(),
  demoVideoUrl:z.string().url().refine(s=>s.startsWith("https://")).nullable().optional(),
  pricePaise:z.number().int().min(0).max(100000000).default(0),
  published:z.boolean().default(false)
 }).strict();
 const sectionGuard=scopedAccess(db,req=>"section:"+req.params.slug);
 const sectionPattern=/^[a-z][a-z0-9-]{1,63}$/;
 function sectionOK(slug:string){return sectionPattern.test(slug)&&slug!=="scheme"}
 r.get("/api/staff/sections/:slug/products",...sectionGuard,async(req,res)=>{
  if(!sectionOK(req.params.slug)){res.status(400).json({error:"Invalid section"});return}
  try{res.json((await db.query("SELECT id,name,category,description,image_url AS \"imageUrl\",demo_video_url AS \"demoVideoUrl\",price_paise AS \"pricePaise\",published,fireworks,section_slug AS \"sectionSlug\" FROM products WHERE section_slug=$1 ORDER BY id DESC LIMIT 500",[req.params.slug])).rows)}
  catch{res.status(503).json({error:"Section catalogue unavailable"})}
 });
 r.post("/api/staff/sections/:slug/products",...sectionGuard,async(req,res)=>{
  const slug=req.params.slug,parsed=product.safeParse(req.body);
  if(!sectionOK(slug)||!parsed.success){res.status(400).json({error:"Invalid product"});return}
  const p=parsed.data,crackers=slug==="crackers";
  if(crackers&&p.pricePaise!==0){res.status(400).json({error:"Crackers are information-only. Set price to zero."});return}
  try{
   const q=await db.query("INSERT INTO products(name,category,description,image_url,demo_video_url,published,fireworks,section_slug,price_paise) SELECT $1,$2,$3,$4,$5,$6,$7,slug,$9 FROM business_sections WHERE slug=$8 AND active=true RETURNING id",[p.name,p.category,p.description,p.imageUrl||null,p.demoVideoUrl||null,p.published,crackers,slug,p.pricePaise]);
   res.status(q.rowCount?201:404).json(q.rows[0]||{error:"Section unavailable"});
  }catch{res.status(503).json({error:"Cannot create product"})}
 });
 r.put("/api/staff/sections/:slug/products/:id",...sectionGuard,async(req,res)=>{
  const slug=req.params.slug,id=userId(req.params.id),parsed=product.safeParse(req.body);
  if(!sectionOK(slug)||!id||!parsed.success){res.status(400).json({error:"Invalid product"});return}
  const p=parsed.data;
  if(slug==="crackers"&&p.pricePaise!==0){res.status(400).json({error:"Crackers are information-only"});return}
  try{
   const q=await db.query("UPDATE products SET name=$1,category=$2,description=$3,image_url=$4,demo_video_url=$5,published=$6,price_paise=$7 WHERE id=$8 AND section_slug=$9 RETURNING id",[p.name,p.category,p.description,p.imageUrl||null,p.demoVideoUrl||null,p.published,p.pricePaise,id,slug]);
   res.status(q.rowCount?200:404).json(q.rows[0]||{error:"Product not found in your section"});
  }catch{res.status(503).json({error:"Cannot update product"})}
 });
 r.patch("/api/staff/sections/:slug/products/:id/unpublish",...sectionGuard,async(req,res)=>{
  const id=userId(req.params.id);
  if(!id||!sectionOK(req.params.slug)){res.status(400).json({error:"Invalid product"});return}
  try{
   const q=await db.query("UPDATE products SET published=false WHERE id=$1 AND section_slug=$2 RETURNING id",[id,req.params.slug]);
   res.status(q.rowCount?200:404).json(q.rows[0]||{error:"Product not found in your section"});
  }catch{res.status(503).json({error:"Cannot unpublish product"})}
 });
 return r;
}
