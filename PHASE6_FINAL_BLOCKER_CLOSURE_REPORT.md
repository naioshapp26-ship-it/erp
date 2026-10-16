# NAIOSH ERP 360 — Phase 6 Final Blocker Closure Report

**Branch:** `cursor/enterprise-settings-phase6-421d`  
**Date:** 2026-10-16  
**Scope:** Local development only (no merge, no Staging/Production deploy)

---

## Recommendation (updated)

| Gate | Decision |
|---|---|
| Local Phase 6 harness | **66/66 PASS — GO (local checks)** |
| Local blocker closure (404 + fresh migrate + authenticated GUI E2E) | **CLOSED / PASS** |
| Request Staging validation (separate explicit approval) | **READY TO REQUEST** |
| Production / commercial sale | **NO-GO until Staging soak + explicit Production approval** |

Previous **CONDITIONAL_GO** was rejected as a commercial-release signal. After closing the two blocked gates and the Module Settings 404/path bug, the local harness is fully green. That is **not** Production approval — **Production remains NO-GO** until Staging is explicitly approved and soaked.

---

## 1) HTTP 404 on `/modules/settings` — root cause

### What the screenshot showed
`HTTP 404 — استخدم نطاق المستأجر مع صلاحية مسؤول.`

### Root causes (two layers)

1. **Misleading artifact path (prior Phase 6 screenshots)**  
   Headless screenshots were taken via `python3 -m http.server` serving static HTML. The page’s `fetch('/api/module-settings/bundle')` hit the static server → raw **HTTP 404** with empty JSON body → UI fell back to `"HTTP " + status`.

2. **Real product bug in path-mode tenancy (fixed)**  
   When the center is opened as `/t/{subdomain}/modules/settings` (supported local/Railway mode without wildcard DNS):
   - Server correctly resolves tenant and serves the HTML.
   - Frontend called **absolute** `/api/module-settings/...` **without** the `/t/{subdomain}` prefix.
   - Tenant context was lost → 400 (or opaque status if `error` field used instead of `message`).
   - Central host `/modules/settings` also showed a generic appended hint instead of a first-class guidance banner.

Tenant isolation and Company Admin RBAC were **not** relaxed to hide the error.

### Fix applied
| File | Change |
|---|---|
| `tenant-path-client.js` | Auto-scope `/api/*` fetches in path mode; allow `/api` nav scoping; expose `scopeApiUrl` |
| `module-settings-center.html` | Load tenant-path client; scope API URLs; clear central-host banner; better 400/401/403/404 messages (`message` \|\| `error`) |
| `company-settings-center.html` | Same scoping + error explanation |
| `enterprise-shared-center.html` | Same scoping + error explanation |
| `server.js` | Bump tenant-path-client cache version |

### Re-test evidence
| Check | Result |
|---|---|
| Central `/api/module-settings/bundle` | **400** with Arabic tenant-host message |
| Path `/t/p3co-a/api/module-settings/bundle` unauth | **401** |
| Path + Company Admin token | **200**, tenant `p3co-a` |
| GUI central `/modules/settings` | Clear banner (no HTTP 404) |
| GUI `/t/p3co-a/modules/settings` + auth | Loads 14 module tabs, RTL |
| Save leave setting + reload | `annual_leave_days=22` persisted |

Screenshots: `p6-gui-modules-central-clear.png`, `p6-gui-modules-tenant-loaded.png`.

---

## 2) Previously BLOCKED tests — now closed

### A. Fresh Database Migration
| Item | Detail |
|---|---|
| Method | Isolated PostgreSQL 16 cluster via `initdb` at `/tmp/phase6-pg` port **55432** (not Production; not primary app DB) |
| Order | `create-enterprise-settings-engine.sql` → `create-company-settings-org.sql` → `create-module-settings-ops.sql` → `create-enterprise-shared-services.sql` |
| Second pass | Idempotent (`IF NOT EXISTS`) — PASS |
| Tables | 26 public relations including settings/wf/backup/outbox/integrations |
| Evidence | `/opt/cursor/artifacts/phase6-fresh-migrate.log` ends with `FRESH_MIGRATE_OK` |
| Status | **PASS** |

### B. Authenticated GUI E2E
| Center | Status |
|---|---|
| `/modules/settings` (tenant path) | PASS — load, save, reload |
| `/company/settings` | PASS |
| `/shared/services` | PASS |
| `/platform/owner` | PASS (owner token, central) |
| `/settings/admin` | PASS (route responds &lt;500) |
| Mobile 390×844 + RTL | PASS |
| Staff denied module settings | PASS (403) |
| Summary | **14 PASS / 0 FAIL / 0 BLOCKED** |
| Runner | `test-phase6-gui-e2e.js` (puppeteer-core + system Chrome) |
| Evidence | `/opt/cursor/artifacts/phase6-gui-e2e-results.json` + `p6-gui-*.png` |

---

## 3) Security re-verification

| Check | Result |
|---|---|
| Staff → module settings | **403** |
| Staff → company settings | **403** |
| Staff → shared services | **403** |
| Tenant A vs B context on path hosts | **Different tenant ids** (`p3co-a` ≠ `p3co-b`) |
| HQ-only bypass removed (Phase 6 earlier) | Still enforced |
| Diagnostics password redaction | PASS (`***`) |
| Restore without confirm / primary URL | Still gated (Phase 5/6 harness) |

No Critical/High findings open after this closure pass.

---

## 4) PR chain review (Phase 0–6)

| PR | Title | State | Base |
|---|---|---|---|
| #150 | Phase 0 Discovery | MERGED | main |
| #151 | Phase 1 Settings Engine | MERGED | main |
| #152 | Phase 2 Platform Owner | OPEN | phase1 branch |
| #153 | Phases 0–3 bundle | MERGED | main |
| #154 | Phase 4 Module Settings | MERGED | main |
| #155 | Phase 5 Shared Services | MERGED | main |
| #156 | Phase 6 readiness | OPEN draft | main (**MERGEABLE**) |

Notes:
- Phase 2 content is already on `main` via later merges (#153+); #152 is a leftover open PR and should not be merged out-of-order.
- Migration order on fresh DB matches Phase 1→5 SQL files; no duplicate table loss on idempotent re-apply.
- Final Phase 6 branch targets `main` and is mergeable; **merge not requested / not performed**.

---

## 5) Remaining risks (not Critical/High)

| Severity | Item |
|---|---|
| Medium | CSRF hardening for cookie POSTs before Staging |
| Medium | Demo seed scripts remain in repo (local only) |
| Low | Process-local login lockout (not multi-instance durable) |
| Low | Notification “sent” = outbox success; SMTP still tenant-configured |

---

## 6) Deploy gates (unchanged approval boundary)

Approved now: local fixes + local tests only.  
**Not approved:** merge to main, Staging deploy, Production deploy, customer data, destructive restore.

### Ask for next approval
Please approve separately if you want:
1. Merge PR #156 into `main`, and/or  
2. Staging deploy + Staging soak plan from `PHASE6_COMMERCIAL_READINESS_REPORT.md` §10.

---

## 7) Files added/changed in this closure

**Added:** `test-phase6-gui-e2e.js`, `PHASE6_FINAL_BLOCKER_CLOSURE_REPORT.md`  
**Modified:** `tenant-path-client.js`, `module-settings-center.html`, `company-settings-center.html`, `enterprise-shared-center.html`, `server.js`, `test-phase6-commercial-readiness.js`
