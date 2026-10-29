# SRC Enterprises — staging and production launch checklist

## Current state
Source code and *staging* deployment configuration only. Not deployed, not approved for live checkout.

## Business sections
- Crackers: information-only, videos, internal scheme drafts. NO remote sale/prebooking/booking, online schemes, subscription/payment links or delivery.
- Housekeeping: category-specific products, cart, enquiry; Razorpay standard-goods payment option is gated off until verified.
- Stationery: independent product catalogue and same optional standard-goods workflow.
- New business section slugs/names are driven by `business_sections`. Additional departments need explicit backend commerce approval and section-specific fulfilment rules.

## Staging prerequisites
1. PostgreSQL database provisioned (do not use expiring free database for real customers).
2. Run migrations 001–010 in order; the local Windows script handles Docker.
3. At least one ADMIN user provisioned locally via `npm run promote-admin -- email@example.org`.
4. Configure a temporary staging HTTPS API domain, then set `config.js` `SRC_API_BASE` to that origin.
5. Add the static GitHub repository to Cloudflare Pages; build command empty, output root `/`. Add domain `srcenterprises.in` after testing.
6. Configure database backups, HTTP monitoring, password recovery SMTP or a supported email API, logs, billing alert and rollback.
7. Do not deploy `server/.env` or share passwords, keys or reset tokens.

## Razorpay (ONLY housekeeping and stationery)
1. Merchant approval specifically for permitted goods sold on the same website. Razorpay terms list pyrotechnics as prohibited.
2. Use **test-mode keys**, not live keys, for UAT. Set server-only `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
3. Verify provider webhooks using the **raw request body** at `POST /api/payments/webhook` and `x-razorpay-signature`.
4. Confirm payment capture by provider fetch and match order id/amount/currency before fulfilment.
5. Test incorrect signatures, duplicate/out-of-order webhooks, network timeouts, payment declines, canceled checkout and reversal paths.
6. Implement operational payment reconciliation and expired reservation cleanup **before** real customer acceptance. This is not yet automated.
7. Configure tax details, seller GSTIN, product HSN/SAC and tax calculations and convert draft receipt generation to legally valid invoices.
8. Only then consider `SRC_PAYMENTS_ENABLED=true` in a supported always-on production environment. Do not use a sleep-on-idle free instance for payments.

## Admin / Agent
- Admin: `/admin.html`; manage catalogues, media slides (type HERO, HTTPS image/video URL), promotions, inventory, roles and enquiry assignment.
- Agent: `/agent.html`; agents see only assigned standard-goods enquiries and add internal notes.
- Register users on storefront; admin locally promotes account through trusted CLI; changes made in `/admin.html` invalidate old sessions.
- Password recovery needs `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `APP_PUBLIC_URL`. Render Free blocks ports 25/465/587, so use a compatible HTTPS email API or paid hosting before enabling recovery there.

## Tests / commands
```powershell
cd C:\Projects\SRC
git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -UseDockerDb -RunCoverage -RunIntegrationTests -StartApi -StartWeb
```
Integration tests MUST use the separate `src_test` database; they must never be run against customer data.

## Remaining production blockers
- E2E tests and measured coverage must pass in the user's machine or CI.
- Dedicated expiry/reconciliation process for pending payments and stock holds, refund workflows, tax invoicing, order delivery proof.
- Account email verification, multi-factor admin authentication and distributed rate limiting.
- Merchant onboarding, live credential approval, published shipping/refund/privacy policies, taxation, customer support.
- Live infrastructure, DNS setup, monitoring, uptime and backups require user-owned provider account configuration.

Do not claim the app is production ready solely because Node's unit tests pass.
