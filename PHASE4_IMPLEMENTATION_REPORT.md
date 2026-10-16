# NAIOSH ERP 360 — Phase 4 Implementation Report

**Status:** Implemented on `cursor/enterprise-settings-phase4-421d`  
**Base:** `main` (Phase 3 merged)  
**Draft PR:** https://github.com/naioshapp26-ship-it/erp/pull/154  
**Environment:** Local / development only  
**Deploy:** **Not** Staging / Production  
**Merge:** **Not** merged  
**Date:** 2026-10-16  
**Phase 5:** **Not started** (stopped for review)

---

## 1) Goal

Convert all existing ERP module settings from partial/mock into enterprise Settings Engine–backed, DB-persisted, behavior-wired policies — across **all** modules present in the product (not HR/Finance only).

---

## 2) Catalog — before vs after (47 retained)

| Metric | Before (Phase 4 start) | After |
|---|---|---|
| total | 47 | 47 |
| live | 26 | **45** |
| partial | 13 | **2** |
| planned | 1 | **0** |
| mock | 7 | **0** |

### Partial remaining (honest)
| id | Why still partial |
|---|---|
| `module-hr-workflow` | Policy key `module.workflows.approvals` is live; legacy HTML workflow canvas remains in-memory |
| `module-backup` | `module.backup.policy` stored/versioned; one-click production restore not added (scripts only) |

### Notable status lifts
| id | Before | After |
|---|---|---|
| `module-finance-fiscal` | planned | **live** |
| `module-hr-payroll` / attendance | partial | **live** |
| CRM / POS / inventory / purchases / suppliers | partial | **live** |
| tasks / task-settings / facilities | partial/mock | **live** |
| templates email/sms/print / numbering | mock | **live** |
| notifications / audit / approvals | partial | **live** |

---

## 3) Delivered surfaces

### UI
- `/modules/settings` → `module-settings-center.html`
- `/invite/accept` → `invite-accept.html` (self-serve invite redeem)

### API (`/api/module-settings/*`) — tenant host + company/module admin
| Area | Routes |
|---|---|
| Bundle / definitions | `GET /bundle`, `GET /definitions` |
| Values | `GET/PUT /values/:key` (no mock save — `value` object required + read-after-write) |
| Section shorthand | `PUT /section/:module/:name` |
| Fiscal | `GET/POST/PUT /fiscal/years`, generate-periods, `POST /fiscal/periods/:id/status`, `POST /fiscal/assert-posting` |
| Ops evaluators | `/ops/validate-leave`, `compute-tax`, `evaluate-stock`, `evaluate-pos`, `evaluate-task`, `evaluate-purchase`, `next-number` |
| Templates | `GET/POST/PUT /templates` |
| Audit | `GET /audit` |

### Settings Engine keys (`module.*`)
HR: leave, attendance, payroll, contracts, recruitment, performance, training, offboarding  
Finance: tax, fiscal, invoicing, treasury, cost_centers, approvals, assets  
Sales: crm, pos, customers  
Supply: inventory.stock, purchases.orders, suppliers.policies  
Ops: tasks.projects, facilities.assets, workflows.approvals, templates.numbering, notifications.channels, backup.policy, audit.retention  

HR 91-tile hub (`/hr/system-settings`) **reused** — not duplicated.

### Ops schema (tenant DB, non-destructive)
`create-module-settings-ops.sql`:
- `fiscal_years`, `fiscal_periods`
- `module_templates`, `module_numbering_counters`

---

## 4) Operational wiring (behavior ≠ HTTP 200)

| Setting | Behavior |
|---|---|
| `module.hr.leave` | Enforced on `POST /api/leave-requests` (max days, reason, allowed types, notice) |
| `module.finance.tax` | Invoice create returns computed tax from policy |
| `module.finance.fiscal` | Closed period blocks invoice posting unless `allow_posting_closed` |
| `module.sales.pos` | `/ops/evaluate-pos` gates zero/negative stock |
| `module.inventory.stock` | Low/negative stock evaluation |
| `module.tasks.projects` | Assignee required gate |
| `module.purchases.orders` | Approval threshold evaluator |
| `module.templates.numbering` | Real counters + formatted next number |
| `company.security` | Session TTL + failed-login lockout on tenant-auth; strong password on register/invite |

### Invite accept
- `POST /api/company-settings/invites/accept` (public on tenant host)
- `GET /api/company-settings/invites/preview`
- Seat limit checked; token single-use

### Entitlement gate
- Allowlist: `/api/module-settings`, `/modules/settings`, `/invite`
- Extra prefixes: leave-requests, leave-balances, tax-settings, invoices

### Storage
- Metering walks branding + tenant uploads / documents / hr-attachments buckets

---

## 5) Permissions & isolation

- Module settings require tenant context + admin-class role
- Staff → 403
- Values scoped by `tenant_id` (A vs B isolation proven in tests)
- Versioning + `setting_audit_events` with `phase: 4`

---

## 6) Tests

```bash
DATABASE_URL=... node test-module-settings.js
# → All Phase 4 assertions passed (46/46)
```

Covered: catalog honesty, entitlement map, RBAC, no-mock-save, leave/tax/stock/POS/fiscal behavior change, templates, numbering, tenant isolation, audit/versioning, invite accept, session TTL resolution, task/purchase evaluators, engine+ops tables regression.

Log: `/opt/cursor/artifacts/phase4-test-output.log`

---

## 7) Files

**Added**
- `module-settings-service.js`
- `module-settings-api.js`
- `module-settings-center.html`
- `create-module-settings-ops.sql`
- `invite-accept.html`
- `test-module-settings.js`
- `PHASE4_IMPLEMENTATION_REPORT.md`

**Modified**
- `server.js` (mounts, leave gate, invoice tax/fiscal, routes)
- `enterprise-settings-catalog.js`
- `module-entitlement-middleware.js`
- `company-settings-service.js` / `company-settings-api.js` (accept invite, storage breadth)
- `tenant-auth-api.js` / `auth-api.js` (TTL + lockout + strong password)

---

## 8) Incomplete / deferred (with reasons)

1. **HR workflow HTML canvas** — still in-memory UI; policy layer done; full canvas rewrite deferred.
2. **Backup one-click restore** — intentionally not added (destructive risk); policy only.
3. **SPA CRM/POS/inventory screens** — policy + evaluators live; every SPA control not rewritten (existing shells remain).
4. **Central-host module center** — requires tenant subdomain (same as Phase 3).
5. **Lockout tracker** — process-local Map (policy-driven); durable DB lockout table can harden later.
6. No Staging/Production deploy; no Phase 5.

---

## 9) Next

**Stop for review.** Do not auto-start Phase 5.
