# SRC retail storefront — October 2026 redesign

This is an **implemented web UI** in `index.html`, `assets/storefront-retail.css`, and `assets/storefront.js`. It is not a screenshot or a generated image.

## Navigation and branding
- Selected the alternative multicolour SRC logo with shopping-cart/fireworks motif, represented as a clean SVG at `assets/src-enterprises-retail.svg`; the earlier roof mark is not used on the storefront.
- Main navigation and All Categories menu come from `GET /api/catalog/sections`. Admin can create more business sections.
- Three independent departments: `crackers`, `housekeeping`, `stationery`. Their products are filtered by `sectionSlug` from the live API.
- The homepage shows a rotating hero and three department tiles. Featured products are **one department at a time**, switched with Housekeeping/Stationery tabs, not a merged catalogue.
- Crackers has an in-department scheme CTA, an information-only scheme section, catalogue and video gallery. This site does not accept crackers bookings, scheme enrolments or payments.
- Deals & Offers are sourced from `GET /api/catalog/promotions`.
- Mobile layouts are defined in the retail CSS.

## Manage homepage hero slides
1. Start the Node.js API and open `http://localhost:8000/admin.html`.
2. Sign in with an account that is already provisioned as ADMIN.
3. Choose `Media`, then add a record with `type=HERO`, a short title, optional subtitle, category corresponding to an existing section slug and a hosted HTTPS image URL or direct .mp4/.webm video URL.
4. Set `published=true`. The homepage displays published HERO records as a carousel; otherwise it displays department-relevant fallback slides.
5. For crackers demonstration videos, use `type=VIDEO`. Do not upload or use copyrighted footage without permission.

The current CMS uses media **URLs**, not file uploads. Image/video hosting, asset approval, alt-text policy and a preview/publish flow are future enhancements.

## Local UAT steps (Windows)
```powershell
cd C:\Projects\SRC
git pull origin main

# One-time or after SQL changes; starts DB, validates backend, starts local services
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -UseDockerDb -StartApi -StartWeb

# Validate the frontend separately
node .\scripts\check.mjs
```

Open `http://localhost:8000/` and hard-refresh using Ctrl+Shift+R. The local frontend calls `http://localhost:8080` automatically.

If both product departments are empty, add **explicitly labelled development-only** products using:
```powershell
docker cp .\server\sql\dev_seed_products.sql src-postgres-local:/tmp/dev_seed_products.sql
docker exec src-postgres-local psql -v ON_ERROR_STOP=1 -U src -d src -f /tmp/dev_seed_products.sql
```
The seed products have no claimed stock or real selling prices. The frontend differentiates sample images and products; production catalogue images and prices must be supplied by SRC.

## Verification and boundaries
- Static HTML element references and JavaScript syntax have been checked.
- Browser visual, accessibility, integration, performance, payment and full end-to-end tests have **not** been run in this environment.
- Housekeeping/stationery cart and enquiry requests use existing API functions. Razorpay remains disabled by default until compliance, gateway test mode and reconciliation are verified.
- This redesign does not deploy or change `srcenterprises.in`.

## October 29 — corporate-logo retail upgrade
- The exact **SRC Enterprises Corporate Logo** uploaded in chat was converted to a small WebP web asset at `assets/src-corporate-logo.webp` and committed. No generic substitute should be used in the storefront.
- Home has its own configurable hero slider. Each business department also has an independent 3-slide fallback carousel with previous/next controls and dots; published HERO media with category matching the department slug overrides the fallback.
- Each department has its own catalogue, category chips, search, and a photographic campaign card.
- Sample UI fallback catalogues include 6 crackers items, 8 housekeeping items and 8 stationery items; every fallback is marked DEMO and cannot be purchased.
- `server/sql/dev_seed_catalogue_v2.sql` inserts the same 22 explicitly labelled no-price/no-stock local demo products into PostgreSQL. The Windows local setup script applies this automatically **only with -UseDockerDb**, unless `-SkipDemoSeed` is specified. The script is idempotent.
- Published real products take precedence over fallback content in their respective departments.
- The crackers scheme appears only inside Crackers plus an information teaser on the homepage. Free festival scheme ID registration is available; there are no online crackers bookings, deliveries, advance collections or fireworks payments.

## Quick preview
```powershell
cd C:\Projects\SRC
git pull origin main
node .\scripts\check.mjs
powershell -ExecutionPolicy Bypass -File .\scripts\local-setup.ps1 -Directory . -SkipClone -UseDockerDb -StartApi -StartWeb
```

Use Ctrl + Shift + R on `http://localhost:8000` after pulling. Direct department routes: `#section/crackers`, `#section/housekeeping`, `#section/stationery`.

**Visual caveat:** The screenshot and local browser rendering have not been validated in a live browser in this environment; the source changes and static JavaScript/DOM checks are verified only.
