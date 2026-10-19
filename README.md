# SRC Enterprises — storefront prototype

A professional responsive digital **catalogue**, product effect video gallery, and role-based dashboard UX prototype for SRC Enterprises Bengaluru.

## Important regulatory / payment restrictions

**This project does not process or solicit online fireworks orders or payments.** India's Supreme Court prohibited online fireworks orders and sales (Arjun Gopal v Union of India, 2018); PESO reaffirmed the online fireworks sale ban in 2023. Razorpay restricted-business terms include pyrotechnic devices and explosives.

- No fireworks checkout, cart, UPI mandates, Razorpay subscription creation or scheme enrolment.
- Admin schemes are internal **draft planning records** only, not customer-facing offers.
- Obtain professional legal advice and payment-provider written approval before introducing any regulated transaction functionality. Lawful, separately approved non-fireworks merchandise can be evaluated for payments later.

## Run locally

This is a static, dependency-free prototype. Open `index.html` in a browser, or serve with `python -m http.server 8000` and open `http://localhost:8000`.

## Features

- Responsive premium festive homepage and catalogue.
- Category cards and product descriptions.
- Approved video links and demonstration gallery placeholders.
- Customer, agent and admin dashboard preview switcher.
- Admin category, product, video, hero campaign and internal scheme draft CRUD with browser localStorage.
- Clear disclaimer and disabled online fireworks transactions.

## Security notes

**NOT production authentication:** The login area is a role selector for UX testing only. Browser localStorage is not a server database. Do not use for real customer data, permissions or business transactions. A future backend needs server-side RBAC, identity verification, validated APIs, audit logs, real media storage, and secure inventory management.

## Suggested next architecture

- Next.js + TypeScript storefront/dashboard, responsive design.
- Spring Boot (Java) or NestJS backend, PostgreSQL, Flyway migrations.
- RBAC: CUSTOMER, AGENT, ADMIN, SUPERADMIN.
- Product/category/media/campaign APIs and inventory audit trails.
- Agents limited to assigned enquiries, admins protected by permission checks.
- Image/video asset hosting through a CDN, only approved source material.
- CI on pull requests with lint, tests, build; avoid excessive CI usage.
- Before any payment-enabled **non-fireworks** lines, obtain provider approval, webhook signature checks, idempotency, payment reconciliation and refund controls.

## References

- https://karnatakacrackers.com/
- https://srigokulamcrackers.com/
- https://elephantcracker.com/index.php?device=tablet

These are design research references, not a compliance endorsement.
