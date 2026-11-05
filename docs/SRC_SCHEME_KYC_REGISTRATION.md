# SRC scheme registration — plan-owned terms, contact KYC and UPI mandate restrictions

## Updated customer registration
- Customer chooses a **published, currently available scheme** card. The Scheme Manager—not the customer—sets `durationMonths`, contribution amount, frequency, year, benefit description and dates.
- The customer form is hidden until a published plan is selected. A read-only summary shows the selected plan name, duration, monthly/quarterly amount and proposed total.
- Required applicant fields: full name, 10-digit Indian mobile, email, address line 1, city, state, six-digit PIN and 10-character PAN. Address line 2 is optional.
- Two separate affirmative consents cover membership-registration terms and handling PAN/address information. Do not include PAN in email, URLs, browser storage, analytics or log messages.
- On submission the server validates the published plan and its dates/capacity under a transaction lock, derives the year/duration and contribution from the database, captures a snapshot of those terms and assigns a random membership ID. A customer-supplied duration or contribution is rejected.
- A customer can register for different published plans with the same duration; duplicate registrations for one plan and phone are blocked.

## Sensitive PAN handling
- PAN is uppercased and validated on the server, then encrypted using AES-256-GCM with a random nonce and membership-ID-bound authenticated data. The full PAN is not stored in plaintext.
- Store the stable 32-byte key as **64 hex characters** in server-only `SRC_PAN_ENCRYPTION_KEY`. Never expose it through Cloudflare Pages, GitHub, URLs, QR codes, or customer responses.
- Admin membership details show only a masked PAN such as `*****1234*` and the registered address. The ciphertext and raw PAN are never included in the Admin response.
- Key loss means encrypted PAN cannot be recovered. Backup and restrict access to the key according to your security and retention policy. Implement an approved deletion/retention workflow before collecting real customer KYC data.
- Collect PAN only with a documented legal purpose, applicable privacy notice and retention period. Do not use personal PAN for Razorpay setup; merchant onboarding uses separate merchant KYC.

## UPI mandate status
**NOT ENABLED.** No UPI ID, PIN, bank credentials or mandate authorization is collected during free registration. The scheme form describes Razorpay UPI AutoPay but disables its button until the actual activity is approved.

Razorpay currently lists pyrotechnic devices and combustible/hazardous materials under prohibited categories: https://razorpay.com/terms/ . Obtain written eligibility confirmation covering the SRC scheme from the provider and counsel before enabling subscriptions. For new UPI Autopay mandates, follow the provider's **UPI Intent** flow instead of manual UPI ID collection: https://razorpay.com/upi-autopay/ . Future approved implementation also needs signed mandate authorization, mandate/webhook state, cancellation, payment reversals/refunds and customer confirmation.

## Local Windows migration and tests

**Do not recreate PostgreSQL or rerun older migrations manually.** With the local Docker instance running:

```powershell
cd C:\Projects\SRC
git pull --ff-only origin main
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -UseDockerDb
```

The setup script preserves your existing JWT secret and generates a stable **local** `SRC_PAN_ENCRYPTION_KEY` if none exists. It automatically applies only pending migration `018_scheme_member_kyc.sql`, builds the backend and runs tests.

Restart API and web server, and hard-refresh the browser:

```powershell
# terminal 1
cd C:\Projects\SRC\server
npm run dev

# terminal 2
cd C:\Projects\SRC
python -m http.server 8000
```

Verify `http://localhost:8080/ready` returns `{"status":"ready"}`, then visit `http://localhost:8000/#section/scheme`. Select a published scheme, check its read-only terms, enter local dummy KYC (never use genuine PAN values for screenshots/UAT), submit and verify the membership ID. In the Admin portal, choose Festival Members → Details; the PAN should be masked.

Database integration tests require `SRC_TEST_DATABASE_URL` pointing to a disposable test database ending `_test`. Do not run this destructive test suite against a customer's database.

## Deploy notes
- Add `SRC_PAN_ENCRYPTION_KEY` to Render server-only environment, using a different stable 64-hex secret from the local environment. It is included as `sync:false` in `render.yaml`.
- Readiness checks the KYC migration column and the encryption key. Registering applicants must not begin without these controls.
- Migration 018 retains legacy free-preference registrations. New registrations must be plan-linked. Existing historical members' missing PAN/address fields must never be silently fabricated.
- Do not enable `SRC_SCHEME_SUBSCRIPTIONS_ENABLED` or other scheme payment collection flags. This release is **registration and KYC preparation only**, not authorization to accept online fireworks payments.

## Verification status
UI script syntax and source structure were inspected. Fresh backend TypeScript compilation, full unit suite and PostgreSQL integration tests after this patch have **not** been executed remotely and must be run locally before staging.
