import "dotenv/config";
import {Pool} from "pg";
import {readFileSync,readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
const directory=join(dirname(fileURLToPath(import.meta.url)),"../sql");
if(!process.env.DATABASE_URL)throw Error("Configure DATABASE_URL in server/.env first");
if(process.env.NODE_ENV==="production"&&process.env.ALLOW_PRODUCTION_MIGRATIONS!=="yes")
 throw Error("Production migrations require explicit ALLOW_PRODUCTION_MIGRATIONS=yes");
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try{
 await client.query("SELECT pg_advisory_lock(62021019)");
 await client.query("CREATE TABLE IF NOT EXISTS src_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())");
 const files=readdirSync(directory).filter(s=>/^\d{3}_.*\.sql$/.test(s)).sort();
 for(const file of files){
  const exists=await client.query("SELECT 1 FROM src_schema_migrations WHERE filename=$1",[file]);
  if(exists.rowCount){console.log("Already applied:",file);continue}
  console.log("Applying:",file);
  try{
   await client.query("BEGIN");
   await client.query(readFileSync(join(directory,file),"utf8"));
   await client.query("INSERT INTO src_schema_migrations(filename) VALUES($1)",[file]);
   await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw Error("Migration "+file+" failed: "+String(e))}
 }
 console.log("All SRC database migrations applied");
}finally{await client.query("SELECT pg_advisory_unlock(62021019)").catch(()=>{});client.release();await pool.end()}
