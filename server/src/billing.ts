import {z} from "zod";
import type {Pool,PoolClient} from "pg";

export const quoteSchema=z.object({
 sectionSlug:z.enum(["stationery","housekeeping"]),
 items:z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().min(1).max(100)}).strict()).min(1).max(40),
 couponCode:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,36}$/).optional()
}).strict();

type Db=Pick<Pool,"query">|Pick<PoolClient,"query">;
export type ProductLine={id:number;name:string;category:string;section_slug:string;price_paise:number;fireworks:boolean;published:boolean};
export type BillRule={id:number;scope:string;section_slug:string;category:string|null;product_id:number|null;valid_from?:string;[key:string]:any};
export type CalculatedLine={productId:number;name:string;category:string;quantity:number;baseUnitPaise:number;dynamicRuleId:number|null;dynamicReason:string|null;unitPricePaise:number;subtotalPaise:number;discountPaise:number;taxablePaise:number;taxInclusive:boolean;taxes:{component:string;ruleId:number;rateBps:number;amountPaise:number;hsnSac:string|null}[];totalPaise:number};
export type Quote={sectionSlug:string;couponCode:string|null;offerId:number|null;lines:CalculatedLine[];subtotalPaise:number;dynamicAdjustmentPaise:number;discountPaise:number;taxPaise:number;totalPaise:number;currency:"INR";evaluatedAt:string;collectionEnabled:boolean};

export function matchesRule(r:BillRule,p:ProductLine,qty:number):boolean{
 if(r.section_slug!==p.section_slug)return false;
 if(r.scope==="SECTION")return true;
 if(r.scope==="CATEGORY")return r.category===p.category;
 if((r.scope==="PRODUCT"||r.scope==="ITEM")&&Number(r.product_id)===Number(p.id))return r.scope!=="ITEM"||qty>=Number(r.min_quantity||1);
 return false;
}
export const specificity=(scope:string)=>{const ranks:Record<string,number>={ITEM:4,PRODUCT:3,CATEGORY:2,SECTION:1};return ranks[scope]||0};
export function chooseRule<T extends BillRule>(rules:T[],p:ProductLine,qty:number):T|undefined{
 return rules.filter(r=>matchesRule(r,p,qty)&&(!r.min_quantity||qty>=Number(r.min_quantity))&&(!r.max_quantity||qty<=Number(r.max_quantity)))
   .sort((a,b)=>specificity(b.scope)-specificity(a.scope)||new Date(String(b.valid_from||0)).getTime()-new Date(String(a.valid_from||0)).getTime()||b.id-a.id)[0];
}
const roundDiv=(n:number,d:number)=>Math.floor((n+Math.floor(d/2))/d);
function ensureMoney(n:number){if(!Number.isSafeInteger(n)||n<0||n>100000000)throw Error("INVALID_AMOUNT");return n}

export function calculateQuote(input:z.infer<typeof quoteSchema>,products:ProductLine[],taxRules:BillRule[],priceRules:BillRule[],offers:BillRule[],at=new Date()):Quote{
 const ids=new Set(input.items.map(x=>x.productId));
 if(ids.size!==input.items.length)throw Error("DUPLICATE_PRODUCT");
 const map=new Map(products.map(p=>[Number(p.id),p]));
 const lines:CalculatedLine[]=[];
 let base=0,subtotal=0;
 for(const item of input.items){
  const p=map.get(item.productId);
  if(!p||!p.published||p.fireworks||p.section_slug!==input.sectionSlug||Number(p.price_paise)<=0||/\(DEMO\)$| - Demo$/i.test(p.name))throw Error("INVALID_PRODUCT");
  const perUnit=ensureMoney(Number(p.price_paise)),qty=item.quantity;
  const dyn=chooseRule(priceRules,p,qty);
  const adjustment=Number(dyn?.adjustment_bps||0);
  const unit=ensureMoney(roundDiv(perUnit*(10000+adjustment),10000));
  if(unit<1)throw Error("INVALID_AMOUNT");
  const lineTotal=ensureMoney(unit*qty);
  base=ensureMoney(base+perUnit*qty);subtotal=ensureMoney(subtotal+lineTotal);
  lines.push({productId:Number(p.id),name:p.name,category:p.category,quantity:qty,baseUnitPaise:perUnit,dynamicRuleId:dyn?.id||null,dynamicReason:dyn?.reason||null,unitPricePaise:unit,subtotalPaise:lineTotal,discountPaise:0,taxablePaise:0,taxInclusive:false,taxes:[],totalPaise:0});
 }
 const eligible=offers.filter(r=>input.items.some(i=>matchesRule(r,map.get(i.productId)!,i.quantity)));
 const candidates=eligible.filter(o=>input.couponCode?o.code===input.couponCode:!o.code);
 const ranked=candidates.map(o=>{
  const eligibleTotal=lines.reduce((n,l)=>n+(matchesRule(o,map.get(l.productId)!,l.quantity)?l.subtotalPaise:0),0);
  let discount=eligibleTotal<Number(o.min_subtotal_paise||0)?0:o.kind==="PERCENT"?roundDiv(eligibleTotal*Number(o.value),10000):Number(o.value);
  discount=Math.min(discount,eligibleTotal,Number(o.max_discount_paise||eligibleTotal));
  return {rule:o,discount};
 }).filter(x=>x.discount>0).sort((a,b)=>b.discount-a.discount||a.rule.id-b.rule.id);
 if(input.couponCode&&!ranked.length)throw Error("INVALID_COUPON");
 const selected=ranked[0];
 if(selected){
  const qualifying=lines.filter(l=>matchesRule(selected.rule,map.get(l.productId)!,l.quantity));
  const eligibleTotal=qualifying.reduce((sum,l)=>sum+l.subtotalPaise,0);
  let remaining=selected.discount;
  qualifying.forEach((l,i)=>{
   const amount=i===qualifying.length-1?remaining:Math.floor(selected.discount*l.subtotalPaise/eligibleTotal);
   l.discountPaise=amount;remaining-=amount;
  });
 }
 let taxPaise=0,discountPaise=0,totalPaise=0;
 for(const l of lines){
  const p=map.get(l.productId)!;
  const components=["CGST","SGST","IGST","CESS","OTHER"].map(component=>chooseRule(taxRules.filter(t=>t.component===component),p,l.quantity)).filter(Boolean) as BillRule[];
  if(components.some(t=>!!t.tax_inclusive)!==components.every(t=>!!t.tax_inclusive))throw Error("MIXED_TAX_MODES");
  if(components.some(x=>x.component==="IGST")&&components.some(x=>x.component==="CGST"||x.component==="SGST"))throw Error("CONFLICTING_TAX_COMPONENTS");
  const inclusive=components.length>0&&!!components[0].tax_inclusive;
  const net=l.subtotalPaise-l.discountPaise;
  const rate=components.reduce((sum,t)=>sum+Number(t.rate_bps),0);
  const taxable=inclusive&&rate>0?Math.round(net*10000/(10000+rate)):net;
  l.taxablePaise=taxable;l.taxInclusive=inclusive;
  let taxSplit=0;
  l.taxes=components.map((t,i)=>{
   let amount=roundDiv(taxable*Number(t.rate_bps),10000);
   if(inclusive&&i===components.length-1)amount=Math.max(0,net-taxable-taxSplit);
   if(inclusive&&i<components.length-1)amount=Math.min(amount,Math.max(0,net-taxable-taxSplit));
   taxSplit+=amount;
   return {component:t.component,ruleId:t.id,rateBps:Number(t.rate_bps),amountPaise:amount,hsnSac:t.hsn_sac||null};
  });
  const lineTax=l.taxes.reduce((n,t)=>n+t.amountPaise,0);
  l.totalPaise=ensureMoney(inclusive?net:net+lineTax);
  discountPaise+=l.discountPaise;taxPaise+=lineTax;totalPaise=ensureMoney(totalPaise+l.totalPaise);
 }
 return {sectionSlug:input.sectionSlug,couponCode:input.couponCode||null,offerId:selected?.rule.id||null,lines,subtotalPaise:subtotal,dynamicAdjustmentPaise:subtotal-base,discountPaise,taxPaise,totalPaise,currency:"INR",evaluatedAt:at.toISOString(),collectionEnabled:false};
}

export async function quoteFromDb(db:Db,raw:unknown):Promise<Quote>{
 const parsed=quoteSchema.safeParse(raw);
 if(!parsed.success)throw Error("INVALID_QUOTE");
 const v=parsed.data;
 const section=await db.query("SELECT active,commerce_mode FROM business_sections WHERE slug=$1",[v.sectionSlug]);
 if(!section.rows[0]?.active||section.rows[0].commerce_mode!=="STANDARD")throw Error("INVALID_SECTION");
 const ids=v.items.map(x=>x.productId);
 const products=(await db.query("SELECT id,name,category,section_slug,price_paise,fireworks,published FROM products WHERE id=ANY($1::bigint[])",[ids])).rows;
 const [tax,price,offer]=await Promise.all([
  db.query("SELECT * FROM src_tax_rules WHERE section_slug=$1 AND active=true AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now())",[v.sectionSlug]),
  db.query("SELECT * FROM src_dynamic_pricing_rules WHERE section_slug=$1 AND active=true AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now())",[v.sectionSlug]),
  db.query("SELECT * FROM src_sales_offers WHERE section_slug=$1 AND active=true AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now())",[v.sectionSlug])
 ]);
 return calculateQuote(v,products,tax.rows,price.rows,offer.rows);
}
