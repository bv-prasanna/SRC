import {Router} from "express";
import {randomBytes} from "node:crypto";
import {z} from "zod";
import nodemailer from "nodemailer";
import type {Pool} from "pg";
import {digestToken} from "./access.js";
import {hashPassword} from "./identity.js";
const emailSchema=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase())});
const resetSchema=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12).max(128)});
const smtpAvailable=()=>!!(process.env.SMTP_HOST&&process.env.SMTP_FROM&&process.env.APP_PUBLIC_URL);
async function sendReset(email:string,token:string){
 const host=process.env.SMTP_HOST||"",port=Number(process.env.SMTP_PORT||587);
 const transporter=nodemailer.createTransport({host,port,secure:port===465,auth:process.env.SMTP_USER&&process.env.SMTP_PASS?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});
 const link=(process.env.APP_PUBLIC_URL||"").replace(/\/$/,"")+"/reset.html?token="+token;
 await transporter.sendMail({from:process.env.SMTP_FROM,to:email,subject:"SRC account password reset",text:"Reset your SRC password using this link (valid for 30 minutes): "+link+"\nIf you did not request this, ignore this message."});
}
export function recoveryRouter(db:Pool){
 const r=Router();
 r.post("/api/auth/password/forgot",async(req,res)=>{
  const v=emailSchema.safeParse(req.body);if(!v.success){res.status(400).json({error:"Valid email required"});return}
  // Generic response prevents account discovery.
  const response={message:"If this account exists, reset instructions will be emailed."};
  if(!smtpAvailable()){res.status(503).json({error:"Password recovery email is not configured"});return}
  try{
   const q=await db.query("SELECT id FROM app_users WHERE email=$1 AND active=true",[v.data.email]);
   if(q.rowCount){
    const token=randomBytes(32).toString("hex");
    await db.query("DELETE FROM password_reset_tokens WHERE user_id=$1",[q.rows[0].id]);
    await db.query("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",[digestToken(token),q.rows[0].id]);
    try{await sendReset(v.data.email,token)}catch{await db.query("DELETE FROM password_reset_tokens WHERE token_hash=$1",[digestToken(token)]);res.status(503).json({error:"Password recovery email could not be sent"});return}
   }
   res.json(response);
  }catch{res.status(503).json({error:"Password recovery temporarily unavailable"})}
 });
 r.post("/api/auth/password/reset",async(req,res)=>{
  const v=resetSchema.safeParse(req.body);if(!v.success){res.status(400).json({error:"Invalid reset request"});return}
  let client;try{client=await db.connect();await client.query("BEGIN");
   const t=await client.query("SELECT user_id FROM password_reset_tokens WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL FOR UPDATE",[digestToken(v.data.token)]);
   if(!t.rowCount){await client.query("ROLLBACK");res.status(400).json({error:"Reset token expired or invalid"});return}
   const hash=await hashPassword(v.data.password);
   await client.query("UPDATE app_users SET password_hash=$1 WHERE id=$2",[hash,t.rows[0].user_id]);
   await client.query("UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1",[digestToken(v.data.token)]);
   await client.query("DELETE FROM user_sessions WHERE user_id=$1",[t.rows[0].user_id]);
   await client.query("COMMIT");res.json({message:"Password updated. Please sign in again."});
  }catch{if(client)await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Reset failed"})}finally{client?.release()}
 });
 return r;
}
