import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import type { RequestHandler } from "express";
export const schemeDraftSchema=z.object({
 name:z.string().trim().min(2).max(120),
 sectionSlug:z.string().regex(/^[a-z][a-z0-9-]+$/),
 durationMonths:z.number().int().min(1).max(60),
 frequency:z.enum(["MONTHLY","QUARTERLY"]),
 amountPaise:z.number().int().positive(),
 internalNotes:z.string().max(4000).default("")
});
export function schemeRouter(pool:Pick<Pool,"query">,admin:RequestHandler){
 const r=Router();
 r.get("/api/admin/scheme-drafts",admin,async(_req,res)=>{try{res.json((await pool.query("SELECT * FROM scheme_drafts ORDER BY id DESC")).rows)}catch{res.status(503).json({error:"Database unavailable"})}});
 r.post("/api/admin/scheme-drafts",admin,async(req,res)=>{
  const checked=schemeDraftSchema.safeParse(req.body);if(!checked.success){res.status(400).json({error:"Invalid draft",details:checked.error.flatten()});return}
  const v=checked.data;
  try{const q=await pool.query("INSERT INTO scheme_drafts(name,section_slug,duration_months,frequency,amount_paise,internal_notes,status) VALUES($1,$2,$3,$4,$5,$6,'DRAFT') RETURNING *",[v.name,v.sectionSlug,v.durationMonths,v.frequency,v.amountPaise,v.internalNotes]);res.status(201).json(q.rows[0])}
  catch{res.status(400).json({error:"Invalid section or database unavailable"})}
 });
 r.delete("/api/admin/scheme-drafts/:id",admin,async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1){res.status(400).json({error:"Invalid id"});return}
  try{const q=await pool.query("DELETE FROM scheme_drafts WHERE id=$1",[id]);res.status(q.rowCount?204:404).end()}catch{res.status(503).json({error:"Database unavailable"})}
 });
 return r;
}
