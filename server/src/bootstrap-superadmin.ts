// One-time trusted CLI only. This is intentionally NOT exposed as an HTTP endpoint.
import "dotenv/config";
import pg from "pg";
import {hashPassword} from "./identity.js";
function validateConfig(){
 const email=(process.env.SRC_BOOTSTRAP_EMAIL||"").trim().toLowerCase();
 const password=process.env.SRC_BOOTSTRAP_PASSWORD||"";
 if(!process.env.DATABASE_URL)throw Error("DATABASE_URL required");
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw Error("SRC_BOOTSTRAP_EMAIL must be a valid email");
 if(password.length<16||Buffer.byteLength(password,"utf8")>128||!/[^A-Za-z0-9]/.test(password)||!/\d/.test(password))throw Error("Bootstrap password requires 16+ characters with a number and symbol");
 if(process.env.SRC_BOOTSTRAP_CONFIRM!=="CREATE_FIRST_SUPERADMIN")throw Error("Set SRC_BOOTSTRAP_CONFIRM=CREATE_FIRST_SUPERADMIN explicitly");
 return {email,password};
}
const {email,password}=validateConfig();
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==="require"?{rejectUnauthorized:true}:undefined});
let client;
try{
 client=await pool.connect();await client.query("BEGIN");
 await client.query("SELECT pg_advisory_xact_lock(62021020)");
 const exists=await client.query("SELECT id FROM app_users WHERE role='SUPER_ADMIN' LIMIT 1");
 if(exists.rowCount)throw Error("Super Admin already exists. Bootstrap is disabled.");
 const occupied=await client.query("SELECT id FROM app_users WHERE email=$1",[email]);
 if(occupied.rowCount)throw Error("Bootstrap email is already registered. Use a new email to prevent account takeover.");
 const hash=await hashPassword(password);
 await client.query("INSERT INTO app_users(email,password_hash,role,active) VALUES($1,$2,'SUPER_ADMIN',true)",[email,hash]);
 await client.query("COMMIT");
 console.log("First SRC Super Admin created:",email,"(credentials not logged)");
}catch(err){if(client)await client.query("ROLLBACK").catch(()=>{});console.error("Bootstrap stopped:",err instanceof Error?err.message:"Unknown failure");process.exitCode=1}
finally{client?.release();await pool.end()}
