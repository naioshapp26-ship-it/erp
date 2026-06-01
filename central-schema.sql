-- ============================================================
-- المرحلة 0 — قاعدة البيانات المركزية (Control-Plane Schema)
-- Central / Control-Plane Database Schema
-- ============================================================

-- --------------------------------------------------------
-- 1. جدول المستأجرين المركزي (Tenants Registry)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id               SERIAL PRIMARY KEY,
  -- subdomain: VARCHAR(63) follows the DNS label length limit per RFC 1035 (max 63 octets)
  subdomain        VARCHAR(63)  NOT NULL UNIQUE,
  company_name     VARCHAR(255) NOT NULL,
  subscription_plan VARCHAR(100) NOT NULL DEFAULT 'basic',
  status           VARCHAR(30)  NOT NULL DEFAULT 'pending_payment'
                   CHECK (status IN ('active', 'suspended', 'deleted', 'pending_payment')),
  encrypted_db_url TEXT,
  db_name          VARCHAR(100),
  settings         JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants (subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status    ON tenants (status);

-- --------------------------------------------------------
-- 2. جدول سجلات التجهيز (Provisioning Logs)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS provisioning_logs (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  step        VARCHAR(100) NOT NULL,
  status      VARCHAR(30)  NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'running', 'success', 'failed')),
  message     TEXT,
  details     JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provisioning_logs_tenant ON provisioning_logs (tenant_id);

-- --------------------------------------------------------
-- 3. جدول الاشتراكات المركزية (Subscriptions)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  plan             VARCHAR(100) NOT NULL,
  status           VARCHAR(30)  NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  trial_ends_at    TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end   TIMESTAMP,
  provider         VARCHAR(50),
  provider_subscription_id VARCHAR(255),
  settings         JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions (tenant_id);

-- --------------------------------------------------------
-- 4. إعدادات الدفع للمنصة المركزية (Platform Payment Settings)
-- ملاحظة: الحقول المشار إليها بـ "encrypted" تُشفَّر بـ AES-256-GCM
--          باستخدام tenant-connection-manager.js::encryptDbUrl قبل التخزين.
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_payment_settings (
  id               SERIAL PRIMARY KEY,
  provider         VARCHAR(50)  NOT NULL UNIQUE
                   CHECK (provider IN ('stripe', 'paypal', 'paymob')),
  is_enabled       BOOLEAN      NOT NULL DEFAULT false,
  is_test_mode     BOOLEAN      NOT NULL DEFAULT true,
  -- Stripe
  stripe_public_key  TEXT,
  stripe_secret_key  TEXT,   -- encrypted
  stripe_webhook_secret TEXT,  -- encrypted
  -- PayPal
  paypal_client_id  TEXT,
  paypal_client_secret TEXT,  -- encrypted
  paypal_webhook_id TEXT,
  paypal_merchant_id TEXT,
  -- Paymob
  paymob_public_key  TEXT,
  paymob_secret_key  TEXT,   -- encrypted
  paymob_hmac_secret TEXT,   -- encrypted
  paymob_integration_ids JSONB DEFAULT '[]',
  paymob_base_url    TEXT,
  -- Subscription plans config
  plans_config       JSONB    NOT NULL DEFAULT '{}',
  trial_days         INTEGER  NOT NULL DEFAULT 0,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 5. معاملات مدفوعات المنصة المركزية (Platform Payment Transactions)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_payment_transactions (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER      REFERENCES tenants (id) ON DELETE SET NULL,
  provider         VARCHAR(50)  NOT NULL,
  provider_transaction_id VARCHAR(255),
  amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         VARCHAR(10)  NOT NULL DEFAULT 'USD',
  status           VARCHAR(30)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  type             VARCHAR(50)  NOT NULL DEFAULT 'subscription'
                   CHECK (type IN ('subscription', 'signup', 'refund')),
  metadata         JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_txn_tenant   ON platform_payment_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_txn_provider ON platform_payment_transactions (provider);

-- --------------------------------------------------------
-- 6. إعدادات البريد الإلكتروني للمنصة (Platform Email Settings)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_email_settings (
  id            SERIAL PRIMARY KEY,
  smtp_host     VARCHAR(255),
  smtp_port     INTEGER      DEFAULT 587,
  smtp_user     VARCHAR(255),
  smtp_password TEXT,           -- encrypted
  smtp_from     VARCHAR(255),
  smtp_secure   BOOLEAN      NOT NULL DEFAULT false,
  is_enabled    BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 7. إعدادات SEO للمنصة (Platform SEO Settings)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_seo_settings (
  id              SERIAL PRIMARY KEY,
  meta_title      VARCHAR(255),
  meta_description TEXT,
  meta_keywords   TEXT,
  og_title        VARCHAR(255),
  og_description  TEXT,
  og_image_url    TEXT,
  robots_txt      TEXT,
  sitemap_xml     TEXT,
  google_analytics_id VARCHAR(100),
  extra           JSONB   NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 8. إعدادات الواجهة والعلامة التجارية للمنصة (Platform Branding Settings)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_branding_settings (
  id              SERIAL PRIMARY KEY,
  logo_url        TEXT,
  favicon_url     TEXT,
  primary_color   VARCHAR(20),
  secondary_color VARCHAR(20),
  font_family     VARCHAR(100),
  custom_css      TEXT,
  extra           JSONB   NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 9. إعدادات المنصة العامة (Platform Settings)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(100) NOT NULL UNIQUE,
  value           TEXT,
  value_json      JSONB,
  description     TEXT,
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 10. المحتوى العام للمنصة (General Content)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS general_content (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  title           VARCHAR(255),
  body            TEXT,
  meta            JSONB   NOT NULL DEFAULT '{}',
  is_published    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 11. جدول أدمن المستأجرين المركزي (Tenant Admins — central reference)
-- ملاحظة: يُنشأ الأدمن الفعلي في قاعدة بيانات المستأجر أثناء التجهيز.
--          هذا الجدول مرجع مركزي فقط.
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_admins (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  full_name   VARCHAR(255),
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_tenant_admins_tenant ON tenant_admins (tenant_id);

-- --------------------------------------------------------
-- 12. فهرس جلسات المستأجرين المركزي (Tenant Session Index)
-- المرحلة 2 — يُستخدم لإعادة حل سياق المستأجر عند غياب النطاق الفرعي
-- يُخزَّن هنا رابط رمز الجلسة بمعرف المستأجر فقط (بدون بيانات حساسة)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_session_index (
  session_token VARCHAR(255) NOT NULL PRIMARY KEY,
  tenant_id     INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  expires_at    TIMESTAMP    NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tsi_tenant  ON tenant_session_index (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tsi_expires ON tenant_session_index (expires_at);

-- --------------------------------------------------------
-- Triggers: auto-update updated_at
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION central_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants',
    'subscriptions',
    'platform_payment_settings',
    'platform_payment_transactions',
    'platform_email_settings',
    'platform_seo_settings',
    'platform_branding_settings',
    'platform_settings',
    'general_content'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I; ' ||
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I ' ||
      'FOR EACH ROW EXECUTE FUNCTION central_update_updated_at();',
      t, t, t, t
    );
  END LOOP;
END;
$$;
