import { Router } from "express";
import type { Pool } from "pg";
import type { RequestHandler } from "express";
import { z } from "zod";
const inputs = {
 categories: z.object({name:z.string().trim().min(1).max(100),icon:z.string().max(20).default("✨"),sectionSlug:z.string().min(2),published:z.boolean().default(false)}),
 media: z.object({title:z.string().min(1),type:z.enum(["HERO","VIDEO","IMAGE"]),url:z.string().url().refine(x=>x.startsWith("https://")),category:z.string().optional(),subtitle:z.string().optional(),published:z.boolean().default(false)}),
 promotions: z.object({title:z.string().min(1),description:z.string().default(""),category:z.string().optional(),published:z.boolean().default(false)})
};
const tables = {categories:"categories",media:"media_content",promotions:"promotions"} as const;
export function contentRouter(db:Pick<Pool,"query">,admin:RequestHandler){
 const router=Router();
 for(const k of Object.keys(tables) as (keyof typeof tables)[]){
  const table=tables[k];
  router.get("/api/catalog/"+k,async(_req,res)=>{
   try{const r=await db.query("SELECT * FROM "+table+" WHERE published=true ORDER BY id DESC");res.json(r.rows)}
   catch{res.status(503).json({error:"Content unavailable"})}
  });
  router.get("/api/admin/"+k,admin,async(_req,res)=>{
   try{const r=await db.query("SELECT * FROM "+table+" ORDER BY id DESC");res.json(r.rows)}
   catch{res.status(503).json({error:"Database unavailable"})}
  });
  router.post("/api/admin/"+k,admin,async(req,res)=>{
   const p=inputs[k].safeParse(req.body);if(!p.success){res.status(400).json({error:"Invalid input"});return}
   const d=p.data as Record<string,unknown>;
   const columns=k==="categories"?["name","icon","section_slug","published"]:k==="media"?["title","type","url","category","subtitle","published"]:["title","description","category","published","information_only"];
   const values=k==="categories"?[d.name,d.icon,d.sectionSlug,d.published]:k==="media"?[d.title,d.type,d.url,d.category||null,d.subtitle||null,d.published]:[d.title,d.description,d.category||null,d.published,true];
   try{const r=await db.query("INSERT INTO "+table+"("+columns.join(",")+") VALUES ("+values.map((_,i)=>"$"+(i+1)).join(",")+") RETURNING *",values);res.status(201).json(r.rows[0])}
   catch{res.status(409).json({error:"Conflict or invalid reference"})}
  });

  router.put("/api/admin/"+k+"/:id",admin,async(req,res)=>{
   const id=Number(req.params.id),p=inputs[k].safeParse(req.body);
   if(!Number.isSafeInteger(id)||id<1||!p.success){res.status(400).json({error:"Invalid content"});return}
   const d=p.data as Record<string,unknown>;
   const columns=k==="categories"?["name","icon","section_slug","published"]:k==="media"?["title","type","url","category","subtitle","published"]:["title","description","category","published","information_only"];
   const values=k==="categories"?[d.name,d.icon,d.sectionSlug,d.published]:k==="media"?[d.title,d.type,d.url,d.category||null,d.subtitle||null,d.published]:[d.title,d.description,d.category||null,d.published,true];
   try{const result=await db.query("UPDATE "+table+" SET "+columns.map((c,i)=>c+"=$"+(i+1)).join(",")+" WHERE id=$"+(values.length+1)+" RETURNING *",[...values,id]);res.status(result.rowCount?200:404).json(result.rows[0]||{error:"Not found"})}
   catch{res.status(409).json({error:"Conflict or invalid reference"})}
  });
  router.delete("/api/admin/"+k+"/:id",admin,async(req,res)=>{
   const id=Number(req.params.id);
   if(!Number.isSafeInteger(id)||id<1){res.status(400).json({error:"Invalid id"});return}
   try{const result=await db.query("DELETE FROM "+table+" WHERE id=$1",[id]);res.status(result.rowCount?204:404).end()}
   catch{res.status(409).json({error:"Referenced record cannot be deleted"})}
  });
 }
 return router;
}
