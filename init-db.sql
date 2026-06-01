-- ========================================
-- NAYOSH ERP - Multi-Tenant Database Schema
-- ========================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS ledger CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS ads CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS entities CASCADE;

-- ========================================
-- TABLE: entities (المستأجرين والكيانات)
-- ========================================
CREATE TABLE entities (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('HQ', 'BRANCH', 'INCUBATOR', 'PLATFORM', 'OFFICE')),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    balance DECIMAL(12, 2) DEFAULT 0.00,
    location VARCHAR(255),
    users_count INTEGER DEFAULT 0,
    plan VARCHAR(20) DEFAULT 'BASIC' CHECK (plan IN ('BASIC', 'PRO', 'ENTERPRISE')),
    expiry_date DATE,
    theme VARCHAR(20) DEFAULT 'BLUE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLE: users (المستخدمين)
-- ========================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL,
    tenant_type VARCHAR(20) NOT NULL,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    entity_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLE: invoices (الفواتير)
-- ========================================
CREATE TABLE invoices (
    id VARCHAR(50) PRIMARY KEY,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('SUBSCRIPTION', 'SERVICE', 'CUSTOM')),
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'UNPAID' CHECK (status IN ('PAID', 'PARTIAL', 'UNPAID', 'OVERDUE')),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLE: transactions (المعاملات المالية)
-- ========================================
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    invoice_id VARCHAR(50) REFERENCES invoices(id) ON DELETE SET NULL,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PAYMENT', 'REFUND', 'CREDIT', 'DEBIT')),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_date DATE NOT NULL,
    reference_code VARCHAR(100),
    user_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLE: ledger (دفتر الأستاذ)
-- ========================================
CREATE TABLE ledger (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    transaction_id VARCHAR(50) REFERENCES transactions(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    debit DECIMAL(10, 2) DEFAULT 0.00,
    credit DECIMAL(10, 2) DEFAULT 0.00,
    balance DECIMAL(12, 2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('Debit', 'Credit')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLE: ads (الإعلانات)
-- ========================================
CREATE TABLE ads (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    level VARCHAR(20) NOT NULL CHECK (level IN ('L1_LOCAL', 'L2_MULTI', 'L3_INC_INT', 'L4_PLT_INT', 'L5_CROSS_INC')),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('LOCAL', 'MULTI', 'INCUBATOR', 'PLATFORM', 'GLOBAL')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'REJECTED')),
    source_entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL,
    target_ids TEXT[], -- Array of target entity IDs
    cost DECIMAL(10, 2) DEFAULT 0.00,
    budget DECIMAL(10, 2) DEFAULT 0.00,
    spent DECIMAL(10, 2) DEFAULT 0.00,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Indexes for Performance
-- ========================================
CREATE INDEX idx_users_entity_id ON users(entity_id);
CREATE INDEX idx_invoices_entity_id ON invoices(entity_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_transactions_entity_id ON transactions(entity_id);
CREATE INDEX idx_transactions_invoice_id ON transactions(invoice_id);
CREATE INDEX idx_ledger_entity_id ON ledger(entity_id);
CREATE INDEX idx_ads_source_entity_id ON ads(source_entity_id);
CREATE INDEX idx_ads_status ON ads(status);

-- ========================================
-- Insert Sample Data
-- ========================================

-- Entities
INSERT INTO entities (id, name, type, status, balance, location, users_count, plan, expiry_date, theme) VALUES
('HQ001', 'المكتب الرئيسي', 'HQ', 'Active', 2500000.00, 'الرياض', 15, 'ENTERPRISE', '2030-12-31', 'BLUE'),
('BR015', 'فرع العليا مول', 'BRANCH', 'Active', 45000.00, 'الرياض - العليا', 8, 'PRO', '2024-06-15', 'BLUE'),
('BR016', 'فرع مول الرياض', 'BRANCH', 'Active', 32000.00, 'الرياض - النخيل', 12, 'BASIC', '2024-05-20', 'BLUE'),
('INC03', 'حاضنة السلامة', 'INCUBATOR', 'Active', 120000.00, 'جدة', 45, 'ENTERPRISE', '2025-01-01', 'EMERALD'),
('INC04', 'حاضنة الرياض تك', 'INCUBATOR', 'Active', 200000.00, 'الرياض', 60, 'ENTERPRISE', '2025-03-01', 'AMBER'),
('PLT01', 'نايوش كلاود', 'PLATFORM', 'Active', 500000.00, 'سحابي', 1200, 'PRO', '2024-11-30', 'PURPLE'),
('OFF01', 'مكتب الدمام', 'OFFICE', 'Active', 15000.00, 'الدمام', 4, 'BASIC', '2024-04-10', 'BLUE');

-- Users
INSERT INTO users (name, email, role, tenant_type, entity_id, entity_name) VALUES
('م. أحمد العلي', 'ahmed@nayosh.com', 'مسؤول النظام', 'HQ', 'HQ001', 'المكتب الرئيسي'),
('سارة محمد', 'sara@nayosh.com', 'مسؤول النظام', 'BRANCH', 'BR015', 'فرع العليا مول'),
('د. خالد الزهراني', 'khaled@nayosh.com', 'مسؤول النظام', 'INCUBATOR', 'INC03', 'حاضنة السلامة'),
('فريق التقنية', 'tech@nayosh.com', 'مسؤول النظام', 'PLATFORM', 'PLT01', 'نايوش كلاود'),
('يوسف المكتب', 'youssef@nayosh.com', 'مسؤول النظام', 'OFFICE', 'OFF01', 'مكتب الدمام'),
('أ. منى المالية', 'mona@nayosh.com', 'مسؤول مالي', 'HQ', 'HQ001', 'المكتب الرئيسي'),
('خدمة العملاء', 'support@nayosh.com', 'دعم فني', 'PLATFORM', 'PLT01', 'نايوش كلاود'),
('كريم التسويق', 'karim@nayosh.com', 'معلن', 'BRANCH', 'BR015', 'فرع العليا مول'),
('فهد السبيعي', 'fahad@nayosh.com', 'مسؤول النظام', 'BRANCH', 'BR016', 'فرع مول الرياض'),
('زائر النظام', 'visitor@nayosh.com', 'مستخدم', 'BRANCH', 'BR015', 'فرع العليا مول');

-- Invoices
INSERT INTO invoices (id, entity_id, type, title, amount, paid_amount, status, issue_date, due_date) VALUES
('INV-1001', 'BR015', 'SUBSCRIPTION', 'اشتراك باقة المحترفين - أكتوبر', 2499.00, 2499.00, 'PAID', '2023-10-01', '2023-10-07'),
('INV-1002', 'BR015', 'SUBSCRIPTION', 'اشتراك باقة المحترفين - نوفمبر', 2499.00, 1000.00, 'PARTIAL', '2023-11-01', '2023-11-07'),
('INV-1003', 'INC03', 'SUBSCRIPTION', 'اشتراك المؤسسات - نوفمبر', 4999.00, 0.00, 'UNPAID', '2023-11-01', '2023-11-07'),
('INV-1004', 'BR015', 'SERVICE', 'حملة إعلانية مخصصة (L2)', 500.00, 0.00, 'OVERDUE', '2023-10-20', '2023-10-25');

-- Transactions
INSERT INTO transactions (id, invoice_id, entity_id, type, amount, payment_method, transaction_date, reference_code, user_name) VALUES
('TRX-501', 'INV-1001', 'BR015', 'PAYMENT', 2499.00, 'Bank Transfer', '2023-10-05', 'REF123', 'سارة محمد'),
('TRX-502', 'INV-1002', 'BR015', 'PAYMENT', 1000.00, 'Credit Card', '2023-11-03', 'CC999', 'سارة محمد');

-- Ledger
INSERT INTO ledger (entity_id, transaction_id, transaction_date, description, debit, credit, balance, type) VALUES
('BR015', 'TRX-501', '2023-10-05', 'سداد فاتورة INV-1001', 0.00, 2499.00, 2499.00, 'Credit'),
('BR015', 'TRX-502', '2023-11-03', 'سداد جزئي INV-1002', 0.00, 1000.00, 3499.00, 'Credit');

-- Ads
INSERT INTO ads (title, content, level, scope, status, source_entity_id, source_type, target_ids, cost, budget, spent, impressions, clicks, start_date, end_date) VALUES
('تحديث سياسات SaaS 2024', 'نلفت انتباه جميع المستأجرين لتحديث السياسات.', 'L5_CROSS_INC', 'GLOBAL', 'ACTIVE', 'HQ001', 'HQ', '{}', 0.00, 0.00, 0.00, 12050, 450, '2023-11-20', '2023-12-31'),
('اجتماع داخلي - العليا', 'مناقشة تارجت الشهر القادم.', 'L1_LOCAL', 'LOCAL', 'ACTIVE', 'BR015', 'BRANCH', ARRAY['BR015'], 0.00, 0.00, 0.00, 8, 8, '2023-11-21', '2023-11-21'),
('عرض مشترك للفروع', 'خصم موحد 15%.', 'L2_MULTI', 'MULTI', 'ACTIVE', 'BR015', 'BRANCH', ARRAY['BR015', 'BR016'], 500.00, 2000.00, 500.00, 850, 120, '2023-11-22', '2023-11-30'),
('ورشة رواد الأعمال', 'مخصصة لمنسوبي الحاضنة.', 'L3_INC_INT', 'INCUBATOR', 'ACTIVE', 'INC03', 'INCUBATOR', ARRAY['INC03'], 100.00, 1000.00, 100.00, 150, 45, '2023-11-23', '2023-12-01'),
('صيانة المنصة السحابية', 'وقت توقف مجدول.', 'L4_PLT_INT', 'PLATFORM', 'ACTIVE', 'PLT01', 'PLATFORM', '{}', 1000.00, 0.00, 0.00, 5000, 200, '2023-11-25', '2023-11-26');

-- ========================================
-- Success Message
-- ========================================
SELECT 'تم إنشاء قاعدة البيانات بنجاح! ✅' AS message;
