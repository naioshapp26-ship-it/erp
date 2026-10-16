# NAIOSH ERP 360 — Phase 2 Plan (Platform Owner Console)

**Status:** PLAN ONLY — **Do not implement until Phase 1 verification is accepted**  
**Prerequisite:** `ENTERPRISE_SETTINGS_PHASE1_VERIFICATION.md` PASS (local)  
**Constraint:** No merge / Production deploy without explicit approval  
**Goal alignment:** Complete settings for **all existing ERP modules** over Phases 2–N; Phase 2 focuses on **Platform Owner** control plane (not HR-only, not a links hub).

---

## 1) Phase 2 objective

Deliver a production-grade **Platform Owner / Operator console** that manages:

1. Companies / tenants (lifecycle)
2. Packages (plans) & commercial limits
3. Subscriptions & billing state
4. Licenses / seats / module entitlements
5. Module catalog enablement per tenant/plan
6. Platform security & RBAC (central)
7. Platform operations (health, flags, audit of platform actions)

This upgrades catalog entries currently `partial` / `planned`:

| Catalog id | Today | Phase 2 target |
|---|---|---|
| `platform-saas-signup` | API catalog only | Editable systems/plans admin UI |
| `platform-subscriptions` | planned | Full plans + subscriptions manager |
| `platform-ops-health` | planned | Ops dashboard + feature flags |
| `platform-tenants` | live (`tenant-admin`) | Absorb/extend into Owner Console IA |
| `platform-super-admin` | live | Keep as RBAC engine; link from console |
| `platform-payment` | live | Keep; wire plan checkout metadata |
| `module-backup` (mock) | scripts only | Operator-triggered backup jobs (non-prod restore guarded) |

---

## 2) Information architecture

```
/settings/admin (Enterprise Settings Hub — Phase 1)
  └── Platform level cards
        └── /platform/owner  (NEW Phase 2 shell)
              ├── Companies
              ├── Plans & Packages
              ├── Subscriptions
              ├── Licenses & Seats
              ├── Module Entitlements
              ├── Security (link → super-admin + platform policies)
              └── Operations (health, flags, jobs, audit)
```

**Rules:**
- Tenant hosts never see Platform Owner routes (reuse Phase 1 catalog filter + server guards).
- Exact `/settings` homepage identity stays untouched.
- Do not replace working `tenant-admin.html` / `super-admin-page.html` in one shot — wrap + deep-link first, then migrate.

---

## 3) Workstreams (implementation order when approved)

### WS-A — Data model (central DB)

Extend / normalize (CREATE IF NOT EXISTS, non-destructive):

| Area | Tables / fields (proposed) | Notes |
|---|---|---|
| Plans | `saas_plans` (code, name, limits JSONB, price, is_active) | May map to existing subscription tables |
| Plan modules | `saas_plan_modules` (plan_id, module_key, enabled) | Entitlement matrix |
| Subscriptions | reuse existing `subscriptions` + status/period/tenant_id | Editor UI missing today |
| Licenses | `tenant_licenses` (seats, starts_at, ends_at, source) | Seat enforcement hooks later |
| Feature flags | `platform_feature_flags` | Ops |
| Platform settings | use Settings Engine keys `platform.*` | Versioned via Phase 1 engine |

Seed definitions into Settings Engine for keys such as:

- `platform.default_plan`
- `platform.signup.enabled`
- `platform.maintenance.mode`
- `platform.security.session_ttl`
- `platform.ops.alert_emails`

### WS-B — APIs (central only)

| Method | Path | Auth |
|---|---|---|
| GET/POST/PUT | `/api/platform-owner/plans` | platform admin |
| GET/PUT | `/api/platform-owner/plans/:id/modules` | platform admin |
| GET/POST/PUT | `/api/platform-owner/subscriptions` | platform admin |
| GET/PUT | `/api/platform-owner/tenants/:id/license` | platform admin |
| GET/PUT | `/api/platform-owner/tenants/:id/modules` | platform admin |
| GET/PUT | `/api/platform-owner/flags` | platform admin |
| GET | `/api/platform-owner/health` | platform admin |
| GET | `/api/platform-owner/audit` | platform admin |

All writes go through Settings Engine audit **or** `setting_audit_events` / dedicated `platform_owner_audit`.

### WS-C — UI

- Owner Console pages (Arabic-first, RTL) under `/platform/owner/*`
- Hub cards for Phase 2 items flip `planned/partial` → `live` only when save paths are real
- No toast-only success
- Reuse existing tenant admin list where possible

### WS-D — Security

- Enforce `super_admin` / `tenant_type=HQ` on all Owner APIs
- Rate-limit mutations
- Sensitive values redacted on GET (engine already supports `is_sensitive`)
- Deny tenant-host access even with stolen central cookie patterns (host + role checks)

### WS-E — Tests (required before calling Phase 2 done)

1. Platform-only access (tenant token → 403)
2. Plan change updates entitlement reads for a sample tenant
3. Subscription suspend blocks module entitlement resolution
4. Versioning on `platform.*` settings keys
5. Compatibility: existing tenant-admin / payment / super-admin still work
6. Staging E2E: login → Owner Console → edit plan → reload persists

---

## 4) Explicit non-goals for Phase 2

- Completing **all** module settings (Finance fiscal periods, CRM pipelines, POS, inventory policies, templates, numbering) — those are Phases 3–5.
- Production deploy / merge without approval.
- Rewriting HR 91-tile hub (already live).
- Customer-facing billing checkout redesign (only owner-side plan/subscription control).

---

## 5) Suggested Phase 2 exit criteria

- [ ] Owner Console reachable from Enterprise Settings Hub (platform level)
- [ ] CRUD plans + module matrix persisted
- [ ] Subscription status editable and audited
- [ ] License seats stored per tenant
- [ ] Feature flags readable/writable
- [ ] Ops health endpoint + basic UI
- [ ] Catalog statuses updated honestly (`live` only when real)
- [ ] Automated isolation/versioning tests green
- [ ] Staging E2E evidence attached
- [ ] Still no Production deploy without written approval

---

## 6) Mapping to later phases (reminder of final goal)

| Phase | Focus |
|---|---|
| **2** | Platform Owner: companies, packages, subscriptions, licenses, modules, security, ops |
| **3** | Company settings completion (email/SEO/AI UI, org CRUD, general locale/currency) + templates/numbering |
| **4** | Finance depth (fiscal periods, policies) + Sales/CRM/POS settings |
| **5** | Supply chain, facilities, notifications cross-module, backup restore UX, workflow engines |

Final goal remains: **settings for every existing ERP module**, not a link directory and not HR-only.
