// Trusted operator CLI, never exposed as an HTTP endpoint.
import "dotenv/config";
import pg from "pg";
import {hashPassword} from "./identity.js";
const email=(process.env.SRC_RECOVERY_EMAIL||"").trim().toLowerCase();
const password=process.env.SRC_RECOVERY_PASSWORD||"";
if(!process.env.DATABASE_URL)throw Error("DATABASE_URL required");
if(process.env.SRC_RECOVERY_CONFIRM!=="ROTATE_SUPERADMIN_PASSWORD")throw Error("Explicit recovery confirmation required");
if(!/^\S+@\S+\.\S+$/.test(email))throw Error("Valid Super Admin email required");
if(password.length<16||Buffer.byteLength(password,"utf8")>128||!/\d/.test(password)||!/[^A-Za-z0-9]/.test(password))throw Error("Recovery password requires 16+ characters, a number and a symbol");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
let c;
try{
 c=await pool.connect();await c.query("BEGIN");
 await c.query("SELECT pg_advisory_xact_lock(62021021)");
 const current=await c.query("SELECT id FROM app_users WHERE email=$1 AND role='SUPER_ADMIN' AND active=true FOR UPDATE",[email]);
 if(!current.rowCount)throw Error("No active Super Admin matches this email");
 const hash=await hashPassword(password);
 await c.query("UPDATE app_users SET password_hash=$1 WHERE id=$2",[hash,current.rows[0].id]);
 await c.query("DELETE FROM user_sessions WHERE user_id=$1",[current.rows[0].id]);
 await c.query("DELETE FROM password_reset_tokens WHERE user_id=$1",[current.rows[0].id]);
 await c.query("COMMIT");
 console.log("Super Admin password rotated. Existing sessions revoked; sign in with the new credentials.");
}catch(e){if(c)await c.query("ROLLBACK").catch(()=>{});console.error(e instanceof Error?e.message:"Recovery failed");process.exitCode=1}
finally{c?.release();await pool.end()}
