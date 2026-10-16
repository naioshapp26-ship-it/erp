-- ============================================================
-- Phase 3 — Company org extensions (tenant DB, non-destructive)
-- Applied via company-settings-service.ensureOrgSchema(pool)
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_branches (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(50)  UNIQUE,
  country       VARCHAR(100),
  city          VARCHAR(100),
  address       TEXT,
  manager_name  VARCHAR(255),
  phone         VARCHAR(50),
  email         VARCHAR(255),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  settings      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_departments (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(50),
  parent_id     INTEGER REFERENCES tenant_departments (id) ON DELETE SET NULL,
  manager_id    INTEGER,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dept_branch ON tenant_departments (branch_id);
CREATE INDEX IF NOT EXISTS idx_dept_parent ON tenant_departments (parent_id);

CREATE TABLE IF NOT EXISTS tenant_job_titles (
  id            SERIAL PRIMARY KEY,
  title_ar      VARCHAR(255) NOT NULL,
  title_en      VARCHAR(255),
  code          VARCHAR(50),
  grade         VARCHAR(50),
  department_id INTEGER REFERENCES tenant_departments (id) ON DELETE SET NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_titles_active ON tenant_job_titles (is_active);

CREATE TABLE IF NOT EXISTS tenant_locations (
  id            SERIAL PRIMARY KEY,
  name_ar       VARCHAR(255) NOT NULL,
  name_en       VARCHAR(255),
  location_type VARCHAR(40)  NOT NULL DEFAULT 'office'
                CHECK (location_type IN ('office', 'warehouse', 'site', 'remote', 'other')),
  branch_id     INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  country       VARCHAR(100),
  city          VARCHAR(100),
  address       TEXT,
  timezone      VARCHAR(80),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_branch ON tenant_locations (branch_id);

CREATE TABLE IF NOT EXISTS tenant_settings (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(100) NOT NULL UNIQUE,
  value           TEXT,
  value_json      JSONB,
  description     TEXT,
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_user_invites (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'staff',
  branch_id     INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  invited_by    INTEGER,
  token_hash    VARCHAR(128) NOT NULL UNIQUE,
  status        VARCHAR(30)  NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at    TIMESTAMP    NOT NULL,
  accepted_at   TIMESTAMP,
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invites_email ON tenant_user_invites (email);
CREATE INDEX IF NOT EXISTS idx_invites_status ON tenant_user_invites (status);
