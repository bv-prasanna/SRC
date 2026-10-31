import "dotenv/config";
import pg from "pg";
import { createApp } from "./app.js";
const port=Number(process.env.PORT||8080);
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL must be configured");
if(Buffer.byteLength(process.env.SRC_JWT_SECRET||"","utf8")<48)throw new Error("SRC_JWT_SECRET must be set to at least 48 random bytes");
if(process.env.NODE_ENV==="production"&&process.env.SRC_PAYMENTS_ENABLED==="true"&&(!process.env.RAZORPAY_WEBHOOK_SECRET||!process.env.SMTP_HOST))throw new Error("Live payments require verified webhook and support email configuration");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const app=createApp(pool,{corsOrigin:process.env.CORS_ORIGIN||"https://srcenterprises.in,https://www.srcenterprises.in"});
const server=app.listen(port,"0.0.0.0",()=>console.log("SRC API listening on port",port));
async function shutdown(){server.close();await pool.end();process.exit(0)}
process.once("SIGTERM",shutdown);process.once("SIGINT",shutdown);
