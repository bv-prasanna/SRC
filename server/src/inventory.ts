import {Router} from "express";
import type {Pool} from "pg";
import type {RequestHandler} from "express";
import {z} from "zod";
export const stockSchema=z.object({productId:z.number().int().positive(),warehouseCode:z.string().trim().min(2).max(60),reorderLevel:z.number().int().min(0).default(0)});
export const movementSchema=z.object({productId:z.number().int().positive(),warehouseCode:z.string().trim().min(2).max(60),delta:z.number().int().refine(n=>n!==0),reason:z.string().trim().min(3).max(120)});
export function inventoryRouter(pool:Pool,admin:RequestHandler){
 const router=Router();
 router.get("/api/admin/inventory",admin,async(_req,res)=>{try{res.json((await pool.query("SELECT s.id,s.product_id,s.warehouse_code,s.on_hand,s.reorder_level,p.name AS product_name FROM stock_levels s JOIN products p ON p.id=s.product_id ORDER BY s.warehouse_code,p.name")).rows)}catch{res.status(503).json({error:"Inventory unavailable"})}});
 router.post("/api/admin/inventory",admin,async(req,res)=>{const v=stockSchema.safeParse(req.body);if(!v.success){res.status(400).json({error:"Invalid stock record"});return}const d=v.data;try{const r=await pool.query("INSERT INTO stock_levels(product_id,warehouse_code,reorder_level) VALUES($1,$2,$3) ON CONFLICT(product_id,warehouse_code) DO UPDATE SET reorder_level=EXCLUDED.reorder_level RETURNING *",[d.productId,d.warehouseCode,d.reorderLevel]);res.status(201).json(r.rows[0])}catch{res.status(409).json({error:"Invalid product or warehouse"})}});
 router.post("/api/admin/inventory/movements",admin,async(req,res)=>{const parsed=movementSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:"Invalid stock movement"});return}const v=parsed.data;let client;try{client=await pool.connect();await client.query("BEGIN");const updated=await client.query("UPDATE stock_levels SET on_hand=on_hand+$1,updated_at=now() WHERE product_id=$2 AND warehouse_code=$3 AND on_hand+$1>=0 RETURNING *",[v.delta,v.productId,v.warehouseCode]);if(!updated.rowCount){await client.query("ROLLBACK");res.status(409).json({error:"Missing stock record or insufficient quantity"});return}await client.query("INSERT INTO stock_movements(stock_level_id,delta,reason) VALUES($1,$2,$3)",[updated.rows[0].id,v.delta,v.reason]);await client.query("COMMIT");res.json(updated.rows[0])}catch{if(client)await client.query("ROLLBACK").catch(()=>{});res.status(503).json({error:"Inventory update failed"})}finally{client?.release()}});
 return router;
}
