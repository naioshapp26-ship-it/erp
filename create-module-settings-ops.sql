-- ============================================================
-- Phase 4 — Module settings operational tables (tenant DB)
-- Non-destructive. Applied via module-settings-service.ensureOpsSchema
-- ============================================================

CREATE TABLE IF NOT EXISTS fiscal_years (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(40)  NOT NULL,
  name_ar       VARCHAR(255) NOT NULL,
  name_en       VARCHAR(255),
  start_date    DATE         NOT NULL,
  end_date      DATE         NOT NULL,
  status        VARCHAR(30)  NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'locked')),
  is_current    BOOLEAN      NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id              SERIAL PRIMARY KEY,
  fiscal_year_id  INTEGER      NOT NULL REFERENCES fiscal_years (id) ON DELETE CASCADE,
  period_no       INTEGER      NOT NULL CHECK (period_no BETWEEN 1 AND 24),
  name_ar         VARCHAR(255) NOT NULL,
  name_en         VARCHAR(255),
  start_date      DATE         NOT NULL,
  end_date        DATE         NOT NULL,
  status          VARCHAR(30)  NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'closed', 'locked')),
  closed_at       TIMESTAMP,
  closed_by       INTEGER,
  notes           TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (fiscal_year_id, period_no)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_year ON fiscal_periods (fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fiscal_years_current ON fiscal_years (is_current);

CREATE TABLE IF NOT EXISTS module_numbering_counters (
  id            SERIAL PRIMARY KEY,
  series_key    VARCHAR(80)  NOT NULL UNIQUE,
  prefix        VARCHAR(40)  NOT NULL DEFAULT '',
  next_number   INTEGER      NOT NULL DEFAULT 1,
  pad_width     INTEGER      NOT NULL DEFAULT 5,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS module_templates (
  id            SERIAL PRIMARY KEY,
  template_type VARCHAR(40)  NOT NULL
                CHECK (template_type IN ('email', 'sms', 'print')),
  code          VARCHAR(80)  NOT NULL,
  name_ar       VARCHAR(255) NOT NULL,
  subject       VARCHAR(500),
  body          TEXT         NOT NULL DEFAULT '',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (template_type, code)
);

CREATE INDEX IF NOT EXISTS idx_module_templates_type ON module_templates (template_type);
