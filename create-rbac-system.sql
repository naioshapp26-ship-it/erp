-- ============================================================
-- نظام الأدوار والصلاحيات والحوكمة وسجل المراجعات
-- RBAC (Role-Based Access Control) + Governance + Audit Log
-- ============================================================

-- 1. جدول الأدوار (Roles)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    level VARCHAR(20) NOT NULL, -- HQ, BRANCH, INCUBATOR, PLATFORM, OFFICE, ALL
    is_system BOOLEAN DEFAULT FALSE, -- أدوار النظام (لا يمكن حذفها)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول الصلاحيات (Permissions)
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    resource VARCHAR(50) NOT NULL, -- users, entities, invoices, etc.
    action VARCHAR(20) NOT NULL, -- CREATE, READ, UPDATE, DELETE, APPROVE, EXPORT
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول ربط الأدوار بالصلاحيات (Role-Permission Mapping)
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- 4. جدول ربط المستخدمين بالأدوار (User-Role Mapping)
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    entity_id VARCHAR(20), -- النطاق: على أي كيان يعمل (NULL = على كل الكيانات ضمن صلاحيته)
    granted_by INTEGER REFERENCES users(id), -- من منح الصلاحية
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- تاريخ انتهاء الصلاحية (NULL = دائمة)
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, role_id, entity_id)
);

-- 5. جدول سجل المراجعات (Audit Log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    user_name VARCHAR(100),
    entity_id VARCHAR(20),
    action VARCHAR(50) NOT NULL, -- LOGIN, CREATE_USER, UPDATE_INVOICE, DELETE_ENTITY, etc.
    resource_type VARCHAR(50), -- users, invoices, entities, etc.
    resource_id VARCHAR(100), -- معرف السجل المتأثر
    old_value TEXT, -- القيمة القديمة (JSON)
    new_value TEXT, -- القيمة الجديدة (JSON)
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason TEXT, -- سبب الإجراء
    status VARCHAR(20) DEFAULT 'SUCCESS', -- SUCCESS, FAILED, BLOCKED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. جدول قواعد الحوكمة (Governance Rules)
CREATE TABLE IF NOT EXISTS governance_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    name_ar VARCHAR(200) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- APPROVAL_REQUIRED, AMOUNT_LIMIT, DUAL_CONTROL, etc.
    resource VARCHAR(50) NOT NULL,
    conditions JSONB, -- شروط تطبيق القاعدة
    action_required VARCHAR(50), -- الإجراء المطلوب (APPROVE, NOTIFY, BLOCK)
    threshold_value DECIMAL(15,2), -- قيمة الحد (للمبالغ المالية)
    approvers_required INTEGER DEFAULT 1, -- عدد الموافقين المطلوب
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. جدول سجل الموافقات (Approval Log)
CREATE TABLE IF NOT EXISTS approval_log (
    id SERIAL PRIMARY KEY,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    requested_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    comments TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_entity ON user_roles(entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_log_status ON approval_log(status);

-- إضافة تعليقات على الجداول
COMMENT ON TABLE roles IS 'جدول الأدوار الوظيفية في النظام';
COMMENT ON TABLE permissions IS 'جدول الصلاحيات والأذونات';
COMMENT ON TABLE role_permissions IS 'ربط الأدوار بالصلاحيات';
COMMENT ON TABLE user_roles IS 'ربط المستخدمين بالأدوار والنطاق';
COMMENT ON TABLE audit_logs IS 'سجل شامل لجميع العمليات في النظام';
COMMENT ON TABLE governance_rules IS 'قواعد الحوكمة والرقابة';
COMMENT ON TABLE approval_log IS 'سجل طلبات الموافقة';

COMMIT;
