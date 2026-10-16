-- ============================================================
-- Phase 5 — Enterprise Shared Services (non-destructive)
-- Workflow engine, backup jobs, notification queue,
-- template versions, integration registry.
-- ============================================================

-- Workflow definitions (replaces in-memory HR workflow canvas)
CREATE TABLE IF NOT EXISTS wf_definitions (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER,
  code            VARCHAR(80)  NOT NULL,
  name_ar         VARCHAR(255) NOT NULL,
  name_en         VARCHAR(255),
  module_key      VARCHAR(80)  NOT NULL DEFAULT 'hr',
  entity_type     VARCHAR(80)  NOT NULL DEFAULT 'employee_request',
  steps           JSONB        NOT NULL DEFAULT '[]',
  conditions      JSONB        NOT NULL DEFAULT '{}',
  escalate_hours  INTEGER      NOT NULL DEFAULT 48,
  allow_skip      BOOLEAN      NOT NULL DEFAULT false,
  allow_return    BOOLEAN      NOT NULL DEFAULT true,
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  version         INTEGER      NOT NULL DEFAULT 1,
  created_by      INTEGER,
  updated_by      INTEGER,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_wf_def_module ON wf_definitions (module_key);
CREATE INDEX IF NOT EXISTS idx_wf_def_active ON wf_definitions (is_active);

CREATE TABLE IF NOT EXISTS wf_instances (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER,
  definition_id     INTEGER REFERENCES wf_definitions (id) ON DELETE SET NULL,
  definition_code   VARCHAR(80),
  entity_type       VARCHAR(80)  NOT NULL,
  entity_id         VARCHAR(120) NOT NULL,
  title             VARCHAR(500),
  status            VARCHAR(30)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','approved','rejected','returned','escalated','cancelled')),
  current_step      INTEGER      NOT NULL DEFAULT 0,
  steps_snapshot    JSONB        NOT NULL DEFAULT '[]',
  payload           JSONB        NOT NULL DEFAULT '{}',
  started_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at      TIMESTAMP,
  escalated_at      TIMESTAMP,
  created_by        INTEGER,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wf_inst_entity ON wf_instances (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_wf_inst_status ON wf_instances (status);
CREATE INDEX IF NOT EXISTS idx_wf_inst_tenant ON wf_instances (tenant_id);

CREATE TABLE IF NOT EXISTS wf_instance_events (
  id            SERIAL PRIMARY KEY,
  instance_id   INTEGER      NOT NULL REFERENCES wf_instances (id) ON DELETE CASCADE,
  step_index    INTEGER,
  action        VARCHAR(40)  NOT NULL,
  actor_id      INTEGER,
  actor_name    VARCHAR(255),
  actor_role    VARCHAR(80),
  notes         TEXT,
  meta          JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wf_events_instance ON wf_instance_events (instance_id);

-- Ensure legacy finance approval tables exist (no sample data)
CREATE TABLE IF NOT EXISTS approval_workflows (
  id              SERIAL PRIMARY KEY,
  entity_id       VARCHAR(40),
  item_type       VARCHAR(50)  NOT NULL,
  item_id         VARCHAR(80)  NOT NULL,
  item_title      VARCHAR(255),
  amount          DECIMAL(14, 2) DEFAULT 0,
  current_level   INTEGER DEFAULT 1,
  status          VARCHAR(20) DEFAULT 'PENDING',
  created_by      INTEGER,
  created_by_name VARCHAR(255),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id               SERIAL PRIMARY KEY,
  workflow_id      INTEGER REFERENCES approval_workflows (id) ON DELETE CASCADE,
  step_level       INTEGER NOT NULL,
  approver_role    VARCHAR(50) NOT NULL,
  approver_id      INTEGER,
  approver_name    VARCHAR(255),
  status           VARCHAR(20) DEFAULT 'PENDING',
  decision_date    TIMESTAMP,
  comments         TEXT,
  rejection_reason TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup policy runs (operational, not one-click prod destroy)
CREATE TABLE IF NOT EXISTS backup_jobs (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER,
  name            VARCHAR(255) NOT NULL,
  schedule_cron   VARCHAR(80),
  retention_days  INTEGER      NOT NULL DEFAULT 30,
  include_uploads BOOLEAN      NOT NULL DEFAULT true,
  target_kind     VARCHAR(40)  NOT NULL DEFAULT 'logical_dump'
                  CHECK (target_kind IN ('logical_dump', 'script_restore_test')),
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  last_run_at     TIMESTAMP,
  next_run_at     TIMESTAMP,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_runs (
  id              SERIAL PRIMARY KEY,
  job_id          INTEGER REFERENCES backup_jobs (id) ON DELETE SET NULL,
  tenant_id       INTEGER,
  action          VARCHAR(40)  NOT NULL
                  CHECK (action IN ('backup', 'restore_test', 'verify')),
  status          VARCHAR(30)  NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'success', 'failed', 'blocked')),
  started_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at     TIMESTAMP,
  artifact_path   TEXT,
  bytes           BIGINT,
  message         TEXT,
  meta            JSONB        NOT NULL DEFAULT '{}',
  initiated_by    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_job ON backup_runs (job_id);
CREATE INDEX IF NOT EXISTS idx_backup_runs_status ON backup_runs (status);

-- Notification outbox / retry queue
CREATE TABLE IF NOT EXISTS notification_outbox (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER,
  channel         VARCHAR(20)  NOT NULL
                  CHECK (channel IN ('email', 'sms', 'in_app')),
  recipient       VARCHAR(500) NOT NULL,
  subject         VARCHAR(500),
  body            TEXT         NOT NULL DEFAULT '',
  template_code   VARCHAR(80),
  status          VARCHAR(30)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts        INTEGER      NOT NULL DEFAULT 0,
  max_attempts    INTEGER      NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error      TEXT,
  meta            JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_outbox_status ON notification_outbox (status, next_attempt_at);

-- Template versions (extends module_templates)
CREATE TABLE IF NOT EXISTS module_template_versions (
  id              SERIAL PRIMARY KEY,
  template_id     INTEGER      NOT NULL,
  version         INTEGER      NOT NULL,
  subject         VARCHAR(500),
  body            TEXT         NOT NULL DEFAULT '',
  changed_by      INTEGER,
  change_reason   TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (template_id, version)
);

-- Integration registry (wraps existing integrations; does not invent new vendors)
CREATE TABLE IF NOT EXISTS integration_registry (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER,
  integration_key VARCHAR(80)  NOT NULL,
  display_name    VARCHAR(255) NOT NULL,
  category        VARCHAR(40)  NOT NULL DEFAULT 'other',
  is_enabled      BOOLEAN      NOT NULL DEFAULT false,
  config_json     JSONB        NOT NULL DEFAULT '{}',
  secrets_ref     VARCHAR(120),
  last_test_at    TIMESTAMP,
  last_test_ok    BOOLEAN,
  last_test_msg   TEXT,
  updated_by      INTEGER,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, integration_key)
);

CREATE INDEX IF NOT EXISTS idx_integ_reg_enabled ON integration_registry (is_enabled);
