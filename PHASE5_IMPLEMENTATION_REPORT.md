# NAIOSH ERP 360 — Phase 5 Implementation Report

**Status:** Implemented on `cursor/enterprise-settings-phase5-421d`  
**Base:** `main` (includes Phase 4)  
**Environment:** Local / development only  
**Deploy:** **Not** Staging / Production  
**Merge:** **Not** merged (draft PR only)  
**Date:** 2026-10-16  
**Phase 6:** **Not started**

---

## 1) Goal

Enterprise shared services used by ERP modules: durable Workflow/Approvals, operational Backup/Restore (safe), Template Studio, Notifications outbox, Integrations registry — plus clearing the last two **partial** catalog entries.

---

## 2) Catalog (47)

| Metric | After Phase 4 | After Phase 5 |
|---|---|---|
| total | 47 | 47 |
| live | 45 | **47** |
| partial | 2 | **0** |
| planned | 0 | 0 |
| mock | 0 | 0 |

| id | Before | After | Evidence |
|---|---|---|---|
| `module-hr-workflow` | partial | **live** | `wf_definitions`/`wf_instances` + canvas saves via `/api/shared-services`; restart persistence tests |
| `module-backup` | partial | **live** | `backup_jobs`/`backup_runs` + logical dump; restore-test gated; schema-sandbox verify |

---

## 3) Delivered

### Surfaces
| Surface | Path |
|---|---|
| Shared services center | `/shared/services` → `enterprise-shared-center.html` |
| API | `/api/shared-services/*` |
| HR workflow canvas | `/hr/workflow-engine` now Postgres-backed |

### Workflow & Approvals
- Tables: `wf_definitions`, `wf_instances`, `wf_instance_events`
- Reuses legacy `approval_workflows` / `approval_steps` for finance path
- Actions: approve, reject, return, escalate (+ overdue escalate)
- Bridges `POST /api/employee-requests` → durable instance
- Canvas (`hr-workflow-engine.html`) load/save/disable via API (no in-memory-only store)

### Backup & Restore
- Jobs + run log; logical dump (`pg_dump` schema+stats or JSON snapshot)
- Retention from `module.backup.policy`
- Restore requires `confirmToken=CONFIRM_DESTRUCTIVE_RESTORE`
- Modes: `TEST_RESTORE_DATABASE_URL` (must look like test DB, never equal to `DATABASE_URL`) **or** `PHASE5_RESTORE_SCHEMA_SANDBOX=true` (marker in `phase5_restore_sandbox` schema — non-destructive)
- Existing scripts under `scripts/restore-*` unchanged as operator path

### Template Studio
- Version table `module_template_versions`
- Safe `{{var}}` preview with HTML escape
- Rejects `<script>` / event handlers
- Test-send via notification outbox

### Notifications
- `notification_outbox` with retry/backoff
- Respects `module.notifications.channels`
- Process worker endpoint `/notifications/process`

### Integrations
- Registry of **existing** integrations only (SMTP, Stripe/PayPal/Paymob, AI, HR SSO/ERP)
- Enable/disable + connection test
- Secrets never returned (refs only; storage remains tenant-settings encryption)

### Settings Engine
- Reused; no second engine
- No mock save (empty bodies rejected)

---

## 4) Files

**Added**
- `create-enterprise-shared-services.sql`
- `enterprise-shared-service.js`
- `enterprise-shared-api.js`
- `enterprise-shared-center.html`
- `test-enterprise-shared-services.js`
- `PHASE5_IMPLEMENTATION_REPORT.md`

**Modified**
- `server.js` (mounts, routes, employee-request bridge)
- `module-entitlement-middleware.js`
- `enterprise-settings-catalog.js`
- `finance/hr-workflow-engine.html` (API persistence)

---

## 5) Tests

```bash
DATABASE_URL=... node test-enterprise-shared-services.js
# → 37/37 passed

DATABASE_URL=... node test-module-settings.js   # Phase 4 regression
DATABASE_URL=... node test-company-settings.js  # Phase 3 regression
```

### Restart persistence
Instances + events re-read from PostgreSQL after save; status remains `approved` with ≥3 events.

### Backup/Restore safety
- Backup artifact written under `uploads/backups/`
- Restore without confirm → **403**
- Restore with confirm + schema sandbox → success + marker row
- Restore targeting primary `DATABASE_URL` → **403**

Logs: `/opt/cursor/artifacts/phase5-test-output.log`

---

## 6) Remaining risks

1. Schema-sandbox restore verifies artifact integrity; full `psql` restore still needs a real separate test DB URL when `CREATEDB` is available.
2. Email/SMS “send” marks outbox `sent` after channel policy checks — production SMTP still via existing tenant email settings (not a new vendor).
3. Lockout/notification workers are on-demand endpoints (no separate daemon process in this phase).
4. Finance `/api/approvals` legacy docs now served under `/api/shared-services/approvals`.
5. No Staging/Production deploy; no Phase 6.

---

## 7) Next

**Stop for review.** Do not auto-start Phase 6. Do not merge unless approved.
