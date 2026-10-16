# NAIOSH ERP 360 — Phase 6 Commercial Readiness Report

**Branch:** `cursor/enterprise-settings-phase6-421d`  
**Base:** `main` (Phases 1–5 merged)  
**Date:** 2026-10-16  
**Environment:** Local development only  
**Deploy:** **Not** Staging / Production  
**Merge:** **Not** merged (draft PR only)

---

## Recommendation: **CONDITIONAL_GO**

**Reasons**
- No open **Critical** or **High** failures after Phase 6 remediations.
- Settings Engine + Company + Module + Shared Services APIs passed operational, isolation, security, and performance checks with measured latencies.
- Catalog declared **47/47 live**; core settings surfaces proven with save/read-after-write and behavior change tests.
- Remaining gaps are **BLOCKED** (not failed): fresh empty-DB ordered migrate (no `CREATEDB` privilege) and **authenticated** GUI E2E across tenant hosts.

**Not a full commercial GO** until Staging soak + authenticated multi-tenant GUI E2E + CREATEDB migration dry-run are completed under a separate explicit approval.

---

## 1) Executive scores

| Suite | Result |
|---|---|
| Phase 6 harness | **64 PASS / 0 FAIL / 2 BLOCKED** |
| Phase 3 regression | **44/44 PASS** |
| Phase 4 regression | **46/46 PASS** (after catalog version assert update) |
| Phase 5 regression | **37/37 PASS** (after catalog version assert update) |
| Verdict | **CONDITIONAL_GO** |

Artifacts:
- `/opt/cursor/artifacts/phase6-harness.log`
- `/opt/cursor/artifacts/phase6-readiness-results.json`
- Screenshots (static page smoke, **not** authenticated E2E):  
  `p6-company-settings-center.png`, `p6-module-settings-center.png`, `p6-enterprise-shared-center.png`, `p6-platform-owner-console.png`

---

## 2) Catalog (47)

| Metric | Value |
|---|---|
| total | 47 |
| live | **47** |
| partial / planned / mock | **0 / 0 / 0** |
| version | `phase6-2026-10-16` |

Operational proofs executed (not “page opens only”):
- `module.hr.leave` save + behavior reject over-limit
- `company.security` save + session TTL resolution (4h)
- Backup run success
- Workflow definition create
- Tenant isolation A≠B on CRM stage
- Invite accept, notification outbox, tax computation from settings

Honesty note: not every one of the 47 nav entries has a dedicated automated click-path; Live classification for hubs is backed by Settings Engine keys / shared services / existing APIs verified in Phases 1–5 plus Phase 6 ops checks. Authenticated UI traversal of all 47 remains BLOCKED.

---

## 3) Security review

| Check | Status | Evidence |
|---|---|---|
| Staff blocked from company/module/shared settings | **PASS** | After RBAC tighten (removed `tenant_type===HQ` bypass) → 403 |
| Company settings require tenant host | PASS | 400 on central |
| Company admin ≠ Platform Owner APIs | PASS | 401/403 |
| Tenant isolation settings | PASS | alpha-only ≠ beta-only |
| Parametrized SQL (SQLi string storage) | PASS | users table intact |
| Template XSS `<script>` rejected | PASS | 400 |
| Template preview HTML escape | PASS | `&lt;img` without raw `<img` |
| Restore without confirm | PASS | 403 |
| Restore targeting `DATABASE_URL` | PASS | 403 |
| Rate-limit headers | PASS | present on shared-services |
| Module entitlement prefix map | PASS | ≥20 prefixes; critical APIs mapped |
| Seat allowance API | PASS | callable |
| Audit log readable | PASS | company audit |
| HR API secrets not returned raw | **PASS (fixed)** | GET/PUT mask `api_key`/`api_secret` as `[redacted]` |

### Fixes applied in Phase 6
1. **High — RBAC bypass:** `tenant_type === 'HQ'` previously granted settings admin to any HQ user including staff. Removed from `company-settings-api.js`, `module-settings-api.js`, `enterprise-shared-api.js`.
2. **High — secret leakage:** `/api/hr/api-integrations` returned plaintext `api_secret`. Now masked; PUT responses masked; empty secret no longer wipes existing secret (`COALESCE`).

### Remaining security backlog (Medium/Low — not blocking CONDITIONAL_GO)
| Severity | Item |
|---|---|
| Medium | Demo seed scripts (`demo123`) still in repo for local demos — not production endpoints |
| Medium | CSRF: cookie auth is non-HttpOnly in places; recommend SameSite + CSRF token for cookie POSTs before Staging |
| Low | Process-local login lockout map (not durable across multi-instance) |
| Low | Outbox email/sms “sent” = queue success; SMTP still via existing tenant settings |

---

## 4) End-to-end operational scenarios (API)

| # | Scenario | Status |
|---|---|---|
| 1–3 | Provision validation + plans list | PASS (reserved subdomain rejected; plans listable) |
| 4 | Users/roles via invites | PASS (create + accept) |
| 5 | Company settings change | PASS |
| 6–7 | Module settings → tax behavior | PASS (15% of 200 = 30) |
| 8 | Workflow approve | PASS + DB re-read persistence |
| 9 | Notify via template + outbox | PASS |
| 10 | Backup + isolated restore-test | PASS (schema sandbox; prod URL blocked) |
| 11 | Cross-tenant isolation | PASS |
| 12 | Persist after restart (DB re-read) | PASS |

Full browser multi-company GUI E2E: **BLOCKED** (see §6).

---

## 5) Database / migrations

| Check | Status | Notes |
|---|---|---|
| Phase SQL files present | PASS | engine, company org, module ops, shared services |
| Idempotent re-apply | PASS | **3ms** total on warm DB |
| Required tables | PASS | 13/13 including wf/backup/outbox |
| Indexes | PASS | wf/notif/fiscal/backup indexes present |
| Fresh empty DB ordered apply | **BLOCKED** | No `CREATEDB` privilege in this environment |
| Rollback strategy | PASS (documented) | Non-destructive `IF NOT EXISTS`; rollback via gated restore artifact |

---

## 6) Performance (measured)

| Metric | Actual | Target | Status |
|---|---|---|---|
| Company bundle | **14ms** | ≤500ms | PASS |
| Module bundle | **15ms** | ≤800ms | PASS |
| Shared bundle | **12ms** | ≤800ms | PASS |
| PUT setting | **4ms** | ≤400ms | PASS |
| 12 concurrent workflow starts | **54ms** | ≤3000ms | PASS |
| RSS after load | **~79MB** | <1024MB | PASS |
| Notification retry process | PASS | — | PASS |

---

## 7) UX / GUI

| Item | Status |
|---|---|
| Static HTML centers exist | PASS |
| Headless page screenshots | PASS (4 pages rendered) |
| Authenticated GUI E2E (login → save → verify) | **BLOCKED** |
| computerUse agent | Unavailable this run (spend limit); used headless Chrome screenshots instead |
| RTL Arabic titles visible in HTML | Confirmed in source + static load |

**Do not treat GUI as commercially verified for real customers until authenticated tenant-host E2E is run on Staging.**

---

## 8) Prior risks closed / open

| Risk | Status |
|---|---|
| Security policies → auth TTL | PASS |
| Invite redemption | PASS |
| Module gate coverage | PASS |
| Storage metering | PASS |
| Backup/restore gates | PASS |
| Demo credentials in APIs | PASS (scripts only) |
| DB password in diagnostics | PASS (redacted `***`) |
| HR API secret echo | **Fixed** |
| Staff HQ RBAC bypass | **Fixed** |

---

## 9) Issues by severity (post-fix)

| Severity | Count | Notes |
|---|---|---|
| Critical | **0** | — |
| High | **0** | Remediations verified |
| Medium | 2 | CSRF hardening; durable lockout |
| Low | 2 | Multi-instance lockout; SMTP send semantics |
| Blocked checks | 2 | Fresh DB migrate; authenticated GUI E2E |

---

## 10) Deploy readiness

| Gate | Status |
|---|---|
| Local API commercial-path readiness | **CONDITIONAL_GO** |
| Staging deploy | **Needs separate explicit approval** |
| Production | **NO** without Staging soak + GUI E2E + CREATEDB migrate dry-run |

### Staging plan (after approval)
1. Apply phase SQL in order on Staging empty + clone-with-anonymized data.
2. Run `test-phase6-commercial-readiness.js` + Phases 3–5 suites against Staging DB.
3. Authenticated GUI E2E on tenant subdomain: owner → company → modules → shared services.
4. Backup restore-test against dedicated Staging sandbox DB URL.
5. 24h soak: notification outbox, workflow volume, error budgets.

### Rollback plan
1. Stop release traffic.
2. Redeploy previous `main` artifact.
3. Restore Staging DB from pre-deploy backup using gated restore tooling (`CONFIRM_DESTRUCTIVE_RESTORE` + sandbox URL only).
4. Re-run Phase 6 harness smoke.

---

## 11) Files changed in Phase 6

**Added:** `test-phase6-commercial-readiness.js`, `PHASE6_COMMERCIAL_READINESS_REPORT.md`  
**Modified:** `server.js` (HR secrets mask), `company-settings-api.js` / `module-settings-api.js` / `enterprise-shared-api.js` (RBAC), `enterprise-settings-catalog.js` (phase6 version), Phase 4/5 test catalog asserts

---

## 12) Stop

Phase 6 validation complete for local development. **No merge. No Staging/Production deploy. No Phase 7 auto-start.**
