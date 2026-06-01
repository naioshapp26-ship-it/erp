-- ========================================
-- COMPREHENSIVE AUDIT LOG SYSTEM
-- نظام سجل المراجعات الشامل
-- ========================================

-- ========================================
-- TABLE: audit_log (سجل المراجعات الرئيسي)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    
    -- WHO: من عمل العملية
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(50),
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE SET NULL,
    
    -- WHEN: متى
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_date DATE DEFAULT CURRENT_DATE,
    
    -- WHAT: على مين/إيه
    entity_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'PAYMENT', 'USER', 'ENTITY', 'APPROVAL', etc.
    entity_reference_id VARCHAR(100), -- ID of the affected entity
    entity_reference_name VARCHAR(255), -- Name for clarity
    
    -- ACTION: إيه اللي اتغير
    action_type VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'PAYMENT', 'DISCOUNT', 'REFUND', etc.
    
    -- BEFORE/AFTER: إيه اللي اتغير بالتفصيل
    field_changed VARCHAR(255), -- اسم الحقل اللي اتغير (مثل: status, amount, etc.)
    old_value TEXT, -- القيمة القديمة
    new_value TEXT, -- القيمة الجديدة
    
    -- WHY: سبب التغيير (مهم جداً)
    reason TEXT, -- السبب
    reason_category VARCHAR(50), -- 'BUSINESS', 'CORRECTION', 'CUSTOMER_REQUEST', 'SYSTEM_ERROR', 'REJECTION_REASON', 'DISCOUNT_REASON', etc.
    
    -- APPROVAL CHAIN: سلسلة الموافقات
    requires_approval BOOLEAN DEFAULT false,
    approval_status VARCHAR(20), -- 'PENDING', 'APPROVED', 'REJECTED'
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by_name VARCHAR(255),
    approval_timestamp TIMESTAMP,
    approval_reason TEXT, -- سبب الموافقة أو الرفض
    
    -- IMPACT: التأثير المالي
    financial_impact BOOLEAN DEFAULT false,
    amount_affected DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- ADDITIONAL CONTEXT
    ip_address VARCHAR(50),
    session_id VARCHAR(100),
    source_system VARCHAR(50), -- 'WEB', 'API', 'MOBILE', 'BATCH'
    description TEXT, -- وصف شامل للعملية
    
    -- METADATA
    related_audit_ids BIGINT[], -- IDs of related audit logs
    error_message TEXT, -- إذا فشلت العملية
    success BOOLEAN DEFAULT true,
    
    -- INDEXES للبحث السريع
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- INDEXES for Performance
-- ========================================
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_entity_id ON audit_log(entity_id);
CREATE INDEX idx_audit_entity_reference ON audit_log(entity_type, entity_reference_id);
CREATE INDEX idx_audit_timestamp ON audit_log(action_timestamp DESC);
CREATE INDEX idx_audit_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_approval_status ON audit_log(approval_status);
CREATE INDEX idx_audit_financial ON audit_log(financial_impact);

-- ========================================
-- TABLE: audit_log_changes (تفاصيل التغييرات)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_log_changes (
    id BIGSERIAL PRIMARY KEY,
    audit_log_id BIGINT NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
    
    field_name VARCHAR(255) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    data_type VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_changes_log_id ON audit_log_changes(audit_log_id);

-- ========================================
-- TABLE: audit_approvals (سلسلة الموافقات التفصيلية)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_approvals (
    id BIGSERIAL PRIMARY KEY,
    audit_log_id BIGINT NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
    
    approval_level INTEGER,
    approver_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approver_name VARCHAR(255) NOT NULL,
    approver_role VARCHAR(50),
    
    approval_status VARCHAR(20), -- 'PENDING', 'APPROVED', 'REJECTED'
    approval_timestamp TIMESTAMP,
    approval_reason TEXT,
    approval_comment TEXT,
    
    required BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_approvals_log_id ON audit_approvals(audit_log_id);
CREATE INDEX idx_audit_approvals_status ON audit_approvals(approval_status);

-- ========================================
-- TABLE: audit_notifications (تنبيهات التغييرات المهمة)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_notifications (
    id BIGSERIAL PRIMARY KEY,
    audit_log_id BIGINT NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
    
    recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recipient_name VARCHAR(255),
    recipient_role VARCHAR(50),
    
    notification_type VARCHAR(50), -- 'EMAIL', 'SMS', 'IN_APP'
    notification_message TEXT,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLE: audit_statistics (إحصائيات المراجعة)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_statistics (
    id SERIAL PRIMARY KEY,
    
    date_recorded DATE,
    entity_type VARCHAR(50),
    action_type VARCHAR(50),
    
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    total_amount_affected DECIMAL(15, 2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- VIEW: audit_log_summary (ملخص سجل المراجعات)
-- ========================================
CREATE OR REPLACE VIEW audit_log_summary AS
SELECT 
    al.id,
    al.user_name,
    al.user_role,
    al.action_timestamp,
    al.entity_type,
    al.entity_reference_id,
    al.entity_reference_name,
    al.action_type,
    al.field_changed,
    al.old_value,
    al.new_value,
    al.reason,
    al.reason_category,
    al.approval_status,
    al.approved_by_name,
    al.amount_affected,
    al.description,
    al.success
FROM audit_log al
ORDER BY al.action_timestamp DESC;

-- ========================================
-- VIEW: audit_log_financial (سجل التأثيرات المالية)
-- ========================================
CREATE OR REPLACE VIEW audit_log_financial AS
SELECT 
    al.id,
    al.user_name,
    al.action_timestamp,
    al.entity_type,
    al.entity_reference_id,
    al.action_type,
    al.amount_affected,
    al.currency,
    al.reason,
    al.approval_status,
    al.approved_by_name
FROM audit_log al
WHERE al.financial_impact = true AND al.amount_affected IS NOT NULL
ORDER BY al.action_timestamp DESC;

-- ========================================
-- VIEW: audit_log_approvals_chain (سلسلة الموافقات)
-- ========================================
CREATE OR REPLACE VIEW audit_log_approvals_chain AS
SELECT 
    al.id AS audit_id,
    al.user_name,
    al.action_type,
    al.entity_reference_name,
    al.approval_status,
    aa.approval_level,
    aa.approver_name,
    aa.approver_role,
    aa.approval_status AS step_status,
    aa.approval_reason,
    aa.approval_comment,
    aa.approval_timestamp
FROM audit_log al
LEFT JOIN audit_approvals aa ON al.id = aa.audit_log_id
ORDER BY al.action_timestamp DESC, aa.approval_level ASC;

-- ========================================
-- FUNCTION: log_audit_entry (إضافة سجل مراجعة)
-- ========================================
CREATE OR REPLACE FUNCTION log_audit_entry(
    p_user_id INTEGER,
    p_user_name VARCHAR,
    p_user_role VARCHAR,
    p_entity_id VARCHAR,
    p_entity_type VARCHAR,
    p_entity_reference_id VARCHAR,
    p_entity_reference_name VARCHAR,
    p_action_type VARCHAR,
    p_field_changed VARCHAR DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_reason_category VARCHAR DEFAULT 'BUSINESS',
    p_requires_approval BOOLEAN DEFAULT false,
    p_approval_status VARCHAR DEFAULT 'PENDING',
    p_financial_impact BOOLEAN DEFAULT false,
    p_amount_affected DECIMAL DEFAULT NULL,
    p_ip_address VARCHAR DEFAULT NULL,
    p_session_id VARCHAR DEFAULT NULL,
    p_source_system VARCHAR DEFAULT 'WEB',
    p_description TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_audit_id BIGINT;
BEGIN
    INSERT INTO audit_log (
        user_id, user_name, user_role, entity_id,
        entity_type, entity_reference_id, entity_reference_name,
        action_type, field_changed, old_value, new_value,
        reason, reason_category,
        requires_approval, approval_status,
        financial_impact, amount_affected,
        ip_address, session_id, source_system, description, success
    ) VALUES (
        p_user_id, p_user_name, p_user_role, p_entity_id,
        p_entity_type, p_entity_reference_id, p_entity_reference_name,
        p_action_type, p_field_changed, p_old_value, p_new_value,
        p_reason, p_reason_category,
        p_requires_approval, p_approval_status,
        p_financial_impact, p_amount_affected,
        p_ip_address, p_session_id, p_source_system, p_description, true
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FUNCTION: record_approval (تسجيل الموافقة)
-- ========================================
CREATE OR REPLACE FUNCTION record_approval(
    p_audit_log_id BIGINT,
    p_approver_user_id INTEGER,
    p_approver_name VARCHAR,
    p_approver_role VARCHAR,
    p_approval_level INTEGER DEFAULT 1,
    p_approval_status VARCHAR DEFAULT 'APPROVED',
    p_approval_reason TEXT DEFAULT NULL,
    p_approval_comment TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO audit_approvals (
        audit_log_id, approval_level,
        approver_user_id, approver_name, approver_role,
        approval_status, approval_timestamp, approval_reason, approval_comment
    ) VALUES (
        p_audit_log_id, p_approval_level,
        p_approver_user_id, p_approver_name, p_approver_role,
        p_approval_status, CURRENT_TIMESTAMP, p_approval_reason, p_approval_comment
    );
    
    -- Update audit_log approval status
    UPDATE audit_log 
    SET approval_status = p_approval_status,
        approved_by_user_id = p_approver_user_id,
        approved_by_name = p_approver_name,
        approval_timestamp = CURRENT_TIMESTAMP,
        approval_reason = p_approval_reason
    WHERE id = p_audit_log_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Sample Data for Testing
-- ========================================

-- أمثلة على العمليات المسجلة
INSERT INTO audit_log (
    user_id, user_name, user_role, entity_id,
    entity_type, entity_reference_id, entity_reference_name,
    action_type, field_changed, old_value, new_value,
    reason, reason_category,
    requires_approval, approval_status,
    financial_impact, amount_affected,
    source_system, description, success
) VALUES
-- Invoice Creation
(1, 'م. أحمد العلي', 'مسؤول النظام', 'HQ001',
 'INVOICE', 'INV-2026-001', 'فاتورة #1', 
 'CREATE', NULL, NULL, NULL,
 'إصدار فاتورة جديدة', 'BUSINESS',
 false, 'COMPLETED',
 true, 10000.00,
 'WEB', 'تم إصدار فاتورة جديدة بقيمة 10000 ر.س', true),

-- Payment Recording with Reason
(1, 'م. أحمد العلي', 'مسؤول النظام', 'BR015',
 'PAYMENT', 'TRX-001', 'دفعة رقم 1',
 'PAYMENT', 'amount_paid', '0.00', '5000.00',
 'تسجيل دفعة جزئية من العميل', 'BUSINESS',
 false, 'COMPLETED',
 true, 5000.00,
 'WEB', 'تسجيل دفعة جزئية', true),

-- Discount Applied with Reason
(2, 'سارة محمد', 'مسؤول مالي', 'BR015',
 'INVOICE', 'INV-2026-002', 'فاتورة #2',
 'APPLY_DISCOUNT', 'discount_percent', '0', '10',
 'خصم لعميل مهم - طلب مدير المبيعات', 'CUSTOMER_REQUEST',
 true, 'PENDING',
 true, -500.00,
 'WEB', 'تطبيق خصم 10% للعميل', false),

-- Refund Processing
(1, 'م. أحمد العلي', 'مسؤول النظام', 'HQ001',
 'PAYMENT', 'REF-001', 'رد مبلغ',
 'REFUND', 'refund_reason', 'PAID', 'REFUNDED',
 'خطأ في العملية - طلب العميل', 'CORRECTION',
 false, 'COMPLETED',
 true, -2000.00,
 'WEB', 'استرجاع مبلغ دفعة خاطئة', true),

-- User Status Change with Approval
(3, 'مدير النظام', 'مسؤول النظام', 'HQ001',
 'USER', 'user-5', 'محمد علي',
 'UPDATE', 'is_active', 'true', 'false',
 'عطل الموظف - إنتهاء العقد', 'BUSINESS',
 true, 'APPROVED',
 false, NULL,
 'WEB', 'إلغاء حساب موظف', true),

-- Batch Payment Processing
(1, 'م. أحمد العلي', 'مسؤول النظام', 'HQ001',
 'PAYMENT', 'BATCH-001', 'دفعات جماعية',
 'BATCH_PAYMENT', 'batch_count', '0', '10',
 'معالجة دفعات يومية', 'BUSINESS',
 false, 'COMPLETED',
 true, 45000.00,
 'BATCH', 'معالجة 10 دفعات جماعية', true);

-- ========================================
-- تسجيل سلسلة موافقات تجريبية
-- ========================================
INSERT INTO audit_approvals (
    audit_log_id, approval_level,
    approver_user_id, approver_name, approver_role,
    approval_status, approval_reason, approval_comment
) SELECT 
    id, 1,
    2, 'سارة محمد', 'مسؤول مالي',
    'APPROVED', 'موافق - تم التحقق', 'تم مراجعة المستندات'
FROM audit_log 
WHERE entity_type = 'INVOICE' AND action_type = 'APPLY_DISCOUNT'
LIMIT 1;

-- ========================================
-- VIEWS للإحصائيات
-- ========================================

CREATE OR REPLACE VIEW audit_daily_summary AS
SELECT 
    action_date,
    entity_type,
    action_type,
    COUNT(*) as total_actions,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_actions,
    SUM(CASE WHEN financial_impact THEN 1 ELSE 0 END) as financial_actions,
    SUM(COALESCE(amount_affected, 0)) as total_amount
FROM audit_log
GROUP BY action_date, entity_type, action_type
ORDER BY action_date DESC, entity_type, action_type;

CREATE OR REPLACE VIEW audit_user_activity AS
SELECT 
    user_name,
    user_role,
    entity_type,
    COUNT(*) as action_count,
    COUNT(DISTINCT action_date) as days_active,
    SUM(CASE WHEN approval_status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN approval_status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_count
FROM audit_log
GROUP BY user_name, user_role, entity_type
ORDER BY action_count DESC;

COMMIT;
