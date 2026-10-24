# SRC business divisions — source of truth

Public site: https://srcenterprises.in
Technology: Node.js + TypeScript + PostgreSQL in `server/`; static storefront in `index.html`.

## Divisions
1. **Crackers** (`crackers`): catalogue, safety information, product demonstration media and outlet details. No online ordering, reservation, prebooking, collection, installments or scheme payments.
2. **Housekeeping Materials** (`housekeeping`): approved standard-commerce division; future normal cart, checkout, delivery and returns.
3. **Stationery** (`stationery`): approved standard-commerce division; future normal cart, checkout, delivery and returns.

Future divisions: create a row through `POST /api/admin/sections` with a unique slug and a configured commerce mode, using an admin credential. Server policy forces crackers into catalogue-only mode.

## Database initialization (new deployment)
Apply `server/sql/001_init.sql`, then `002_business_sections.sql`, `003_scheme_drafts.sql`, and `004_content.sql` in ascending order with `psql`. Do not use this as a substitute for migration tracking in production; add versioned migrations and a schema migration runner before launch.

## Existing Node API
- GET /api/catalog/sections
- GET /api/catalog/sections/:slug/products
- GET /api/catalog/products
- GET /api/catalog/categories
- GET /api/catalog/media
- GET /api/catalog/promotions
- Admin section create/edit, product create/edit/delete, content creation, and scheme draft create/list/delete

## Priorities to finish
- Genuine customer, agent, operator and admin authentication, permissions, MFA, audit logs
- Native admin screens backed by Node API (current role picker/localStorage is demo only)
- Full persistent product categories, inventory, promotions/offers and media CMS with update/delete operations
- Non-fireworks cart, inventory reservations, address selection, checkout, Razorpay approval, refunds and fulfillment
- Customer accounts, order history, agent reporting and notifications
- Licensed in-person firework operation outside e-commerce with compliance review
- Complete tests and measured coverage, data migrations, security verification and verified deployment

## Scheme requirements
Admin-only `scheme_drafts` stores future scheme designs including monthly/quarterly frequency, months and contributions. This does not register members or collect contributions. **Fireworks scheme launching and prebooking must not be implemented as online ordering/payments without an authoritative lawful basis and payment provider approval.**

Legal basis: Supreme Court judgment dated 23 October 2018 (Arjun Gopal) prohibits accepting online firework orders; PESO circular dated 11 April 2023 reiterates the ban.
