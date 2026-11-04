# SRC Enterprises staging deployment gate — 4 November 2026

## Verdict

**Conditional GO for isolated staging infrastructure only. NO GO for public commercial launch or live payments.** The checkout and Scheme subscription switches must remain disabled while financial, legal and operational UAT is incomplete.

Repo: `bv-prasanna/SRC`, branch `main`. Review based on GitHub source checks and provider documentation, **not successful CI/build execution**. GitHub Actions returned zero recorded workflow runs at review time.

## Concrete release fixes completed

- Fixed the billing quote engine so **zero configured tax rules** produces a valid zero-tax quote instead of an incorrect `MIXED_TAX_MODES` error.
- Added the fresh-database no-tax quote and `/ready` assertions to the existing PostgreSQL integration test.
- `/ready` now checks the critical business-sections, JWT users, Scheme, finance and operations tables, and reports HTTP 503 if the staging schema has not been provisioned.
- Pinned Render staging API to **Singapore** and used `autoDeployTrigger: off`, so the first deployment is deliberate.
- Prior page/role fixes (cart quantities, operational task controls, Admin order details, session security) remain on `main`.

## Required pre-deployment release gates

1. `git pull origin main`, then run all static checks from repository root:
   ```powershell
   node scripts/check.mjs
   node scripts/check-roles.mjs
   node scripts/check-pages.mjs
   node scripts/check-billing.mjs
   node scripts/check-deployment.mjs
   ```
2. Execute the backend test/build from `server/`:
   ```powershell
   npm install --no-audit --no-fund
   npm run build
   npm test
   npm run coverage
   ```
   Zero failures required. Record total test count, failures and measured coverage rather than claiming unverified percentages.
3. Create a **disposable PostgreSQL test DB ending `_test`**, set `SRC_TEST_DATABASE_URL`, then run `npm run test:integration`. Never run against live Neon customer records. Note the integration suite applies migrations and writes test data.
4. Alternatively, trigger **GitHub → Actions → Node backend verification → Run workflow (main)** and **Static checks → Run workflow (main)**. This avoids repeated CI usage from every push, because the workflows have manual triggers.
5. Create Neon project, choose PostgreSQL region near Render Singapore, run `npm run migrate` on a trusted local computer using a secure direct Neon connection. Do not call a Render deployment healthy until `/ready` returns 200 with the migrated schema.
6. Create first Super Admin via `scripts/bootstrap-superadmin.ps1`. Do not expose secrets, database URLs or passwords in GitHub/cloud static assets.
7. Set Render `DATABASE_URL`, 48+-byte stable `SRC_JWT_SECRET`, `CORS_ORIGIN` including the exact Cloudflare Pages staging domain, `NODE_ENV=production`; leave `SRC_PAYMENTS_ENABLED=false` and `SRC_SCHEME_SUBSCRIPTIONS_ENABLED=false`.
8. Connect `api.srcenterprises.in` to Render with the DNS target Render actually provides, then validate `https://api.srcenterprises.in/ready`. Connect Cloudflare Pages to GitHub with `node scripts/build-pages.mjs` and `.pages-dist`; test on `*.pages.dev` before switching `srcenterprises.in`.
9. Perform browser/mobile UAT for customer, Scheme, Agent, Admin, Super Admin, Finance, Operations, Procurement, Packing and Delivery pages. Use both positive and negative authorization cases. Verify draft bill/quote tax breakdown, no-tax quotations and member ID lookups.
10. Preserve the existing domain/email DNS records during the cutover. Record SSL and CORS status, error logs, test date and backup/recovery plan.

## Blockers to public customer launch

- No independently verified end-to-end browser test run, backend TypeScript compile result, migrations or integration-test results.
- Live `srcenterprises.in` and `api.srcenterprises.in` could not be verified through available checks.
- Operational email/password recovery isn't provisioned for Render Free's SMTP restrictions.
- Real taxable invoices, refunds, payment reconciliation and merchant compliance approval still require separate acceptance tests.
- The 96 preview products are *sample data* and must not be sold as live priced goods.
- Render Free services spin down on idle; its free tier should not be used for reliable production payment processing.

## Go / no-go policy

**Staging infrastructure creation:** GO now.  
**Expose the protected staging application for UAT:** GO only after steps 1–8 pass.  
**Publish the customer-facing commercial site or enable payments:** NO GO until the full UAT and regulatory/payment gates pass.
