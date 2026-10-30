# SRC Scheme Management — administrator guide

The dedicated page is `/scheme-admin.html`, linked from `/admin.html`.

## Purpose
Manage standalone Deepavali schemes as separate business plans, not as products in the Crackers catalogue. An SRC administrator can create a plan, choose 6/10/12-month duration, monthly/quarterly frequency, proposed INR contributions, maximum registration count, dates, descriptions, benefits, terms and internal notes.

All changes are stored in PostgreSQL, and creation/editing/status changes are audited. The plan lifecycle is:

`DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`

Review plans may return to draft; published plans are immutable and may be duplicated into a new editable version. PUBLISHED means **visible for free membership registration only**, not an approved financial product, payable subscription or deposit authorization.

Published plans appear on the standalone **Scheme** customer page and link to the customer's unique SRC membership ID. The registration remains free and separate from crackers catalogue sales. Existing pre-plan membership records continue to work.

## Setup on Windows (without Docker)
```powershell
cd C:\Projects\SRC
git pull origin main
# Ensure server/.env DATABASE_URL points to your development PostgreSQL DB.
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -StartApi -StartWeb
```
Migration `015_scheme_management.sql` creates the plan master, change history and optional registration-to-plan relationship. The Node migration runner applies it automatically if it has not been applied already.

Administrator signs in at `http://localhost:8000/scheme-admin.html`.

## Razorpay key setup for future approved subscriptions
**Do not send secrets in chat, add them to GitHub, or paste them into the admin page.**

When the legal team and Razorpay have approved the **actual business model**, the server can be configured with environment secrets (initially TEST mode):

```ini
RAZORPAY_KEY_ID=rzp_test_REPLACE_WITH_KEY_ID
RAZORPAY_KEY_SECRET=REPLACE_WITH_SECRET_IN_SERVER_ONLY
RAZORPAY_WEBHOOK_SECRET=REPLACE_WITH_A_SEPARATE_SECRET
SRC_SCHEME_SUBSCRIPTIONS_ENABLED=false
```

All values must be placed in `server/.env` (local only) or the hosting provider's server-side secret manager. Keep the scheme-collection flag false. Even if someone sets it to true, the current scheme-management code **does not implement or initiate subscription collection**; it reports collection disabled.

The page includes a **gateway mapping preview** for administrators, displaying the proposed Razorpay Plan shape such as `period: monthly`, `interval: 1`, `item.amount` in paise, `item.currency: INR`, and proposed billing cycles. This preview does not call Razorpay APIs, create plans, payment links, mandates or subscriptions.

Razorpay documentation: https://razorpay.com/docs/api/payments/subscriptions/create-plan/
Razorpay restrictions: https://razorpay.com/terms/

## Admin workflows
- **Create:** Save new plan as DRAFT.
- **Edit:** Modify details while DRAFT or IN_REVIEW, with optimistic version checks.
- **Review:** Move DRAFT to IN_REVIEW.
- **Publish:** Move IN_REVIEW to PUBLISHED. This exposes the *free registration* option on the customer page, not recurring charges.
- **Duplicate:** Start a new version of an existing plan with a new code, preserving historical agreements.
- **Archive:** Remove a published plan from the public listing while retaining member records.
- **Audit:** Review actions, timestamps and actors.
- **Members:** View registration counts by plan; open Admin → Festival Members to verify unique member IDs and physical shop visits.

### Validation details
- Plan codes: uppercase letters, digits, underscores or dashes, 3–40 characters.
- 6, 10 or 12 months; quarterly schedules require a duration divisible by three (6 or 12).
- Contribution amounts are **proposed planning amounts** only, not debts, invoices or payable instalments.
- Public lists exclude internal notes and gateway identifiers.
- Server-side routes require ADMIN access, except read-only public plan listing.
- Published/archived plan terms are not editable in place.

## Outstanding compliance and payment development
Before collection can be built or activated: written opinion on relevant Karnataka/India laws and scheme terms; approval of the actual goods/services and scheme model by Razorpay; approved refund/cancellation/accounting/GST model; customer mandate consent and payment authorization; webhook signature verification and idempotent event processing; reconciliation; receipts; support and disputes; real test-mode UAT; production key rotation and least-privilege deployment.

This commit does **not** contain an operational Razorpay Subscriptions gateway, and does not make a prohibited scheme lawful merely by renaming it.
