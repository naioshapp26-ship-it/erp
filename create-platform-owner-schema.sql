-- ============================================================
-- Phase 2 — Platform Owner Console (non-destructive)
-- ============================================================

CREATE TABLE IF NOT EXISTS saas_plans (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(80)  NOT NULL UNIQUE,
  name_ar          VARCHAR(255) NOT NULL,
  name_en          VARCHAR(255),
  description_ar   TEXT,
  description_en   TEXT,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         VARCHAR(10)  NOT NULL DEFAULT 'USD',
  billing_cycle    VARCHAR(20)  NOT NULL DEFAULT 'monthly'
                   CHECK (billing_cycle IN ('monthly', 'yearly', 'custom')),
  trial_days       INTEGER      NOT NULL DEFAULT 0,
  grace_days       INTEGER      NOT NULL DEFAULT 3,
  max_users        INTEGER      NOT NULL DEFAULT 5,
  max_storage_mb   INTEGER      NOT NULL DEFAULT 1024,
  is_custom        BOOLEAN      NOT NULL DEFAULT false,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  sort_order       INTEGER      NOT NULL DEFAULT 100,
  limits           JSONB        NOT NULL DEFAULT '{}',
  metadata         JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saas_plans_active ON saas_plans (is_active);

CREATE TABLE IF NOT EXISTS saas_plan_modules (
  id               SERIAL PRIMARY KEY,
  plan_code        VARCHAR(80)  NOT NULL REFERENCES saas_plans (code) ON DELETE CASCADE,
  module_key       VARCHAR(120) NOT NULL,
  enabled          BOOLEAN      NOT NULL DEFAULT true,
  UNIQUE (plan_code, module_key)
);

CREATE INDEX IF NOT EXISTS idx_saas_plan_modules_plan ON saas_plan_modules (plan_code);

CREATE TABLE IF NOT EXISTS tenant_licenses (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  plan_code        VARCHAR(80),
  seats            INTEGER      NOT NULL DEFAULT 5,
  seats_used       INTEGER      NOT NULL DEFAULT 0,
  storage_mb_limit INTEGER      NOT NULL DEFAULT 1024,
  storage_mb_used  INTEGER      NOT NULL DEFAULT 0,
  starts_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at          TIMESTAMP,
  source           VARCHAR(50)  NOT NULL DEFAULT 'manual',
  status           VARCHAR(30)  NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'expired', 'suspended', 'grace')),
  notes            TEXT,
  metadata         JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_licenses_status ON tenant_licenses (status);

CREATE TABLE IF NOT EXISTS tenant_module_overrides (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  module_key       VARCHAR(120) NOT NULL,
  enabled          BOOLEAN      NOT NULL,
  reason           TEXT,
  updated_by       INTEGER,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_module_overrides_tenant
  ON tenant_module_overrides (tenant_id);

CREATE TABLE IF NOT EXISTS platform_feature_flags (
  id               SERIAL PRIMARY KEY,
  key              VARCHAR(120) NOT NULL UNIQUE,
  enabled          BOOLEAN      NOT NULL DEFAULT false,
  description_ar   TEXT,
  description_en   TEXT,
  audience         VARCHAR(40)  NOT NULL DEFAULT 'platform'
                   CHECK (audience IN ('platform', 'all_tenants', 'selected')),
  metadata         JSONB        NOT NULL DEFAULT '{}',
  updated_by       INTEGER,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_owner_audit (
  id               SERIAL PRIMARY KEY,
  actor_id         INTEGER,
  action           VARCHAR(80)  NOT NULL,
  entity_type      VARCHAR(60),
  entity_id        VARCHAR(120),
  tenant_id        INTEGER,
  old_value        JSONB,
  new_value        JSONB,
  meta             JSONB        NOT NULL DEFAULT '{}',
  ip_address       VARCHAR(64),
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_owner_audit_created
  ON platform_owner_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_owner_audit_tenant
  ON platform_owner_audit (tenant_id);

CREATE TABLE IF NOT EXISTS platform_api_error_events (
  id               SERIAL PRIMARY KEY,
  path             TEXT,
  method           VARCHAR(10),
  status_code      INTEGER,
  error_message    TEXT,
  tenant_id        INTEGER,
  meta             JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_api_errors_created
  ON platform_api_error_events (created_at DESC);

-- Soft-extend subscriptions settings for grace / renewal metadata (no destructive ALTER).
-- Values live in subscriptions.settings JSONB.
