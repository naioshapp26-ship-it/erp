const db = require('./db');

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
  'certificates'
];

let bootstrapPromise = null;

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
    await verifyRequiredTables();
    console.log('✅ Database bootstrap verified required ERP tables');
  })();

  return bootstrapPromise;
}

async function seedMinimumData() {
  await db.query(`
    INSERT INTO entities (id, name, type, status, balance, location, users_count, plan, expiry_date, theme)
    VALUES
      ('HQ001', 'NAIOSH HQ', 'HQ', 'Active', 0, 'Riyadh', 1, 'ENTERPRISE', '2030-12-31', 'BLUE'),
      ('INC03', 'Safety Incubator', 'INCUBATOR', 'Active', 0, 'Jeddah', 0, 'ENTERPRISE', '2030-12-31', 'EMERALD'),
      ('PLT01', 'NAIOSH Cloud', 'PLATFORM', 'Active', 0, 'Cloud', 0, 'PRO', '2030-12-31', 'PURPLE'),
      ('OFF01', 'Dammam Office', 'OFFICE', 'Active', 0, 'Dammam', 0, 'BASIC', '2030-12-31', 'BLUE')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (name, email, role, tenant_type, entity_id, entity_name, job_title, is_active)
    SELECT 'Super Admin', 'admin@naiosh.com', 'مسؤول النظام', 'HQ', 'HQ001', 'NAIOSH HQ', 'مدير النظام', true
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE entity_id = 'HQ001');

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
