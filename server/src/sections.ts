import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
export const sectionSchema=z.object({
 slug:z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
 name:z.string().trim().min(2).max(120),
 description:z.string().max(2000).default(""),
 commerceMode:z.enum(["CATALOGUE_ONLY","STANDARD"]).default("CATALOGUE_ONLY"),
 active:z.boolean().default(true),
 sortOrder:z.number().int().min(0).max(10000).default(100)
});
const guardedSlugs=new Set(["crackers","scheme"]);
export function canOrderSection(section:string,mode:string){return !guardedSlugs.has(section)&&mode==="STANDARD"}
export function sectionsRouter(pool:Pick<Pool,"query">,admin:import("express").RequestHandler){
 const router=Router();
 router.get("/api/catalog/sections",async(_req,res)=>{try{const q=await pool.query('SELECT slug,name,description,commerce_mode AS "commerceMode",sort_order AS "sortOrder" FROM business_sections WHERE active=true ORDER BY sort_order,name');res.json(q.rows)}catch{res.status(503).json({error:"Sections unavailable"})}});
 router.get("/api/catalog/sections/:slug/products",async(req,res)=>{
  try{const r=await pool.query('SELECT id,name,category,description,image_url AS "imageUrl",demo_video_url AS "demoVideoUrl",price_paise AS "pricePaise",section_slug AS "sectionSlug" FROM products WHERE section_slug=$1 AND published=true ORDER BY name',[req.params.slug]);res.json(r.rows)}
  catch{res.status(503).json({error:"Catalogue unavailable"})}
 });
 router.get("/api/admin/sections",admin,async(_req,res)=>{try{res.json((await pool.query("SELECT * FROM business_sections ORDER BY sort_order,name")).rows)}catch{res.status(503).json({error:"Database unavailable"})}});
 router.post("/api/admin/sections",admin,async(req,res)=>{
  const checked=sectionSchema.safeParse(req.body);if(!checked.success){res.status(400).json({error:"Invalid section",details:checked.error.flatten()});return}
  const v=checked.data;if(guardedSlugs.has(v.slug)&&v.commerceMode!=="CATALOGUE_ONLY"){res.status(400).json({error:"Scheme and fireworks must remain non-commerce sections"});return}
  try{const q=await pool.query('INSERT INTO business_sections(slug,name,description,commerce_mode,active,sort_order) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[v.slug,v.name,v.description,v.commerceMode,v.active,v.sortOrder]);res.status(201).json(q.rows[0])}
  catch{res.status(409).json({error:"Section already exists or database error"})}
 });
 router.put("/api/admin/sections/:slug",admin,async(req,res)=>{
  const checked=sectionSchema.omit({slug:true}).safeParse(req.body);if(!checked.success){res.status(400).json({error:"Invalid section"});return}
  const v=checked.data;if(guardedSlugs.has(req.params.slug)&&v.commerceMode!=="CATALOGUE_ONLY"){res.status(400).json({error:"Fireworks must remain catalogue-only"});return}
  try{const q=await pool.query("UPDATE business_sections SET name=$1,description=$2,commerce_mode=$3,active=$4,sort_order=$5 WHERE slug=$6 RETURNING *",[v.name,v.description,v.commerceMode,v.active,v.sortOrder,req.params.slug]);res.status(q.rowCount?200:404).json(q.rows[0]||{error:"Section not found"})}
  catch{res.status(503).json({error:"Database unavailable"})}
 });
 return router;
}
