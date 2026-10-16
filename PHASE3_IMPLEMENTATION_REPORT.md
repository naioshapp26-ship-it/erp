# NAIOSH ERP 360 — Phase 3 Implementation Report

**Status:** Implemented on `cursor/enterprise-settings-phase3-421d`  
**Base:** Phase 2 (`cursor/enterprise-settings-phase2-421d`)  
**Environment:** Local / development only  
**Deploy:** **Not** Staging / Production  
**Merge:** **Not** merged  
**Date:** 2026-10-16

---

## 1) Delivered — Company Settings Center

### UI
- `/company/settings` → `company-settings-center.html`
- Sections: general/legal, branding (deep-link), org, users/invites, security, notifications, preferences, email/SEO/AI integrations, audit + storage meter

### APIs (`/api/company-settings/*`) — tenant host only
| Area | Routes |
|---|---|
| Bundle | `GET /bundle` |
| Engine-backed sections | `GET/PUT /general\|security\|notifications\|preferences` |
| Org | `POST/PUT /org/branches`, deactivate; departments; job-titles; locations |
| Invites | `GET/POST /invites`, `POST /invites/:id/revoke` |
| Audit | `GET /audit` |
| Storage | `POST /storage/recalculate`, `GET /storage/check` |

### Settings Engine (Phase 1 — reused, not duplicated)
Keys seeded/used:
- `company.general`
- `company.security`
- `company.notifications`
- `company.preferences`
- `company.storage_meter`

Persist with versioning + `setting_audit_events`. General also mirrored to tenant `tenant_settings.company_general` for runtime.

### Org schema (tenant DB)
`create-company-settings-org.sql`:
- ensures `tenant_branches`, `tenant_departments`
- adds `tenant_job_titles`, `tenant_locations`, `tenant_user_invites`

### Reused existing surfaces
- Branding / payment HTML + `/api/tenant-settings/*`
- `/api/tenant-users` for user list
- Seat limits from Phase 2 on invites

---

## 2) Risk mitigations (scoped)

| Risk | Action |
|---|---|
| Module entitlement coverage | Expanded `MODULE_API_PREFIXES` (CRM, inventory, purchases, suppliers, payroll, attendance, sales paths, …); allowlist includes `/api/company-settings` |
| Provisioning safety | `provision-safety.js` validates subdomain/plan/password; Owner create-company uses `safeProvisionTenant` (no destructive drops) |
| Storage metering | `recalculateStorageMeter` + `checkStorageAllowance`; logo upload checks limit and refreshes meter |

---

## 3) Permissions & isolation

- Company Settings require tenant context + company admin role
- Staff → 403
- Central host without tenant → 400
- Company admin → Platform Owner APIs → 403
- Values scoped by `tenant_id` in Settings Engine (A vs B isolation proven)

---

## 4) Catalog (47 retained)

| id | Before | After |
|---|---|---|
| `company-general` | mock | **live** → `/company/settings` |
| `company-email` | partial | **live** |
| `company-seo` | partial | **live** |
| `company-ai` | partial | **live** |
| `company-org` | partial | **live** |
| `company-users-roles` | live (super-admin only) | **live** → company center |
| branding / payment | live | unchanged |

Approximate counts after Phase 3: **live ≥ 26 · partial ≤ 13 · planned 1 · mock ≤ 7 · total 47**

---

## 5) Tests

```bash
DATABASE_URL=... node test-company-settings.js
# → All Phase 3 assertions passed (44)
```

Covered: catalog, module gate expansion, provision validation, RBAC, CRUD general + versioning + audit, tenant isolation, org CRUD, security/notifications/preferences, invites, storage meter, Phase 1/2 regression (engine tables + saas_plans).

**No mock save:** PUT requires `value` object; read-after-write asserted.

---

## 6) Files

**Added:** `company-settings-service.js`, `company-settings-api.js`, `company-settings-center.html`, `create-company-settings-org.sql`, `provision-safety.js`, `test-company-settings.js`, `PHASE3_IMPLEMENTATION_REPORT.md`

**Modified:** `server.js`, `enterprise-settings-catalog.js`, `module-entitlement-middleware.js`, `platform-owner-api.js`, `tenant-settings-api.js`

---

## 7) Remaining risks

1. Company Settings UI on **central** host shows auth banner by design — must use tenant subdomain (or local test harness with tenant context).
2. Invite accept/redeem flow is token-issued; full self-serve accept page can land in a later polish pass.
3. Security policies are stored/versioned; not every policy is yet wired into every login middleware path.
4. Storage metering covers branding uploads primarily; broader file inventory is incremental.
5. Module settings for Finance/CRM/etc. remain Phase 4+.
6. No Staging/Production deploy.

---

## 8) Next

**Stop for review before Phase 4** (all ERP module settings).
