# SRC Enterprises — Cloudflare Pages + Render + PostgreSQL (staging/UAT)

This repository contains code and deployment configuration. **No DNS, Cloudflare, Render or database account has been changed by the GitHub commits.** Do not turn on payment collection for either scheme or fireworks as part of this deployment.

## Deployment diagram

Browser https://srcenterprises.in
  -> Cloudflare Pages (static frontend, produced in .pages-dist)
  -> HTTPS fetch https://api.srcenterprises.in (Node.js/Express on Render free web service)
  -> PostgreSQL (e.g. Neon Free; persistent hosted database)

## Why not directly deploy the API to Cloudflare Workers?

The SRC backend is currently a Node.js/Express API using pg TCP connections, scrypt, SMTP and a conventional server listener. Workers offers some Node compatibility, but the backend has **not** been ported or tested as a Worker. Cloudflare Pages is the low-risk zero-cost fit for the frontend. Render free can host the current API for **UAT**, with a 15-minute idle spin-down and cold starts; do not use it for live checkout or reliable paid subscriptions.

## One-time database setup

1. Create a PostgreSQL database (a Neon free-tier project is one option). Copy its **pooled, TLS-enabled** connection string into `server/.env` on a trusted operator machine, not a GitHub commit.
2. Back up any existing SRC database before migrating. If the database has been set up with manual SQL, inspect `src_schema_migrations` first and reconcile old migrations — do not assume a partially migrated database is clean.
3. Run:
   ```powershell
   cd C:\Projects\SRC
   git pull origin main
   cd server
   npm install
   # Edit server/.env: DATABASE_URL=<Neon/Postgres URL>, SRC_JWT_SECRET=<random 48+ byte secret>
   npm run migrate
   npm run build
   npm test
   ```
   For a production NODE_ENV migration, set `ALLOW_PRODUCTION_MIGRATIONS=yes` **only for the trusted migration command** then unset it.
4. Migration `016_jwt_superadmin.sql` extends the role matrix and deletes old opaque sessions. Everyone must sign in again after the JWT cutover.

## Secure first Super Admin

There is deliberately **no default username, default password or bootstrap HTTP API**. Create the first Super Admin on the same trusted computer that has the database URL:

```powershell
cd C:\Projects\SRC
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-superadmin.ps1 -Email "your-admin-email@example.com"
```

The script prompts for a 16+ character password containing a number and symbol. It uses a transaction and lock, refuses any second Super Admin, and refuses to take over an email already registered. The email/password are never committed or printed. Register other users normally and, as Super Admin, assign ADMIN, AGENT, PROCUREMENT, PACKING, DELIVERY and OPERATIONS roles from the admin portal. Ordinary ADMIN users cannot grant ADMIN or modify the Super Admin account.

**Keep the bootstrap command off public application startup**. Password recovery requires a working email service.

## Cloudflare Pages setup

1. Cloudflare → Workers & Pages → Pages → Connect to GitHub repo `bv-prasanna/SRC`.
2. Choose production branch `main`; root directory `/`; framework preset: None.
3. **Build command:** `node scripts/build-pages.mjs`
4. **Build output directory:** `.pages-dist`
5. The build script copies only approved HTML, CSS, JavaScript and image assets. **Never publish the repository root**; it includes backend code and SQL.
6. Verify the `*.pages.dev` site before attaching your domain.
7. In Pages → Custom domains, add `srcenterprises.in` (and optionally `www.srcenterprises.in`). For the apex domain, Cloudflare must manage the DNS zone/nameservers. Let Cloudflare create the record; do not invent a CNAME target.

## Render API

1. Import the GitHub repo into Render using `render.yaml` (Blueprint) or create a web service using `server/Dockerfile`.
2. Choose the **Free** plan for staging only.
3. Add secret environment variables in Render:
   - `DATABASE_URL`: hosted PostgreSQL TLS URL, server-only.
   - `SRC_JWT_SECRET`: random string of **at least 48 bytes**, stable across redeploys (do not rotate casually).
   - Other envs from `render.yaml`: `NODE_ENV=production`, `CORS_ORIGIN=https://srcenterprises.in,https://www.srcenterprises.in`, `PORT=8080`, `TRUST_PROXY=true`, `SRC_PAYMENTS_ENABLED=false`, `SRC_SCHEME_SUBSCRIPTIONS_ENABLED=false`.
4. Run migrations and the bootstrap from a trusted CLI before opening customer enrolment.
5. Wait for `https://<YOUR_ACTUAL_RENDER_SERVICE>.onrender.com/ready` to return `{"status":"ready"}`. This checks PostgreSQL connectivity.
6. Render → web service → Settings → Custom Domains → add **`api.srcenterprises.in`**. Render will display the exact required DNS record; set that value in Cloudflare DNS and verify in Render.
7. Confirm `https://api.srcenterprises.in/ready` and `https://srcenterprises.in`. The public frontend already points to `https://api.srcenterprises.in` in `config.js`. HTTPS and correct CORS origins are required.

**Do not point `srcenterprises.in` at Render**; it belongs to Cloudflare Pages. Use the `api` subdomain for Render. If the domain currently serves an older live website, verify the new Pages site and preserve the current DNS settings until cutover.

## Local no-Docker setup

```powershell
cd C:\Projects\SRC
git pull origin main
# Set DATABASE_URL to local PostgreSQL or Neon in server/.env
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -StartApi -StartWeb
```

This generates a local JWT secret if the example placeholder is still present and runs migrations. Then bootstrap Super Admin using the interactive command above.

## Smoke tests before sharing with users

```powershell
cd C:\Projects\SRC
node .\scripts\check.mjs
node .\scripts\check-roles.mjs
node .\scripts\build-pages.mjs
cd server
npm run build
npm test
npm run coverage
```

For integration tests use an isolated PostgreSQL database named `*_test`, set `SRC_TEST_DATABASE_URL`, then `npm run test:integration`. Do not run this against live customer records.

Production hardening still needed: external email API for password reset (Render Free blocks outbound SMTP ports), scalable distributed rate limiting, MFA for privileged users, monitoring, regular database backups, independent audit, real browser/UAT and recovery tests, and always-on hosting before payment acceptance.

## Provider references

- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://render.com/docs/web-services
- https://render.com/docs/custom-domains
- https://render.com/docs/free
- https://neon.tech/pricing
