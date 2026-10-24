import "dotenv/config";
import pg from "pg";
import { createApp } from "./app.js";
const port=Number(process.env.PORT||8080);
const token=process.env.SRC_ADMIN_TOKEN||"";
if(token.length<32)throw new Error("Set SRC_ADMIN_TOKEN to a strong random secret (32+ chars)");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
createApp(pool,{adminToken:token,corsOrigin:process.env.CORS_ORIGIN||"https://srcenterprises.in"}).listen(port,()=>console.log("SRC API listening on",port));
