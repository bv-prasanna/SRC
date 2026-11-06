# SRC Deepavali scheme-first launch + Razorpay sandbox verification

## Landing/navigation
- The root URL opens the **Scheme** view. Clicking the logo or **Home** also opens Scheme.
- Scheme, Crackers, Housekeeping and Stationery remain visible and navigable; the original retail homepage is preserved in source.
- The Scheme Manager controls price, frequency, duration, dates, benefits, publication and enrollment cap. The customer cannot alter these fields.
- Plan registration continues to issue an SRC membership code and securely encrypt PAN in PostgreSQL.

## Razorpay test-mode flow
1. Administrator publishes a scheme. Customer chooses the plan and completes the KYC registration.
2. When the backend explicitly permits test checkout, the registration response contains a 30-minute server-signed, membership-bound payment proof. No PAN is sent to Razorpay.
3. **Test subscription authorization** creates a Razorpay TEST plan if needed, then a TEST subscription with the server-side plan amount and number of billing cycles.
4. Razorpay Checkout obtains customer mandate authorization. The backend verifies its subscription signature against the server secret and known membership-to-subscription mapping.
5. Subscription webhook events are verified from raw request bytes, stored once by event ID, and update the recorded lifecycle and cumulative paid instalment count.
6. Customer receives authorization state; admin Scheme Control Centre displays test-subscription counts.

This code cannot create **live** scheme subscriptions: the gate requires a `rzp_test_` key and `SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED=true`. No backend setting implemented here enables live collection. Do not treat mocked test charges as financial transactions or accounting entries.

## Server-only environment
```dotenv
RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_TEST_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_SEPARATE_TEST_WEBHOOK_SECRET
SRC_JWT_SECRET=AT_LEAST_48_RANDOM_BYTES
SRC_PAN_ENCRYPTION_KEY=64_RANDOM_HEX_CHARACTERS
SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED=false
SRC_SCHEME_SUBSCRIPTIONS_ENABLED=false
```
Set `SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED=true` only in isolated non-production staging with TEST keys. NEVER paste any secret into GitHub, the browser, chat or Cloudflare Pages settings. It belongs on the API server's secret manager.

**Razorpay webhook URL (test dashboard):** `https://YOUR_API_HOST/api/scheme/payments/webhook`  
Subscribe to `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, and `subscription.completed`. Use a distinct endpoint secret.

## Validation
```bash
cd server
npm install
npm run build
npm test
npm run migrate
# Integration tests ONLY on disposable *_test PostgreSQL:
SRC_TEST_DATABASE_URL=postgres://.../src_test npm run test:integration
```
The migration runner discovers and applies `019_scheme_subscription_payments.sql` automatically.

**Test scenarios to perform after test keys arrive**
- Publish the plan; register; open Razorpay test checkout; authorize a test mandate; confirm backend authorization.
- Verify correctly signed webhook delivery; view test count in Scheme Manager.
- Replay same webhook ID (one event), tamper with its signature (401), and send out-of-order status (must not downgrade completed/cancelled).
- Reject invalid/expired payment proof, a different membership code, forged amount or plan ID, unconfigured gateway, live key, and duplicate subscription creation.
- Cancel or fail test checkout; ensure UI does not claim a successful payment.
- Verify multiple registration and other section links still work.
- Use only synthetic PAN and contact details on disposable staging databases.

## Important limitations
- The integration has not been verified against the provider without test credentials.
- Test subscriptions in an uncertain FAILED state are intentionally **not** automatically retried; an administrator must reconcile the provider dashboard before remediation, avoiding duplicate mandates.
- Financial ledger, real refunds, subscription cancellation self-service, notification delivery, and production payment E2E are not implemented here. These require additional engineering and confirmation of the approved business model.
- Razorpay terms prohibit pyrotechnic devices/hazardous materials. Obtain **written provider approval for the exact scheme**, along with applicable legal review, before considering any live payments. Merely setting key ID/secret does not grant permission.
