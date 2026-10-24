# SRC Enterprises — Node.js backend

TypeScript + Express + PostgreSQL. Java Spring Boot backend is legacy and must not be deployed.

## Start
1. Install Node.js 22 and PostgreSQL.
2. Copy `.env.example` to `.env` and set a unique 32+ character admin token and DATABASE_URL.
3. Apply `sql/001_init.sql` using `psql "$DATABASE_URL" -f sql/001_init.sql`.
4. Run `npm install`, `npm run build`, then `npm start`.

### API
- Public: GET /health, GET /api/catalog/products
- Admin with Authorization: Bearer SRC_ADMIN_TOKEN: GET/POST /api/admin/products, PUT/DELETE /api/admin/products/:id

This is a foundation, not production authentication. Replace the single admin token with real user accounts, MFA and RBAC before launch. Categories, banners, promotions, scheme drafts and inventory are pending migration from Java. No online fireworks ordering, reservation, scheme enrolment, or payment endpoints.
