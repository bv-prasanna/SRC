import {Router} from "express";
import {scrypt as scryptCb,randomBytes,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import type {Pool} from "pg";
import {z} from "zod";
import {digestToken,requireAuthenticated,requireRole} from "./access.js";
import {issueJwt,newJti,JWT_MAX_AGE_SECONDS} from "./jwt.js";
const scrypt=promisify(scryptCb);
const credentials=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(12).max(128)}).strict();
export async function hashPassword(password:string){const salt=randomBytes(16);const key=await scrypt(password,salt,64) as Buffer;return "scrypt:"+salt.toString("hex")+":"+key.toString("hex")}
export async function verifyPassword(password:string,stored:string){
 try{
  const [algorithm,salt,hash]=stored.split(":");
  if(algorithm!=="scrypt"||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hash))return false;
  const key=await scrypt(password,Buffer.from(salt,"hex"),64) as Buffer;
  const expected=Buffer.from(hash,"hex");
  return timingSafeEqual(key,expected);
 }catch{return false}
}
export function identityRouter(db:Pool){
 const r=Router(),auth=requireAuthenticated(db);
 r.post("/api/auth/register",async(req,res)=>{
  const v=credentials.safeParse(req.body);if(!v.success){res.status(400).json({error:"Invalid registration"});return}
  try{const hash=await hashPassword(v.data.password);await db.query("INSERT INTO app_users(email,password_hash,role) VALUES($1,$2,'CUSTOMER')",[v.data.email,hash]);res.status(201).json({message:"Customer account registered"})}
  catch{res.status(409).json({error:"Account already exists or registration unavailable"})}
 });
 r.post("/api/auth/login",async(req,res)=>{
  const v=credentials.safeParse(req.body);if(!v.success){res.status(401).json({error:"Invalid credentials"});return}
  try{
   const q=await db.query("SELECT id,email,role,password_hash FROM app_users WHERE email=$1 AND active=true",[v.data.email]);
   const u=q.rows[0];
   if(!u||!await verifyPassword(v.data.password,u.password_hash)){res.status(401).json({error:"Invalid credentials"});return}
   const jti=newJti(),token=issueJwt(Number(u.id),jti);
   await db.query("INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[digestToken(jti),u.id]);
   res.setHeader("Cache-Control","no-store");
   res.json({token,tokenType:"Bearer",expiresInSeconds:JWT_MAX_AGE_SECONDS,user:{id:u.id,email:u.email,role:u.role}});
  }catch{res.status(503).json({error:"Login unavailable"})}
 });
 r.get("/api/auth/me",auth,(_req,res)=>{res.setHeader("Cache-Control","no-store");res.json({user:res.locals.user})});
 r.post("/api/auth/logout",auth,async(_req,res)=>{
  try{await db.query("DELETE FROM user_sessions WHERE token_hash=$1",[digestToken(res.locals.jwtJti)]);res.status(204).end()}
  catch{res.status(503).json({error:"Logout unavailable"})}
 });
 r.get("/api/admin/users",requireRole(db,["ADMIN"]),async(_req,res)=>{
  try{res.json((await db.query("SELECT id,email,role,active,created_at FROM app_users ORDER BY id DESC LIMIT 500")).rows)}
  catch{res.status(503).json({error:"Users unavailable"})}
 });
 return r;
}
