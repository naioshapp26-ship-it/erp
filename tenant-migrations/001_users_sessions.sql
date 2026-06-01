-- ============================================================
-- Tenant Base Schema — Migration 001
-- المرحلة 1 — المخطط الأساسي لقاعدة بيانات المستأجر
-- ============================================================
-- هذا الملف يُطبَّق على كل قاعدة بيانات مستأجر جديدة أثناء التجهيز.
-- يُنشئ جداول المستخدمين والجلسات وتتبع الهجرات.
-- ============================================================

-- --------------------------------------------------------
-- جدول تتبع الهجرات المطبقة (schema_migrations)
-- يُخزَّن في قاعدة بيانات المستأجر نفسه
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          SERIAL PRIMARY KEY,
  filename    VARCHAR(255) NOT NULL UNIQUE,
  applied_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- جدول المستخدمين (users)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL DEFAULT '',
  username      VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(255),
  phone         VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'staff',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email    ON users (email)    WHERE email IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX        IF NOT EXISTS idx_users_role     ON users (role);

-- --------------------------------------------------------
-- جدول الجلسات (sessions)
-- tenant_id يُخزَّن هنا لتمكين إعادة حل السياق من النطاق المركزي
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tenant_id     INTEGER      NOT NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address    VARCHAR(50),
  user_agent    TEXT,
  expires_at    TIMESTAMP    NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant  ON sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- --------------------------------------------------------
-- Trigger: auto-update updated_at on users
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION tenant_update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION tenant_update_users_updated_at();

