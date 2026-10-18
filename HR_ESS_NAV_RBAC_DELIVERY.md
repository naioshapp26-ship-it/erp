# NAIOSH ERP 360 — HR ESS / Manager Portal / RBAC Delivery

**Branch:** `cursor/hr-ess-nav-rbac-audit-421d`  
**Scope:** Draft only — no merge, no staging, no production.

## 1) Inventory summary

| Metric | Count |
|--------|------:|
| HR functions inventoried (ESS + admin ops + KEEP + shortcuts) | 30 |
| HR KEEP modules (unchanged IA) | 9 |
| Admin ops cards newly surfaced on GM home | 5 (settings only for HR/company/platform admins) |
| Operational shortcuts newly surfaced on GM home | 11 |
| Functions previously reachable mainly via HCM sidebar / GAI | ~16 admin/ops |
| Linked/fixed on manager home (admin + shortcuts + KEEP) | 24 cards for manager |
| Employee self-service cards | 5 |

Full inventory builder: `hr-portal-access.js` → `buildInventoryRows()`.

## 2) Employee self-service (available)

1. طلب إجازة → `/hr/leaves`
2. طلب سلفة → `/hr/advances`
3. خطابات وتعريف راتب → `/hr/my-requests?type=salary-certificate`
4. الحضور والرواتب الشخصية → `/hr/attendance-departure`
5. طلباتي ومتابعتها → `/hr/my-requests`

Admin HCM sidebar is hidden for `EMPLOYEE` / `staff` personas (`hr-ess-mode`).

## 3) Admin functions blocked from employee

UI: employees, pending-actions, manager dashboard, system-settings, payroll admin, recruitment, etc.  
API (403): `/api/hr/pending-actions`, `/api/hr/manager-dashboard`, `/api/employees`, `/api/employee-requests/:id/decide`; own-only scoping on `/api/employee-requests` and `/api/leave-requests`.

## 4) Leave E2E result

**PASS** — employee submits leave → appears in طلباتي → manager pending → approve manager→hr → employee sees `APPROVED`.  
Evidence: `test-hr-ess-nav-rbac.js`, GUI leave submit screenshot.

## 5) GUI tests

| Check | Result |
|-------|--------|
| Employee persona + ESS nav (no admin items) | PASS |
| Employee leave modal + list | PASS |
| Manager admin section cards | PASS |
| Manager KEEP + shortcuts | PASS |
| Desktop/Mobile screenshots | PASS |

Artifacts under `/opt/cursor/artifacts/screenshots/hr-ess-*` and `hr-manager-*`.

## 6) Files changed

- `hr-portal-access.js` (new)
- `server.js` (portal APIs, authUser, RBAC scopes)
- `finance/hr-home.html`
- `finance/hr-portal-shell.js`
- `finance/hr-my-requests.html`
- `test-hr-modules-audit.js`
- `test-hr-ess-nav-rbac.js` (new)
- `test-hr-ess-gui.js` (new)
- `scripts/seed-hr-ess-test-users.js` (new)
- `HR_ESS_NAV_RBAC_DELIVERY.md` (this file)

## 7) Remaining risks

- Anonymous HQ (no session) still defaults to manager portal (legacy behavior).
- `/hr/pending-actions` remains GAI nav context (KEEP/MOVE) while also linked from GM admin cards.
- Personal payroll slips UI is still the generic `hr-section` catalog for `/hr/salary-slips` — not promoted as a fake ESS button; attendance uses the live logs page.
- Role strings are heuristic (`classifyPersona`); custom Arabic titles may need mapping if introduced.
