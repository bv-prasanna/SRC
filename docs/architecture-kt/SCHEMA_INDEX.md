# SRC Enterprises - Complete PostgreSQL SQL Migration Catalog

> All **21** numbered SQL migration files on `main` inspected on 2026-11-09. These source-derived diagrams/dictionaries are **not a substitute for physical production schema export**, and do not endorse a regulated transaction flow.

| Migration scope | Documentation |
|---|---|
| 001–011 | [Part 1: tables, columns, SQL references and ER](SCHEMA_MIGRATIONS_01.md) |
| 012–021 | [Part 2: tables, columns, SQL references and ER](SCHEMA_MIGRATIONS_02.md) |

Other handover resources: [architecture and deployment](README.md) · [guarded migration shell script](migrate-safe.sh) · [existing deployment documentation](../../docs/DEPLOYMENT.md).

## Database deployment control
1. Confirm exactly which `server/` or legacy backend code is deployed; record deployed git SHA, database identity and migration history.
2. Backup and test restore in a separate database before running `cd server && npm run migrate` in the approved environment.
3. Test schema checksum/order, member/manager permissions, scheme state, inventory, tax/billing and notification callbacks in staging.
4. Verify `pg_dump --schema-only` vs all numbered SQL files and reconcile indexes, uniqueness, constraints and RLS if relevant.
5. Check PAN/phone/UPI data retention, encryption, access logs, admin credentials and logging redaction.
6. **Regulatory release gate:** do not enable online fireworks checkout, payment, UPI mandate or scheme sale unless separately reviewed and approved by qualified counsel and payment provider. Database migrations themselves are not approval.

**Limitations:** ER snippets cover changes introduced within each group; later ALTERs can change earlier columns. No production database was accessed for this catalog.