-- ========================================
-- نظام محاسبي متكامل - NAIOSH Finance System
-- ========================================
-- Based on 44-page accounting system specification
-- Created: 2026-01-26
-- ========================================

-- ========================================
-- 1. شجرة الحسابات (Chart of Accounts)
-- ========================================

-- جدول شجرة الحسابات الرئيسي
CREATE TABLE IF NOT EXISTS finance_accounts (
    account_id SERIAL PRIMARY KEY,
    account_code VARCHAR(20) UNIQUE NOT NULL,
    account_name_ar VARCHAR(200) NOT NULL,
    account_name_en VARCHAR(200),
    account_type VARCHAR(50) NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    parent_account_id INTEGER REFERENCES finance_accounts(account_id),
    level INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    is_header BOOLEAN DEFAULT false, -- حساب رئيسي أم فرعي
    normal_balance VARCHAR(10) DEFAULT 'DEBIT', -- DEBIT or CREDIT
    
    -- الربط بالكيانات
    entity_type VARCHAR(20), -- HQ, BRANCH, INCUBATOR, PLATFORM, OFFICE
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    office_id VARCHAR(50),
    
    -- معلومات إضافية
    description TEXT,
    notes TEXT,

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- الفهارس لشجرة الحسابات
CREATE INDEX IF NOT EXISTS idx_finance_accounts_code ON finance_accounts(account_code);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_type ON finance_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_entity ON finance_accounts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_parent ON finance_accounts(parent_account_id);

-- ========================================
-- 2. القيود المحاسبية (Journal Entries)
-- ========================================

-- جدول القيود المحاسبية الرئيسي
CREATE TABLE IF NOT EXISTS finance_journal_entries (
    entry_id SERIAL PRIMARY KEY,
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    entry_date DATE NOT NULL,
    entry_type VARCHAR(50) DEFAULT 'MANUAL', -- MANUAL, AUTO, INVOICE, PAYMENT, PAYROLL, ADJUSTMENT
    
    -- الوصف
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    reference_type VARCHAR(50), -- INVOICE, PAYMENT, PAYROLL, etc.
    reference_id INTEGER,
    
    -- الحالة
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, POSTED, APPROVED, CANCELLED
    is_posted BOOLEAN DEFAULT false,
    posted_at TIMESTAMP,
    posted_by VARCHAR(100),
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    office_id VARCHAR(50),
    
    -- الفترة المحاسبية
    fiscal_year INTEGER,
    fiscal_period INTEGER,
    is_adjusting BOOLEAN DEFAULT false,
    
    -- المرفقات
    attachments JSONB,
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP
);

-- جدول سطور القيود المحاسبية
CREATE TABLE IF NOT EXISTS finance_journal_lines (
    line_id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES finance_journal_entries(entry_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- الحساب
    account_id INTEGER NOT NULL REFERENCES finance_accounts(account_id),
    account_code VARCHAR(20) NOT NULL,
    
    -- المبالغ
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    
    -- الوصف
    description TEXT,
    
    -- الأبعاد المالية (Cost Centers, Projects, etc.)
    cost_center_id INTEGER,
    project_id INTEGER,
    department_id INTEGER,
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    )
);

-- الفهارس للقيود المحاسبية
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON finance_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON finance_journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entity ON finance_journal_entries(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON finance_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON finance_journal_lines(entry_id);

-- ========================================
-- 3. الفواتير والعملاء (Invoices & Customers)
-- ========================================

-- جدول العملاء المحاسبي
CREATE TABLE IF NOT EXISTS finance_customers (
    customer_id SERIAL PRIMARY KEY,
    customer_code VARCHAR(50) UNIQUE NOT NULL,
    customer_name_ar VARCHAR(200) NOT NULL,
    customer_name_en VARCHAR(200),
    customer_type VARCHAR(50) DEFAULT 'INDIVIDUAL', -- INDIVIDUAL, COMPANY, GOVERNMENT
    company_name VARCHAR(200),
    website VARCHAR(200),
    
    -- معلومات الاتصال
    email VARCHAR(200),
    email_secondary VARCHAR(200),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    mobile_secondary VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Saudi Arabia',

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),

    -- عنوان الشحن
    shipping_copy_billing BOOLEAN DEFAULT true,
    shipping_street_name VARCHAR(200),
    shipping_city VARCHAR(100),
    shipping_region VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    
    -- معلومات ضريبية
    tax_number VARCHAR(50),
    commercial_registration VARCHAR(50),
    
    -- الحد الائتماني
    credit_limit DECIMAL(15,2) DEFAULT 0,
    credit_period_days INTEGER DEFAULT 30,
    payment_terms TEXT,
    
    -- AI Risk Score
    risk_score INTEGER DEFAULT 50, -- 0-100
    risk_level VARCHAR(20) DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    risk_factors JSONB,
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    program_id INTEGER,
    
    -- الحالة
    is_active BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    blocked_reason TEXT,
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- جدول الفواتير
CREATE TABLE IF NOT EXISTS finance_invoices (
    invoice_id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    
    -- العميل
    customer_id INTEGER NOT NULL REFERENCES finance_customers(customer_id),
    customer_name VARCHAR(200),

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- المبالغ
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) DEFAULT 0,
    
    -- الحالة
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, ISSUED, PARTIAL, PAID, CANCELLED, OVERDUE
    payment_status VARCHAR(20) DEFAULT 'UNPAID', -- UNPAID, PARTIAL, PAID
    
    -- سياسة الدفع
    allow_partial_payment BOOLEAN DEFAULT true,
    allow_installments BOOLEAN DEFAULT false,
    
    -- الربط بالبرامج والخدمات
    program_id INTEGER,
    service_id INTEGER,
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    office_id VARCHAR(50),
    
    -- القيد المحاسبي المرتبط
    journal_entry_id INTEGER REFERENCES finance_journal_entries(entry_id),
    
    -- معلومات إضافية
    notes TEXT,
    terms_conditions TEXT,
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    cancelled_by VARCHAR(100),
    cancelled_at TIMESTAMP,
    cancelled_reason TEXT
);

-- جدول سطور الفواتير
CREATE TABLE IF NOT EXISTS finance_invoice_lines (
    line_id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES finance_invoices(invoice_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- الصنف/الخدمة
    item_code VARCHAR(50),
    item_name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- الكمية والسعر
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 15, -- VAT 15%
    tax_amount DECIMAL(15,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    
    -- الربط بالحسابات
    revenue_account_id INTEGER REFERENCES finance_accounts(account_id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- الفهارس للفواتير
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON finance_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON finance_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_entity ON finance_invoices(entity_type, entity_id);

-- ========================================
-- 4. المدفوعات وخطط الدفع (Payments & Payment Plans)
-- ========================================

-- جدول المدفوعات
CREATE TABLE IF NOT EXISTS finance_payments (
    payment_id SERIAL PRIMARY KEY,
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    payment_date DATE NOT NULL,
    
    -- العميل
    customer_id INTEGER NOT NULL REFERENCES finance_customers(customer_id),
    customer_name VARCHAR(200),

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- المبلغ
    payment_amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- CASH, BANK_TRANSFER, CREDIT_CARD, MADA, etc.
    
    -- نوع الدفع
    payment_type VARCHAR(20) DEFAULT 'FULL', -- FULL, PARTIAL
    
    -- معلومات الدفع
    bank_name VARCHAR(100),
    check_number VARCHAR(50),
    transaction_reference VARCHAR(100),
    
    -- الحالة
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    
    -- القيد المحاسبي المرتبط
    journal_entry_id INTEGER REFERENCES finance_journal_entries(entry_id),
    
    -- ملاحظات
    notes TEXT,
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP
);

-- جدول ربط المدفوعات بالفواتير
CREATE TABLE IF NOT EXISTS finance_payment_allocations (
    allocation_id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES finance_payments(payment_id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES finance_invoices(invoice_id),
    allocated_amount DECIMAL(15,2) NOT NULL,

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_allocated_positive CHECK (allocated_amount > 0)
);

-- جدول خطط الدفع
CREATE TABLE IF NOT EXISTS finance_payment_plans (
    plan_id SERIAL PRIMARY KEY,
    plan_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- العميل والفاتورة
    customer_id INTEGER NOT NULL REFERENCES finance_customers(customer_id),
    invoice_id INTEGER REFERENCES finance_invoices(invoice_id),

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- التواريخ
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- المبالغ
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2),
    
    -- الأقساط
    number_of_installments INTEGER NOT NULL,
    installment_amount DECIMAL(15,2) NOT NULL,
    installment_frequency VARCHAR(20) DEFAULT 'MONTHLY', -- WEEKLY, MONTHLY, QUARTERLY
    
    -- الحالة
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, DEFAULTED, CANCELLED
    
    -- AI Risk Assessment at Creation
    risk_score_at_creation INTEGER,
    risk_level_at_creation VARCHAR(20),
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP
);

-- جدول أقساط خطط الدفع
CREATE TABLE IF NOT EXISTS finance_plan_installments (
    installment_id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES finance_payment_plans(plan_id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    
    -- التواريخ والمبالغ
    due_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    
    -- الحالة
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, OVERDUE, WAIVED
    paid_date DATE,
    
    -- الربط بالدفعات
    payment_id INTEGER REFERENCES finance_payments(payment_id),

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- الفهارس للمدفوعات
CREATE INDEX IF NOT EXISTS idx_payments_customer ON finance_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON finance_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON finance_payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_customer ON finance_payment_plans(customer_id);

-- ========================================
-- 5. الميزانيات التقديرية (Budgets)
-- ========================================

-- جدول الميزانيات
CREATE TABLE IF NOT EXISTS finance_budgets (
    budget_id SERIAL PRIMARY KEY,
    budget_code VARCHAR(50) UNIQUE NOT NULL,
    budget_name_ar VARCHAR(200) NOT NULL,
    budget_name_en VARCHAR(200),
    
    -- النوع والسنة
    budget_type VARCHAR(50) NOT NULL, -- REVENUE, EXPENSE, CASHFLOW, CAPITAL
    fiscal_year INTEGER NOT NULL,
    
    -- السيناريو
    scenario VARCHAR(50) DEFAULT 'BASE', -- BASE, OPTIMISTIC, CONSERVATIVE
    
    -- الحالة
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, APPROVED, ACTIVE, CLOSED
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    program_id INTEGER,
    
    -- ملاحظات
    description TEXT,
    assumptions TEXT,

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP
);

-- جدول سطور الميزانية
CREATE TABLE IF NOT EXISTS finance_budget_lines (
    line_id SERIAL PRIMARY KEY,
    budget_id INTEGER NOT NULL REFERENCES finance_budgets(budget_id) ON DELETE CASCADE,
    
    -- الحساب
    account_id INTEGER NOT NULL REFERENCES finance_accounts(account_id),
    account_code VARCHAR(20),
    account_name VARCHAR(200),
    
    -- المبلغ السنوي
    annual_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- التوزيع الشهري
    month_1 DECIMAL(15,2) DEFAULT 0,
    month_2 DECIMAL(15,2) DEFAULT 0,
    month_3 DECIMAL(15,2) DEFAULT 0,
    month_4 DECIMAL(15,2) DEFAULT 0,
    month_5 DECIMAL(15,2) DEFAULT 0,
    month_6 DECIMAL(15,2) DEFAULT 0,
    month_7 DECIMAL(15,2) DEFAULT 0,
    month_8 DECIMAL(15,2) DEFAULT 0,
    month_9 DECIMAL(15,2) DEFAULT 0,
    month_10 DECIMAL(15,2) DEFAULT 0,
    month_11 DECIMAL(15,2) DEFAULT 0,
    month_12 DECIMAL(15,2) DEFAULT 0,
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول الانحرافات (Variance Analysis)
CREATE TABLE IF NOT EXISTS finance_budget_variances (
    variance_id SERIAL PRIMARY KEY,
    
    -- الفترة
    fiscal_year INTEGER NOT NULL,
    fiscal_period INTEGER NOT NULL,
    period_name VARCHAR(50),
    
    -- الحساب
    account_id INTEGER NOT NULL REFERENCES finance_accounts(account_id),
    account_code VARCHAR(20),
    
    -- المبالغ
    budgeted_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    actual_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    variance_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    variance_percentage DECIMAL(8,2) DEFAULT 0,
    
    -- التصنيف
    variance_type VARCHAR(20), -- FAVORABLE, UNFAVORABLE
    significance_level VARCHAR(20), -- LOW, MEDIUM, HIGH, CRITICAL
    
    -- AI Commentary
    ai_explanation TEXT,
    ai_recommendations TEXT,
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    analyzed_at TIMESTAMP
);

-- الفهارس للميزانيات
CREATE INDEX IF NOT EXISTS idx_budgets_year ON finance_budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budgets_entity ON finance_budgets(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_account ON finance_budget_lines(account_id);

-- ========================================
-- 6. التقارير والتحليلات المالية
-- ========================================

-- جدول التدفقات النقدية
CREATE TABLE IF NOT EXISTS finance_cashflow (
    cashflow_id SERIAL PRIMARY KEY,
    
    -- الفترة
    transaction_date DATE NOT NULL,
    fiscal_year INTEGER,
    fiscal_period INTEGER,
    
    -- النوع
    flow_type VARCHAR(50) NOT NULL, -- OPERATING, INVESTING, FINANCING
    flow_category VARCHAR(100),
    
    -- المبلغ
    amount DECIMAL(15,2) NOT NULL,
    flow_direction VARCHAR(10) NOT NULL, -- IN, OUT
    
    -- الوصف
    description TEXT,
    reference_type VARCHAR(50),
    reference_id INTEGER,

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    
    -- القيد المحاسبي
    journal_entry_id INTEGER REFERENCES finance_journal_entries(entry_id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول توقعات الذكاء الاصطناعي
CREATE TABLE IF NOT EXISTS finance_ai_forecasts (
    forecast_id SERIAL PRIMARY KEY,
    
    -- نوع التوقع
    forecast_type VARCHAR(50) NOT NULL, -- REVENUE, EXPENSE, COLLECTION, CASHFLOW
    
    -- الفترة
    forecast_period VARCHAR(50) NOT NULL, -- MONTHLY, QUARTERLY, ANNUAL
    forecast_date DATE NOT NULL,
    start_date DATE,
    end_date DATE,
    
    -- القيمة المتوقعة
    forecasted_value DECIMAL(15,2) NOT NULL,
    confidence_level DECIMAL(5,2), -- 0-100%
    
    -- النطاق
    lower_bound DECIMAL(15,2),
    upper_bound DECIMAL(15,2),
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    
    -- البيانات والنموذج
    model_version VARCHAR(50),
    input_data JSONB,
    model_parameters JSONB,

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- القيمة الفعلية (للمقارنة لاحقاً)
    actual_value DECIMAL(15,2),
    accuracy_score DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    evaluated_at TIMESTAMP
);

-- جدول تقييم المخاطر بالذكاء الاصطناعي
CREATE TABLE IF NOT EXISTS finance_ai_risk_scores (
    risk_id SERIAL PRIMARY KEY,
    
    -- العميل
    customer_id INTEGER REFERENCES finance_customers(customer_id),
    
    -- التاريخ
    assessment_date DATE NOT NULL,
    
    -- درجة المخاطر
    risk_score INTEGER NOT NULL, -- 0-100
    risk_level VARCHAR(20) NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    
    -- العوامل
    risk_factors JSONB,
    calculation_details JSONB,
    
    -- التوصيات
    recommendations TEXT,
    suggested_actions JSONB,

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    
    -- النموذج
    model_version VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- الفهارس للتقارير والتحليلات
CREATE INDEX IF NOT EXISTS idx_cashflow_date ON finance_cashflow(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cashflow_type ON finance_cashflow(flow_type);
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_type ON finance_ai_forecasts(forecast_type);
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_date ON finance_ai_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_ai_risks_customer ON finance_ai_risk_scores(customer_id);

-- ========================================
-- 7. الأصول الثابتة (Fixed Assets)
-- ========================================

CREATE TABLE IF NOT EXISTS finance_fixed_assets (
    asset_id SERIAL PRIMARY KEY,
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    asset_name_ar VARCHAR(200) NOT NULL,
    asset_name_en VARCHAR(200),
    
    -- التصنيف
    asset_category VARCHAR(100), -- BUILDINGS, EQUIPMENT, VEHICLES, FURNITURE, IT
    asset_type VARCHAR(100),
    
    -- القيمة
    purchase_date DATE NOT NULL,
    purchase_cost DECIMAL(15,2) NOT NULL,
    salvage_value DECIMAL(15,2) DEFAULT 0,
    depreciable_value DECIMAL(15,2),
    
    -- الإهلاك
    depreciation_method VARCHAR(50) DEFAULT 'STRAIGHT_LINE', -- STRAIGHT_LINE, DECLINING_BALANCE
    useful_life_years INTEGER NOT NULL,
    useful_life_months INTEGER,
    accumulated_depreciation DECIMAL(15,2) DEFAULT 0,
    net_book_value DECIMAL(15,2),
    
    -- الحالة
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, DISPOSED, SOLD, RETIRED
    disposal_date DATE,
    disposal_value DECIMAL(15,2),
    
    -- الموقع
    location VARCHAR(200),
    custodian_employee_id INTEGER,

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    office_id VARCHAR(50),
    
    -- الربط بالحسابات
    asset_account_id INTEGER REFERENCES finance_accounts(account_id),
    depreciation_account_id INTEGER REFERENCES finance_accounts(account_id),
    accumulated_depreciation_account_id INTEGER REFERENCES finance_accounts(account_id),
    
    -- ملاحظات
    serial_number VARCHAR(100),
    warranty_expiry_date DATE,
    maintenance_schedule TEXT,
    notes TEXT,
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- جدول حركات إهلاك الأصول
CREATE TABLE IF NOT EXISTS finance_asset_depreciation (
    depreciation_id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES finance_fixed_assets(asset_id),
    
    -- الفترة
    depreciation_date DATE NOT NULL,
    fiscal_year INTEGER,
    fiscal_period INTEGER,
    
    -- المبلغ
    depreciation_amount DECIMAL(15,2) NOT NULL,
    accumulated_depreciation DECIMAL(15,2),
    net_book_value DECIMAL(15,2),
    
    -- القيد المحاسبي
    journal_entry_id INTEGER REFERENCES finance_journal_entries(entry_id),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- الفهارس للأصول
CREATE INDEX IF NOT EXISTS idx_assets_code ON finance_fixed_assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_category ON finance_fixed_assets(asset_category);
CREATE INDEX IF NOT EXISTS idx_assets_status ON finance_fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_asset_depreciation_date ON finance_asset_depreciation(depreciation_date);

-- ========================================
-- 8. الموردين والمصروفات (Vendors & Expenses)
-- ========================================

CREATE TABLE IF NOT EXISTS finance_vendors (
    vendor_id SERIAL PRIMARY KEY,
    vendor_code VARCHAR(50) UNIQUE NOT NULL,
    vendor_name_ar VARCHAR(200) NOT NULL,
    vendor_name_en VARCHAR(200),
    vendor_type VARCHAR(50) DEFAULT 'SUPPLIER', -- SUPPLIER, CONTRACTOR, SERVICE_PROVIDER
    
    -- معلومات الاتصال
    email VARCHAR(200),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Saudi Arabia',

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    -- معلومات ضريبية
    tax_number VARCHAR(50),
    commercial_registration VARCHAR(50),
    
    -- شروط الدفع
    payment_terms VARCHAR(200),
    payment_term_days INTEGER DEFAULT 30,
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    
    -- الحالة
    is_active BOOLEAN DEFAULT true,
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS finance_expenses (
    expense_id SERIAL PRIMARY KEY,
    expense_number VARCHAR(50) UNIQUE NOT NULL,
    expense_date DATE NOT NULL,
    
    -- الفئة
    expense_category VARCHAR(100) NOT NULL, -- OPERATIONAL, ADMINISTRATIVE, PROGRAM, MARKETING, TECH
    expense_type VARCHAR(100),
    
    -- المورد
    vendor_id INTEGER REFERENCES finance_vendors(vendor_id),
    vendor_name VARCHAR(200),
    
    -- المبلغ
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    
    -- الحالة
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, PAID, REJECTED
    
    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    
    -- القيد المحاسبي
    journal_entry_id INTEGER REFERENCES finance_journal_entries(entry_id),
    
    -- المرفقات
    invoice_number VARCHAR(100),
    receipt_file VARCHAR(500),
    attachments JSONB,

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),
    
    description TEXT,
    notes TEXT,
    
    -- التدقيق
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP
);

-- الفهارس للموردين والمصروفات
CREATE INDEX IF NOT EXISTS idx_vendors_code ON finance_vendors(vendor_code);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON finance_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON finance_expenses(expense_category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON finance_expenses(status);

-- ========================================
-- 9. Views للتقارير السريعة
-- ========================================

-- عرض الأرصدة الحالية للحسابات
CREATE OR REPLACE VIEW finance_account_balances AS
SELECT 
    a.account_id,
    a.account_code,
    a.account_name_ar,
    a.account_type,
    a.entity_type,
    a.entity_id,
    COALESCE(SUM(jl.debit_amount), 0) as total_debit,
    COALESCE(SUM(jl.credit_amount), 0) as total_credit,
    CASE 
        WHEN a.normal_balance = 'DEBIT' THEN 
            COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0)
        ELSE 
            COALESCE(SUM(jl.credit_amount), 0) - COALESCE(SUM(jl.debit_amount), 0)
    END as balance
FROM finance_accounts a
LEFT JOIN finance_journal_lines jl ON a.account_id = jl.account_id
LEFT JOIN finance_journal_entries je ON jl.entry_id = je.entry_id AND je.is_posted = true
WHERE a.is_active = true
GROUP BY a.account_id, a.account_code, a.account_name_ar, a.account_type, 
         a.entity_type, a.entity_id, a.normal_balance;

-- عرض تقرير الذمم المدينة (Accounts Receivable Aging)
CREATE OR REPLACE VIEW finance_ar_aging AS
SELECT 
    i.invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    c.customer_id,
    c.customer_code,
    c.customer_name_ar,
    i.total_amount,
    i.paid_amount,
    i.remaining_amount,
    i.status,
    CURRENT_DATE - i.due_date as days_overdue,
    CASE 
        WHEN CURRENT_DATE <= i.due_date THEN 'CURRENT'
        WHEN CURRENT_DATE - i.due_date BETWEEN 1 AND 30 THEN '1-30_DAYS'
        WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN '31-60_DAYS'
        WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND 90 THEN '61-90_DAYS'
        ELSE 'OVER_90_DAYS'
    END as aging_category,
    i.entity_type,
    i.entity_id,
    i.branch_id,
    i.incubator_id
FROM finance_invoices i
JOIN finance_customers c ON i.customer_id = c.customer_id
WHERE i.remaining_amount > 0 
  AND i.status IN ('ISSUED', 'PARTIAL', 'OVERDUE');

-- عرض ملخص التدفقات النقدية
CREATE OR REPLACE VIEW finance_cashflow_summary AS
SELECT 
    flow_type,
    fiscal_year,
    fiscal_period,
    entity_type,
    entity_id,
    SUM(CASE WHEN flow_direction = 'IN' THEN amount ELSE 0 END) as cash_in,
    SUM(CASE WHEN flow_direction = 'OUT' THEN amount ELSE 0 END) as cash_out,
    SUM(CASE WHEN flow_direction = 'IN' THEN amount ELSE -amount END) as net_cashflow
FROM finance_cashflow
GROUP BY flow_type, fiscal_year, fiscal_period, entity_type, entity_id;

-- ========================================
-- 9. منظومة الرواتب (Payroll)
-- ========================================

-- الموظفون والمتعاونون
CREATE TABLE IF NOT EXISTS finance_payroll_employees (
    employee_id SERIAL PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name_ar VARCHAR(200) NOT NULL,
    full_name_en VARCHAR(200),
    employment_type VARCHAR(20) DEFAULT 'EMPLOYEE', -- EMPLOYEE, CONTRACTOR
    hire_date DATE,
    end_date DATE,
    base_salary DECIMAL(15,2) DEFAULT 0,

    -- بيانات بنكية
    bank_name VARCHAR(150),
    bank_iban VARCHAR(60),
    bank_account VARCHAR(60),

    -- بيانات العنوان
    street_name VARCHAR(200),
    postal_code VARCHAR(20),
    building_number VARCHAR(20),
    city VARCHAR(100),
    district VARCHAR(100),
    national_address_number VARCHAR(50),
    short_address VARCHAR(200),

    -- أرقام الاشتراكات
    social_insurance_number VARCHAR(80),
    insurance_number VARCHAR(80),

    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    office_id VARCHAR(50),

    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employees_entity ON finance_payroll_employees(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employees_active ON finance_payroll_employees(is_active);

-- مكونات الراتب
CREATE TABLE IF NOT EXISTS finance_payroll_components (
    component_id SERIAL PRIMARY KEY,
    component_code VARCHAR(50) UNIQUE NOT NULL,
    component_name_ar VARCHAR(200) NOT NULL,
    component_name_en VARCHAR(200),
    component_type VARCHAR(20) NOT NULL, -- EARNING, DEDUCTION
    calculation_method VARCHAR(20) DEFAULT 'FIXED', -- FIXED, PERCENTAGE
    default_amount DECIMAL(15,2) DEFAULT 0,
    is_taxable BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_components_entity ON finance_payroll_components(entity_type, entity_id);

-- مكونات الراتب الخاصة بكل موظف
CREATE TABLE IF NOT EXISTS finance_payroll_employee_components (
    employee_component_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES finance_payroll_employees(employee_id) ON DELETE CASCADE,
    component_id INTEGER NOT NULL REFERENCES finance_payroll_components(component_id) ON DELETE CASCADE,
    amount DECIMAL(15,2) DEFAULT 0,
    percentage DECIMAL(8,4),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee_components_employee ON finance_payroll_employee_components(employee_id);

-- تشغيل الرواتب
CREATE TABLE IF NOT EXISTS finance_payroll_runs (
    run_id SERIAL PRIMARY KEY,
    run_number VARCHAR(50) UNIQUE NOT NULL,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    run_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, APPROVED, POSTED, CANCELLED
    total_gross DECIMAL(15,2) DEFAULT 0,
    total_deductions DECIMAL(15,2) DEFAULT 0,
    total_net DECIMAL(15,2) DEFAULT 0,

    -- الربط المحاسبي
    journal_entry_id INTEGER REFERENCES finance_journal_entries(entry_id),

    -- الربط بالكيانات
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    office_id VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON finance_payroll_runs(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_entity ON finance_payroll_runs(entity_type, entity_id);

-- بنود قسائم الرواتب
CREATE TABLE IF NOT EXISTS finance_payroll_items (
    item_id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES finance_payroll_runs(run_id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES finance_payroll_employees(employee_id) ON DELETE CASCADE,
    gross_amount DECIMAL(15,2) DEFAULT 0,
    deductions_amount DECIMAL(15,2) DEFAULT 0,
    net_amount DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'DRAFT',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON finance_payroll_items(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON finance_payroll_items(employee_id);

-- تفاصيل بنود القسيمة
CREATE TABLE IF NOT EXISTS finance_payroll_item_lines (
    line_id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES finance_payroll_items(item_id) ON DELETE CASCADE,
    component_id INTEGER REFERENCES finance_payroll_components(component_id),
    line_type VARCHAR(20) NOT NULL, -- EARNING, DEDUCTION
    amount DECIMAL(15,2) NOT NULL,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_payroll_item_lines_item ON finance_payroll_item_lines(item_id);

-- العمل الإضافي
CREATE TABLE IF NOT EXISTS finance_payroll_overtime (
    overtime_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES finance_payroll_employees(employee_id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    hours DECIMAL(8,2) DEFAULT 0,
    rate DECIMAL(12,2) DEFAULT 0,
    multiplier DECIMAL(6,2) DEFAULT 1,
    amount DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    payroll_run_id INTEGER REFERENCES finance_payroll_runs(run_id),
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_overtime_employee ON finance_payroll_overtime(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_overtime_status ON finance_payroll_overtime(status);

-- قواعد الراتب المرن
CREATE TABLE IF NOT EXISTS finance_payroll_flexible_rules (
    rule_id SERIAL PRIMARY KEY,
    rule_name_ar VARCHAR(200) NOT NULL,
    rule_name_en VARCHAR(200),
    max_percent_of_salary DECIMAL(6,2) DEFAULT 0,
    min_remaining_salary DECIMAL(15,2) DEFAULT 0,
    allow_advance BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- التسويات المالية
CREATE TABLE IF NOT EXISTS finance_payroll_settlements (
    settlement_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES finance_payroll_employees(employee_id) ON DELETE CASCADE,
    settlement_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT',
    payroll_run_id INTEGER REFERENCES finance_payroll_runs(run_id),
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_settlements_employee ON finance_payroll_settlements(employee_id);

-- شركات التمويل والخصومات
CREATE TABLE IF NOT EXISTS finance_payroll_finance_partners (
    partner_id SERIAL PRIMARY KEY,
    partner_name VARCHAR(200) NOT NULL,
    partner_type VARCHAR(20) DEFAULT 'FINANCE', -- FINANCE, OTHER
    contact_info TEXT,
    is_active BOOLEAN DEFAULT true,
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_payroll_finance_deductions (
    deduction_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES finance_payroll_employees(employee_id) ON DELETE CASCADE,
    partner_id INTEGER REFERENCES finance_payroll_finance_partners(partner_id),
    amount DECIMAL(15,2) NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ملفات الضمان والتأمينات
CREATE TABLE IF NOT EXISTS finance_payroll_insurance_profiles (
    profile_id SERIAL PRIMARY KEY,
    country_code VARCHAR(10) NOT NULL,
    profile_name VARCHAR(200) NOT NULL,
    employee_rate DECIMAL(8,4) DEFAULT 0,
    employer_rate DECIMAL(8,4) DEFAULT 0,
    min_salary DECIMAL(15,2) DEFAULT 0,
    max_salary DECIMAL(15,2),
    effective_from DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_payroll_employee_insurance (
    employee_insurance_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES finance_payroll_employees(employee_id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL REFERENCES finance_payroll_insurance_profiles(profile_id),
    insurance_number VARCHAR(80),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- محافظ النقاط
CREATE TABLE IF NOT EXISTS finance_payroll_wallets (
    wallet_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES finance_payroll_employees(employee_id) ON DELETE CASCADE,
    points_balance DECIMAL(15,2) DEFAULT 0,
    value_balance DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'SAR',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_payroll_wallet_transactions (
    transaction_id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES finance_payroll_wallets(wallet_id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- EARNED, PURCHASED, TOPUP, ADJUSTMENT, REDEEMED
    points_amount DECIMAL(15,2) DEFAULT 0,
    value_amount DECIMAL(15,2) DEFAULT 0,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_wallet_tx_wallet ON finance_payroll_wallet_transactions(wallet_id);

-- دفعات التحويل البنكي
CREATE TABLE IF NOT EXISTS finance_payroll_bank_batches (
    batch_id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES finance_payroll_runs(run_id) ON DELETE CASCADE,
    bank_name VARCHAR(200),
    file_reference VARCHAR(200),
    status VARCHAR(20) DEFAULT 'GENERATED',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP
);

-- ========================================
-- 10. بيانات أولية - شجرة الحسابات القياسية
-- ========================================

-- المستوى الأول - الأصول (1000)
INSERT INTO finance_accounts (account_code, account_name_ar, account_name_en, account_type, level, is_header, normal_balance) 
VALUES 
('1000', 'الأصول', 'Assets', 'ASSET', 1, true, 'DEBIT'),
('1100', 'الأصول المتداولة', 'Current Assets', 'ASSET', 2, true, 'DEBIT'),
('1110', 'النقدية والنقدية المعادلة', 'Cash and Cash Equivalents', 'ASSET', 3, false, 'DEBIT'),
('1120', 'البنوك', 'Banks', 'ASSET', 3, false, 'DEBIT'),
('1130', 'الذمم المدينة', 'Accounts Receivable', 'ASSET', 3, false, 'DEBIT'),
('1140', 'المخزون', 'Inventory', 'ASSET', 3, false, 'DEBIT'),
('1150', 'المصروفات المدفوعة مقدماً', 'Prepaid Expenses', 'ASSET', 3, false, 'DEBIT'),
('1500', 'الأصول الثابتة', 'Fixed Assets', 'ASSET', 2, true, 'DEBIT'),
('1510', 'الأراضي', 'Land', 'ASSET', 3, false, 'DEBIT'),
('1520', 'المباني', 'Buildings', 'ASSET', 3, false, 'DEBIT'),
('1530', 'الأثاث والمعدات', 'Furniture and Equipment', 'ASSET', 3, false, 'DEBIT'),
('1540', 'السيارات', 'Vehicles', 'ASSET', 3, false, 'DEBIT'),
('1550', 'أجهزة الكمبيوتر', 'Computer Equipment', 'ASSET', 3, false, 'DEBIT'),
('1600', 'مجمع الإهلاك', 'Accumulated Depreciation', 'ASSET', 2, true, 'CREDIT'),
('1610', 'مجمع إهلاك المباني', 'Accumulated Depreciation - Buildings', 'ASSET', 3, false, 'CREDIT'),
('1620', 'مجمع إهلاك الأثاث', 'Accumulated Depreciation - Furniture', 'ASSET', 3, false, 'CREDIT'),
('1630', 'مجمع إهلاك السيارات', 'Accumulated Depreciation - Vehicles', 'ASSET', 3, false, 'CREDIT'),
('1640', 'مجمع إهلاك الأجهزة', 'Accumulated Depreciation - Equipment', 'ASSET', 3, false, 'CREDIT')
ON CONFLICT (account_code) DO NOTHING;

-- المستوى الأول - الالتزامات (2000)
INSERT INTO finance_accounts (account_code, account_name_ar, account_name_en, account_type, level, is_header, normal_balance)
VALUES
('2000', 'الالتزامات', 'Liabilities', 'LIABILITY', 1, true, 'CREDIT'),
('2100', 'الالتزامات المتداولة', 'Current Liabilities', 'LIABILITY', 2, true, 'CREDIT'),
('2110', 'الذمم الدائنة', 'Accounts Payable', 'LIABILITY', 3, false, 'CREDIT'),
('2120', 'المصروفات المستحقة', 'Accrued Expenses', 'LIABILITY', 3, false, 'CREDIT'),
('2130', 'القروض قصيرة الأجل', 'Short-term Loans', 'LIABILITY', 3, false, 'CREDIT'),
('2140', 'الضرائب المستحقة', 'Taxes Payable', 'LIABILITY', 3, false, 'CREDIT'),
('2150', 'الرواتب المستحقة', 'Salaries Payable', 'LIABILITY', 3, false, 'CREDIT'),
('2200', 'الالتزامات طويلة الأجل', 'Long-term Liabilities', 'LIABILITY', 2, true, 'CREDIT'),
('2210', 'القروض طويلة الأجل', 'Long-term Loans', 'LIABILITY', 3, false, 'CREDIT'),
('2220', 'التزامات التمويل', 'Finance Lease Obligations', 'LIABILITY', 3, false, 'CREDIT')
ON CONFLICT (account_code) DO NOTHING;

-- المستوى الأول - حقوق الملكية (3000)
INSERT INTO finance_accounts (account_code, account_name_ar, account_name_en, account_type, level, is_header, normal_balance)
VALUES
('3000', 'حقوق الملكية', 'Equity', 'EQUITY', 1, true, 'CREDIT'),
('3100', 'رأس المال', 'Capital', 'EQUITY', 2, false, 'CREDIT'),
('3200', 'الأرباح المحتجزة', 'Retained Earnings', 'EQUITY', 2, false, 'CREDIT'),
('3300', 'أرباح العام الحالي', 'Current Year Profit', 'EQUITY', 2, false, 'CREDIT')
ON CONFLICT (account_code) DO NOTHING;

-- المستوى الأول - الإيرادات (4000)
INSERT INTO finance_accounts (account_code, account_name_ar, account_name_en, account_type, level, is_header, normal_balance)
VALUES
('4000', 'الإيرادات', 'Revenue', 'REVENUE', 1, true, 'CREDIT'),
('4100', 'إيرادات البرامج التدريبية', 'Training Programs Revenue', 'REVENUE', 2, false, 'CREDIT'),
('4200', 'إيرادات الحاضنات', 'Incubators Revenue', 'REVENUE', 2, false, 'CREDIT'),
('4300', 'إيرادات المنصات الرقمية', 'Digital Platforms Revenue', 'REVENUE', 2, false, 'CREDIT'),
('4400', 'إيرادات الخدمات الاستشارية', 'Consulting Services Revenue', 'REVENUE', 2, false, 'CREDIT'),
('4500', 'إيرادات أخرى', 'Other Revenue', 'REVENUE', 2, false, 'CREDIT')
ON CONFLICT (account_code) DO NOTHING;

-- المستوى الأول - المصروفات (5000 - 9000)
INSERT INTO finance_accounts (account_code, account_name_ar, account_name_en, account_type, level, is_header, normal_balance)
VALUES
('5000', 'المصروفات التشغيلية', 'Operating Expenses', 'EXPENSE', 1, true, 'DEBIT'),
('5100', 'رواتب التشغيل', 'Operating Salaries', 'EXPENSE', 2, false, 'DEBIT'),
('5200', 'الإيجارات', 'Rent Expenses', 'EXPENSE', 2, false, 'DEBIT'),
('5300', 'الكهرباء والمرافق', 'Utilities', 'EXPENSE', 2, false, 'DEBIT'),
('5400', 'الصيانة', 'Maintenance', 'EXPENSE', 2, false, 'DEBIT'),

('6000', 'المصروفات الإدارية', 'Administrative Expenses', 'EXPENSE', 1, true, 'DEBIT'),
('6100', 'رواتب الإدارة', 'Administrative Salaries', 'EXPENSE', 2, false, 'DEBIT'),
('6200', 'السفر والاجتماعات', 'Travel and Meetings', 'EXPENSE', 2, false, 'DEBIT'),
('6300', 'الخدمات المهنية', 'Professional Services', 'EXPENSE', 2, false, 'DEBIT'),
('6400', 'القرطاسية واللوازم', 'Office Supplies', 'EXPENSE', 2, false, 'DEBIT'),

('7000', 'مصروفات البرامج', 'Program Expenses', 'EXPENSE', 1, true, 'DEBIT'),
('7100', 'مكافآت المدربين', 'Trainers Fees', 'EXPENSE', 2, false, 'DEBIT'),
('7200', 'المواد التدريبية', 'Training Materials', 'EXPENSE', 2, false, 'DEBIT'),
('7300', 'الفعاليات', 'Events', 'EXPENSE', 2, false, 'DEBIT'),

('8000', 'مصروفات التسويق', 'Marketing Expenses', 'EXPENSE', 1, true, 'DEBIT'),
('8100', 'الإعلانات', 'Advertising', 'EXPENSE', 2, false, 'DEBIT'),
('8200', 'الحملات الرقمية', 'Digital Campaigns', 'EXPENSE', 2, false, 'DEBIT'),
('8300', 'العلاقات العامة', 'Public Relations', 'EXPENSE', 2, false, 'DEBIT'),

('9000', 'مصروفات التقنية', 'Technology Expenses', 'EXPENSE', 1, true, 'DEBIT'),
('9100', 'اشتراكات SaaS', 'SaaS Subscriptions', 'EXPENSE', 2, false, 'DEBIT'),
('9200', 'تطوير المنصات', 'Platform Development', 'EXPENSE', 2, false, 'DEBIT'),
('9300', 'الاستضافة والخوادم', 'Hosting and Servers', 'EXPENSE', 2, false, 'DEBIT'),
('9400', 'الدعم الفني', 'Technical Support', 'EXPENSE', 2, false, 'DEBIT')
ON CONFLICT (account_code) DO NOTHING;

-- تحديث الحسابات الرئيسية لتكون parent للحسابات الفرعية
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '1000') WHERE account_code IN ('1100', '1500', '1600');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '1100') WHERE account_code IN ('1110', '1120', '1130', '1140', '1150');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '1500') WHERE account_code IN ('1510', '1520', '1530', '1540', '1550');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '1600') WHERE account_code IN ('1610', '1620', '1630', '1640');

UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '2000') WHERE account_code IN ('2100', '2200');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '2100') WHERE account_code IN ('2110', '2120', '2130', '2140', '2150');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '2200') WHERE account_code IN ('2210', '2220');

UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '3000') WHERE account_code IN ('3100', '3200', '3300');

UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '4000') WHERE account_code IN ('4100', '4200', '4300', '4400', '4500');

UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '5000') WHERE account_code IN ('5100', '5200', '5300', '5400');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '6000') WHERE account_code IN ('6100', '6200', '6300', '6400');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '7000') WHERE account_code IN ('7100', '7200', '7300');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '8000') WHERE account_code IN ('8100', '8200', '8300');
UPDATE finance_accounts SET parent_account_id = (SELECT account_id FROM finance_accounts WHERE account_code = '9000') WHERE account_code IN ('9100', '9200', '9300', '9400');

-- ========================================
-- النهاية - Finance System Initialized
-- ========================================
