import "dotenv/config";
import {Pool} from "pg";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
if(process.env.NODE_ENV==="production")throw Error("Never load demo products into production");
if(!process.env.DATABASE_URL)throw Error("DATABASE_URL missing");
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{
 await pool.query(readFileSync(join(dirname(fileURLToPath(import.meta.url)),"../sql/dev_seed_catalogue_v3.sql"),"utf8"));
 const data=await pool.query("SELECT section_slug,COUNT(*)::int AS count FROM products WHERE name LIKE '%(DEMO)' GROUP BY section_slug ORDER BY section_slug");
 console.log("SRC demo catalogue:",data.rows);
}finally{await pool.end()}
