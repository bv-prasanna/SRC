import express from "express";
import {createHash} from "node:crypto";
import cors from "cors";
import helmet from "helmet";
import {rateLimit} from "express-rate-limit";
import { z } from "zod";
import type { Pool } from "pg";
import { sectionsRouter } from "./sections.js";
import { schemeRouter } from "./schemes.js";
import { contentRouter } from "./content.js";
import { orderRouter } from "./orders.js";
import { inventoryRouter } from "./inventory.js";
import { identityRouter } from "./identity.js";
import { fulfillmentRouter } from "./fulfillment.js";
import { commerceRouter,paymentWebhook } from "./commerce.js";
import { agentsRouter } from "./agents.js";
import { recoveryRouter } from "./recovery.js";
import { paidOrdersRouter } from "./paidOrders.js";
import { workspacesRouter } from "./workspaces.js";
import { festivalRouter } from "./festival.js";
export const catalogueSchema=z.object({name:z.string().trim().min(1).max(150),category:z.string().trim().min(1).max(100),description:z.string().max(1500).default(""),imageUrl:z.string().url().refine(s=>s.startsWith("https://")).optional().nullable(),demoVideoUrl:z.string().url().refine(s=>s.startsWith("https://")).optional().nullable(),published:z.boolean().default(false),fireworks:z.boolean().default(true),sectionSlug:z.string().default('crackers'),pricePaise:z.number().int().min(0).default(0)});
export function createApp(pool:Pick<Pool,"query">,config:{adminToken:string;corsOrigin:string}){
 const app=express();app.disable("x-powered-by");app.set("trust proxy",process.env.TRUST_PROXY==="true"?1:false);app.use(helmet());app.use(cors({origin:config.corsOrigin.split(",").map(s=>s.trim())}));
 app.post("/api/payments/webhook",express.raw({type:"application/json",limit:"128kb"}),paymentWebhook(pool as Pool));
 app.use(express.json({limit:"100kb"}));
 const authLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many attempts. Try later."}});
 app.use(["/api/auth/login","/api/auth/register","/api/auth/password/forgot","/api/auth/password/reset"],authLimiter);

 const admin:express.RequestHandler=async(req,res,next)=>{
 const h=req.header("authorization")||"";
 if(process.env.NODE_ENV!=="production"&&config.adminToken.length>=32&&h===`Bearer ${config.adminToken}`){next();return}
 const token=h.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token){res.status(401).json({error:"Unauthorized"});return}
 try{
  const digest=createHash("sha256").update(token).digest("hex");
  const user=await pool.query("SELECT u.id FROM user_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true AND u.role='ADMIN'",[digest]);
  if(!user.rowCount){res.status(403).json({error:"Admin access required"});return}
  next()
 }catch{res.status(503).json({error:"Authorization unavailable"})}
};
 app.use(identityRouter(pool as Pool));app.use(sectionsRouter(pool,admin));app.use(schemeRouter(pool,admin));app.use(contentRouter(pool,admin));app.use(orderRouter(pool as Pool,admin));app.use(inventoryRouter(pool as Pool,admin));app.use(fulfillmentRouter(pool as Pool,admin));app.use(agentsRouter(pool as Pool));app.use(recoveryRouter(pool as Pool));app.use(commerceRouter(pool as Pool));app.use(paidOrdersRouter(pool as Pool));app.use(workspacesRouter(pool as Pool));app.use(festivalRouter(pool as Pool));
 app.get("/health",(_req,res)=>res.json({status:"ok"}));
 app.get("/api/catalog/products",async(_req,res)=>{try{const r=await pool.query("select id,name,category,description,image_url as \"imageUrl\",demo_video_url as \"demoVideoUrl\",published,fireworks,section_slug as \"sectionSlug\",price_paise as \"pricePaise\" from products where published=true order by name");res.json(r.rows)}catch{res.status(503).json({error:"Catalogue unavailable"})}});
 app.get("/api/admin/products",admin,async(_req,res)=>{try{const r=await pool.query("select * from products order by id desc");res.json(r.rows)}catch{res.status(503).json({error:"Database unavailable"})}});
 app.post("/api/admin/products",admin,async(req,res)=>{const parsed=catalogueSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:"Validation failed",details:parsed.error.flatten()});return;}const p=parsed.data;try{const r=await pool.query("insert into products(name,category,description,image_url,demo_video_url,published,fireworks,section_slug,price_paise) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",[p.name,p.category,p.description,p.imageUrl||null,p.demoVideoUrl||null,p.published,p.fireworks,p.sectionSlug,p.pricePaise]);res.status(201).json(r.rows[0])}catch{res.status(503).json({error:"Database unavailable"})}});
 app.put("/api/admin/products/:id",admin,async(req,res)=>{const id=Number(req.params.id),parsed=catalogueSchema.safeParse(req.body);if(!Number.isSafeInteger(id)||id<1||!parsed.success){res.status(400).json({error:"Invalid product"});return;}const p=parsed.data;try{const r=await pool.query("update products set name=$1,category=$2,description=$3,image_url=$4,demo_video_url=$5,published=$6,fireworks=$7,section_slug=$8,price_paise=$9 where id=$10 returning *",[p.name,p.category,p.description,p.imageUrl||null,p.demoVideoUrl||null,p.published,p.fireworks,p.sectionSlug,p.pricePaise,id]);res.status(r.rowCount?200:404).json(r.rows[0]||{error:"Not found"})}catch{res.status(503).json({error:"Database unavailable"})}});
 app.delete("/api/admin/products/:id",admin,async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1){res.status(400).json({error:"Invalid id"});return;}try{const r=await pool.query("delete from products where id=$1",[id]);res.status(r.rowCount?204:404).end()}catch{res.status(503).json({error:"Database unavailable"})}});
 app.use((_req,res)=>res.status(404).json({error:"Not found"}));return app;
}
