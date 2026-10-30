# SRC festival member registration and shop-counter verification

This is **free registration only**, not a purchase, financial contribution, deposit, advance, online fireworks order or stock reservation.

## Intended business workflow

1. Customer browses SRC > Crackers > Festival scheme.
2. Customer selects a tentative 6-, 10- or 12-month duration, enters name, Indian mobile and optional email, and agrees to contact-data use.
3. The API creates a unique non-sequential **SRC-YYYY-XXXXXXXX…** registration ID, returned on the confirmation page. The code has a 96-bit random component. The customer saves/copies the code.
4. At the shop, an authorized **OPERATIONS** or **ADMIN** staff member searches the exact ID or registered mobile number, confirms the mobile's last four digits and changes registration to VERIFIED.
5. Staff may log a shop visit. Once a separate lawful **physical-store** purchase has been completed and a counter receipt has been issued, staff can link that receipt number to the member registration. The portal does not issue the sale or collect payment online.
6. SRC can search member registrations, plan preferences and shop visits from the admin console. Scheme discounts, bonuses, refunds and account balances are *not* implemented.

## User interfaces

- `/#section/crackers` — customer enrolment and unique membership ID.
- `/admin.html` > Festival members — member list, exact-code/mobile search, verify, log visit, link physical receipt.
- `/operations.html` > Festival desk — staff verification and physical-counter receipt linking with **OPERATIONS** credentials (no shared admin login).

## API (Node.js, PostgreSQL)

- `POST /api/festival/enrol`: public, rate-limited, requires fullName, phone, durationMonths=6|10|12, consent=true, optional email; returns unique membershipCode, year, registration status.
- `GET /api/admin/festival/members?search=...`: ADMIN/OPERATIONS only; returns member records, not public.
- `PATCH /api/admin/festival/members/:code/verify`: ADMIN/OPERATIONS, requires registered mobile last 4 digits.
- `POST /api/admin/festival/members/:code/visit`: ADMIN/OPERATIONS; records an in-store visit, not an order.
- `POST /api/admin/festival/members/:code/counter-receipt`: ADMIN/OPERATIONS; links a separately issued physical-store receipt, with uniqueness protection.

Tables: `festival_members` (migration 012), `festival_store_visits` (012), `festival_counter_receipts` (013).

## Start locally, no Docker

Configure `server/.env` with DATABASE_URL pointing to a development PostgreSQL database.

```powershell
cd C:\Projects\SRC
git pull origin main
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -StartApi -StartWeb
```

Run static tests with `node scripts/check.mjs`. Run Node tests and measured coverage with `cd server; npm test; npm run coverage`. Integration tests require an isolated database with a name ending `_test`; see `docs/SRC_DEMO_ROLES.md`.

## Legal/compliance gate before collecting money

The Indian Supreme Court banned online fireworks orders/sales (Arjun Gopal, 23 October 2018), and PESO's 11 April 2023 circular reminded licensees. This does **not** itself mean that requesting contact details for a free membership reference is an online fireworks sale.

However, **periodic money collection toward future fireworks or promised bonus goods requires individual legal review**. The Banning of Unregulated Deposit Schemes Act, 2019 distinguishes genuine business advances from unlawful unregulated deposits based on the actual commercial arrangement and refund terms. Do not assume that labelling money "instalments", "chit", "saving", or "scheme" creates an exemption. Payment processors may also prohibit transactions involving pyrotechnics.

Before activating any contributions, have Karnataka counsel/accountant confirm: legal entity and licence scope; written member terms, benefit formula and termination/refund provisions; how advances are treated, tax/GST and bookkeeping; cash/UPI/payment processor policy; physical-store sale at Diwali; privacy notice, consent, access control and retention. Do not activate Razorpay for fireworks.

The free ID system has no public code lookup that reveals member PII and requires staff login for verification. SMS/OTP verification, production privacy notices, rate-limiter persistence and browser/UAT testing are still required before broad public launch.
