# NAIOSH ERP 360 — Staging Deployment Plan

**Date:** 2026-10-16  
**Purpose:** Safe Staging validation of Enterprise Settings Center (Phases 1–6) before any commercial / Production launch.  
**Status:** Plan only — **no Staging deploy executed in this document.**  
**Production / customer data:** **Forbidden** without a later explicit approval.

---

## Recommendation (Staging readiness)

| Gate | Decision |
|---|---|
| Code completeness on `main` (Phases 0–6) | **READY** |
| Local Phase 6 evidence accepted | **READY** (66/66 harness, fresh migrate, GUI E2E, path-mode fix) |
| Staging deploy execution | **WAITING for separate explicit approval** |
| Production deploy / sale | **NO-GO** until Staging soak passes |

---

## 1) PR chain review (Phase 0 → 6)

| PR | Phase | State | Base | Merge commit / notes |
|---|---|---|---|---|
| #150 | 0 Discovery | **MERGED** | `main` | `e3f344c` |
| #151 | 1 Settings Engine | **MERGED** | `main` | `d9f82dd` |
| #152 | 2 Platform Owner | **OPEN (leftover)** | `phase1` branch | Content already on `main` via later merges — **do not merge out-of-order** |
| #153 | 0–3 bundle / Company Settings | **MERGED** | `main` | Includes Phase 2+3 on `main` |
| #154 | 4 Module Settings | **MERGED** | `main` | `f98ccfb` |
| #155 | 5 Shared Services | **MERGED** | `main` | `b22ba46` |
| #156 | 6 Readiness + blocker closure | **MERGED** | `main` | `062cf26` |

### Completeness / conflicts
- Tip of `origin/main`: **`062cf26`** — *Merge Phase 6 commercial readiness and blocker closure into main.*
- Phase SQL + centers + harness present on `main`: engine, company org, module ops, shared services, platform-owner schema, path-mode client, Phase 6 reports/tests.
- No open merge conflicts for #156 (`MERGEABLE` then merged).
- **Action before Staging:** close #152 as superseded (optional housekeeping; not required for deploy). Do **not** rebase-merge #152 onto `main`.

---

## 2) Final code source for Staging

| Item | Value |
|---|---|
| **Source of truth** | GitHub `main` |
| **Pin / tag (recommended)** | Create annotated tag after approval, e.g. `staging-enterprise-settings-2026-10-16` → `062cf26` |
| **Deploy artifact** | Docker build from repo root (`railway.json` → Dockerfile + `scripts/railway-start.sh`) |
| **Do not deploy from** | Feature branches `cursor/enterprise-settings-phase*-421d`, draft PRs, or local dirty trees |

```text
origin/main @ 062cf26
  ├── Phase 1 engine SQL + APIs
  ├── Phase 2 Platform Owner console + schema
  ├── Phase 3 Company Settings Center
  ├── Phase 4 Module Settings Center
  ├── Phase 5 Shared Services (wf/backup/templates/outbox/integrations)
  └── Phase 6 security/path-mode + readiness harness + GUI E2E runner
```

---

## 3) Safe Staging deploy plan

### 3.1 Pre-flight (before any deploy click)
1. Confirm separate Staging Railway (or equivalent) **project/environment** — not Production.
2. Provision **new** Staging Postgres service (empty). Name DB distinctly, e.g. `naiosh_erp_staging`.
3. Generate **new** secrets for Staging only (never copy Production):
   - `TENANT_DB_ENCRYPTION_KEY` (64 hex)
   - Platform payment keys → **test-mode only** (or disabled)
4. Set env vars (see §5). Double-check `DATABASE_URL` host ≠ Production host.
5. Optional: `pg_dump --schema-only` from a **non-prod** reference is allowed; **never** restore Production data dumps into Staging for this validation.

### 3.2 Deploy sequence
1. Point Staging service to Git ref `main` @ pinned SHA/`tag`.
2. Build & start (`scripts/railway-start.sh` → `node server.js`).
3. **Do not** set `RUN_DB_RESTORE_ONCE` unless restoring an approved **Staging** backup.
4. Apply / verify migrations in order (idempotent `IF NOT EXISTS`):

| Order | File | Purpose |
|---|---|---|
| 1 | `create-enterprise-settings-engine.sql` | Settings Engine |
| 2 | `create-platform-owner-schema.sql` | Owner plans/licenses/modules |
| 3 | `create-company-settings-org.sql` | Company org + invites |
| 4 | `create-module-settings-ops.sql` | Fiscal / numbering / templates |
| 5 | `create-enterprise-shared-services.sql` | Workflow, backup, outbox, integrations |

Services also call `ensureSchema` / `ensureEngine` on first API use; still run SQL explicitly once on empty Staging for auditability.

5. Smoke: `GET /api/db-connect-test`, `GET /api/auth/ping`, open `/platform/owner` (central) and `/t/{demo}/modules/settings`.

### 3.3 Post-deploy verification (same window)
Run against **Staging** `DATABASE_URL` only:

```bash
DATABASE_URL="$STAGING_DATABASE_URL" DATABASE_SSL=true \
  node test-phase6-commercial-readiness.js

DATABASE_URL="$STAGING_DATABASE_URL" node test-company-settings.js
DATABASE_URL="$STAGING_DATABASE_URL" node test-module-settings.js
DATABASE_URL="$STAGING_DATABASE_URL" node test-enterprise-shared-services.js

PHASE6_GUI_BASE="https://<staging-host>" PHASE6_GUI_SUBDOMAIN="<demo-sub>" \
  node test-phase6-gui-e2e.js   # or manual checklist §7
```

### 3.4 Rollback plan
| Layer | Action |
|---|---|
| App | Redeploy previous known-good image/SHA on Staging service |
| Schema | Prefer forward-fix; Phase SQL is non-destructive `IF NOT EXISTS`. Destructive rollback = restore Staging DB from **pre-deploy Staging snapshot** only |
| Restore tooling | Use gated restore: `CONFIRM_DESTRUCTIVE_RESTORE` + `TEST_RESTORE_DATABASE_URL` pointing at a **second** Staging sandbox DB (`*_test` / `restore_sandbox` in name) — never Staging primary, never Production |
| Kill switch | Disable Staging public domain / set service sleep if soak fails |

---

## 4) Staging PostgreSQL isolation (mandatory)

| Rule | Requirement |
|---|---|
| Separate instance | Dedicated Staging Postgres service (new Railway Postgres or equivalent) |
| Separate credentials | Unique user/password; not Production roles |
| Separate database name | e.g. `naiosh_erp_staging` — never Production DB name |
| Network | Staging app → Staging DB only; no Production `DATABASE_URL` reference variables |
| Backups | Staging-only backup schedule; restore targets must include `_test` / `restore_sandbox` in URL |
| Proof before go-live of Staging | Record redacted hosts of Staging vs Production in deploy ticket; they must differ |

---

## 5) Environment variables (Staging) — no Production secrets

### Required
| Variable | Staging value guidance |
|---|---|
| `DATABASE_URL` | Staging Postgres only (Add Reference → Staging Postgres) |
| `DATABASE_SSL` | `true` on managed cloud PG |
| `NODE_ENV` | `production` (or `staging` if app treats it safely; default railway example uses `production`) |
| `BASE_DOMAIN` | Staging domain, e.g. `staging.example.com` — **not** Production apex |
| `PUBLIC_APP_URL` | Staging public URL (enables `/t/{subdomain}` links) |
| `TENANT_SUBDOMAIN_URLS` | `true` if wildcard DNS available on Staging |
| `HOST` / `PORT` | Platform-managed |
| `TRUST_PROXY` | `1` |
| `TENANT_DB_ENCRYPTION_KEY` | **New** 64-hex key for Staging only |
| `UPLOADS_ROOT_DIR` | Staging volume / ephemeral path |

### Staging-only safety flags
| Variable | Guidance |
|---|---|
| `PHASE5_RESTORE_SCHEMA_SANDBOX` | `true` for non-destructive restore-test markers |
| `TEST_RESTORE_DATABASE_URL` | Optional second Staging DB URL containing `_test` — never equal to Staging primary or Production |
| `ALLOW_PHASE5_TEST_RESTORE` | Avoid on shared Staging unless tightly controlled |
| `RUN_DB_RESTORE_ONCE` | **Unset** for first Staging bring-up |
| `DEBUG_AUTH` | `0` |
| `PAYMENT_DEMO_MODE` / test gateway keys | Prefer demo/test keys; **never** live Production merchant secrets |
| `SAAS_SKIP_PAYMENT` | Allowed on Staging for provisioning drills |

### Forbidden on Staging
- Production `DATABASE_URL` / `DATABASE_PUBLIC_URL` / `PROVISION_DB_URL`
- Production `TENANT_DB_ENCRYPTION_KEY`
- Live Stripe/PayPal/Paymob secrets
- Customer PII dumps
- Pasting Production connection strings into logs/tickets

---

## 6) Role test matrix (Platform Owner / Company Admin / Staff)

Seed **synthetic** Staging users only (new passwords; not Production accounts).

| Role | Host | Expected access | Expected deny |
|---|---|---|---|
| **Platform Owner** (`super_admin` / HQ) | Central Staging host | `/platform/owner`, platform APIs `/api/platform-owner/*`, plans/subscriptions/modules | Tenant company/module/shared settings APIs without tenant host |
| **Company Admin** (`company_admin` / `admin`) | Tenant host or `/t/{sub}/…` | `/company/settings`, `/modules/settings`, `/shared/services`, save settings, invites, workflow, backup job create, restore-**test** only | Platform Owner APIs; other tenants’ data |
| **Staff** (`staff` / `employee`) | Same tenant host | Normal operational modules per entitlements | Company/module/shared settings mutating APIs → **403**; no HQ bypass |

### Authentication notes for Staging
- Prefer path mode `/t/{subdomain}/…` if Staging lacks wildcard DNS.
- Confirm `tenant-path-client.js` scopes `/api/*` under `/t/{sub}`.
- Session cookies / Bearer tokens must be Staging-issued.

---

## 7) Settings centers & ERP modules — Staging test scenarios

### 7.1 Centers (authenticated GUI)
| # | Center | Path | Checks |
|---|---|---|---|
| 1 | Settings hub | `/settings/admin` | Loads; links to centers |
| 2 | Platform Owner | `/platform/owner` | Companies, plans, modules, security tabs; refresh works |
| 3 | Company Settings | `/t/{sub}/company/settings` | Load bundle; edit safe field; save; reload; RTL |
| 4 | Module Settings | `/t/{sub}/modules/settings` | Tabs for modules; save `module.hr.leave`; reload persist |
| 5 | Shared Services | `/t/{sub}/shared/services` | Workflow / backup / templates / notifications / integrations |

Central host negative checks:
- `/modules/settings` and `/company/settings` show **clear tenant-host guidance** (not generic HTTP 404).

### 7.2 Catalog / modules (47 live entries — operational samples)
Execute at least one **behavior** proof per family (not page-open only):

| Family | Example proof |
|---|---|
| HR | Leave policy save → validate-leave rejects over-limit |
| Finance | Tax rate setting → compute-tax matches |
| Sales / POS / CRM | POS zero-allow / CRM stage isolated per tenant |
| Supply chain | Stock policy evaluate |
| Tasks / Purchases | Assignee / PO threshold evaluators |
| Fiscal | Create year/periods; posting gate closed vs open |
| Workflows | Create definition; start; approve; DB re-read |
| Templates | Versioned save; XSS `<script>` rejected; preview escaped |
| Notifications | Enqueue + process outbox |
| Backup | Run backup; restore-test to sandbox/`_test` URL; block primary URL |
| Security / Audit | Audit list shows `module.*` / `company.*` keys |
| Integrations | List registry; enable; test (no secret echo) |
| Isolation | Tenant A value ≠ Tenant B for same key |
| Entitlements / seats | Module gate prefixes; seat allowance API |

### 7.3 Soak (after smoke green)
- 24h Staging soak: error rate, outbox backlog, workflow volume, memory RSS.
- Concurrent workflow start smoke (harness already measures locally).

---

## 8) Remaining operational risks

| Severity | Risk | Mitigation on Staging |
|---|---|---|
| Medium | CSRF on cookie-authenticated POSTs | Prefer Bearer tokens in API tests; plan CSRF tokens before Production |
| Medium | Demo seed scripts in repo | Do not run Production seed scripts on Staging with real domains; use Staging-only synthetic seeds |
| Medium | Leftover open PR #152 | Close as superseded to avoid accidental out-of-order merge |
| Low | Login lockout is process-local | Acceptable on single Staging instance; document for multi-instance Production |
| Low | Notification “sent” = queue success | Validate SMTP via Staging test mailbox before Production email claims |
| Low | Wildcard DNS may be missing | Use `/t/{subdomain}` path mode + `PUBLIC_APP_URL` |
| Ops | Accidental Production URL in env | Checklist: compare redacted hosts; fail deploy if match |
| Ops | Destructive restore | Keep `CONFIRM_DESTRUCTIVE_RESTORE` + safe URL gates; never set Staging primary as restore target |

**No open Critical/High** from Phase 6 local closure; Staging may still surface environment-specific issues (DNS, SSL, volume mounts).

---

## 9) Staging readiness verdict

| Question | Answer |
|---|---|
| Is code on `main` complete for Phases 1–6? | **Yes** (`062cf26`) |
| Are local blockers closed? | **Yes** |
| Is Staging deploy approved by this document? | **No** — plan only |
| Ready to **request** Staging deploy approval? | **Yes** |

### Ask for next approval (separate message)
Please reply with an explicit approval if you want Staging executed, specifying:
1. Staging host / Railway project name  
2. Confirmation that a **new** Postgres will be created (not Production)  
3. Whether to tag `main@062cf26` before deploy  

Until then: **no Staging deploy, no Production deploy, no customer data changes.**

---

## Appendix A — Quick rollback card

1. Stop / sleep Staging web service.  
2. Redeploy previous Staging image SHA.  
3. If schema corrupted: restore from pre-deploy Staging snapshot to Staging DB only.  
4. Re-run `test-phase6-commercial-readiness.js` against Staging.  
5. Record incident; do not touch Production.

## Appendix B — Evidence already accepted locally
- Fresh migrate: isolated PG PASS  
- Authenticated GUI E2E: 14/0/0 PASS  
- Phase 6 harness: 66/66 PASS  
- Path-mode tenant API scoping fix  
- Reports: `PHASE6_COMMERCIAL_READINESS_REPORT.md`, `PHASE6_FINAL_BLOCKER_CLOSURE_REPORT.md`
