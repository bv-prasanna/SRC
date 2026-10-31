import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
const issuer="src-enterprises",audience="src-portal";
export const JWT_MAX_AGE_SECONDS=12*60*60;
function secret(){
 const value=process.env.SRC_JWT_SECRET||"";
 if(Buffer.byteLength(value,"utf8")<48)throw Error("SRC_JWT_SECRET must have at least 48 random UTF-8 bytes");
 return value;
}
const b64=(s:string)=>Buffer.from(s,"utf8").toString("base64url");
export function newJti(){return randomBytes(32).toString("hex")}
export function issueJwt(userId:number,jti:string,now=Math.floor(Date.now()/1000)){
 if(!Number.isSafeInteger(userId)||userId<1||!/^[a-f0-9]{64}$/.test(jti))throw Error("Invalid session");
 const header=b64(JSON.stringify({alg:"HS256",typ:"JWT"}));
 const payload=b64(JSON.stringify({iss:issuer,aud:aud,sub:String(userId),jti,iat:now,exp:now+JWT_MAX_AGE_SECONDS}));
 const signed=header+"."+payload;
 const signature=createHmac("sha256",secret()).update(signed).digest("base64url");
 return signed+"."+signature;
}
export function verifyJwt(token:string,now=Math.floor(Date.now()/1000)):{
 sub:number;jti:string;exp:number
}|null{
 if(typeof token!=="string"||token.length>4096||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))return null;
 try{
  const [header,payload,signature]=token.split(".");
  const expected=createHmac("sha256",secret()).update(header+"."+payload).digest();
  const got=Buffer.from(signature,"base64url");
  if(got.length!==expected.length||!timingSafeEqual(got,expected))return null;
  const h=JSON.parse(Buffer.from(header,"base64url").toString("utf8"));
  const p=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
  if(h.alg!=="HS256"||h.typ!=="JWT"||p.iss!==issuer||p.aud!==audience)return null;
  const id=Number(p.sub);
  if(!Number.isSafeInteger(id)||id<1||String(id)!==p.sub||!/^[a-f0-9]{64}$/.test(p.jti))return null;
  if(!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>now+30||p.exp<=now||p.exp-p.iat!==JWT_MAX_AGE_SECONDS)return null;
  return {sub:id,jti:p.jti,exp:p.exp};
 }catch{return null}
}
