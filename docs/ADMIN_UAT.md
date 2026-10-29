# SRC local operations — new admin and enquiry functions

## Get current code and run
```powershell
cd C:\Projects\SRC
git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -UseDockerDb -StartApi -StartWeb
```

Open `http://localhost:8000/` for storefront; `http://localhost:8000/admin.html` for operations.

## First administrator
1. Register an account at the storefront Account page (12+ character password).
2. From **the trusted local machine** with the API database configured:
```powershell
cd C:\Projects\SRC\server
npm run promote-admin -- admin@example.com
```
Replace admin@example.com with the email that was registered. The command intentionally never creates a default password or exposes role escalation through a public HTTP API.
3. Sign into `http://localhost:8000/admin.html` using that email and password.

## What works in source
- Database-backed admin session authentication for admin API calls
- Product/category/media/promotion CRUD and section configuration
- Inventory movement API and stock records
- Housekeeping/stationery cart-to-enquiry (no online payment)
- Admin enquiry review and standard-goods fulfilment statuses
- Scheme planning drafts only; fireworks sales and collections remain disabled.

## Work still required
- Browser and database integration tests, real stock reservation and reconciliation
- Customer order history, address book, invoicing, refunds and notifications
- Agent role provisioning and assigned workflow
- Razorpay for permitted *non-fireworks* goods: verify payment signatures, webhooks, refunds, idempotency and reconcile invoices before activation
- Rate limits and CSRF/session hardening, password reset, structured audit logs, least-privilege role matrix
- Production database migrations, deployment, rollback, monitoring and backups

Do **not** enter the legacy shared admin token in the browser or publish `.env`. The admin console accepts database-backed ADMIN sessions.
