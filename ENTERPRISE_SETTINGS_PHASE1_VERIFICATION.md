# NAIOSH ERP 360 — Phase 1 Verification Report

**Status:** Verification complete (local) — **Phase 2 NOT started** — **No Production deploy / merge**  
**Branch:** `cursor/enterprise-settings-phase1-421d`  
**Date:** 2026-10-16  
**Evidence:** `/opt/cursor/artifacts/phase1-*.log`, `phase1-verification-results.json`, `phase1-hub-smoke.json`

---

## Verdict

| Gate | Result |
|---|---|
| Catalog matrix (47 = 18 live + 18 partial + 3 planned + 8 mock) | **PASS** |
| Settings Engine on real Postgres (tables + seed + CRUD) | **PASS** |
| Backend auth / tenant isolation / versioning | **PASS** (after versioning fix) |
| Local hub + real login save/read | **PASS** |
| Compatibility with existing settings pages | **PASS** |
| Remote Staging browser E2E | **BLOCKED** — Phase 1 branch not deployed to Railway Staging; no prod/staging deploy without approval |
| GUI computer-use demo video | **BLOCKED** — computer-use executor unavailable in this run; API + HTML + static wiring covered instead |

**Conditional approval for Phase 2 planning is satisfied for local verification. Do not implement Phase 2 until this report is accepted.**

---

## 1) The 18 partial items (detail)

| # | id | Level | What exists today | Gap vs commercial settings |
|---:|---|---|---|---|
| 1 | `platform-saas-signup` | platform | `GET /api/saas/systems-catalog` | No editable plans UI; Phase 2 owner console |
| 2 | `company-email` | company | `/api/tenant-settings/email` | API only — no dedicated SMTP settings page in hub |
| 3 | `company-seo` | company | `/api/tenant-settings/seo` | API only — no SEO editor surface |
| 4 | `company-ai` | company | `/api/tenant-settings/ai` | API only — no AI controls UI |
| 5 | `company-org` | company | Tables `tenant_branches` / departments; SPA route exists | Settings UI was formal; needs real CRUD (Phase 3) |
| 6 | `module-hr-payroll` | module | `/hr/payroll-hub` operational hub | Not a full payroll *policy/settings* console |
| 7 | `module-hr-attendance` | module | `/hr/attendance-hub` | Missing attendance policy/rules settings depth |
| 8 | `module-finance-policies` | module | `/finance/financial-policies-framework.html` | Framework page incomplete vs policy master |
| 9 | `module-sales-crm` | module | `/sales/crm` module | No dedicated CRM settings (pipelines, stages, SLA) |
| 10 | `module-sales-pos` | module | `/sales/pos` | No POS config (registers, receipts, tax mapping) |
| 11 | `module-inventory` | module | `/supply-chain/inventory` | No warehouse/valuation/reorder settings surface |
| 12 | `module-purchases` | module | `/supply-chain/purchases` | No PO approval limits / purchase policies settings |
| 13 | `module-suppliers` | module | `/supply-chain/suppliers` | No supplier qualification / terms settings |
| 14 | `module-tasks` | module | `/tasks` | Module live; settings depth elsewhere (mock) |
| 15 | `module-facilities` | module | `/facilities` | Operational pages without facilities settings master |
| 16 | `module-approvals-governance` | module | `/finance/approvals-roles-governance.html` | Partial governance UI; not full matrix editor |
| 17 | `module-notifications` | module | `/hr/notifications-center` | HR-centric; not cross-module notification policies |
| 18 | `module-audit` | module | `/audit-logs` | Viewer exists; not settings for retention/export policies |

---

## 2) The 8 mock / formal items (detail)

| # | id | Previous behavior | Current Phase 1 behavior | Target phase |
|---:|---|---|---|---|
| 1 | `company-general` | Toast-only language/region/currency | Disabled card + honest warning; no fake save | Phase 3 |
| 2 | `module-hr-workflow` | In-memory workflow UI | Marked mock; no pretend persistence | Phase 4 |
| 3 | `module-task-settings` | Local checkboxes without save | Disabled; redirected honesty via hub | Phase 3 |
| 4 | `module-templates-email` | Legacy settings toast shell | Disabled mock tile | Phase 3/5 |
| 5 | `module-templates-sms` | Legacy toast shell | Disabled mock tile | Phase 3/5 |
| 6 | `module-templates-print` | Legacy toast shell | Disabled mock tile | Phase 3/5 |
| 7 | `module-numbering` | Legacy toast shell | Disabled mock tile | Phase 3 |
| 8 | `module-backup` | Restore scripts only | Disabled; no production restore button | Phase 2 ops |

Legacy SPA routes (`settings-email-templates`, `settings-backup`, …) now render an honesty page and refuse fake success actions (`handleSettingsCatalogAction`).

---

## 3) Settings Engine — real DB proof (not schema-only)

Against local Postgres `vendowor_erp` @ `127.0.0.1`:

1. `ensureSchema()` created:
   - `setting_definitions`
   - `setting_values`
   - `setting_versions`
   - `setting_audit_events`
2. `POST /api/enterprise-settings/definitions/seed` upserted live+partial nav definitions.
3. `PUT /api/enterprise-settings/values/:key` writes JSONB values with version + audit rows.
4. `GET .../versions` and `GET .../audit` return persisted history.
5. Mounted in live `server.js` on `:3010` and exercised after real `POST /api/auth/login` (`HQ001` / `Admin@123`).

**Bug found & fixed during verification:** update path collided with create’s version-1 row (`setting_versions` unique). Fixed with idempotent archive (`ON CONFLICT DO NOTHING`) + insert of the new version snapshot.

**Hardening:** unique index `idx_setting_values_scope_unique` using `COALESCE` so NULL `tenant_id` cannot duplicate platform rows silently.

Commands:

```bash
DATABASE_URL=postgresql://vendowor_erp_user:***@127.0.0.1:5432/vendowor_erp \
  node test-enterprise-settings-verification.js
# → All verification assertions passed (45+)

DATABASE_URL=... node test-enterprise-settings-hub-smoke.js
# → Hub smoke passed
```

---

## 4) Backend isolation / permissions / versioning

| Test | Result |
|---|---|
| No token → 401 | PASS |
| Staff (non-admin) on central → 401 | PASS |
| Platform admin catalog includes platform level (47) | PASS |
| Tenant host catalog hides all `level=platform` | PASS |
| Tenant cannot `POST /definitions/seed` → 403 | PASS |
| Tenant cannot PUT platform-scoped key → 403 | PASS |
| Tenant A (101) vs Tenant B (202) values isolated | PASS |
| Version increments on overwrite; history ≥ 2 rows | PASS |
| Audit events recorded for key | PASS |

---

## 5) Hub / login / navigate / save (local)

| Step | Result |
|---|---|
| `POST /api/auth/login` HQ001 / Admin@123 | PASS — session cookie `authToken` |
| `GET /api/enterprise-settings/catalog` with session | PASS — counts 47 / live 18 / partial 18 / mock 8 |
| `PUT` value then `GET` same key | PASS — read-after-write |
| `GET /settings/admin` | PASS — SPA dashboard shell |
| `GET /settings` | PASS — homepage identity remains separate |
| Search / mock disable / no fake toast | PASS — verified in `script.js` contract |

Remote Staging UI walkthrough was **not** run: Phase 1 is not on Railway Staging, and production deploy is forbidden without explicit approval.

---

## 6) Compatibility

| Check | Result |
|---|---|
| Exact `/settings` homepage identity unchanged | PASS |
| `/settings/admin` added without overriding homepage | PASS |
| Live pages still served: payment, tax, branding, super-admin | PASS |
| Permissions tile → `/super-admin-page.html` (no dead toast) | PASS |
| Legacy mock routes no longer fake-save | PASS |

---

## 7) Remaining issues (honest)

1. **18 partial + 8 mock + 3 planned** still incomplete — expected; Phase 1 is inventory + engine + honest hub, not full module settings completion.
2. **Remote Staging / Production** not updated — by design until approval.
3. **GUI demo video** not captured in this environment (computer-use blocked).
4. Engine currently seeds **navigation metadata** (`nav.*`) more than deep module policy keys — deep keys land in later phases per module.
5. Local bootstrap password docs remain `HQ001` / `Admin@123` (dev only).

---

## Artifacts

- `phase1-verification-run.log` / `phase1-verification-results.json`
- `phase1-hub-smoke.log` / `phase1-hub-smoke.json`
- `phase1-live-server-smoke.log`
- `phase1-login-hub-flow.log` (token nested under `data.session.token`)
- `settings-admin-response.html`, `settings-homepage-response.html`
- Server: local `0.0.0.0:3010` (left running for follow-up)
