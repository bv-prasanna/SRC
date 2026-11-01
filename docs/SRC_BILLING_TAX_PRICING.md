# SRC Enterprises — Tax, Billing, Offers and Dynamic Pricing (v1)

This module is for the **Stationery** and **Housekeeping** standard-goods sections only. The **Deepavali Scheme** and **Crackers** sections remain outside online checkout, subscription charging and product pricing. Configuring rules does not activate Razorpay payments.

## Admin screen

Open `/billing-admin.html` and sign in with `ADMIN` or `SUPER_ADMIN`. The SRC Control Centre links to **Finance & Pricing**.

Five modules:
1. **Tax rules** — create/edit/deactivate individual CGST, SGST, IGST, CESS or OTHER tax components. Configure rates in %, price treatment (inclusive/exclusive), HSN/SAC reference, status, effective start/end. Rules can be assigned to section, category, product or line-item scope.
2. **Dynamic pricing** — automatic, transparent price adjustment in basis points (percentage increase/decrease), reason, dates, minimum/maximum ordered quantity, and scope. **No device/OS/identity-based price discrimination.**
3. **Offers & coupons** — percentage or fixed discount, auto (no code) or coupon code, scope, minimum eligible subtotal, discount cap, activation and dates. Only one best eligible automatic offer, or one specified valid coupon, is applied; no stacking.
4. **Merchant & invoices** — seller name, GSTIN, state code, document prefix, and default **invoice email OFF**. The customer can download a draft bill from payment history. No auto-email is sent.
5. **Audit history** — creation/updates/deactivations and merchant-setting changes, recorded with actor and before/after snapshots. Admin 'Delete' deactivates a rule; history and order snapshots remain.

All rule amounts are integer **paise**, tax/percentage rates in integer **basis points** (18% = 1800 bps); the UI converts to/from Indian Rupees and percentages.

## Precedence and calculation

`ITEM (product ID / order line) > PRODUCT > CATEGORY > SECTION`.

At an equal scope the latest effective rule wins. Components (CGST/SGST/IGST/CESS/OTHER) are separately selected by scope. Rules are active only within their effective timestamp window. No tax is invented if no rate is configured. Do **not** publish a tax profile until the accountant confirms jurisdiction, product HSN and correct treatment.

Server-side calculation:

`Catalogue unit price -> one applicable dynamic adjustment per line -> one eligible order offer/coupon allocated to eligible lines -> tax based on discounted taxable value -> grand total`.

Inclusive tax is extracted from the already-inclusive amount; exclusive tax is added. The quote API rejects mixed inclusive/exclusive settings and an IGST+CGST/SGST combination on the same line to avoid contradictory configurations. It does **not** automatically infer GST place of supply from a free-text shipping address. Seller registration, supply-state determination, HSN mappings and any e-invoicing obligations require separately approved master data.

Example staging quote (not a statutory rate recommendation):
- Two items, catalogue price ₹125 each = ₹250
- Dynamic bulk adjustment −10% = ₹225
- Eligible fixed coupon ₹10 = ₹215
- **Illustrative only** CGST 9% + SGST 9% on the net value = ₹38.70
- Quoted total = **₹253.70**

## APIs

Authenticated admin:
- `GET/POST /api/admin/billing/taxes`
- `PUT/DELETE /api/admin/billing/taxes/:id`
- `GET/POST /api/admin/billing/pricing`
- `PUT/DELETE /api/admin/billing/pricing/:id`
- `GET/POST /api/admin/billing/offers`
- `PUT/DELETE /api/admin/billing/offers/:id`
- `GET/PUT /api/admin/billing/merchant`
- `GET /api/admin/billing/audit`

Public (no payment):
```http
POST /api/billing/quote
Content-Type: application/json

{"sectionSlug":"stationery","items":[{"productId":123,"quantity":2}],"couponCode":"WELCOME10"}
```

The quote returns product lines, dynamic adjustments/reasons, selected offer, discount allocation, tax components, amounts and grand total in paise. The same backend engine now computes **standard-goods enquiries and future Razorpay checkout**. Both store the resulting quote snapshot in PostgreSQL so changing rules later cannot retroactively alter an order's recorded price.

## Invoice / billing state

After a standard-goods Razorpay payment is verified, the captured order includes its immutable quote and seller-setting snapshot in the existing `customer_invoices` record. A **DRAFT bill** is provided to the authenticated buyer for download and printing / Save as PDF from the SRC account and customer workspace. The draft is **not a valid GST TAX_INVOICE**; a legally compliant tax invoice/credit note issuance workflow is still pending verified GSTIN, HSN, buyer address/place of supply, statutory serial numbering and financial review.

No Razorpay subscriptions, fireworks charging, or live standard-goods payment flags are changed by this module.

## Data model

Migration `017_billing_pricing.sql` creates:
- `src_tax_rules`
- `src_dynamic_pricing_rules`
- `src_sales_offers`
- `src_billing_settings`
- `src_billing_audit`
- `customer_orders.quote_snapshot/coupon_code`
- `standard_orders.quote_snapshot/coupon_code`.

## Test and deployment

Run from the repo root:
```powershell
git pull origin main
node scripts/check.mjs
node scripts/check-roles.mjs
node scripts/check-billing.mjs
node scripts/check-deployment.mjs
cd server
npm install
npm run build
npm test
npm run coverage
```

For the isolated database integration suite, set `SRC_TEST_DATABASE_URL` to a **disposable PostgreSQL database named `*_test`**, then `npm run test:integration`.

The Windows setup script `scripts/local-setup.ps1` has been repaired. From `C:\Projects\SRC` run `powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -StartApi -StartWeb` after setting `server/.env`. Docker is optional. Demo seed is opt-in through `-SeedDemo`; it should not be used for production data.

## Remaining financial requirements

The scope above is an **implemented v1 calculation/administration module**, not a statement of certified GST compliance. Before live billing, add or verify: recipient GST details and state, HSN/SAC master and statutory tax determination, approved GST invoice numbering and issuance, credit notes/returns/refund tax reversal, accounting ledger, authorized overrides, audit retention, gateway tests, and production reconciliation. Confirm GST rates and rules with your tax professional.

Regulatory source: https://cbic-gst.gov.in/gst-invoice-rules.html
