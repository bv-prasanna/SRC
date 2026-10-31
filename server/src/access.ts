import {createHash} from "node:crypto";
import type {Pool} from "pg";
import type {RequestHandler} from "express";
import {verifyJwt} from "./jwt.js";
export type Role="CUSTOMER"|"AGENT"|"ADMIN"|"SUPER_ADMIN"|"DELIVERY"|"PROCUREMENT"|"PACKING"|"OPERATIONS";
export const ALL_ROLES:Role[]=["CUSTOMER","AGENT","ADMIN","SUPER_ADMIN","DELIVERY","PROCUREMENT","PACKING","OPERATIONS"];
export function digestToken(s:string){return createHash("sha256").update(s).digest("hex")}
export function requireRole(db:Pick<Pool,"query">,roles:Role[]):RequestHandler{
 return async(req,res,next)=>{
  const auth=req.header("authorization")||"";
  const match=auth.match(/^Bearer ([\w.-]+)$/);
  const claims=match?verifyJwt(match[1]):null;
  if(!claims){res.status(401).json({error:"Sign in required"});return}
  try{
   const result=await db.query("SELECT u.id,u.email,u.role FROM user_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.id=$2 AND u.active=true",[digestToken(claims.jti),claims.sub]);
   const user=result.rows[0];
   if(!user){res.status(401).json({error:"Session expired or revoked"});return}
   const permitted=roles.includes(user.role)||(user.role==="SUPER_ADMIN"&&roles.includes("ADMIN"));
   if(!permitted){res.status(403).json({error:"Insufficient privileges"});return}
   res.locals.user=user;res.locals.jwtJti=claims.jti;next();
  }catch{res.status(503).json({error:"Session validation unavailable"})}
 };
}
export const requireAuthenticated=(db:Pick<Pool,"query">)=>requireRole(db,ALL_ROLES);
