# SRC Enterprises — Release readiness review
**Review date:** 2026-11-01
**Scope:** GitHub `bv-prasanna/SRC` main branch, before Cloudflare Pages + Render + Neon staging.

## Executive assessment
SRC has real backend/API modules, persistent PostgreSQL storage, role-based JWT authentication, a standalone Scheme plan manager, admin dashboards, agent/enquiry and operations task flows. This is **more than a static demo template**, but **not fully production-ready**. A professional visual assessment requires live rendered browser/mobile UAT; no pixel-perfect validation or measured backend test coverage is claimed here.

## Implemented and reviewed
| Area | Source implementation | Verification still required |
|---|---|---|
| Branding/site | Uploaded SRC corporate logo; homepage and four separate sections: Scheme, Stationery, Housekeeping, Crackers; independent hero sliders | Browser screenshots at desktop/tablet/mobile, genuine assets/alt text |
| Catalogue | Section-aware product listing, category/search filters, real-product priority, 96 labelled demo placeholders | Real SKUs, images, GST/HSN, prices and inventory from SRC |
| Scheme | Separate plan master, review/publish/archive, future-year enrolment, random member IDs, store verification and receipt references | Consent, legal terms, real messaging and live registration UAT |
| Account/security | Signed JWT, database-revocable sessions, one-time Super Admin bootstrap, role checks, session invalidation on changes, offline admin recovery | TypeScript build, security/negative tests, MFA, token/session lifecycle under redeploy |
| Customer | Catalogue/enquiries, own standard-goods checkout/order views | Address UX, payments after merchant approval, mobile/UAT |
| Agent | Assigned enquiry queue, follow-up notes | Agent assignment UX and notification delivery |
| Procurement/Packing/Delivery/Operations | Role-restricted task queues, assignments and progress tracking; direct status bypass restricted | End-to-end dispatch with test data; actual delivery proof, exceptions, returns |
| Admin | KPI views, separate demo/real metrics, records search/filter, inventory with reserved-stock protection, staff management dialogs, media/promotions | Verify every create/edit/delete, dashboards against real data, keyboard and responsive UI |
| Hosting | Safe Cloudflare Pages output, Render Docker service, Neon PostgreSQL migration, `/ready`, documented domain split | Actual account setup, DNS, SSL, CORS, logs and backup/restoration test |

## High-impact corrections committed during this review
1. Corrected **Scheme plan edit** validation: separately validates optimistic version and strict plan fields.
2. Prevented **inventory decreases below reserved units** and exposed `available` inventory.
3. Fixed **next-year Scheme registration** and serialized scheme-capacity checks inside a database transaction.
4. Prevented **admin order-status overrides** while an operational task queue exists.
5. Added **Super Admin coverage** for operational task lists/details.
6. Hardened product input to reject merchandise in Scheme, misclassified fireworks and priced demonstration items.
7. Enabled validated HTTPS **promotion images**, allowed Admin section editing, and improved table search/filter.
8. Separated **real and demo product KPIs**, prioritised genuine published products, fixed sample price display and retained demo labels.
9. Added **offline Super Admin password recovery** with session revocation, never as an HTTP endpoint.
10. Extended isolated integration tests for reserved inventory and future-year membership.

## Must complete before external staging/UAT handover
- [ ] `cd server && npm install && npm run build && npm test && npm run coverage` exit successfully and coverage is measured.
- [ ] Use a **disposable** `SRC_TEST_DATABASE_URL` ending `_test`; run `npm run test:integration`.
- [ ] `node scripts/check.mjs`, `node scripts/check-roles.mjs`, `node scripts/check-deployment.mjs` all pass.
- [ ] Neon is reachable over TLS, all migrations 001–016 apply, and Super Admin bootstrap works exactly once.
- [ ] Render API `/ready` is healthy and CORS works from Cloudflare Pages.
- [ ] Manual browser UAT for all four public sections and each role (Admin, Super Admin, Customer, Agent, Procurement, Packing, Delivery, Operations).
- [ ] Verify **scheme free registration → member ID → admin/operator lookup → store verification → counter receipt reference**.
- [ ] Confirm the demo flags, sample photography, and draft plans cannot be mistaken for real payable products.
- [ ] Test login, invalid login, expiry, logout, disabled user, password reset failure handling, authorization barriers and mobile layouts.
- [ ] No production secrets in static output. Render/Neon secrets stored only in server hosting environment.
- [ ] Publish explicit Privacy Policy, Terms, Refund/Return policies as applicable, customer support contact, and permission/retention policy after legal review.

## Blocking real transactions / commercial launch
1. **Deepavali Scheme subscriptions:** Razorpay subscriptions are intentionally disabled. Legal and merchant approval for the actual underlying scheme required; mandate/payment/refund/reconciliation integration is not implemented.
2. **Online fireworks:** Online fireworks checkout and scheme-funded purchase collection are not enabled.
3. **Standard-goods commerce:** Razorpay integration has not completed live gateway UAT, reconciliation, refunds/settlements or final GST tax invoice workflow. Render free sleep is unsuitable for dependable paid order processing.
4. **Communications:** SMTP password recovery is unsuitable for Render Free's blocked outbound SMTP ports; use and verify an HTTP email service. Customer messages/notifications not confirmed.
5. **Data/reliability:** Real product master and stock are required; implement backups, monitoring, real media hosting and disaster-recovery validation before commercial traffic.

## Reviewer note
Source inspection and browser JavaScript syntax checks do **not** establish passing TypeScript compilation, E2E coverage, penetration testing, or visual QA. The GitHub Actions API showed **zero recorded runs** during this review. Keep payment switches off until the documented gates are satisfied.

## References within repo
- `docs/DEPLOY_SRC_CLOUDFLARE.md`
- `docs/SRC_DEMO_ROLES.md`
- `docs/SCHEME_MANAGEMENT.md`
- `docs/FESTIVAL_MEMBERSHIP.md`
