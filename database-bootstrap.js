const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { ensureFinanceReady, FINANCE_CORE_TABLES } = require('./finance-bootstrap');
const { ensureHierarchyCatalog } = require('./hierarchy-catalog-bootstrap');

const REQUIRED_TABLES = [
  'entities',
  'users',
  'user_credentials',
  'user_sessions',
  'invoices',
  'transactions',
  'ledger',
  'ads',
  'employee_requests',
  'payment_methods',
  'installment_plan_types',
  'tax_settings',
  'notifications',
  'training_programs',
  'beneficiaries',
  'training_sessions',
  'enrollments',
  'assessments',
  'certificates',
  'headquarters',
  'branches',
  'incubators',
  'platforms',
  'offices',
  'office_platforms',
  'branch_incubators',
  'branch_platforms',
  'executive_kpis',
  'roles',
  ...FINANCE_CORE_TABLES
];

let bootstrapPromise = null;

function readSqlFile(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').replace(/^\s*COMMIT\s*;?\s*$/gim, '');
}

async function ensureDatabaseReady() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS entities (
        id VARCHAR(120) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(40) NOT NULL,
        status VARCHAR(40) DEFAULT 'Active',
        balance DECIMAL(14, 2) DEFAULT 0.00,
        location VARCHAR(255),
        users_count INTEGER DEFAULT 0,
        plan VARCHAR(40) DEFAULT 'BASIC',
        expiry_date DATE,
        theme VARCHAR(40) DEFAULT 'BLUE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        role VARCHAR(100) NOT NULL DEFAULT 'مسؤول النظام',
        tenant_type VARCHAR(40) NOT NULL DEFAULT 'HQ',
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        entity_name VARCHAR(255),
        job_title VARCHAR(255),
        office_id INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS office_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

      CREATE TABLE IF NOT EXISTS user_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_activity TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(50) PRIMARY KEY,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        type VARCHAR(40) NOT NULL DEFAULT 'SUBSCRIPTION',
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(12, 2) DEFAULT 0,
        status VARCHAR(40) DEFAULT 'UNPAID',
        issue_date DATE DEFAULT CURRENT_DATE,
        due_date DATE DEFAULT CURRENT_DATE,
        customer_name VARCHAR(255),
        customer_number VARCHAR(100),
        customer_phone VARCHAR(100),
        customer_email VARCHAR(255),
        payment_method VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(50) PRIMARY KEY,
        invoice_id VARCHAR(50) REFERENCES invoices(id) ON DELETE SET NULL,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        type VARCHAR(40) NOT NULL DEFAULT 'PAYMENT',
        amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        payment_method VARCHAR(100),
        transaction_date DATE DEFAULT CURRENT_DATE,
        reference_code VARCHAR(100),
        user_name VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ledger (
        id SERIAL PRIMARY KEY,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        transaction_id VARCHAR(50) REFERENCES transactions(id) ON DELETE SET NULL,
        transaction_date DATE DEFAULT CURRENT_DATE,
        description TEXT NOT NULL DEFAULT '',
        debit DECIMAL(12, 2) DEFAULT 0,
        credit DECIMAL(12, 2) DEFAULT 0,
        balance DECIMAL(14, 2) DEFAULT 0,
        type VARCHAR(40),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ads (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        level VARCHAR(40),
        scope VARCHAR(40),
        status VARCHAR(40) DEFAULT 'PENDING',
        source_entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        source_type VARCHAR(40),
        target_ids TEXT[],
        cost DECIMAL(12, 2) DEFAULT 0,
        budget DECIMAL(12, 2) DEFAULT 0,
        spent DECIMAL(12, 2) DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        start_date DATE DEFAULT CURRENT_DATE,
        end_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE ads ADD COLUMN IF NOT EXISTS entity_id VARCHAR(120);

      CREATE TABLE IF NOT EXISTS employee_requests (
        id VARCHAR(50) PRIMARY KEY,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        employee_id VARCHAR(50),
        employee_name VARCHAR(255) NOT NULL DEFAULT '',
        request_type VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
        request_title VARCHAR(255) NOT NULL DEFAULT '',
        description TEXT,
        status VARCHAR(40) DEFAULT 'PENDING',
        priority VARCHAR(40) DEFAULT 'NORMAL',
        request_data JSONB,
        requires_approval BOOLEAN DEFAULT TRUE,
        approver_id VARCHAR(50),
        approver_name VARCHAR(255),
        approval_date TIMESTAMP,
        approval_notes TEXT,
        requested_date DATE DEFAULT CURRENT_DATE,
        start_date DATE,
        end_date DATE,
        completion_date DATE,
        attachments TEXT[],
        notes TEXT,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        method_code VARCHAR(100) UNIQUE NOT NULL,
        method_name_ar VARCHAR(255) NOT NULL,
        method_name_en VARCHAR(255),
        description_ar TEXT,
        description_en TEXT,
        icon VARCHAR(100),
        color VARCHAR(50) DEFAULT '#3b82f6',
        is_active BOOLEAN DEFAULT TRUE,
        requires_bank_details BOOLEAN DEFAULT FALSE,
        requires_card_details BOOLEAN DEFAULT FALSE,
        processing_fee_percentage DECIMAL(5, 2) DEFAULT 0,
        processing_fee_fixed DECIMAL(10, 2) DEFAULT 0,
        min_amount DECIMAL(10, 2),
        max_amount DECIMAL(10, 2),
        display_order INTEGER DEFAULT 0,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS installment_plan_types (
        id SERIAL PRIMARY KEY,
        plan_code VARCHAR(50) UNIQUE NOT NULL,
        plan_name_ar VARCHAR(255) NOT NULL,
        plan_name_en VARCHAR(255),
        description_ar TEXT,
        description_en TEXT,
        duration_months INTEGER NOT NULL,
        number_of_payments INTEGER NOT NULL,
        payment_frequency VARCHAR(50) DEFAULT 'MONTHLY',
        interest_rate DECIMAL(5, 2) DEFAULT 0,
        admin_fee DECIMAL(10, 2) DEFAULT 0,
        late_payment_fee DECIMAL(10, 2) DEFAULT 0,
        min_amount DECIMAL(15, 2),
        max_amount DECIMAL(15, 2),
        has_grace_period BOOLEAN DEFAULT false,
        grace_period_days INTEGER DEFAULT 0,
        early_payment_discount DECIMAL(5, 2) DEFAULT 0,
        icon VARCHAR(20) DEFAULT 'calendar',
        color VARCHAR(20) DEFAULT '#3b82f6',
        badge_text VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        is_featured BOOLEAN DEFAULT false,
        display_order INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tax_settings (
        id SERIAL PRIMARY KEY,
        tax_code VARCHAR(100) UNIQUE NOT NULL,
        tax_name_ar VARCHAR(255) NOT NULL,
        tax_name_en VARCHAR(255),
        description_ar TEXT,
        description_en TEXT,
        tax_type VARCHAR(50) NOT NULL DEFAULT 'VAT',
        default_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
        branch_id INTEGER,
        branch_name_ar VARCHAR(255),
        branch_specific_rate DECIMAL(5, 2),
        is_active BOOLEAN DEFAULT TRUE,
        applicable_on VARCHAR(100) DEFAULT 'invoice',
        calculation_method VARCHAR(50) DEFAULT 'percentage',
        include_in_total BOOLEAN DEFAULT TRUE,
        is_default BOOLEAN DEFAULT FALSE,
        priority INTEGER DEFAULT 0,
        min_amount DECIMAL(10, 2),
        max_amount DECIMAL(10, 2),
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link_type VARCHAR(50),
        link_id VARCHAR(50),
        is_read BOOLEAN DEFAULT false,
        priority VARCHAR(40) DEFAULT 'NORMAL',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS training_programs (
        id SERIAL PRIMARY KEY,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        duration_hours INTEGER NOT NULL DEFAULT 0,
        max_participants INTEGER DEFAULT 30,
        price DECIMAL(10, 2) DEFAULT 0,
        passing_score INTEGER DEFAULT 70,
        certificate_validity_months INTEGER DEFAULT 12,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS beneficiaries (
        id SERIAL PRIMARY KEY,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        national_id VARCHAR(50) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        date_of_birth DATE,
        gender VARCHAR(20),
        education_level VARCHAR(100),
        occupation VARCHAR(100),
        status VARCHAR(40) DEFAULT 'ACTIVE',
        registration_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS training_sessions (
        id SERIAL PRIMARY KEY,
        program_id INTEGER REFERENCES training_programs(id) ON DELETE CASCADE,
        entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE SET NULL,
        session_code VARCHAR(50) UNIQUE NOT NULL,
        session_name VARCHAR(255) NOT NULL,
        start_date DATE DEFAULT CURRENT_DATE,
        end_date DATE DEFAULT CURRENT_DATE,
        location VARCHAR(255),
        instructor_name VARCHAR(255),
        max_participants INTEGER DEFAULT 30,
        current_participants INTEGER DEFAULT 0,
        status VARCHAR(40) DEFAULT 'PLANNED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE,
        beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
        enrollment_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(40) DEFAULT 'REGISTERED',
        attendance_percentage DECIMAL(5, 2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, beneficiary_id)
      );

      CREATE TABLE IF NOT EXISTS assessments (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE CASCADE,
        assessment_type VARCHAR(50) NOT NULL,
        assessment_date DATE DEFAULT CURRENT_DATE,
        score DECIMAL(5, 2),
        max_score DECIMAL(5, 2) DEFAULT 100,
        passed BOOLEAN DEFAULT false,
        assessor_name VARCHAR(255),
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE CASCADE,
        beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
        program_id INTEGER REFERENCES training_programs(id) ON DELETE CASCADE,
        certificate_number VARCHAR(100) UNIQUE NOT NULL,
        issue_date DATE DEFAULT CURRENT_DATE,
        expiry_date DATE,
        qr_code TEXT,
        final_score DECIMAL(5, 2),
        grade VARCHAR(40),
        status VARCHAR(40) DEFAULT 'VALID',
        issued_by VARCHAR(255),
        verification_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_users_entity_id ON users(entity_id);
      CREATE INDEX IF NOT EXISTS idx_credentials_username ON user_credentials(username);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_employee_requests_entity ON employee_requests(entity_id);
      CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);
      CREATE INDEX IF NOT EXISTS idx_installment_plan_types_active ON installment_plan_types(is_active);
      CREATE INDEX IF NOT EXISTS idx_tax_settings_active ON tax_settings(is_active);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_training_programs_entity ON training_programs(entity_id);
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_entity ON beneficiaries(entity_id);
      CREATE INDEX IF NOT EXISTS idx_training_sessions_entity ON training_sessions(entity_id);
    `);

    await seedMinimumData();
    await ensureMultiTenantHierarchy();
    await ensureHierarchyJunctionTables();
    await seedExtendedEntities();
    // Re-seed full hierarchy catalog when wiped / bootstrap-only (الفروع والحاضنات والمنصات والمكاتب)
    await ensureHierarchyCatalog(db);
    await ensureStrategicModules();
    await ensureFinanceReady();
    await verifyRequiredTables();
    console.log('✅ Database bootstrap verified required ERP tables');
  })();

  return bootstrapPromise;
}

async function seedMinimumData() {
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);

  await db.query(`
    INSERT INTO entities (id, name, type, status, balance, location, users_count, plan, expiry_date, theme)
    VALUES
      ('HQ001', 'NAIOSH HQ', 'HQ', 'Active', 0, 'Riyadh', 1, 'ENTERPRISE', '2030-12-31', 'BLUE'),
      ('BR001', 'فرع الرياض', 'BRANCH', 'Active', 0, 'Riyadh', 12, 'ENTERPRISE', '2030-12-31', 'RED'),
      ('BR002', 'فرع جدة', 'BRANCH', 'Active', 0, 'Jeddah', 8, 'PRO', '2030-12-31', 'BLUE'),
      ('BR003', 'فرع الدمام', 'BRANCH', 'Active', 0, 'Dammam', 6, 'PRO', '2030-12-31', 'TEAL'),
      ('INC03', 'Safety Incubator', 'INCUBATOR', 'Active', 0, 'Jeddah', 0, 'ENTERPRISE', '2030-12-31', 'EMERALD'),
      ('INC001', 'حاضنة الرياض التقنية', 'INCUBATOR', 'Active', 0, 'Riyadh', 0, 'PRO', '2030-12-31', 'EMERALD'),
      ('INC002', 'حاضنة القاهرة للتقنية', 'INCUBATOR', 'Active', 0, 'Cairo', 0, 'PRO', '2030-12-31', 'EMERALD'),
      ('PLT01', 'NAIOSH Cloud', 'PLATFORM', 'Active', 0, 'Cloud', 0, 'PRO', '2030-12-31', 'PURPLE'),
      ('PLT001', 'منصة التدريب المهني', 'PLATFORM', 'Active', 0, 'Cloud', 0, 'PRO', '2030-12-31', 'PURPLE'),
      ('OFF01', 'Dammam Office', 'OFFICE', 'Active', 0, 'Dammam', 0, 'BASIC', '2030-12-31', 'BLUE'),
      ('OFF001', 'مكتب خدمة العملاء - الرياض', 'OFFICE', 'Active', 0, 'Riyadh', 0, 'BASIC', '2030-12-31', 'BLUE')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (name, email, role, tenant_type, entity_id, entity_name, job_title, is_active)
    SELECT 'Super Admin', 'admin@naiosh.com', 'مسؤول النظام', 'HQ', 'HQ001', 'NAIOSH HQ', 'مدير النظام', true
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE entity_id = 'HQ001');
  `);

  await db.query(`
    INSERT INTO user_credentials (user_id, username, password_hash, is_active, failed_attempts)
    SELECT id, 'HQ001', $1, true, 0
    FROM users
    WHERE entity_id = 'HQ001'
    ORDER BY id
    LIMIT 1
    ON CONFLICT (user_id) DO NOTHING;
  `, [adminPasswordHash]);

  await db.query(`
    INSERT INTO payment_methods (method_code, method_name_ar, method_name_en, icon, color, display_order, requires_bank_details)
    VALUES
      ('bank_transfer', 'تحويل بنكي', 'Bank Transfer', 'bank', '#3b82f6', 1, true),
      ('cash', 'دفع نقداً', 'Cash Payment', 'cash', '#10b981', 2, false),
      ('credit_card', 'بطاقة ائتمان', 'Credit Card', 'card', '#a855f7', 3, false)
    ON CONFLICT (method_code) DO NOTHING;

    INSERT INTO installment_plan_types (
      plan_code, plan_name_ar, plan_name_en, duration_months, number_of_payments,
      interest_rate, badge_text, display_order, is_active
    )
    VALUES
      ('PLAN_3M', '3 أشهر', '3 Months', 3, 3, 0, 'بدون فائدة', 1, true),
      ('PLAN_6M', '6 أشهر', '6 Months', 6, 6, 2.5, 'معدل منخفض', 2, true),
      ('PLAN_12M', '12 شهر', '12 Months', 12, 12, 5, 'مرونة عالية', 3, true)
    ON CONFLICT (plan_code) DO NOTHING;

    INSERT INTO tax_settings (
      tax_code, tax_name_ar, tax_name_en, tax_type, default_rate,
      applicable_on, is_active, is_default, priority
    )
    VALUES
      ('vat_15', 'ضريبة القيمة المضافة 15%', 'VAT 15%', 'VAT', 15, 'invoice', true, true, 1),
      ('vat_5', 'ضريبة القيمة المضافة 5%', 'VAT 5%', 'VAT', 5, 'service', true, false, 2)
    ON CONFLICT (tax_code) DO NOTHING;
  `);
}

async function ensureMultiTenantHierarchy() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS headquarters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      country VARCHAR(100),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      logo_url TEXT,
      settings JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS branches (
      id SERIAL PRIMARY KEY,
      hq_id INTEGER NOT NULL REFERENCES headquarters(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      description TEXT,
      country VARCHAR(100),
      city VARCHAR(100),
      address TEXT,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      manager_name VARCHAR(255),
      settings JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(hq_id, code)
    );

    CREATE TABLE IF NOT EXISTS incubators (
      id SERIAL PRIMARY KEY,
      branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      description TEXT,
      program_type VARCHAR(100),
      capacity INTEGER DEFAULT 0,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      manager_name VARCHAR(255),
      start_date DATE,
      end_date DATE,
      settings JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(branch_id, code)
    );

    CREATE TABLE IF NOT EXISTS platforms (
      id SERIAL PRIMARY KEY,
      incubator_id INTEGER NOT NULL REFERENCES incubators(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      description TEXT,
      platform_type VARCHAR(100),
      pricing_model VARCHAR(50),
      base_price DECIMAL(10, 2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      features JSONB DEFAULT '[]',
      settings JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(incubator_id, code)
    );

    CREATE TABLE IF NOT EXISTS offices (
      id SERIAL PRIMARY KEY,
      incubator_id INTEGER NOT NULL REFERENCES incubators(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL,
      description TEXT,
      office_type VARCHAR(100),
      location VARCHAR(255),
      address TEXT,
      capacity INTEGER DEFAULT 0,
      working_hours JSONB DEFAULT '{}',
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      manager_name VARCHAR(255),
      settings JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(incubator_id, code)
    );

    CREATE TABLE IF NOT EXISTS office_platforms (
      id SERIAL PRIMARY KEY,
      office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(office_id, platform_id)
    );

    ALTER TABLE headquarters ADD COLUMN IF NOT EXISTS entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE;
    ALTER TABLE branches ADD COLUMN IF NOT EXISTS entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE;
    ALTER TABLE incubators ADD COLUMN IF NOT EXISTS entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE;
    ALTER TABLE platforms ADD COLUMN IF NOT EXISTS entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE;
    ALTER TABLE offices ADD COLUMN IF NOT EXISTS entity_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE;

    ALTER TABLE entities ADD COLUMN IF NOT EXISTS tenant_type VARCHAR(50);
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS hq_id INTEGER REFERENCES headquarters(id);
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS incubator_id INTEGER REFERENCES incubators(id);
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS platform_id INTEGER REFERENCES platforms(id);
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES offices(id);

    CREATE INDEX IF NOT EXISTS idx_headquarters_entity_id ON headquarters(entity_id);
    CREATE INDEX IF NOT EXISTS idx_branches_hq ON branches(hq_id);
    CREATE INDEX IF NOT EXISTS idx_branches_entity_id ON branches(entity_id);
    CREATE INDEX IF NOT EXISTS idx_incubators_branch ON incubators(branch_id);
    CREATE INDEX IF NOT EXISTS idx_incubators_entity_id ON incubators(entity_id);
    CREATE INDEX IF NOT EXISTS idx_platforms_incubator ON platforms(incubator_id);
    CREATE INDEX IF NOT EXISTS idx_platforms_entity_id ON platforms(entity_id);
    CREATE INDEX IF NOT EXISTS idx_offices_incubator ON offices(incubator_id);
    CREATE INDEX IF NOT EXISTS idx_offices_entity_id ON offices(entity_id);
    CREATE INDEX IF NOT EXISTS idx_office_platforms_office ON office_platforms(office_id);
    CREATE INDEX IF NOT EXISTS idx_office_platforms_platform ON office_platforms(platform_id);

    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  const triggerTables = ['headquarters', 'branches', 'incubators', 'platforms', 'offices'];
  for (const tableName of triggerTables) {
    await db.query(`
      DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName};
      CREATE TRIGGER update_${tableName}_updated_at
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  await db.query(`
    INSERT INTO headquarters (name, code, description, country, contact_email, entity_id)
    VALUES ('NAIOSH HQ', 'HQ-001', 'المقر الرئيسي لنظام نايوش', 'Saudi Arabia', 'hq@naiosh.com', 'HQ001')
    ON CONFLICT (code) DO UPDATE
      SET entity_id = COALESCE(headquarters.entity_id, EXCLUDED.entity_id),
          name = EXCLUDED.name,
          is_active = true;

    INSERT INTO branches (hq_id, name, code, country, city, contact_email)
    SELECT hq.id, 'فرع المملكة العربية السعودية', 'BR-SA', 'Saudi Arabia', 'Riyadh', 'sa@naiosh.com'
    FROM headquarters hq
    WHERE hq.code = 'HQ-001'
    ON CONFLICT (hq_id, code) DO NOTHING;

    INSERT INTO branches (hq_id, name, code, country, city, contact_email)
    SELECT hq.id, 'فرع جمهورية مصر العربية', 'BR-EG', 'Egypt', 'Cairo', 'eg@naiosh.com'
    FROM headquarters hq
    WHERE hq.code = 'HQ-001'
    ON CONFLICT (hq_id, code) DO NOTHING;

    INSERT INTO incubators (branch_id, name, code, program_type, capacity, entity_id)
    SELECT b.id, 'Safety Incubator', 'INC-SA-01', 'احتضان أعمال', 50, 'INC03'
    FROM branches b
    WHERE b.code = 'BR-SA'
    ON CONFLICT (branch_id, code) DO UPDATE
      SET entity_id = COALESCE(incubators.entity_id, EXCLUDED.entity_id);

    INSERT INTO platforms (incubator_id, name, code, platform_type, pricing_model, base_price, entity_id)
    SELECT i.id, 'NAIOSH Cloud', 'PLT-CS-01', 'خدمات تقنية', 'اشتراك شهري', 99.99, 'PLT01'
    FROM incubators i
    WHERE i.code = 'INC-SA-01'
    ON CONFLICT (incubator_id, code) DO UPDATE
      SET entity_id = COALESCE(platforms.entity_id, EXCLUDED.entity_id);

    INSERT INTO offices (incubator_id, name, code, office_type, capacity, entity_id)
    SELECT i.id, 'Dammam Office', 'OFF-SA-CS', 'مركز خدمة', 20, 'OFF01'
    FROM incubators i
    WHERE i.code = 'INC-SA-01'
    ON CONFLICT (incubator_id, code) DO UPDATE
      SET entity_id = COALESCE(offices.entity_id, EXCLUDED.entity_id);

    INSERT INTO office_platforms (office_id, platform_id)
    SELECT o.id, p.id
    FROM offices o
    JOIN platforms p ON p.code = 'PLT-CS-01'
    WHERE o.code = 'OFF-SA-CS'
    ON CONFLICT (office_id, platform_id) DO NOTHING;

    UPDATE headquarters SET entity_id = 'HQ001' WHERE entity_id IS NULL;
  `);

  console.log('✅ Multi-tenant hierarchy tables verified');
}

async function ensureHierarchyJunctionTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS branch_incubators (
      id SERIAL PRIMARY KEY,
      branch_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      incubator_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      relationship_status VARCHAR(20) DEFAULT 'ACTIVE',
      assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      UNIQUE(branch_id, incubator_id)
    );

    CREATE TABLE IF NOT EXISTS branch_platforms (
      id SERIAL PRIMARY KEY,
      branch_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      platform_id VARCHAR(120) REFERENCES entities(id) ON DELETE CASCADE,
      relationship_status VARCHAR(20) DEFAULT 'ACTIVE',
      assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      performance_score DECIMAL(5,2),
      monthly_revenue DECIMAL(10,2),
      notes TEXT,
      UNIQUE(branch_id, platform_id)
    );

    CREATE INDEX IF NOT EXISTS idx_branch_incubators_branch ON branch_incubators(branch_id);
    CREATE INDEX IF NOT EXISTS idx_branch_incubators_incubator ON branch_incubators(incubator_id);
    CREATE INDEX IF NOT EXISTS idx_branch_platforms_branch ON branch_platforms(branch_id);
    CREATE INDEX IF NOT EXISTS idx_branch_platforms_platform ON branch_platforms(platform_id);
  `);

  console.log('✅ Hierarchy junction tables verified');
}

async function seedExtendedEntities() {
  await db.query(`
    INSERT INTO branch_incubators (branch_id, incubator_id, relationship_status)
    VALUES
      ('BR001', 'INC001', 'ACTIVE'),
      ('BR001', 'INC03', 'ACTIVE'),
      ('BR002', 'INC03', 'ACTIVE'),
      ('BR003', 'INC002', 'ACTIVE')
    ON CONFLICT (branch_id, incubator_id) DO NOTHING;

    INSERT INTO branch_platforms (branch_id, platform_id, relationship_status, performance_score, monthly_revenue)
    VALUES
      ('BR001', 'PLT001', 'ACTIVE', 88.5, 45000),
      ('BR001', 'PLT01', 'ACTIVE', 92.0, 52000),
      ('BR002', 'PLT01', 'ACTIVE', 85.0, 38000),
      ('BR003', 'PLT001', 'ACTIVE', 79.5, 22000)
    ON CONFLICT (branch_id, platform_id) DO NOTHING;

    INSERT INTO ads (title, content, level, scope, status, source_entity_id, source_type, entity_id, cost, budget, start_date, end_date)
    SELECT 'حملة نايوش الربع الأول', 'حملة ترويجية للمنصة', 'L5_CROSS_INC', 'GLOBAL', 'ACTIVE', 'HQ001', 'HQ', 'HQ001', 15000, 50000, CURRENT_DATE, CURRENT_DATE + 90
    WHERE NOT EXISTS (SELECT 1 FROM ads WHERE title = 'حملة نايوش الربع الأول');

    INSERT INTO ads (title, content, level, scope, status, source_entity_id, source_type, entity_id, cost, budget, start_date, end_date)
    SELECT 'إعلان فرع الرياض', 'ترويج خدمات الفرع', 'L1_LOCAL', 'LOCAL', 'ACTIVE', 'BR001', 'BRANCH', 'BR001', 5000, 15000, CURRENT_DATE, CURRENT_DATE + 30
    WHERE NOT EXISTS (SELECT 1 FROM ads WHERE title = 'إعلان فرع الرياض');

    INSERT INTO ads (title, content, level, scope, status, source_entity_id, source_type, entity_id, cost, budget, start_date, end_date)
    SELECT 'منصة التدريب', 'إعلان برامج التدريب', 'L4_PLT_INT', 'PLATFORM', 'ACTIVE', 'PLT001', 'PLATFORM', 'PLT001', 3000, 10000, CURRENT_DATE, CURRENT_DATE + 45
    WHERE NOT EXISTS (SELECT 1 FROM ads WHERE title = 'منصة التدريب');

    INSERT INTO employee_requests (id, entity_id, employee_name, request_type, request_title, description, status, priority, requested_date)
    VALUES
      ('REQ-001', 'HQ001', 'أحمد محمد', 'LEAVE', 'طلب إجازة سنوية', 'إجازة لمدة 5 أيام', 'PENDING', 'NORMAL', CURRENT_DATE),
      ('REQ-002', 'BR001', 'سارة علي', 'TRAINING', 'طلب تدريب', 'دورة إدارة المشاريع', 'APPROVED', 'HIGH', CURRENT_DATE),
      ('REQ-003', 'BR002', 'خالد يوسف', 'GENERAL', 'استفسار فاتورة', 'استفسار عن فاتورة الاشتراك', 'PENDING', 'NORMAL', CURRENT_DATE)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO invoices (id, entity_id, type, title, amount, paid_amount, status, issue_date, due_date, customer_name)
    VALUES
      ('INV-001', 'BR001', 'SUBSCRIPTION', 'اشتراك سنوي - فرع الرياض', 12000, 12000, 'PAID', CURRENT_DATE - 30, CURRENT_DATE + 335, 'شركة المدار'),
      ('INV-002', 'BR002', 'SERVICE', 'خدمات تدريب', 8500, 4000, 'PARTIAL', CURRENT_DATE - 15, CURRENT_DATE + 15, 'مؤسسة الحلول'),
      ('INV-003', 'PLT01', 'SUBSCRIPTION', 'اشتراك منصة سحابية', 24000, 0, 'UNPAID', CURRENT_DATE, CURRENT_DATE + 30, 'مجموعة الريادة')
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log('✅ Extended entity and sample operational data seeded');
}

async function ensureStrategicModules() {
  const strategicSql = path.join(__dirname, 'create-strategic-management-tables.sql');
  const missingSql = path.join(__dirname, 'create-missing-strategic-tables.sql');
  const seedSql = path.join(__dirname, 'insert-strategic-management-data.sql');
  const rbacSql = path.join(__dirname, 'create-rbac-system.sql');

  if (fs.existsSync(strategicSql)) {
    await db.query(readSqlFile(strategicSql));
  }

  const missingTable = await db.query("SELECT to_regclass('public.financial_manual') AS table_name");
  if (!missingTable.rows[0].table_name && fs.existsSync(missingSql)) {
    await db.query(readSqlFile(missingSql));
  }

  if (fs.existsSync(rbacSql)) {
    await db.query(readSqlFile(rbacSql));
  }

  await db.query(`
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS job_title_ar VARCHAR(200);
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS job_title_en VARCHAR(200);
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS max_approval_limit NUMERIC(15,2);
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS approval_notes_ar TEXT;
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

    INSERT INTO roles (name, name_ar, description, level, is_system, hierarchy_level, job_title_ar, max_approval_limit)
    VALUES
      ('SUPER_ADMIN', 'سوبر آدمن', 'صلاحيات كاملة على جميع مستويات النظام', 'HQ', true, 1, 'مسؤول النظام', 999999999),
      ('HQ_EXECUTIVE_MANAGER', 'مدير تنفيذي', 'مدير تنفيذي في المكتب الرئيسي', 'HQ', false, 2, 'مدير تنفيذي', 500000),
      ('BRANCH_MANAGER', 'مدير فرع', 'مدير فرع', 'BRANCH', false, 3, 'مدير فرع', 100000)
    ON CONFLICT (name) DO NOTHING;
  `);

  const kpiCount = await db.query('SELECT COUNT(*)::int AS count FROM executive_kpis');
  if (kpiCount.rows[0].count === 0 && fs.existsSync(seedSql)) {
    await db.query(readSqlFile(seedSql));
  }

  console.log('✅ Strategic management and RBAC modules verified');
}

async function verifyRequiredTables() {
  const result = await db.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `,
    [REQUIRED_TABLES]
  );
  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((tableName) => !found.has(tableName));
  if (missing.length > 0) {
    throw new Error(`Missing required ERP tables: ${missing.join(', ')}`);
  }
}

module.exports = {
  REQUIRED_TABLES,
  ensureDatabaseReady
};
