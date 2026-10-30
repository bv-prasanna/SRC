import {Router} from "express";
import {randomBytes} from "node:crypto";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import type {Pool} from "pg";
import {requireRole} from "./access.js";

export const festivalRegistrationSchema=z.object({
 fullName:z.string().trim().min(2).max(120),
 phone:z.string().regex(/^[6-9][0-9]{9}$/,"Use a 10-digit Indian mobile number"),
 email:z.union([z.string().email().max(254),z.literal("")]).optional(),
 durationMonths:z.union([z.literal(6),z.literal(10),z.literal(12)]),
 consent:z.literal(true)
}).strict();
const verifySchema=z.object({phoneLast4:z.string().regex(/^[0-9]{4}$/)}).strict();
const visitSchema=verifySchema.extend({notes:z.string().max(500).default("")});
export function newFestivalCode(year:number){
 return "SRC-"+year+"-"+randomBytes(12).toString("hex").toUpperCase();
}
export function festivalRouter(db:Pool){
 const r=Router(),shop=requireRole(db,["ADMIN","OPERATIONS"]);
 const limiter=rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many registration attempts. Please visit SRC directly."}});
 r.post("/api/festival/enrol",limiter,async(req,res)=>{
  const data=festivalRegistrationSchema.safeParse(req.body);
  if(!data.success){res.status(400).json({error:"Check the name, phone number, selected plan and consent"});return}
  const year=new Date().getUTCFullYear(),v=data.data;
  try{
   // The membership code identifies a registration; it is NOT a cracker order, scheme payment or financial entitlement.
   const code=newFestivalCode(year);
   const q=await db.query(
    "INSERT INTO festival_members(membership_code,scheme_year,full_name,phone,email,duration_months,consented_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT (scheme_year,phone,duration_months) DO NOTHING RETURNING membership_code,scheme_year,duration_months,status,created_at",
    [code,year,v.fullName,v.phone,v.email||null,v.durationMonths]);
   if(!q.rowCount){res.status(409).json({error:"This mobile number already has a registration for the selected duration. Contact SRC for help."});return}
   res.status(201).json({membershipCode:q.rows[0].membership_code,year:q.rows[0].scheme_year,durationMonths:q.rows[0].duration_months,status:q.rows[0].status,message:"Registration received. Present your membership ID and registered mobile at the SRC shop for verification. No payment or fireworks order has been made."});
  }catch{res.status(503).json({error:"Registration temporarily unavailable. Please try at the shop."})}
 });
 r.get("/api/admin/festival/members",shop,async(req,res)=>{
  const search=String(req.query.search||"").trim().slice(0,80);
  try{
   const q=await db.query(
    "SELECT m.id,m.membership_code,m.scheme_year,m.full_name,m.phone,m.email,m.duration_months,m.status,m.created_at,m.verified_at,(SELECT COUNT(*)::int FROM festival_store_visits v WHERE v.member_id=m.id) AS store_visits FROM festival_members m WHERE $1='' OR m.membership_code ILIKE '%'||$1||'%' OR m.phone LIKE '%'||$1||'%' ORDER BY m.id DESC LIMIT 200",[search]);
   res.json(q.rows);
  }catch{res.status(503).json({error:"Member list unavailable"})}
 });
 r.patch("/api/admin/festival/members/:code/verify",shop,async(req,res)=>{
  const data=verifySchema.safeParse(req.body),code=String(req.params.code||"");
  if(!data.success||!/^SRC-[0-9]{4}-[A-F0-9]{24}$/.test(code)){res.status(400).json({error:"Invalid membership ID or phone verification"});return}
  try{
   const q=await db.query(
    "UPDATE festival_members SET status='VERIFIED',verified_at=now(),verified_by=$1 WHERE membership_code=$2 AND RIGHT(phone,4)=$3 AND status='REGISTERED' RETURNING membership_code,status,verified_at",
    [res.locals.user.id,code,data.data.phoneLast4]);
   res.status(q.rowCount?200:409).json(q.rows[0]||{error:"Not found, phone mismatch, or already verified/cancelled"});
  }catch{res.status(503).json({error:"Verification unavailable"})}
 });
 r.post("/api/admin/festival/members/:code/visit",shop,async(req,res)=>{
  const data=visitSchema.safeParse(req.body),code=String(req.params.code||"");
  if(!data.success||!/^SRC-[0-9]{4}-[A-F0-9]{24}$/.test(code)){res.status(400).json({error:"Invalid visit details"});return}
  try{
   const q=await db.query(
    "INSERT INTO festival_store_visits(member_id,recorded_by,notes) SELECT id,$1,$2 FROM festival_members WHERE membership_code=$3 AND RIGHT(phone,4)=$4 AND status='VERIFIED' RETURNING id,visited_at",
    [res.locals.user.id,data.data.notes,code,data.data.phoneLast4]);
   res.status(q.rowCount?201:403).json(q.rows[0]||{error:"Verify member code and phone before logging an in-store visit"});
  }catch{res.status(503).json({error:"Store visit could not be recorded"})}
 });
 return r;
}
