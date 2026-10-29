// Local operator-only bootstrap. Run on the trusted server, never expose as an HTTP route.
// First register the account using /api/auth/register; then promote explicitly.
import "dotenv/config";
import pg from "pg";
const email=process.argv[2]?.trim().toLowerCase();
if(!email||!/^\S+@\S+\.\S+$/.test(email)){console.error("Usage: npm run promote-admin -- admin@example.com");process.exit(2)}
if(!process.env.DATABASE_URL){console.error("DATABASE_URL is required");process.exit(2)}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
 const result=await pool.query("UPDATE app_users SET role='ADMIN' WHERE email=$1 AND active=true RETURNING id,email,role",[email]);
 if(!result.rowCount){console.error("No active registered account found. Register it first.");process.exitCode=1}
 else console.log("Admin provisioned:",result.rows[0].email);
}catch(err){console.error("Admin provisioning failed",err);process.exitCode=1}
finally{await pool.end()}
