# NAIOSH ERP 360 — Enterprise Settings Center
## Phase 0: Discovery & Audit Report

**Date:** 2026-10-16  
**Repo:** `naioshapp26-ship-it/erp`  
**Production:** `https://web-production-419e2.up.railway.app/`  
**Branch:** `cursor/enterprise-settings-phase0-421d`  
**Status:** Phase 0 complete — **no production changes**; awaiting approval to start Phase 1

---

## 0. Executive verdict

The product already has:

- Multi-tenant platform (central tenants + dedicated tenant DBs)
- Super Admin RBAC / page-access / audit
- Real homepage branding settings (`/settings` → `settings.html`)
- Tenant branding + payment settings (live APIs)
- HR System Settings hub (91 catalog tiles + CRUD API)
- Finance modules (COA, tax, payment plans) as separate pages
- Permissions matrix (33 roles) and approval SQL foundations

The UI the user screenshotted (`/settings/admin` — 16 tiles) is largely a **placeholder shell**: navigation works, actions toast only, no real backend for most tiles.

**Strategy:** evolve existing surfaces into **NAIOSH ENTERPRISE SETTINGS CENTER 360** — do not rebuild ERP from scratch; replace mock hub with real settings engine wired to existing modules.

---

## 1. Architecture snapshot (current)

| Layer | Tech |
|---|---|
| Runtime | Node.js + Express (`server.js` ~16.7k lines) |
| UI | Multi-page HTML + large SPA (`script.js`) + Finance/HR HTML modules |
| DB | PostgreSQL — central schema + per-tenant schemas/migrations |
| Tenancy | `tenants`, `subscriptions`, tenant pool resolver, `/t/{subdomain}` |
| AuthZ | Session + roles + office/tenant page access + permission matrix |

### Key mounts already present

| Mount | Module |
|---|---|
| `/api/admin` | `super-admin-api.js` |
| `/api/tenants` | `tenant-management-api.js` |
| `/api/tenant-settings` | `tenant-settings-api.js` |
| `/api/platform` | `platform-settings-api.js` |
| `/api/permissions` | `api-permissions-routes.js` |
| `/api/hr/system-settings` | `hr/api/system-settings.js` |
| `/api/tax-settings` | `server.js` |
| Finance APIs | `finance/api/*` |

---

## 2. Naming collision (critical UX finding)

| URL / Label | Actual meaning today |
|---|---|
| Sidebar **إعدادات الصفحة الرئيسية** → `/settings` | **Live** homepage identity editor (`settings.html` + `/api/admin/homepage-settings*`) |
| Sidebar **الاعدادات** → SPA `/settings/admin` | **Mock** 16-tile Settings Center (toast-only) |
| Screenshot hub tiles | Map to SPA routes `settings-*` in `script.js` — **not** wired to CRUD APIs |

Hard refresh on `/settings/admin` is fragile (SPA route not registered like other dashboard paths → can bounce to `/`).

**Recommended:** keep `/settings` for homepage branding; introduce `/enterprise-settings` (or harden `/settings/admin` SPA serving) as the real Enterprise Settings Center.

---

## 3. Master inventory matrix

Legend: **E** Existing · **I** Incomplete · **M** Missing · **D** Duplicate · **R** Reusable · **S** Security risk

### 3.1 Platform Super Admin

| Capability | Status | Evidence | Risk / Action |
|---|---|---|---|
| Tenant CRUD (create/suspend/migrate/refund) | E | `tenant-admin.html`, `/api/tenants*` | R — extend lifecycle UX (archive/export/delete policy) |
| Plans basic/pro/enterprise | I | Hardcoded in tenant APIs + `saas-signup-api.js`; `subscription.html` static | Build editable `subscription_plans` + entitlements enforcement |
| Module enablement | I | `products-modules-builder.js`, tenant page access by plan | Central Module Management UI + backend entitlement checks |
| Platform ops health / feature flags | M | Health fragments only | Phase 2 ops board |
| Platform branding/SEO/email/AI APIs | E (API) / I (UI) | `platform-settings-api.js` — payment UI only | Wire UI for non-payment platform settings |
| Super Admin RBAC UI | E | `super-admin-page.html` | R — keep as IAM console; link from settings hub |

### 3.2 Company / Tenant settings

| Capability | Status | Evidence | Action |
|---|---|---|---|
| Branding / identity | E | `tenant-branding-settings.html`, `/api/tenant-settings/identity` | R |
| Payment gateways | E | `tenant-payment-settings.html` | R |
| Email / SEO / AI / public-site | E (API) / M (UI) | `tenant-settings-api.js` | Add company settings screens |
| Branches / departments | I | Tables `tenant_branches`, `tenant_departments` in tenant migrations; hub tile mock | Wire org structure CRUD to settings hub |
| Company profile (legal name, TZ, currency) | I | Partial in branding/tenants | Extend identity schema + UI |

### 3.3 Settings Center hub (screenshot)

| Tile | Status | Reality |
|---|---|---|
| الفروع والاقسام | I/M UI | Org tables exist; hub is mock |
| نماذج الحقول | I | HR catalog `field-templates` generic JSONB |
| انظمة الترقيم | M engine | SPA mock only |
| انواع الاجراءات / الخطابات / النماذج | I | HR catalog seeds; ops letters separate |
| حالات المعاملات / الطلبات / المهام | I | Mixed SPA mock + HR workflow catalog keys |
| قوالب email/SMS/print/barcode | I | Catalog metadata only — no bodies/render/send |
| الصلاحيات | D/I | Does **not** open Super Admin; fake page |
| النسخ الاحتياطي | M in-app | Ops scripts only (`scripts/restore-*`) |
| اعدادات عامة | M | SPA mock |

### 3.4 IAM & RBAC

| Item | Status | Notes |
|---|---|---|
| 33 roles + matrix | E | `add-33-roles.sql`, `implement-full-permissions-matrix.sql` |
| `/api/permissions/*` | E | Also duplicated handlers later in `server.js` (**D**) |
| Tenant RBAC tables `rbac_*` | E / D | Parallel to central `roles`/`permissions` |
| MFA / session revoke / password policy | M / I | Not found as enterprise settings |
| Server-side tenant isolation tests | E (partial) | Multiple `test-tenant-*.js`, `test-*-permissions*.js` |
| Privilege escalation / SoD | I | Needs explicit sensitive-action gates |

**S — Security:** UI-only hiding is already insufficient for tenants; continue enforcing on API. Dual RBAC schemas increase misconfig risk.

### 3.5 HR Settings 360

| Item | Status | Notes |
|---|---|---|
| Catalog hub 13 groups / 91 tiles | E | `hr-system-settings-catalog.js` |
| CRUD API + UI | E | `/api/hr/system-settings`, `finance/hr-system-settings*.html` |
| Table `hr_system_setting_records` | I | Created at runtime — **no SQL migration** (**S**/ops risk) |
| Domain engines (payroll rules, attendance clocks, leave accrual) | I | Mostly generic JSONB records, not enforced engines |
| HR independent of Finance | E (mostly) | Separate modules; keep independence |

### 3.6 Finance Settings 360

| Item | Status | Notes |
|---|---|---|
| Unified finance settings hub | M | Modules linked from `finance/index.html` separately |
| Tax settings | E | `tax_settings` + `/api/tax-settings` + `manage-tax-settings.html` |
| Chart of accounts | E | `finance_accounts` + API/UI (also tenant `chart_of_accounts` — **D**) |
| Payment / installment plans | E | `finance_payment_plans*` |
| Fiscal years / closed periods | M master | Fields used on journals/budgets; no settings period manager |
| Locked period enforcement | I | Needs hard server rules |
| Direct balance edits | S | Policy: forbid; use posted corrective docs |

### 3.7 Workflows

| Item | Status | Notes |
|---|---|---|
| Approval SQL (`approval_workflows`, steps) | E | `add-approval-system.sql` |
| HR request workflow runtime | E | `hr-request-workflow.js` |
| Finance approval HTTP APIs | M | Documented/tested in places but not mounted consistently |
| Workflow designer UI | I | `finance/hr-workflow-engine.html` in-memory mock |

### 3.8 Templates / Notifications / Backup / Integrations / AI

| Domain | Status | Notes |
|---|---|---|
| Template Studio | I | Catalog + SPA shells; no versioning/preview/publish pipeline |
| Notifications | I | `notifications` table + read APIs; no unified delivery confirmation |
| Backup Center | M (product) / E (ops scripts) | Must not expose unsafe restore on prod without gates |
| Integration Hub / API keys / webhooks | M / I | Payment webhooks exist; general hub missing |
| AI settings | I | Platform/tenant AI settings keys exist; no verified production AI control plane |

---

## 4. Database reuse map (do not recreate blindly)

**Reuse / extend:**

- Central: `tenants`, `subscriptions`, `tenant_admins`, `platform_*_settings`, `homepage_settings`
- Tenant: `tenant_settings`, `branding_settings`, `tenant_payment_settings`, `tenant_email_settings`, `tenant_branches`, `tenant_departments`, `rbac_*`
- IAM: `roles`, `permissions`, `role_permissions`, `user_roles`, `permission_levels`, `systems`, `system_permissions`, `role_system_permissions`
- HR: `hr_system_setting_records` (add proper migration)
- Finance: `tax_settings`, `finance_accounts`, `finance_payment_plans`, `approval_workflows`

**Add only when needed (Phase 1+):**

- `setting_definitions` / `setting_values` / `setting_versions` (Settings Engine) — if not mappable 1:1 onto existing JSON settings
- `plan_entitlements`, `tenant_modules` (if not fully covered by page-access + products modules)
- `feature_flags`, `backup_records` (ops productization)

Optimistic locking + audit_events for sensitive setting writes are recommended in Phase 1.

---

## 5. Recommended phased execution (aligned to prompt, adapted to repo)

| Phase | Scope | Depends on | Exit criteria |
|---|---|---|---|
| **0** | This audit | — | Report accepted |
| **1 Foundation** | Real Enterprise Settings shell replacing mock hub; Settings Engine skeleton; route serving fix; link existing live modules | 0 | Hub opens real pages; no toast-only for linked tiles; regression green |
| **2 Platform Admin** | Tenant lifecycle UX polish; editable plans/entitlements; module toggles; ops health lite | 1 | Plan limits enforced server-side |
| **3 Company Admin** | Identity/org structure/users entry from hub; wire Super Admin permissions tile | 1 | Company settings save/load/apply |
| **4 HR Settings** | Migrate `hr_system_setting_records`; deepen high-value engines (attendance/leave/payroll policies) | 1 | Policies affect HR runtime paths with tests |
| **5 Finance Settings** | Unified finance settings nav; fiscal periods; closed-period locks | 1 | Finance settings apply; no cross-tenant leak |
| **6 Shared** | Template studio MVP; workflow API wiring; notifications reliability | 1–5 | Preview/publish; approval API works |
| **7 Advanced** | Feature flags; AI gates; analytics | 6 | No fake AI claims |
| **8 Hardening** | Security, isolation tests, backup restore drill, docs, release gate | all | Acceptance checklist met |

---

## 6. Security & migration impact (Phase 0)

| Topic | Finding | Action |
|---|---|---|
| Tenant isolation | Present for tenant-settings & platform gates | Keep server enforcement; expand automated isolation tests per new API |
| Secrets | Payment/SMTP encryption helpers exist | Never render secrets in UI/logs |
| Mock hub | False sense of “settings complete” | Replace before commercial claims |
| Schema duplication | Central roles vs `rbac_*`; dual COA | Document source-of-truth per context; avoid third copy |
| HR settings table | No migration file | Add migration + rollback before Phase 4 depth |
| Production | Railway live | **No direct prod DDL/data edits** without staging + approval |
| Rollback | Express monolith | Feature flags / route toggles preferred over big-bang cutover |

---

## 7. What will NOT be done without approval

- Dropping tables/APIs
- Destructive data migrations
- Production deploy
- Replacing Super Admin or homepage `/settings` branding editor
- Inventing unsupported modules just to fill menus
- Claiming AI/backup/email delivery complete without tests

---

## 8. Phase 0 deliverables checklist

| Deliverable | Status |
|---|---|
| Repo/structure inspection | Done |
| Settings hub vs real APIs mapping | Done |
| HR/Finance/IAM/Workflow/Templates audit | Done |
| Existing / Missing / Incomplete / Duplicate / Reusable / Security / Migration matrix | Done |
| Phased plan mapped to current codebase | Done |
| Implementation code | **Not started** (awaiting Phase 1 approval) |

---

## 9. Decision request (human)

Please approve **Phase 1 — Foundation** scope:

1. Replace mock `/settings/admin` hub with real Enterprise Settings Center that deep-links to existing live modules (HR settings, Super Admin permissions, tax, branding, payment, COA, etc.).
2. Fix SPA hard-refresh serving for settings routes.
3. Introduce Settings Engine skeleton (definitions/values/versions) **only where existing tables are insufficient**.
4. Add automated smoke + tenant-isolation regression for the new hub.
5. No production deploy from this phase without explicit OK.

Reply with: **Approve Phase 1** (optionally with scope edits), or prioritize a different phase.
