# SRC Enterprises — 96-product demo, user roles and local setup

## Why Docker is not required
SRC uses a **PostgreSQL database** for accounts, catalogue administration, inventory, order state and role permissions. Docker was only one way to host PostgreSQL on Windows. It is optional. You can use:
1. PostgreSQL installed directly on Windows (localhost);
2. a hosted PostgreSQL instance such as Neon (free-tier subject to provider limits); or
3. the existing Docker container if convenient.

The frontend alone can run without a database, but real login, admin pages, order tracking and inventory require the Node API and PostgreSQL.

## No Docker — Windows quick start
Configure `server/.env` with **your real development PostgreSQL connection string**:
```powershell
cd C:\Projects\SRC
git pull origin main
if (!(Test-Path .\server\.env)) { Copy-Item .\server\.env.example .\server\.env }
notepad .\server\.env
```
Ensure `DATABASE_URL` points to an accessible non-production PostgreSQL database. Keep `SRC_PAYMENTS_ENABLED=false`. Start the app:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -StartApi -StartWeb
```
This uses the installed Node.js version to install packages, apply versioned SQL migrations, load the **96 read-only demo products**, compile and run unit tests. The website opens at `http://localhost:8000`, and the API health route is `http://localhost:8080/health`.

To start without any database/API just for a visual walk-through:
```powershell
cd C:\Projects\SRC
python -m http.server 8000
```
The frontend falls back to 96 **clearly labelled illustrative products**. Login, admin, checkout and role queues will not function without backend/database.

## Existing Docker setup (also supported)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -UseDockerDb -StartApi -StartWeb
```
The script preserves existing PostgreSQL data and does not require deleting volumes.

## Local demo products
- 24 crackers product-information previews. **No online ordering, prebooking, collection or scheme enrolment**.
- 36 housekeeping previews.
- 36 stationery previews.
All are tagged DEMO; prices and stock are zero/unconfirmed and the UI blocks adding them to paid carts. The SQL seed is repeatable. Previous V2 demo entries are not deleted automatically.

Once SRC supplies real products and prices, publish them via Admin. Price display and checkout require genuine stock, proper tax configuration and approval.

## Role interfaces
| URL | Role | Access |
|---|---|---|
| `/customer.html` | CUSTOMER | Own standard-goods purchases and order status |
| `/agent.html` | AGENT | Assigned enquiries, follow-up notes |
| `/procurement.html` | PROCUREMENT | Assigned supply-handling tasks and item lists |
| `/packing.html` | PACKING | Assigned packing tasks and item lists |
| `/delivery.html` | DELIVERY | Assigned delivery tasks, items and delivery address |
| `/operations.html` | OPERATIONS | Staff assignments, stage progress and operational queues |
| `/admin.html` | ADMIN | KPI summaries, charts, products, category/sections, media, promotions, stock, role access, customer enquiries, checkout orders, workflow, draft scheme configurations |

Users self-register as CUSTOMER. An authorized ADMIN changes their role in the Admin > Users section. Do not create shared/default credentials. Each role has a distinct login experience, checked **again by the backend**, not just a client-side menu.

### Provision the first administrator
Create a CUSTOMER account in the storefront, then on a trusted local server:
```powershell
cd C:\Projects\SRC\server
npm run promote-admin -- your-registered-email@example.com
```
Sign in to Admin and assign other registered accounts to PROCUREMENT, PACKING, DELIVERY, OPERATIONS, or AGENT.

### Order workflow
Only a **captured and verified paid housekeeping/stationery order** enters this pipeline:
1. PROCUREMENT task created as PAID is recorded; operations/admin assigns it.
2. Procurement completes; order moves to PACKING and a packing task is created.
3. Packing completes; order moves to DISPATCHED and a delivery task is created.
4. Delivery completes; order moves to DELIVERED.

Tasks are logged with user identity and timestamps; staff can only access tasks assigned to their role. Delivery addresses are visible only to authorized delivery/operations/admin staff.

Razorpay remains **disabled by default**. The payment integration has not been end-to-end certified; do not enable it with live customer funds until gateway tests, reconciliation, refunds, tax invoices, permissions and monitoring have been verified.

## Tests
```powershell
cd C:\Projects\SRC
node .\scripts\check.mjs
node .\scripts\check-roles.mjs
cd server
npm run build
npm test
npm run coverage
```
Integration tests require an **isolated** PostgreSQL database whose name ends in `_test`; configure `SRC_TEST_DATABASE_URL`, then `npm run test:integration`. Never run against production data.

## Open production items
Payment settlement/refund automation, GST-compliant final invoice issuance, full security testing (password reset SMTP, MFA, abuse protection), shipping-provider integration, real SMS/email notification delivery, production infrastructure and domain deployment are **not** confirmed complete. Demo workflows are for internal UAT until all acceptance tests pass.
