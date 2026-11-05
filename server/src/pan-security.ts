import {createCipheriv,randomBytes} from "node:crypto";

export function panEncryptionConfigured():boolean{
 return /^[a-fA-F0-9]{64}$/.test(process.env.SRC_PAN_ENCRYPTION_KEY||"");
}
export function encryptedPan(pan:string,membershipCode:string):string{
 const key=process.env.SRC_PAN_ENCRYPTION_KEY||"";
 if(!/^[a-fA-F0-9]{64}$/.test(key))throw new Error("PAN_ENCRYPTION_NOT_CONFIGURED");
 if(!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))throw new Error("INVALID_PAN");
 const iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",Buffer.from(key,"hex"),iv);
 cipher.setAAD(Buffer.from(membershipCode,"utf8"));
 const enc=Buffer.concat([cipher.update(pan,"utf8"),cipher.final()]);
 return [iv,cipher.getAuthTag(),enc].map(b=>b.toString("base64url")).join(".");
}
export function panLastFourDigits(pan:string):string{
 if(!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))throw Error("INVALID_PAN");
 return pan.slice(5,9);
}
export function maskedPan(digits:string|null|undefined):string|null{
 return digits&&/^[0-9]{4}$/.test(digits)?"*****"+digits+"*":null;
}
