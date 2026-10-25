import {Router} from "express";
import {scrypt as scryptCb,randomBytes,createHash,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import type {Pool} from "pg";
import type {RequestHandler} from "express";
import {z} from "zod";
const scrypt=promisify(scryptCb);
const credentials=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(12).max(128)});
export async function hashPassword(password:string){const salt=randomBytes(16);const key=await scrypt(password,salt,64) as Buffer;return "scrypt:"+salt.toString("hex")+":"+key.toString("hex")}
export async function verifyPassword(password:string,stored:string){const [algorithm,salt,hash]=stored.split(":");if(algorithm!=="scrypt"||!salt||!hash)return false;const key=await scrypt(password,Buffer.from(salt,"hex"),64) as Buffer;const expected=Buffer.from(hash,"hex");return key.length===expected.length&&timingSafeEqual(key,expected)}
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");
export function identityRouter(db:Pool){
 const r=Router();
 const auth:RequestHandler=async(req,res,next)=>{
  const token=req.header("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token){res.status(401).json({error:"Unauthorized"});return}
  try{const q=await db.query("SELECT u.id,u.email,u.role FROM user_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",[digest(token)]);
   if(!q.rowCount){res.status(401).json({error:"Unauthorized"});return}
   res.locals.user=q.rows[0];next()
  }catch{res.status(503).json({error:"Authentication unavailable"})}
 };
 r.post("/api/auth/register",async(req,res)=>{
  const parsed=credentials.safeParse(req.body);if(!parsed.success){res.status(400).json({error:"Invalid registration"});return}
  try{const hash=await hashPassword(parsed.data.password);await db.query("INSERT INTO app_users(email,password_hash,role) VALUES($1,$2,'CUSTOMER')",[parsed.data.email,hash]);res.status(201).json({message:"Customer account registered"})}
  catch{res.status(409).json({error:"Registration unavailable or account already exists"})}
 });
 r.post("/api/auth/login",async(req,res)=>{
  const parsed=credentials.safeParse(req.body);if(!parsed.success){res.status(401).json({error:"Invalid credentials"});return}
  try{const q=await db.query("SELECT id,email,role,password_hash FROM app_users WHERE email=$1 AND active=true",[parsed.data.email]);const user=q.rows[0];
   if(!user||!await verifyPassword(parsed.data.password,user.password_hash)){res.status(401).json({error:"Invalid credentials"});return}
   const token=randomBytes(32).toString("hex");await db.query("INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[digest(token),user.id]);res.json({token,expiresInSeconds:43200,user:{id:user.id,email:user.email,role:user.role}})
  }catch{res.status(503).json({error:"Login unavailable"})}
 });
 r.get("/api/auth/me",auth,(_req,res)=>res.json({user:res.locals.user}));
 r.post("/api/auth/logout",auth,async(req,res)=>{try{const token=req.header("authorization")!.slice(7);await db.query("DELETE FROM user_sessions WHERE token_hash=$1",[digest(token)]);res.status(204).end()}catch{res.status(503).json({error:"Logout unavailable"})}});
 r.get("/api/admin/users",auth,async(_req,res)=>{if(res.locals.user.role!=="ADMIN"){res.status(403).json({error:"Forbidden"});return}try{res.json((await db.query("SELECT id,email,role,active,created_at FROM app_users ORDER BY id DESC LIMIT 500")).rows)}catch{res.status(503).json({error:"Users unavailable"})}});
 return r;
}
