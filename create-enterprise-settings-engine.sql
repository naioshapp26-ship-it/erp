-- ============================================================
-- Phase 1 — Enterprise Settings Engine (central / control-plane)
-- Non-destructive: CREATE IF NOT EXISTS only.
-- ============================================================

CREATE TABLE IF NOT EXISTS setting_definitions (
  id               SERIAL PRIMARY KEY,
  key              VARCHAR(150) NOT NULL UNIQUE,
  scope            VARCHAR(30)  NOT NULL
                   CHECK (scope IN ('platform', 'plan', 'tenant', 'branch', 'module', 'user')),
  module_key       VARCHAR(100),
  data_type        VARCHAR(30)  NOT NULL DEFAULT 'json',
  default_value    JSONB,
  label_ar         TEXT,
  label_en         TEXT,
  description_ar   TEXT,
  description_en   TEXT,
  validation       JSONB        NOT NULL DEFAULT '{}',
  read_permission  VARCHAR(120),
  write_permission VARCHAR(120),
  is_sensitive     BOOLEAN      NOT NULL DEFAULT false,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_setting_definitions_scope
  ON setting_definitions (scope);
CREATE INDEX IF NOT EXISTS idx_setting_definitions_module
  ON setting_definitions (module_key);

CREATE TABLE IF NOT EXISTS setting_values (
  id               SERIAL PRIMARY KEY,
  definition_key   VARCHAR(150) NOT NULL REFERENCES setting_definitions (key) ON DELETE CASCADE,
  tenant_id        INTEGER,
  branch_id        INTEGER,
  module_key       VARCHAR(100),
  value            JSONB        NOT NULL,
  version          INTEGER      NOT NULL DEFAULT 1,
  updated_by       INTEGER,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (definition_key, tenant_id, branch_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_setting_values_tenant
  ON setting_values (tenant_id);
CREATE INDEX IF NOT EXISTS idx_setting_values_key
  ON setting_values (definition_key);

CREATE TABLE IF NOT EXISTS setting_versions (
  id               SERIAL PRIMARY KEY,
  setting_value_id INTEGER      NOT NULL REFERENCES setting_values (id) ON DELETE CASCADE,
  version          INTEGER      NOT NULL,
  value            JSONB        NOT NULL,
  changed_by       INTEGER,
  change_reason    TEXT,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (setting_value_id, version)
);

CREATE INDEX IF NOT EXISTS idx_setting_versions_value
  ON setting_versions (setting_value_id);

CREATE TABLE IF NOT EXISTS setting_audit_events (
  id               SERIAL PRIMARY KEY,
  definition_key   VARCHAR(150),
  tenant_id        INTEGER,
  actor_id         INTEGER,
  action           VARCHAR(50)  NOT NULL,
  old_value        JSONB,
  new_value        JSONB,
  meta             JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_setting_audit_key
  ON setting_audit_events (definition_key);
CREATE INDEX IF NOT EXISTS idx_setting_audit_tenant
  ON setting_audit_events (tenant_id);
