# SRC Node.js rollout status

Current code is **not production-ready**. This file is intended to prevent accidental deployment of incomplete commerce flows.

## Active business sections
- Crackers: catalogue and demo videos only; no online order, prebooking, collection scheduling, scheme signup or payment.
- Housekeeping: normal commerce candidate; currently product catalogue and purchase enquiries only.
- Stationery: normal commerce candidate; currently product catalogue and purchase enquiries only.
- Future sections can be added by admin; they must go through merchant/legal review before payment enablement.

## Database SQL order
Apply from the `server/` working directory to a new PostgreSQL database:
```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/002_business_sections.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/003_scheme_drafts.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/004_content.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/005_standard_orders.sql
```
A proper versioned migration runner, atomic migrations, rollback and schema drift checks remain necessary before production.

## Current Node routes
- GET /health
- GET /api/catalog/sections
- GET /api/catalog/sections/:slug/products
- GET /api/catalog/products
- GET /api/catalog/categories
- GET /api/catalog/media
- GET /api/catalog/promotions
- POST /api/enquiries (only housekeeping/stationery; enquiry is not a sale)
- Admin product CRUD, section create/update, content creation, internal scheme draft management, enquiry listing

## Critical unfinished work
- Strong account authentication, password reset, customer/agent RBAC and MFA
- Persistent admin screens integrated with Node APIs; current demo role picker is not authentication
- Product categorization and product administration UX for three sections
- Stock availability, tax invoicing, customer addresses, delivery coverage and returns
- Housekeeping/stationery cart with authenticated checkout, gateway, refund, reconciliation and fulfillment
- Robust API/security tests, migrations, measured coverage, real browser UAT
- Deployment to srcenterprises.in, DNS, backups and monitoring
- Crackers scheme requires independent legal review and payment-provider written permission before activation

Never expose the current single admin bearer token to browser users; it is for backend development only.
