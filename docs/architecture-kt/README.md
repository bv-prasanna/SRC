# SRC Enterprises commerce and operations - Architecture, Deployment, ER, Database, Migration & KT Guide
> **Code snapshot:** 2026-11-09, `main` branch of [bv-prasanna/SRC](https://github.com/bv-prasanna/SRC). **Repository-derived reference**; cloud environment and deployed DB must be verified separately.
**Regulatory gate:** repository README restricts online fireworks sale/payment; do not use this handover to authorize those flows.
## 1. System context and component architecture
**Stack observed / documented:** Node.js/TypeScript + PostgreSQL; static web UI. Source has web components, no verified mobile app and backend/API sources.

```mermaid
flowchart LR
    Operator[Customers / Staff] --> UI[Web or module consumer]

    UI --> Service[Application API / Domain]

    Service --> Security[Auth / policy / validation]
    Security --> DB[(Persisted data store - verify env)]

    Service -.-> Provider[External adapters / payment / mail]
    QA[Tests / CI] -. checks .-> Service
```
**Cross-cutting contracts:** server-validated inputs; least-privilege RBAC; concurrency/idempotency; customer vs admin isolation; audit IDs; non-secret config; appropriate geo evidence and billing snapshots where applicable.

## 2. Deployment diagram (logical reference, not production verification)
```mermaid
flowchart TB
    Git[GitHub main / tagged release] --> QA[CI / build checks]
    QA -. approved artifact .-> Front[Frontend / CDN / HTTPS]
    Front --> Back[Backend / APIs / runtime]

    Back --> DB[(Database instance)]

    Vault[Managed secrets / environment] -. injected .-> Back
    Monitor[Logs / metrics / alerts] -. monitors .-> Back
```
**Complete for each environment:** cloud project/region, DNS and custom domain, static/web deployment, API container/function, environment names, database identity, secret manager, backup owner, health check, rollback release, CI status and contact matrix. Diagram does **not** establish a running deployment.

## 3. ER diagram - representative source-verified baseline
The ER uses `CREATE TABLE` and declared `REFERENCES` found in **1 selected baseline file(s)**, not every subsequent migration. It is not a complete physical ER; export the current database catalog for authoritative tables, columns and foreign keys.

```mermaid
erDiagram
    PRODUCTS {
        BIGINT id PK
        VARCHAR name
        VARCHAR category
        VARCHAR description
        TEXT image_url
        TEXT demo_video_url
        BOOLEAN published
        BOOLEAN fireworks
    }
```

## 4. Database schema and migration registry
**DDL/migration sources detected:** 21. **Baseline tables detected:** 1. The full and exact schema is defined by the ordered source SQL and later ALTERs, plus the deployed migration history; this table-name view is intentionally limited to inspected baseline files.

Baseline tables: `products`.

**Versioned SQL / schema paths:**
- [`server/sql/001_init.sql`](../../server/sql/001_init.sql)
- [`server/sql/002_business_sections.sql`](../../server/sql/002_business_sections.sql)
- [`server/sql/003_scheme_drafts.sql`](../../server/sql/003_scheme_drafts.sql)
- [`server/sql/004_content.sql`](../../server/sql/004_content.sql)
- [`server/sql/005_standard_orders.sql`](../../server/sql/005_standard_orders.sql)
- [`server/sql/006_inventory.sql`](../../server/sql/006_inventory.sql)
- [`server/sql/007_identity.sql`](../../server/sql/007_identity.sql)
- [`server/sql/008_fulfillment.sql`](../../server/sql/008_fulfillment.sql)
- [`server/sql/009_commerce.sql`](../../server/sql/009_commerce.sql)
- [`server/sql/010_paid_fulfillment.sql`](../../server/sql/010_paid_fulfillment.sql)
- [`server/sql/011_operational_roles.sql`](../../server/sql/011_operational_roles.sql)
- [`server/sql/012_festival_members.sql`](../../server/sql/012_festival_members.sql)
- [`server/sql/013_festival_counter_receipts.sql`](../../server/sql/013_festival_counter_receipts.sql)
- [`server/sql/014_standalone_scheme_section.sql`](../../server/sql/014_standalone_scheme_section.sql)
- [`server/sql/015_scheme_management.sql`](../../server/sql/015_scheme_management.sql)
- [`server/sql/016_jwt_superadmin.sql`](../../server/sql/016_jwt_superadmin.sql)
- [`server/sql/017_billing_pricing.sql`](../../server/sql/017_billing_pricing.sql)
- [`server/sql/018_scheme_member_kyc.sql`](../../server/sql/018_scheme_member_kyc.sql)
- [`server/sql/019_scheme_subscription_payments.sql`](../../server/sql/019_scheme_subscription_payments.sql)
- [`server/sql/020_scoped_staff_permissions.sql`](../../server/sql/020_scoped_staff_permissions.sql)
- [`server/sql/021_scheme_member_followups.sql`](../../server/sql/021_scheme_member_followups.sql)


For a verified PostgreSQL schema snapshot: `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > schema-only.sql`. For SQLite/D1, inspect `sqlite_master` and `PRAGMA table_info` in the correct environment. Never upload production PII or credentials to docs.

## 5. Safe migration script and procedures
**Repository-native migration:** cd server && npm run migrate. Copy/adapt this guarded operator wrapper into the deployment runbook; it performs **no migration by default**.

```bash
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-plan}" != "apply" ]]; then
  echo 'PLAN ONLY: verify target branch/SHA, migration history, pending DDL and permissions'
  echo 'Back up, restore-test, dry-run in staging and record release/backup references.'
  exit 0
fi
[[ "${CONFIRM_DB_MIGRATION:-}" == "BACKUP_VERIFIED" ]] || exit 3
: "${BACKUP_REFERENCE:?Verified backup/snapshot reference required}"
: "${MIGRATION_APPLY_CMD:?Provide the reviewed repository-native migration command}"
bash -lc "$MIGRATION_APPLY_CMD"
echo 'Verify migration tracking table, API health, smoke tests, reconciliation and audit.'
```
**Process:** (1) compare applied versions/checksums; (2) review forward/backward compatibility; (3) backup + actual restoration rehearsal; (4) staging migration/test; (5) review/approve; (6) production apply once; (7) verify health, business smoke and data; (8) record release; (9) recover using tested restore or forward-fix, never blindly undo destructive SQL. Production seeding is prohibited by default.

## 6. Build, release and deployment KT
- Check out the exact release SHA, supported runtime from `package.json` / `pom.xml` and documented local dependencies.
- Run repository tests/build/coverage as configured, inspect CI workflow failures, artifacts, lint/typecheck and vulnerability scans.
- Configure HTTPS, tenant/role/OTP modes, CORS and sessions; keep third-party secrets and payment credentials out of GitHub.
- Validate database connectivity, migration record, app health, cron/background jobs, callback signature verification, logs and alert routes.
- For web/mobile releases verify required version controls, app signing, staging-only toggles and rollback compatibility when present.

## 7. Support, maintenance and incident runbook
**Daily:** health/error rates, auth errors, queue/jobs, webhook exceptions, failed payment/invoice notifications and CI deploy status. **Weekly:** DB backup checks, restore sample, retention, storage growth, payment/reconciliation where relevant, access review. **Monthly:** dependency patching, cert renewals, DR drill, audit review and architecture drift.  
**Incident:** establish scope/last-good SHA; protect logs; disable unsafe writes; compare current vs expected config; use tested rollback/restore; verify with smoke tests; record RCA and corrective test cases.

## 8. KT and customer UAT demo script
**Show:** Browse catalog -> staff/catalog admin -> stock/fulfilment; regulated fireworks transactions excluded.
| Minutes | What to demonstrate |
|---|---|
| 0-10 | Product scope, stakeholders, roles, current maturity |
| 10-25 | Main happy path + real error/success messages |
| 25-40 | Architecture, data flows, DB, RBAC and integrations |
| 40-50 | Local build, CI/deploy, migration and rollback |
| 50-60 | Backups, monitoring, admin operations, UAT gaps and contacts |

**Negative tests:** bad credentials, expired session, forbidden role, bad input, duplicate submission, concurrent operation/stock conflict, offline/timeouts, provider failures, duplicate webhook if used, failed refund, DB loss, location missing (where relevant), invalid migration and tenant leak. Demonstrate only sandbox transactions unless deployment approval is recorded.

## 9. Handover checklist and known evidence gaps
- [ ] Production/staging service URLs, domains, hosting region, owner and runtime version documented
- [ ] Secrets access handed over via vault (NO values committed)
- [ ] Build and CI evidence, test report/coverage and open defects acknowledged
- [ ] Current database schema-only export and ER reconciled to deployed SHA
- [ ] Migration history, checksum changes and backup/restore evidence signed
- [ ] Health, logs, monitoring thresholds and escalation contact operational
- [ ] Application walkthrough, operational SOP and security/negative UAT approved
- [ ] Release steps, rollback/forward-fix plan and next maintenance window owned

**Other source documentation:**
- [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md)
- [`docs/DEPLOY_SRC_CLOUDFLARE.md`](../../docs/DEPLOY_SRC_CLOUDFLARE.md)
- [`docs/SRC_RELEASE_AUDIT_2026-11-01.md`](../../docs/SRC_RELEASE_AUDIT_2026-11-01.md)
- [`docs/SRC_STAGING_RELEASE_GATE_2026-11-04.md`](../../docs/SRC_STAGING_RELEASE_GATE_2026-11-04.md)
- CI: [`.github/workflows/backend-verify.yml`](../../.github/workflows/backend-verify.yml)
- CI: [`.github/workflows/node-verify.yml`](../../.github/workflows/node-verify.yml)
- CI: [`.github/workflows/static-check.yml`](../../.github/workflows/static-check.yml)

*This guide is a source-derived starting point for KT. Do not claim that source presence means production deployment, a passing CI run or an accurate live-schema export.*
