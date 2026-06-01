-- ============================================================
-- نظام التحصيل الذكي (Smart Collection System)
-- يدعم الدفع الكامل والجزئي والأقساط مع حوكمة ذكية
-- ============================================================

-- 1. جدول أنواع الفواتير (Invoice Types)
CREATE TABLE IF NOT EXISTS invoice_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول حالات الفواتير (Invoice Status)
CREATE TABLE IF NOT EXISTS invoice_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول الفواتير المحسّن (Enhanced Invoices)
CREATE TABLE IF NOT EXISTS invoices_enhanced (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    entity_id VARCHAR(20) NOT NULL REFERENCES entities(id),
    customer_id VARCHAR(50),
    invoice_type_id INTEGER REFERENCES invoice_types(id),
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    currency VARCHAR(3) DEFAULT 'SAR',
    country_code VARCHAR(2) NOT NULL, -- للقوانين المحلية (SA, JO, IQ, EG, etc.)
    tax_type VARCHAR(20), -- VAT, ZAKAT, GST, etc.
    tax_rate DECIMAL(5,2),
    due_date DATE,
    issued_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. جدول الدفعات (Payments)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50), -- CASH, BANK_TRANSFER, CHEQUE, CARD, etc.
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. جدول نطاقات الأقساط (Installment Plans)
CREATE TABLE IF NOT EXISTS installment_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    number_of_installments INTEGER NOT NULL,
    installment_duration_days INTEGER, -- عدد أيام بين كل قسط
    down_payment_percentage DECIMAL(5,2) DEFAULT 0, -- نسبة الدفعة الأولى
    interest_rate DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. جدول الفواتير بالأقساط (Installment Invoices)
CREATE TABLE IF NOT EXISTS installment_invoices (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES installment_plans(id),
    number_of_installments INTEGER NOT NULL,
    installment_amount DECIMAL(15,2) NOT NULL,
    next_due_date DATE,
    completed_installments INTEGER DEFAULT 0,
    total_paid DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, COMPLETED, DEFAULT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. جدول سجل الأقساط (Installment History)
CREATE TABLE IF NOT EXISTS installment_history (
    id SERIAL PRIMARY KEY,
    installment_invoice_id INTEGER NOT NULL REFERENCES installment_invoices(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    paid_date DATE,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PAID, OVERDUE, PARTIAL
    payment_id INTEGER REFERENCES payments(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. جدول القوانين الضريبية (Tax Rules)
CREATE TABLE IF NOT EXISTS tax_rules (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL,
    tax_type VARCHAR(20) NOT NULL, -- VAT, ZAKAT, GST, etc.
    tax_rate DECIMAL(5,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. جدول قواعد التحصيل (Collection Rules)
CREATE TABLE IF NOT EXISTS collection_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    country_code VARCHAR(2),
    rule_type VARCHAR(50), -- AUTO_REMINDER, ESCALATION, DISCOUNT, PENALTY
    conditions JSONB,
    action VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. جدول تذكيرات التحصيل (Collection Reminders)
CREATE TABLE IF NOT EXISTS collection_reminders (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50), -- FIRST, SECOND, FINAL, LEGAL
    reminder_date DATE,
    due_date DATE,
    days_overdue INTEGER,
    sent BOOLEAN DEFAULT FALSE,
    sent_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. جدول قائمة العملاء المتأخرين (Overdue List)
CREATE TABLE IF NOT EXISTS overdue_list (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices_enhanced(id) ON DELETE CASCADE,
    customer_id VARCHAR(50),
    customer_name VARCHAR(255),
    total_overdue DECIMAL(15,2) NOT NULL,
    days_overdue INTEGER,
    number_of_reminders INTEGER DEFAULT 0,
    escalation_level INTEGER DEFAULT 0, -- 1, 2, 3, LEGAL
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_invoices_entity ON invoices_enhanced(entity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices_enhanced(status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices_enhanced(invoice_type_id);
CREATE INDEX IF NOT EXISTS idx_invoices_country ON invoices_enhanced(country_code);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices_enhanced(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_installment_invoice ON installment_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_installment_history ON installment_history(installment_invoice_id);
CREATE INDEX IF NOT EXISTS idx_collection_reminders_invoice ON collection_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_overdue_list_invoice ON overdue_list(invoice_id);
CREATE INDEX IF NOT EXISTS idx_overdue_list_days ON overdue_list(days_overdue DESC);

-- تعليقات على الجداول
COMMENT ON TABLE invoices_enhanced IS 'جدول الفواتير المحسّن يدعم جميع أنواع الدفع والقوانين المحلية';
COMMENT ON TABLE payments IS 'جدول تسجيل الدفعات لكل فاتورة';
COMMENT ON TABLE installment_invoices IS 'جدول الفواتير التي تُسدد بالأقساط';
COMMENT ON TABLE installment_history IS 'سجل تاريخي لكل قسط وحالته';
COMMENT ON TABLE tax_rules IS 'القوانين الضريبية حسب الدول';
COMMENT ON TABLE collection_rules IS 'قواعد التحصيل والتذكيرات الذكية';
COMMENT ON TABLE collection_reminders IS 'تذكيرات التحصيل التلقائية';
COMMENT ON TABLE overdue_list IS 'قائمة الفواتير المتأخرة مع درجات التصعيد';

COMMIT;
