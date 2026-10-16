# NAIOSH ERP 360 — Phase 1 Report
## Foundation & Complete Module Inventory (Revised Scope)

**Status:** Implemented (local/dev) — **Not deployed to Production**  
**Branch:** `cursor/enterprise-settings-phase1-421d`  
**Date:** 2026-10-16

---

## 1. What Phase 1 delivered

1. **Full ERP settings inventory catalog** (`enterprise-settings-catalog.js`) covering Platform / Company / Module levels.
2. **Enterprise Settings Engine foundation**:
   - SQL: `create-enterprise-settings-engine.sql`
   - API: `/api/enterprise-settings/*` (`enterprise-settings-engine-api.js`)
   - Definitions / values / versions / audit
   - Tenant host cannot see Platform entries
3. **Replaced mock Settings Hub** in `script.js`:
   - No fake success toasts for catalog actions
   - Live/partial cards open real URLs
   - Mock/planned cards disabled with honest messaging
   - Permissions tile now opens `/super-admin-page.html`
4. **Fixed SPA hard-refresh** for `/settings/admin` and legacy `/settings/*` detail routes without breaking exact `/settings` homepage identity page.
5. **Smoke tests:** `test-enterprise-settings-engine.js`

---

## 2. Module inventory summary

| Level | Focus | Live | Partial | Planned | Mock (was fake UI) |
|---|---|---:|---:|---:|---:|
| Platform | Tenants, Super Admin, homepage identity, platform payment, SaaS catalog, plans, ops | 4 | 1 | 2 | 0 |
| Company | Branding, payment, email/SEO/AI APIs, org, users/roles, general | 3 | 4 | 0 | 1 |
| Module | HR, Finance, Sales/CRM, Supply, Tasks, Facilities, Approvals, Templates, Notifications, Backup, Audit | many | many | some | several |

Exact counts come from `GET /api/enterprise-settings/catalog` → `data.counts`.

### Per-domain snapshot

| Module / Domain | Existing settings | Missing / incomplete | Formal/mock | Linked in Phase 1 | Later phase |
|---|---|---|---|---|---|
| Platform Super Admin | Live RBAC + tenant admin pages | Editable plans UI, ops health | — | Yes | Phase 2 |
| Multi-tenant | `/api/tenants`, branding/payment | Archive/export/delete policies | — | Yes | Phase 2 |
| Subscriptions/plans | DB + hardcoded plans | Editable entitlements enforcement UI | Static `subscription.html` | Catalog only | Phase 2 |
| Users/Roles/Permissions | Super Admin + 33-role matrix | MFA/session revoke settings | Old hub toast | Linked to Super Admin | Phase 3 |
| HR | 91-tile hub + API | Deep engines for leave/payroll rules | Workflow designer mock | `/hr/system-settings` | Phase 4 |
| Finance | Tax, COA, plans, journals… | Fiscal period master, unified finance settings shell | — | Linked key pages | Phase 4 |
| Sales/CRM/POS | SPA modules + customers | Dedicated settings surfaces | — | Linked SPA/finance customers | Phase 4 |
| Purchases/Inventory/Suppliers | SPA modules | Dedicated settings | — | Linked SPA | Phase 4 |
| Tasks/Projects | Tasks SPA | Task settings save | Task settings mock | Partial | Phase 4 |
| Facilities/Assets/Custodies | Facilities SPA + fixed assets + HR custodies | Deeper facilities settings | — | Linked | Phase 4 |
| Documents/Contracts | Contracts page | Contract policy settings center | Letter template mocks | Contracts live; templates marked mock | Phase 5 |
| Workflows/Approvals | SQL + HR request workflow + governance page | Finance approval HTTP APIs; designer persist | Workflow engine HTML mock | Governance linked | Phase 5 |
| Templates/Numbering | HR catalog seeds | Bodies/preview/publish | SPA template tiles mock | Marked mock; no fake actions | Phase 5 |
| Notifications | notifications table + HR center | Delivery confirmation pipeline | — | Partial link | Phase 5 |
| Integrations/API | Payment webhooks etc. | Integration Hub product | — | Not claimed live | Phase 5 |
| Security/Sessions | RBAC/audit | MFA, session revoke center | — | Audit partial | Phase 3/6 |
| Backup/Restore | Ops scripts | In-app controlled restore | Backup tile mock | Honest disabled | Phase 5/6 |
| AI | tenant/platform AI settings APIs | Verified AI control UX | — | Partial API noted | Phase 5/7 |
| Branding/Languages/Currencies | Branding live; general mock | Locale/currency company settings | General tile mock | Branding live | Phase 3 |
| Org structure | Tables exist | Settings CRUD UI | Branches tile was mock | Marked partial | Phase 3 |
| Ops/monitoring | Fragments | Feature flags / health board | — | Planned | Phase 2 |

---

## 3. Files changed / added

| File | Change |
|---|---|
| `enterprise-settings-catalog.js` | **Added** — inventory + hub map |
| `enterprise-settings-engine-api.js` | **Added** — Settings Engine API |
| `create-enterprise-settings-engine.sql` | **Added** — non-destructive schema |
| `test-enterprise-settings-engine.js` | **Added** — smoke tests |
| `ENTERPRISE_SETTINGS_PHASE1_REPORT.md` | **Added** — this report |
| `ENTERPRISE_SETTINGS_PHASE0_AUDIT.md` | Present from Phase 0 |
| `server.js` | Mount API; SPA routes for `/settings/admin*`; scoped API allowlist |
| `script.js` | Replace mock hub with real Enterprise Settings Center UI |

---

## 4. API surface (Phase 1)

| Method | Path | Auth |
|---|---|---|
| GET | `/api/enterprise-settings/catalog` | Platform admin or tenant admin |
| GET | `/api/enterprise-settings/definitions` | same |
| POST | `/api/enterprise-settings/definitions/seed` | Platform admin on central host only |
| GET | `/api/enterprise-settings/values` | scoped |
| GET/PUT | `/api/enterprise-settings/values/:key` | scoped + versioning |
| GET | `/api/enterprise-settings/values/:key/versions` | scoped |
| GET | `/api/enterprise-settings/audit` | scoped |

---

## 5. Tests

| Test | Result |
|---|---|
| `node test-enterprise-settings-engine.js` (catalog integrity, permissions mapping, tenant filter) | Run in CI/dev |
| DB schema ensure | Runs when `DATABASE_URL` available; skipped otherwise |
| Production deploy | **Not performed** |

---

## 6. Risks remaining

1. Settings Engine tables must be applied on the target DB (auto-ensure on first API call; still recommend migration review before prod).
2. Many module settings remain **partial/planned/mock** — Phase 1 intentionally does not fake completion.
3. Dual RBAC schemas (`roles` vs `rbac_*`) still need unification later.
4. `hr_system_setting_records` still lacks a dedicated SQL migration file (Phase 4).
5. Hub requires authenticated admin session to load catalog.

---

## 7. Explicit non-goals completed / respected

- No Production deploy
- No destructive drops
- No duplicate RBAC system
- No fake toast success for unimplemented tiles
- Did **not** auto-start Phase 2

---

## 8. Approval gate

Await confirmation to begin **Phase 2 — Platform Administration** (editable plans/entitlements, module toggles, ops health lite) without expanding into Phase 4 module depth yet.
