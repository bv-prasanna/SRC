# SRC UAT — Razorpay subscriptions readiness (test mode only)

The Scheme Manager supports free registration and an optional Razorpay **TEST** subscription checkout. The code in `server/src/scheme-payments.ts` intentionally rejects live Razorpay keys and never enables live subscription charging merely because credentials exist. Publishing a scheme does not start recurring payments.

## Compliance gate

SRC's Deepavali scheme may involve future fireworks redemption. Razorpay's published prohibited-business list includes pyrotechnic devices and related goods. Obtain explicit written confirmation from Razorpay and qualified Indian counsel covering **the exact scheme, payment flow, beneficiary, and redemption model** before accepting any real payments. Do not label an unrelated product or alter the business description to bypass approval. Until then keep test-only collection or free registration.

## Render environment (secrets are entered in Render only)

1. `RAZORPAY_KEY_ID`: use a Razorpay **TEST** key beginning with `rzp_test_`. Never use `rzp_live_` for scheme test checkout.
2. `RAZORPAY_KEY_SECRET`: matching **TEST** key secret.
3. `RAZORPAY_WEBHOOK_SECRET`: an independent random webhook signing secret, entered identically in Razorpay webhook settings and Render; it is *not* the Razorpay API key secret.
4. `SRC_SCHEME_PAYMENT_TEST_MODE_ENABLED=true` enables **TEST** scheme payment routes only; set back to `false` to disable.
5. Keep `SRC_PAYMENTS_ENABLED=false` and `SRC_SCHEME_SUBSCRIPTIONS_ENABLED=false` for SRC UAT and do not enable live scheme payment collection.
6. Retain the already configured `SRC_JWT_SECRET`, `SRC_PAN_ENCRYPTION_KEY`, and Neon `DATABASE_URL`. Do not regenerate a PAN encryption key after storing customer data.

Webhook URL: `https://api.srcenterprises.in/api/scheme/payments/webhook`

Recommended subscription events to subscribe to in Razorpay TEST mode:
- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.halted`
- `subscription.cancelled`
- `subscription.completed`

**Do not share any secrets or screenshots containing secrets in chat, GitHub, or Cloudflare Pages.**

## Verification sequence (use only TEST-mode credentials)

1. Render: save environment variables and perform a controlled redeploy (auto-deploy is disabled).
2. Open `https://api.srcenterprises.in/api/scheme/payments/readiness`. Expect `{"testEnabled":true,"liveEnabled":false}` after test mode is explicitly enabled. `liveEnabled` must always be false.
3. Open a published, currently open scheme in `https://srcenterprises.in/scheme-register.html` and register with **UAT-only test data**; avoid real PAN and real personal details.
4. On registration completion, the optional **TEST** Checkout button should appear only when test mode is enabled. Completing test authorization must never be described as a real charge or active recurring mandate.
5. Verify signed webhook deliveries in Razorpay's dashboard, and status/counts in the Scheme Manager. Webhook notification receipt, not frontend callback, is used to advance paid cycles.
6. Test declined/cancelled authorizations, duplicate callbacks, repeated webhooks, expired proof, and network failure before marking the test integration UAT-ready. An uncertain provider request intentionally blocks automatic retry for manual reconciliation.

## Known boundaries

- Existing implementation creates a plan and subscription on the first authorized test attempt, checks Razorpay Checkout signatures, verifies raw-body webhook HMAC, and deduplicates webhook event IDs.
- It does **not** implement a live activation switch, approved real-money mandate collection, live refunds/settlements, or a full operations reconciliation console. A merchant key/secret alone cannot safely supply these.
- Do not promise that setting credentials tomorrow will enable genuine money collection. First get written provider and regulatory approval, and implement and verify the live-specific lifecycle, disclosures, recovery and reconciliation.
- Registration windows are evaluated against the India business date; the UAT fix is in this branch.
