# NAIOSH ERP 360 — Staging Validation Report

**Date:** 2026-10-16  
**Approval scope:** Conditional Staging only  
**Production deploy:** **Not performed**  
**Customer data:** **Not used**

---

## Executive verdict

| Gate | Decision |
|---|---|
| Code source `main@062cf26` Phases 1–6 complete | **PASS** |
| PR #152 unique changes vs `main` | **None** (safe to close as superseded; **not closed** in this run) |
| Isolated Staging Postgres + app brought up | **PASS** (local project `naiosh-erp-staging`) |
| Public cloud Staging URL (Railway) | **BLOCKED** — no `RAILWAY_TOKEN` / Railway login in this environment (credentials requested) |
| Post-deploy API validation | **43 PASS / 0 FAIL** |
| Authenticated GUI E2E on Staging URL | **14 PASS / 0 FAIL** |
| **Commercial / Production GO** | **NO-GO** |

**Staging local stack: GO for continued Staging soak.**  
**Public Railway Staging + commercial launch: NO-GO until cloud credentials + public URL validation.**

---

## 1) Code source verification

| Item | Value |
|---|---|
| **Deployed / validated commit** | `062cf26cdad16c36632a2511e6d54d386eed6593` |
| **Ref** | `origin/main` |
| **Message** | Merge Phase 6 commercial readiness and blocker closure into main |
| Phase SQL on tip | engine, platform-owner, company-org, module-ops, shared-services — present |
| Centers / harness | company, module, shared, owner, `tenant-path-client`, Phase 6 tests — present |

### PR #152 investigation (left open)
| Check | Result |
|---|---|
| Commits on `cursor/enterprise-settings-phase2-421d` not in `main` | **0** |
| `b3bb16e` / `8fed0cd` ancestors of `main` | **Yes** |
| Why still OPEN | Targets base `cursor/enterprise-settings-phase1-421d` (not `main`); never merged as that PR because Phase 2 landed via later `main` merges (#153+) |
| Unique file content missing from `main` | **No** — `main` is a **superset** (Phases 3–6). Small diffs (`module-entitlement-middleware.js`, `platform-owner-api.js`) show **main newer** (expanded entitlements + `safeProvisionTenant`) |
| Action taken | **Documented only** — PR **not closed**, **not merged** (per approval) |

**Final code source for Staging:** Git `main` @ **`062cf26`** only.

---

## 2) Staging environment (isolated)

| Field | Value |
|---|---|
| **Project / env name** | `naiosh-erp-staging` |
| **App URL (local Staging)** | `http://127.0.0.1:3020` |
| **Tenant path example** | `http://127.0.0.1:3020/t/stg-alpha/modules/settings` |
| **BASE_DOMAIN** | `staging.local` |
| **PUBLIC_APP_URL** | `http://127.0.0.1:3020` |
| **NODE_ENV** | `staging` |
| **Commit running** | `062cf26` |
| **Uploads root** | `/tmp/naiosh-erp-staging/uploads` |
| **Cloud Railway project** | **Not created** (no token) |

### PostgreSQL isolation proof

| Property | Staging | Local/dev (non-prod) | Production Railway host (from docs — **not used**) |
|---|---|---|---|
| Host:port | `127.0.0.1:55433` | `127.0.0.1:5432` | `crossover.proxy.rlwy.net:44255` |
| Database | `naiosh_erp_staging` | `vendowor_erp` | `railway` (leaked in old docs — **avoid**) |
| User | `staging_app` | `vendowor_erp_user` | n/a |
| Cluster data dir | `/tmp/naiosh-erp-staging/pgdata` | system PG | n/a |

Pre-deploy checks recorded: Staging URL ≠ vendowor_erp; not `proxy.rlwy.net`; DB name `naiosh_erp_staging`; server reports `databaseHost: 127.0.0.1` / connected.

**Encryption key:** new Staging-only `TENANT_DB_ENCRYPTION_KEY` (generated; not Production).  
**Payment:** `PAYMENT_DEMO_MODE=1`, `SAAS_SKIP_PAYMENT=1` — no Production merchant secrets.

---

## 3) Migrations

| Step | Result |
|---|---|
| Schema bootstrap | Schema-only dump from **local non-prod** `vendowor_erp` (no row data) → Staging |
| Ordered Phase SQL re-apply | engine → platform-owner → company-org → module-ops → shared-services — **OK** |
| Public tables | **210** |
| Phase tables present | setting_*, saas_plans, tenant_*, fiscal_*, wf_*, backup_*, notification_outbox — **PASS** |
| Evidence log | `/opt/cursor/artifacts/staging-migrate.log` |

### Synthetic seed (fake only)
- Tenants: `stg-alpha` (pro), `stg-beta` (basic)
- Users: `staging-owner@example.test`, `staging-admin-alpha@example.test`, `staging-admin-beta@example.test`, `staging-staff-alpha@example.test`
- Plans: basic / pro / enterprise (active)
- Entity: `HQ001` Staging HQ

---

## 4) Post-deploy test results

### API (`test-staging-validation.js` → Staging :3020)
**43 PASS / 0 FAIL / 0 Critical**

Covered: isolation proofs, Platform Owner overview/plans, Staff denied Owner+settings, path-mode routing, company/module/shared bundles, save settings, alpha≠beta CRM stages, workflow create, notifications enqueue/process, backup job+run, restore without confirm → 403, RTL HTML, all five centers’ HTTP 200.

Artifact: `/opt/cursor/artifacts/staging-api-validation-results.json`

### GUI E2E (`test-phase6-gui-e2e.js` against Staging)
**14 PASS / 0 FAIL / 0 BLOCKED** on `http://127.0.0.1:3020` / subdomain `stg-alpha`

Includes: central-host clear message, tenant module load (14 tabs, RTL), save+reload leave days, company settings, shared services, platform owner, settings/admin, staff 403, mobile viewport.

Screenshots: `/opt/cursor/artifacts/screenshots/staging-p6-gui-*.png`

---

## 5) Remaining issues / blockers

| Severity | Item |
|---|---|
| **Blocker (public Staging)** | No Railway auth in agent VM — cannot publish customer-reachable Staging URL or managed Railway Postgres from here |
| Medium | Repo docs still embed an old Railway `DATABASE_URL` with password (`RAILWAY_SETUP.md` / `DEPLOYMENT_INSTRUCTIONS.md`) — **must rotate/remove**; Staging did **not** use it |
| Medium | CSRF hardening still pending before Production |
| Low | Local Staging binds `127.0.0.1` only (intentional isolation); not internet-facing |
| Info | PR #152 still OPEN; verified superseded — close manually when desired |

---

## 6) Commercial recommendation

**NO-GO for commercial / Production launch.**

Reasons:
1. Public cloud Staging URL not yet available/validated.  
2. Production approval not granted.  
3. Remaining Medium risks (CSRF, leaked legacy DB URL in docs) should be cleared before sale.

**Local Staging stack:** validated against `062cf26` with full isolation proofs — suitable for continued soak once/if a public Staging host is provisioned with the same commit and a **new** Postgres.

---

## 7) What we need from you for public Staging

Already requested via environment setup actions:
1. `RAILWAY_TOKEN` (or create Railway project `naiosh-erp-staging` with empty Postgres and share URL)  
2. Optional `STAGING_BASE_DOMAIN` / `STAGING_PUBLIC_APP_URL`

Until then, public Staging deploy remains blocked by the isolation/credentials gate in your approval.

---

## Appendix — Commands used (redacted)

```bash
# Staging Postgres
initdb/pg_ctl → /tmp/naiosh-erp-staging/pgdata -p 55433
database: naiosh_erp_staging  user: staging_app

# App
DATABASE_URL=postgresql://staging_app:***@127.0.0.1:55433/naiosh_erp_staging \
PORT=3020 NODE_ENV=staging BASE_DOMAIN=staging.local \
node server.js   # commit 062cf26

# Tests
DATABASE_URL=... STAGING_BASE=http://127.0.0.1:3020 node test-staging-validation.js
PHASE6_GUI_BASE=http://127.0.0.1:3020 PHASE6_GUI_SUBDOMAIN=stg-alpha node test-phase6-gui-e2e.js
```
