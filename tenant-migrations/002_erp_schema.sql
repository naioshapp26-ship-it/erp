-- ============================================================
-- Tenant ERP Schema — Migration 002
-- المرحلة 3 — سكيمة المستأجر الكاملة لنظام ERP
-- ============================================================
-- يُطبَّق على كل قاعدة بيانات مستأجر بعد migration 001.
-- يُنشئ جميع وحدات أعمال ERP وجداول الإعدادات الخاصة بالمستأجر.
-- ============================================================

-- ============================================================
-- وحدة الإعدادات الخاصة بالمستأجر
-- ============================================================

-- إعدادات الدفع (Stripe / PayPal / Paymob)
-- الحقول المشار إليها بـ "encrypted" تُشفَّر قبل التخزين
CREATE TABLE IF NOT EXISTS tenant_payment_settings (
  id                       SERIAL PRIMARY KEY,
  provider                 VARCHAR(50) NOT NULL UNIQUE
                           CHECK (provider IN ('stripe', 'paypal', 'paymob')),
  is_enabled               BOOLEAN     NOT NULL DEFAULT false,
  is_test_mode             BOOLEAN     NOT NULL DEFAULT true,
  -- Stripe
  stripe_public_key        TEXT,
  stripe_secret_key        TEXT,         -- encrypted
  stripe_webhook_secret    TEXT,         -- encrypted
  -- PayPal
  paypal_client_id         TEXT,
  paypal_client_secret     TEXT,         -- encrypted
  paypal_webhook_id        TEXT,
  paypal_merchant_id       TEXT,
  -- Paymob
  paymob_public_key        TEXT,
  paymob_secret_key        TEXT,         -- encrypted
  paymob_hmac_secret       TEXT,         -- encrypted
  paymob_integration_ids   JSONB        NOT NULL DEFAULT '[]',
  paymob_base_url          TEXT,
  -- إضافية
  extra                    JSONB        NOT NULL DEFAULT '{}',
  created_at               TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- إعدادات البريد الإلكتروني (SMTP)
CREATE TABLE IF NOT EXISTS tenant_email_settings (
  id            SERIAL PRIMARY KEY,
  smtp_host     VARCHAR(255),
  smtp_port     INTEGER     DEFAULT 587,
  smtp_user     VARCHAR(255),
  smtp_password TEXT,                   -- encrypted
  smtp_from     VARCHAR(255),
  smtp_secure   BOOLEAN     NOT NULL DEFAULT false,
  is_enabled    BOOLEAN     NOT NULL DEFAULT false,
  extra         JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- إعدادات الواجهة والعلامة التجارية
CREATE TABLE IF NOT EXISTS branding_settings (
  id              SERIAL PRIMARY KEY,
  logo_url        TEXT,
  favicon_url     TEXT,
  primary_color   VARCHAR(20),
  secondary_color VARCHAR(20),
  font_family     VARCHAR(100),
  custom_css      TEXT,
  extra           JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- إعدادات SEO
CREATE TABLE IF NOT EXISTS seo_settings (
  id                  SERIAL PRIMARY KEY,
  meta_title          VARCHAR(255),
  meta_description    TEXT,
  meta_keywords       TEXT,
  og_title            VARCHAR(255),
  og_description      TEXT,
  og_image_url        TEXT,
  robots_txt          TEXT,
  sitemap_xml         TEXT,
  google_analytics_id VARCHAR(100),
  extra               JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- إعدادات الموقع العام (صفحات ثابتة عامة)
CREATE TABLE IF NOT EXISTS public_site_settings (
  id              SERIAL PRIMARY KEY,
  site_name       VARCHAR(255),
  site_tagline    TEXT,
  privacy_policy  TEXT,
  terms_of_service TEXT,
  contact_email   VARCHAR(255),
  contact_phone   VARCHAR(50),
  address         TEXT,
  social_links    JSONB       NOT NULL DEFAULT '{}',
  extra           JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- إعدادات المستأجر العامة (مفتاح-قيمة + JSONB)
CREATE TABLE IF NOT EXISTS tenant_settings (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(100) NOT NULL UNIQUE,
  value           TEXT,
  value_json      JSONB,
  description     TEXT,
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- معاملات الدفع الخاصة بالمستأجر
CREATE TABLE IF NOT EXISTS tenant_payment_transactions (
  id                      SERIAL PRIMARY KEY,
  provider                VARCHAR(50)   NOT NULL,
  provider_transaction_id VARCHAR(255),
  amount                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency                VARCHAR(10)   NOT NULL DEFAULT 'SAR',
  status                  VARCHAR(30)   NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  type                    VARCHAR(50)   NOT NULL DEFAULT 'purchase'
                          CHECK (type IN ('purchase', 'invoice', 'refund', 'other')),
  reference_type          VARCHAR(50),  -- 'invoice', 'purchase_order', etc.
  reference_id            INTEGER,
  metadata                JSONB         NOT NULL DEFAULT '{}',
  created_at              TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tpt_provider   ON tenant_payment_transactions (provider);
CREATE INDEX IF NOT EXISTS idx_tpt_status     ON tenant_payment_transactions (status);
CREATE INDEX IF NOT EXISTS idx_tpt_reference  ON tenant_payment_transactions (reference_type, reference_id);

-- ============================================================
-- وحدة إدارة الفروع والكيانات
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
  manager_id    INTEGER,          -- references users(id) — soft ref to avoid circular FK
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dept_branch ON tenant_departments (branch_id);
CREATE INDEX IF NOT EXISTS idx_dept_parent ON tenant_departments (parent_id);

CREATE TABLE IF NOT EXISTS tenant_cost_centers (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES tenant_departments (id) ON DELETE SET NULL,
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(50)  UNIQUE,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ربط المستخدمين بالفروع
CREATE TABLE IF NOT EXISTS user_branch_map (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  branch_id   INTEGER NOT NULL REFERENCES tenant_branches (id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_ubm_user   ON user_branch_map (user_id);
CREATE INDEX IF NOT EXISTS idx_ubm_branch ON user_branch_map (branch_id);

-- ============================================================
-- وحدة الصلاحيات وإدارة الأدوار (RBAC)
-- ============================================================

CREATE TABLE IF NOT EXISTS rbac_roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,   -- أدوار افتراضية لا تُحذف
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rbac_permissions (
  id          SERIAL PRIMARY KEY,
  module      VARCHAR(100) NOT NULL,  -- مثل: accounting, hr, crm
  action      VARCHAR(100) NOT NULL,  -- مثل: create, read, update, delete
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (module, action)
);

CREATE INDEX IF NOT EXISTS idx_perm_module ON rbac_permissions (module);

CREATE TABLE IF NOT EXISTS rbac_role_permissions (
  id            SERIAL PRIMARY KEY,
  role_id       INTEGER NOT NULL REFERENCES rbac_roles (id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES rbac_permissions (id) ON DELETE CASCADE,
  UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_rp_role ON rbac_role_permissions (role_id);

CREATE TABLE IF NOT EXISTS rbac_user_roles (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id     INTEGER NOT NULL REFERENCES rbac_roles (id) ON DELETE CASCADE,
  branch_id   INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,  -- اختياري: دور محدد للفرع
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, role_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_ur_user ON rbac_user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_ur_role ON rbac_user_roles (role_id);

-- ============================================================
-- وحدة الموارد البشرية والرواتب
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users (id) ON DELETE SET NULL,
  branch_id         INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  department_id     INTEGER REFERENCES tenant_departments (id) ON DELETE SET NULL,
  employee_number   VARCHAR(50) UNIQUE,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL DEFAULT '',
  national_id       VARCHAR(50),
  passport_number   VARCHAR(50),
  nationality       VARCHAR(100),
  date_of_birth     DATE,
  gender            VARCHAR(20),
  marital_status    VARCHAR(30),
  phone             VARCHAR(50),
  email             VARCHAR(255),
  address           TEXT,
  job_title         VARCHAR(255),
  job_grade         VARCHAR(50),
  employment_type   VARCHAR(50) DEFAULT 'full_time'
                    CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  hire_date         DATE,
  probation_end_date DATE,
  termination_date  DATE,
  status            VARCHAR(30) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'on_leave', 'suspended', 'terminated')),
  basic_salary      NUMERIC(14,2),
  salary_currency   VARCHAR(10) DEFAULT 'SAR',
  bank_name         VARCHAR(255),
  iban              VARCHAR(50),
  photo_url         TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emp_branch     ON employees (branch_id);
CREATE INDEX IF NOT EXISTS idx_emp_department ON employees (department_id);
CREATE INDEX IF NOT EXISTS idx_emp_status     ON employees (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_national_id ON employees (national_id) WHERE national_id IS NOT NULL;

-- مسيرات الرواتب
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              SERIAL PRIMARY KEY,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  period_label    VARCHAR(50) NOT NULL,   -- مثل: 2026-03
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  total_gross     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  approved_by     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  approved_at     TIMESTAMP,
  notes           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pr_branch ON payroll_runs (branch_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON payroll_runs (status);

-- بنود الراتب لكل موظف في مسيرة
CREATE TABLE IF NOT EXISTS payroll_items (
  id              SERIAL PRIMARY KEY,
  payroll_run_id  INTEGER NOT NULL REFERENCES payroll_runs (id) ON DELETE CASCADE,
  employee_id     INTEGER NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  basic_salary    NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowances      NUMERIC(14,2) NOT NULL DEFAULT 0,
  bonuses         NUMERIC(14,2) NOT NULL DEFAULT 0,
  overtime        NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  social_security NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_salary      NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_status  VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (payment_status IN ('pending', 'paid', 'failed')),
  details         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_pi_run      ON payroll_items (payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_pi_employee ON payroll_items (employee_id);

-- سجلات الحضور والانصراف
CREATE TABLE IF NOT EXISTS attendance (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  date          DATE    NOT NULL,
  check_in      TIMESTAMP,
  check_out     TIMESTAMP,
  status        VARCHAR(30) NOT NULL DEFAULT 'present'
                CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave', 'holiday')),
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_att_employee ON attendance (employee_id);
CREATE INDEX IF NOT EXISTS idx_att_date     ON attendance (date);

-- طلبات الإجازات
CREATE TABLE IF NOT EXISTS leave_requests (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  leave_type    VARCHAR(50) NOT NULL,   -- annual, sick, unpaid, maternity, etc.
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  days_count    NUMERIC(5,1) NOT NULL DEFAULT 0,
  reason        TEXT,
  status        VARCHAR(30) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  approved_at   TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lr_employee ON leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_lr_status   ON leave_requests (status);

-- نهايات الخدمة والتسويات
CREATE TABLE IF NOT EXISTS end_of_service (
  id                   SERIAL PRIMARY KEY,
  employee_id          INTEGER NOT NULL REFERENCES employees (id) ON DELETE CASCADE UNIQUE,
  termination_reason   VARCHAR(50) CHECK (termination_reason IN ('resignation', 'termination', 'retirement', 'death', 'contract_end', 'other')),
  termination_date     DATE NOT NULL,
  years_of_service     NUMERIC(5,2) NOT NULL DEFAULT 0,
  gratuity_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_dues           NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions           NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_payment          NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_status       VARCHAR(30) NOT NULL DEFAULT 'pending'
                       CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  notes                TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- سياسات الموارد البشرية
CREATE TABLE IF NOT EXISTS hr_policies (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  category      VARCHAR(100),
  content       TEXT,
  is_published  BOOLEAN NOT NULL DEFAULT false,
  effective_date DATE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- عهد وأصول الموظفين
CREATE TABLE IF NOT EXISTS employee_assets (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  asset_type      VARCHAR(100) NOT NULL,
  asset_name      VARCHAR(255) NOT NULL,
  serial_number   VARCHAR(100),
  issued_date     DATE,
  return_date     DATE,
  condition       VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ea_employee ON employee_assets (employee_id);

-- ============================================================
-- وحدة المحاسبة والعمليات المالية
-- ============================================================

-- شجرة الحسابات
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50)  NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  account_type    VARCHAR(50)  NOT NULL
                  CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id       INTEGER REFERENCES chart_of_accounts (id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10)   NOT NULL DEFAULT 'SAR',
  description     TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coa_type   ON chart_of_accounts (account_type);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts (parent_id);

-- القيود المحاسبية (رأس القيد)
CREATE TABLE IF NOT EXISTS journal_entries (
  id              SERIAL PRIMARY KEY,
  entry_number    VARCHAR(50)  UNIQUE,
  entry_date      DATE         NOT NULL,
  description     TEXT,
  reference_type  VARCHAR(50),    -- 'invoice', 'payment', 'payroll', etc.
  reference_id    INTEGER,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  cost_center_id  INTEGER REFERENCES tenant_cost_centers (id) ON DELETE SET NULL,
  total_debit     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_credit    NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          VARCHAR(30)  NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'posted', 'reversed')),
  posted_by       INTEGER REFERENCES users (id) ON DELETE SET NULL,
  posted_at       TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_je_date      ON journal_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_je_status    ON journal_entries (status);
CREATE INDEX IF NOT EXISTS idx_je_reference ON journal_entries (reference_type, reference_id);

-- سطور القيد المحاسبي
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id               SERIAL PRIMARY KEY,
  journal_entry_id INTEGER NOT NULL REFERENCES journal_entries (id) ON DELETE CASCADE,
  account_id       INTEGER NOT NULL REFERENCES chart_of_accounts (id),
  debit_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  description      TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jel_entry   ON journal_entry_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines (account_id);

-- الفواتير (مبيعات ومشتريات)
CREATE TABLE IF NOT EXISTS invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(50)  UNIQUE,
  invoice_type    VARCHAR(20)  NOT NULL DEFAULT 'sales'
                  CHECK (invoice_type IN ('sales', 'purchase', 'credit_note', 'debit_note')),
  invoice_date    DATE         NOT NULL,
  due_date        DATE,
  party_type      VARCHAR(20)  CHECK (party_type IN ('customer', 'vendor')),
  party_id        INTEGER,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10)   NOT NULL DEFAULT 'SAR',
  status          VARCHAR(30)   NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
  notes           TEXT,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inv_type   ON invoices (invoice_type);
CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_inv_party  ON invoices (party_type, party_id);

-- بنود الفواتير
CREATE TABLE IF NOT EXISTS invoice_items (
  id              SERIAL PRIMARY KEY,
  invoice_id      INTEGER NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  description     TEXT    NOT NULL,
  quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tax_pct         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  account_id      INTEGER REFERENCES chart_of_accounts (id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ii_invoice ON invoice_items (invoice_id);

-- المصروفات
CREATE TABLE IF NOT EXISTS expenses (
  id              SERIAL PRIMARY KEY,
  expense_date    DATE         NOT NULL,
  description     TEXT         NOT NULL,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10)   NOT NULL DEFAULT 'SAR',
  account_id      INTEGER REFERENCES chart_of_accounts (id) ON DELETE SET NULL,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  cost_center_id  INTEGER REFERENCES tenant_cost_centers (id) ON DELETE SET NULL,
  category        VARCHAR(100),
  vendor_id       INTEGER,
  status          VARCHAR(30)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  approved_by     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  receipt_url     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exp_date   ON expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_exp_status ON expenses (status);

-- المدفوعات وسجلات التحصيل
CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  payment_date    DATE         NOT NULL,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10)   NOT NULL DEFAULT 'SAR',
  direction       VARCHAR(20)  NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  party_type      VARCHAR(20)  CHECK (party_type IN ('customer', 'vendor', 'employee', 'other')),
  party_id        INTEGER,
  invoice_id      INTEGER REFERENCES invoices (id) ON DELETE SET NULL,
  payment_method  VARCHAR(50),
  reference_number VARCHAR(100),
  account_id      INTEGER REFERENCES chart_of_accounts (id) ON DELETE SET NULL,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  status          VARCHAR(30)  NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  notes           TEXT,
  provider        VARCHAR(50),                -- stripe / paypal / paymob / bank
  provider_txn_id VARCHAR(255),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pay_date   ON payments (payment_date);
CREATE INDEX IF NOT EXISTS idx_pay_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_pay_party  ON payments (party_type, party_id);

-- خطط الأقساط
CREATE TABLE IF NOT EXISTS payment_plans (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  invoice_id      INTEGER REFERENCES invoices (id) ON DELETE SET NULL,
  party_type      VARCHAR(20),
  party_id        INTEGER,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  installments    INTEGER NOT NULL DEFAULT 1,
  frequency       VARCHAR(30) DEFAULT 'monthly'
                  CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'custom')),
  start_date      DATE,
  status          VARCHAR(30) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_plan_installments (
  id              SERIAL PRIMARY KEY,
  plan_id         INTEGER NOT NULL REFERENCES payment_plans (id) ON DELETE CASCADE,
  installment_no  INTEGER NOT NULL,
  due_date        DATE    NOT NULL,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_id      INTEGER REFERENCES payments (id) ON DELETE SET NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ppi_plan ON payment_plan_installments (plan_id);

-- الموازنات
CREATE TABLE IF NOT EXISTS budgets (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  fiscal_year     INTEGER NOT NULL,
  period_type     VARCHAR(20) DEFAULT 'annual'
                  CHECK (period_type IN ('annual', 'quarterly', 'monthly')),
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  cost_center_id  INTEGER REFERENCES tenant_cost_centers (id) ON DELETE SET NULL,
  total_planned   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_actual    NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'approved', 'closed')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id              SERIAL PRIMARY KEY,
  budget_id       INTEGER NOT NULL REFERENCES budgets (id) ON DELETE CASCADE,
  account_id      INTEGER REFERENCES chart_of_accounts (id) ON DELETE SET NULL,
  period_label    VARCHAR(20),
  planned_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bl_budget ON budget_lines (budget_id);

-- التسويات والإقفال المحاسبي
CREATE TABLE IF NOT EXISTS reconciliations (
  id              SERIAL PRIMARY KEY,
  account_id      INTEGER NOT NULL REFERENCES chart_of_accounts (id) ON DELETE CASCADE,
  period_label    VARCHAR(20) NOT NULL,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  closed_by       INTEGER REFERENCES users (id) ON DELETE SET NULL,
  closed_at       TIMESTAMP,
  notes           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- إعدادات الضرائب والسياسات المالية
CREATE TABLE IF NOT EXISTS tax_settings (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL UNIQUE,
  rate_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_type        VARCHAR(50),    -- vat, withholding, etc.
  is_active       BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- سجل التدقيق المالي
CREATE TABLE IF NOT EXISTS financial_audit_log (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users (id) ON DELETE SET NULL,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(100) NOT NULL,
  entity_id       INTEGER,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      VARCHAR(50),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fal_entity  ON financial_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_fal_user    ON financial_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_fal_created ON financial_audit_log (created_at);

-- ============================================================
-- وحدة المبيعات وإدارة علاقات العملاء (CRM)
-- ============================================================

-- العملاء
CREATE TABLE IF NOT EXISTS customers (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  company_name    VARCHAR(255),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  address         TEXT,
  country         VARCHAR(100),
  city            VARCHAR(100),
  tax_number      VARCHAR(100),
  credit_limit    NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance         NUMERIC(14,2) NOT NULL DEFAULT 0,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cust_branch ON customers (branch_id);

-- خط الفرص (CRM Pipeline)
CREATE TABLE IF NOT EXISTS crm_opportunities (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER REFERENCES customers (id) ON DELETE SET NULL,
  title           VARCHAR(255) NOT NULL,
  stage           VARCHAR(50)  NOT NULL DEFAULT 'lead'
                  CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  estimated_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  probability_pct INTEGER,
  expected_close  DATE,
  assigned_to     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opp_stage    ON crm_opportunities (stage);
CREATE INDEX IF NOT EXISTS idx_opp_customer ON crm_opportunities (customer_id);

-- المنتجات والخدمات
CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  sku             VARCHAR(100) UNIQUE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  product_type    VARCHAR(30) DEFAULT 'product'
                  CHECK (product_type IN ('product', 'service')),
  unit            VARCHAR(50),
  cost_price      NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_price      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_id          INTEGER REFERENCES tax_settings (id) ON DELETE SET NULL,
  account_id      INTEGER REFERENCES chart_of_accounts (id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- معاملات نقاط البيع (POS)
CREATE TABLE IF NOT EXISTS pos_transactions (
  id              SERIAL PRIMARY KEY,
  transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  customer_id     INTEGER REFERENCES customers (id) ON DELETE SET NULL,
  cashier_id      INTEGER REFERENCES users (id) ON DELETE SET NULL,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method  VARCHAR(50),
  status          VARCHAR(30) NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('pending', 'completed', 'refunded', 'voided')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pos_date   ON pos_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_pos_branch ON pos_transactions (branch_id);

CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id                  SERIAL PRIMARY KEY,
  pos_transaction_id  INTEGER NOT NULL REFERENCES pos_transactions (id) ON DELETE CASCADE,
  product_id          INTEGER REFERENCES products (id) ON DELETE SET NULL,
  description         TEXT,
  quantity            NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price          NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pti_pos ON pos_transaction_items (pos_transaction_id);

-- ============================================================
-- وحدة سلسلة الإمداد والمخزون
-- ============================================================

-- الموردون
CREATE TABLE IF NOT EXISTS vendors (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  company_name    VARCHAR(255),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  address         TEXT,
  country         VARCHAR(100),
  city            VARCHAR(100),
  tax_number      VARCHAR(100),
  rating          NUMERIC(3,1),
  payment_terms   INTEGER DEFAULT 30,    -- أيام
  credit_balance  NUMERIC(14,2) NOT NULL DEFAULT 0,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- طلبات الشراء
CREATE TABLE IF NOT EXISTS purchase_requests (
  id              SERIAL PRIMARY KEY,
  request_number  VARCHAR(50) UNIQUE,
  request_date    DATE NOT NULL,
  requested_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  department_id   INTEGER REFERENCES tenant_departments (id) ON DELETE SET NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'ordered', 'received', 'cancelled')),
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id                  SERIAL PRIMARY KEY,
  purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests (id) ON DELETE CASCADE,
  product_id          INTEGER REFERENCES products (id) ON DELETE SET NULL,
  description         TEXT NOT NULL,
  quantity            NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit               VARCHAR(50),
  estimated_price    NUMERIC(14,2),
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pri_request ON purchase_request_items (purchase_request_id);

-- أوامر الشراء
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              SERIAL PRIMARY KEY,
  po_number       VARCHAR(50) UNIQUE,
  po_date         DATE NOT NULL,
  vendor_id       INTEGER REFERENCES vendors (id) ON DELETE SET NULL,
  purchase_request_id INTEGER REFERENCES purchase_requests (id) ON DELETE SET NULL,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) NOT NULL DEFAULT 'SAR',
  delivery_date   DATE,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'partial', 'received', 'cancelled', 'invoiced')),
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders (status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  product_id        INTEGER REFERENCES products (id) ON DELETE SET NULL,
  description       TEXT NOT NULL,
  quantity          NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit              VARCHAR(50),
  unit_price        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_pct           NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  received_qty      NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items (purchase_order_id);

-- استلام البضاعة
CREATE TABLE IF NOT EXISTS goods_receipts (
  id                SERIAL PRIMARY KEY,
  receipt_number    VARCHAR(50) UNIQUE,
  receipt_date      DATE NOT NULL,
  purchase_order_id INTEGER REFERENCES purchase_orders (id) ON DELETE SET NULL,
  vendor_id         INTEGER REFERENCES vendors (id) ON DELETE SET NULL,
  branch_id         INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  received_by       INTEGER REFERENCES users (id) ON DELETE SET NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'complete'
                    CHECK (status IN ('partial', 'complete', 'rejected')),
  notes             TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id                SERIAL PRIMARY KEY,
  goods_receipt_id  INTEGER NOT NULL REFERENCES goods_receipts (id) ON DELETE CASCADE,
  product_id        INTEGER REFERENCES products (id) ON DELETE SET NULL,
  po_item_id        INTEGER REFERENCES purchase_order_items (id) ON DELETE SET NULL,
  description       TEXT,
  expected_qty      NUMERIC(10,3) NOT NULL DEFAULT 0,
  received_qty      NUMERIC(10,3) NOT NULL DEFAULT 0,
  unit_cost         NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gri_receipt ON goods_receipt_items (goods_receipt_id);

-- حركات المخزون
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  movement_type   VARCHAR(30) NOT NULL
                  CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
  quantity        NUMERIC(10,3) NOT NULL,
  unit_cost       NUMERIC(14,2) NOT NULL DEFAULT 0,
  reference_type  VARCHAR(50),
  reference_id    INTEGER,
  notes           TEXT,
  created_by      INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_im_product  ON inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_im_type     ON inventory_movements (movement_type);
CREATE INDEX IF NOT EXISTS idx_im_date     ON inventory_movements (created_at);

-- الأصول الثابتة
CREATE TABLE IF NOT EXISTS fixed_assets (
  id                  SERIAL PRIMARY KEY,
  asset_number        VARCHAR(50) UNIQUE,
  name                VARCHAR(255) NOT NULL,
  category            VARCHAR(100),
  purchase_date       DATE,
  purchase_price      NUMERIC(14,2) NOT NULL DEFAULT 0,
  depreciation_method VARCHAR(30) DEFAULT 'straight_line'
                      CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
  useful_life_years   INTEGER DEFAULT 5,
  residual_value      NUMERIC(14,2) NOT NULL DEFAULT 0,
  accumulated_depreciation NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_book_value      NUMERIC(14,2) NOT NULL DEFAULT 0,
  branch_id           INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  assigned_to         INTEGER REFERENCES employees (id) ON DELETE SET NULL,
  status              VARCHAR(30) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'disposed', 'under_maintenance')),
  notes               TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- وحدة الموافقات وسير الاعتماد
-- ============================================================

CREATE TABLE IF NOT EXISTS approval_workflows (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  entity_type     VARCHAR(100) NOT NULL,   -- 'invoice', 'expense', 'leave_request', etc.
  steps           JSONB NOT NULL DEFAULT '[]',  -- مصفوفة من خطوات الموافقة
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id              SERIAL PRIMARY KEY,
  workflow_id     INTEGER REFERENCES approval_workflows (id) ON DELETE SET NULL,
  entity_type     VARCHAR(100) NOT NULL,
  entity_id       INTEGER      NOT NULL,
  current_step    INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ar_entity  ON approval_requests (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ar_status  ON approval_requests (status);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id                  SERIAL PRIMARY KEY,
  approval_request_id INTEGER NOT NULL REFERENCES approval_requests (id) ON DELETE CASCADE,
  step_number         INTEGER NOT NULL,
  decision            VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected', 'delegated')),
  decided_by          INTEGER REFERENCES users (id) ON DELETE SET NULL,
  decided_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_ad_request ON approval_decisions (approval_request_id);

-- ============================================================
-- وحدة الأرشفة والسجلات
-- ============================================================

CREATE TABLE IF NOT EXISTS document_archive (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  document_type   VARCHAR(100),
  entity_type     VARCHAR(100),
  entity_id       INTEGER,
  file_url        TEXT,
  file_size       INTEGER,
  mime_type       VARCHAR(100),
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  expiry_date     DATE,
  uploaded_by     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  branch_id       INTEGER REFERENCES tenant_branches (id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_da_entity ON document_archive (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_da_branch ON document_archive (branch_id);

CREATE TABLE IF NOT EXISTS archive_tags (
  id              SERIAL PRIMARY KEY,
  document_id     INTEGER NOT NULL REFERENCES document_archive (id) ON DELETE CASCADE,
  tag             VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_at_doc ON archive_tags (document_id);
CREATE INDEX IF NOT EXISTS idx_at_tag ON archive_tags (tag);

CREATE TABLE IF NOT EXISTS archive_retrieval_log (
  id              SERIAL PRIMARY KEY,
  document_id     INTEGER NOT NULL REFERENCES document_archive (id) ON DELETE CASCADE,
  retrieved_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  retrieved_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason          TEXT
);

-- ============================================================
-- وحدة التقارير التنفيذية والتدقيق الشامل
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users (id) ON DELETE SET NULL,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(100),
  entity_id       INTEGER,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      VARCHAR(50),
  user_agent      TEXT,
  module          VARCHAR(100),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_al_entity  ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_al_user    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_al_created ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_al_module  ON audit_log (module);

-- ============================================================
-- Triggers: auto-update updated_at on all major tables
-- ============================================================

CREATE OR REPLACE FUNCTION tenant_erp_update_updated_at()
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
    'tenant_payment_settings',
    'tenant_email_settings',
    'branding_settings',
    'seo_settings',
    'public_site_settings',
    'tenant_settings',
    'tenant_payment_transactions',
    'tenant_branches',
    'tenant_departments',
    'tenant_cost_centers',
    'rbac_roles',
    'employees',
    'payroll_runs',
    'payroll_items',
    'attendance',
    'leave_requests',
    'end_of_service',
    'hr_policies',
    'employee_assets',
    'chart_of_accounts',
    'journal_entries',
    'invoices',
    'expenses',
    'payments',
    'payment_plans',
    'payment_plan_installments',
    'budgets',
    'budget_lines',
    'reconciliations',
    'tax_settings',
    'customers',
    'crm_opportunities',
    'products',
    'vendors',
    'purchase_requests',
    'purchase_orders',
    'fixed_assets',
    'approval_workflows',
    'approval_requests',
    'document_archive'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_erp_updated_at ON %I; ' ||
      'CREATE TRIGGER trg_%s_erp_updated_at BEFORE UPDATE ON %I ' ||
      'FOR EACH ROW EXECUTE FUNCTION tenant_erp_update_updated_at();',
      t, t, t, t
    );
  END LOOP;
END;
$$;
