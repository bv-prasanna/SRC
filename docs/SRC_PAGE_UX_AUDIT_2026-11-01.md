# SRC Enterprises — Cross-page UX and functional review
**Date:** 2026-11-01 · Branch: main · Staging readiness inspection (source level)

## Reviewed pages

| Page / entry point | Functions inspected | Improvements in this review | Validation status |
|---|---|---|---|
| `index.html` storefront | Four-section navigation, hero carousel, product search, category chips, cart, checkout, free Scheme registration, offers | Cart quantity +/− controls and safer category-chip handling | Source/JavaScript checks; live browser UAT pending |
| `admin.html` | JWT sign-in, reports, catalogue, staffing, enquiries, inventory, paid-order list, Scheme and Finance navigation | Detailed order modal with tax/discount; clearer product unpublish; staff/enquiry modal controls | Source/JavaScript checks; DB UAT pending |
| `billing-admin.html` | Tax, offers, dynamic rules, merchant settings, quote preview | Correct PostgreSQL string-based product-ID handling in shared quote engine | Source/JavaScript and unit regression authored; runtime pending |
| `scheme-admin.html` | Scheme draft/edit/review/publish/archive, member analytics | Review confirms standalone Scheme and no payment activation | Source checks; runtime pending |
| `customer.html` | Signed-in orders, invoices, status | Readable task-detail dialog component, simplified navigation | Source checks; runtime pending |
| `agent.html` | Role sign-in, assigned enquiries, follow-up notes | Corporate logo and responsive login UI | Source checks; runtime pending |
| `procurement.html` | Assigned work, start/complete, order-line details | Detail modal and explicit completion confirmation | Source checks; runtime pending |
| `packing.html` | Work queue, items, stage handover | Detail modal, cancel-safe notes | Source checks; runtime pending |
| `delivery.html` | Work queue, address and status | Order/address detail modal and cancel-safe completion | Source checks; runtime pending |
| `operations.html` | Staff assignments, stage tracking, Scheme member desk | Corrected Super Admin SQL bind parameters; detail modal | Source checks; runtime pending |
| `reset.html` | One-time password reset link and form | Responsive branded design, password confirmation/show-hide, invalid-link handling | Source checks; email service UAT pending |

## Corrected functional bugs

1. PostgreSQL returns BIGINT product IDs as **strings**. Both tax/dynamic/offer matching and order-line snapshot association now normalize IDs to numbers.
2. A Super Admin task-list query incorrectly supplied worker-only SQL bind parameters. Those are now aligned with administrator privileges.
3. An Admin order-detail button previously showed only a status message; it now calls an authenticated API and shows customer address, products, prices, tax/discount totals and draft billing status.
4. Products with history are now **unpublished** instead of hard-deleted, preserving inventory and order references.
5. Cart users can change line quantities from 1 to 100 without removing/re-adding products. Checkout idempotency keys are discarded when quantities change.
6. Department category-chip handlers safely encode category names containing apostrophes or other punctuation.
7. Procurement/Packing/Delivery task details are shown in structured dialogs instead of alert messages. Cancelling completion notes no longer submits an update accidentally.
8. Agent and Reset pages now use the corporate SRC logo, mobile viewport and responsive branded forms.
9. Admin enquiry assignment uses an actual directory of **active AGENT users**, not a typed numeric staff ID. Status updates use a consistent dialog.
10. Added `scripts/check-pages.mjs`, a repeatable 11-page static audit covering local link/assets, viewport, duplicate DOM IDs, forms, scripts, deployment inclusions, roles and selected API wiring.

## How to run source and test checks

```powershell
cd C:\Projects\SRC
git pull origin main
node .\scripts\check-pages.mjs
node .\scripts\check.mjs
node .\scripts\check-roles.mjs
node .\scripts\check-billing.mjs
node .\scripts\check-deployment.mjs
cd server
npm install
npm run build
npm test
npm run coverage
```

Integration tests require a disposable PostgreSQL database ending `_test` set in `SRC_TEST_DATABASE_URL`; never run the suite against a production database.

## Acceptance criteria before launch

- Render and Neon configured, database migrations 001–017 applied, and `/ready` returns HTTP 200.
- Super Admin bootstrap, JWT login, logout, disabled-user handling and role restrictions tested in the browser.
- Check public navigation and all management screens on **mobile (360–390 px), tablet (768 px) and desktop (1366+ px)** for clipping, scroll, visibility, form focus, and keyboard access.
- Test real published stationery/housekeeping inventory, quantities, enquiry, tax and offer quote, order preview and the customer's invoice download.
- Test enquiry assignment to a genuine AGENT; test procurement → packing → delivery including cross-role denial and cancel-safe notes.
- Test Scheme membership registration, verification and physical-store receipt reference. Do not treat that path as an online fireworks payment.
- Verify SMTP or a compatible HTTP-based recovery provider; the free Render configuration can block regular SMTP.
- Use real seller and product details, approved GST rules, genuine photos, store hours/contact details, and required customer legal pages. Label all remaining illustrative products.
- Checkout and subscriptions remain disabled until approved gateway, invoice issuance, refund, webhook, reconciliation and legal compliance testing.

## Scope and limitations

This is a **source, route and structural UI review**, not a claim of pixel-perfect live browser inspection. The deployed `srcenterprises.in` and `api.srcenterprises.in` sites could not be fetched for real-rendered QA. Full TypeScript compilation, test execution, and measured coverage are not verified in this environment. No real paid or GST TAX_INVOICE issuance path was activated.
