import test from "node:test";
import assert from "node:assert/strict";
import {calculateQuote,chooseRule,quoteSchema} from "./billing.js";
import {validateBillingRule} from "./billing-admin.js";
const product={id:10,name:"A4 Paper",category:"Paper",section_slug:"stationery",price_paise:10000,fireworks:false,published:true};
const goods=[product];
const input={sectionSlug:"stationery" as const,items:[{productId:10,quantity:2}]};
const rule=(id:number,changes:Record<string,unknown>={})=>({id,scope:"SECTION",section_slug:"stationery",category:null,product_id:null,valid_from:"2026-01-01T00:00:00Z",...changes});
test("no configured tax or offer means catalogue subtotal",()=>{
 const q=calculateQuote(input,goods,[],[],[]);assert.equal(q.totalPaise,20000);assert.equal(q.taxPaise,0);assert.equal(q.discountPaise,0)
});
test("taxes apply after fixed coupon discount",()=>{
 const tax=[rule(1,{component:"CGST",rate_bps:900,tax_inclusive:false}),rule(2,{component:"SGST",rate_bps:900,tax_inclusive:false})];
 const offer=[rule(3,{kind:"FIXED",value:2000,code:"SAVE20",min_subtotal_paise:0})];
 const q=calculateQuote({...input,couponCode:"SAVE20"},goods,tax,[],offer);
 assert.equal(q.discountPaise,2000);assert.equal(q.taxPaise,3240);assert.equal(q.totalPaise,21240);
 assert.equal(q.lines[0].taxablePaise,18000);
});
test("tax-inclusive tax must not be added twice",()=>{
 const included=[{...product,price_paise:11800}];
 const q=calculateQuote({sectionSlug:"stationery",items:[{productId:10,quantity:1}]},included,[rule(1,{component:"IGST",rate_bps:1800,tax_inclusive:true})],[],[]);
 assert.equal(q.taxPaise,1800);assert.equal(q.totalPaise,11800);assert.equal(q.lines[0].taxablePaise,10000);
});
test("most specific tax component wins for a product",()=>{
 const broad=rule(1,{component:"CGST",rate_bps:600});
 const category=rule(2,{scope:"CATEGORY",category:"Paper",component:"CGST",rate_bps:900});
 const item=rule(3,{scope:"ITEM",product_id:10,component:"CGST",rate_bps:1200});
 const q=calculateQuote(input,goods,[broad,category,item],[],[]);
 assert.equal(q.lines[0].taxes[0].rateBps,1200);assert.equal(q.taxPaise,2400);
});
test("dynamic pricing supports transparent quantity thresholds",()=>{
 const increase=rule(1,{adjustment_bps:2000,reason:"High-demand period"});
 const bulk=rule(2,{scope:"ITEM",product_id:10,min_quantity:2,adjustment_bps:-1000,reason:"Two-unit promotion"});
 const q=calculateQuote(input,goods,[],[increase,bulk],[]);
 assert.equal(q.lines[0].unitPricePaise,9000);assert.equal(q.dynamicAdjustmentPaise,-2000);assert.equal(q.totalPaise,18000);
});
test("one best eligible offer is selected, not stacked",()=>{
 const offers=[rule(1,{kind:"PERCENT",value:1000,code:null,min_subtotal_paise:0}),rule(2,{kind:"FIXED",value:2500,code:null,min_subtotal_paise:0})];
 const q=calculateQuote(input,goods,[],[],offers);assert.equal(q.offerId,2);assert.equal(q.discountPaise,2500);
});
test("unknown coupon rejected; coupon does not stack automatic promotion",()=>{
 const offers=[rule(1,{kind:"PERCENT",value:1000,code:null,min_subtotal_paise:0}),rule(2,{kind:"FIXED",value:1000,code:"HELLO",min_subtotal_paise:0})];
 assert.throws(()=>calculateQuote({...input,couponCode:"BAD"},goods,[],[],offers),/INVALID_COUPON/);
 assert.equal(calculateQuote({...input,couponCode:"HELLO"},goods,[],[],offers).discountPaise,1000);
});
test("mixed tax inclusion modes and conflicting interstate components are rejected",()=>{
 assert.throws(()=>calculateQuote(input,goods,[rule(1,{component:"CGST",rate_bps:900,tax_inclusive:false}),rule(2,{component:"SGST",rate_bps:900,tax_inclusive:true})],[],[]),/MIXED_TAX_MODES/);
 assert.throws(()=>calculateQuote(input,goods,[rule(1,{component:"IGST",rate_bps:1800}),rule(2,{component:"CGST",rate_bps:900})],[],[]),/CONFLICTING_TAX_COMPONENTS/)
});
test("invalid products, duplicate items and forbidden sections are rejected",()=>{
 assert.throws(()=>calculateQuote({...input,items:[...input.items,...input.items]},goods,[],[],[]),/DUPLICATE_PRODUCT/);
 assert.throws(()=>calculateQuote(input,[{...product,fireworks:true}],[],[],[]),/INVALID_PRODUCT/);
 assert.equal(quoteSchema.safeParse({sectionSlug:"crackers",items:input.items}).success,false);
});
test("admin rule validation disallows wrong product scope and excessive discounts",()=>{
 const base={name:"Stationery line tax",scope:"ITEM",sectionSlug:"stationery",category:null,productId:10,active:true,validUntil:null,component:"CGST",rateBps:900,taxInclusive:false,hsnSac:"4802"};
 assert.equal(validateBillingRule("taxes",base).rateBps,900);
 assert.throws(()=>validateBillingRule("taxes",{...base,sectionSlug:"crackers"}));
 assert.throws(()=>validateBillingRule("taxes",{...base,productId:null}));
 assert.throws(()=>validateBillingRule("offers",{...base,component:undefined,rateBps:undefined,kind:"PERCENT",value:10001,code:null,minSubtotalPaise:0,maxDiscountPaise:null,description:""}));
});

test("database string IDs still match product and line-item rules",()=>{
 const dbProducts=[{...product,id:"10"}] as unknown as typeof goods;
 const itemTax=rule(41,{scope:"ITEM",product_id:"10",component:"CGST",rate_bps:900});
 const itemPrice=rule(42,{scope:"PRODUCT",product_id:"10",adjustment_bps:-1000,reason:"Promo for product"});
 const itemOffer=rule(43,{scope:"ITEM",product_id:"10",kind:"FIXED",value:1000,code:"ITEM10"});
 const result=calculateQuote({...input,couponCode:"ITEM10"},dbProducts,[itemTax],[itemPrice],[itemOffer]);
 assert.equal(result.dynamicAdjustmentPaise,-2000);
 assert.equal(result.discountPaise,1000);
 assert.equal(result.taxPaise,1530);
 assert.equal(result.totalPaise,18530);
});
