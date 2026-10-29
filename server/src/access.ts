import {createHash} from "node:crypto";
import type {Pool} from "pg";
import type {RequestHandler} from "express";
export type Role="CUSTOMER"|"AGENT"|"ADMIN";
export function digestToken(s:string){return createHash("sha256").update(s).digest("hex")}
export function requireRole(db:Pick<Pool,"query">,roles:Role[]):RequestHandler{
 return async(req,res,next)=>{
  const token=req.header("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token){res.status(401).json({error:"Sign in required"});return}
  try{const result=await db.query("SELECT u.id,u.email,u.role FROM user_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",[digestToken(token)]);
   const u=result.rows[0];if(!u){res.status(401).json({error:"Session expired"});return}
   if(!roles.includes(u.role)){res.status(403).json({error:"Insufficient privileges"});return}
   res.locals.user=u;next();
  }catch{res.status(503).json({error:"Session validation unavailable"})}
 };
}
