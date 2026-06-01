-- ============================================================================
-- نظام مصفوفة الصلاحيات الكامل - نسخة محدثة
-- متوافق مع بنية الجداول الحالية
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. إنشاء جدول مستويات الصلاحيات
-- ============================================================================
CREATE TABLE IF NOT EXISTS permission_levels (
    id SERIAL PRIMARY KEY,
    level_code VARCHAR(50) UNIQUE NOT NULL,
    level_name_ar VARCHAR(100) NOT NULL,
    level_name_en VARCHAR(100) NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    color_code VARCHAR(20),
    priority_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO permission_levels (level_code, level_name_ar, level_name_en, description_ar, description_en, color_code, priority_order) VALUES
('FULL', 'كامل', 'Full Access', 'صلاحيات كاملة بدون قيود', 'Complete access without restrictions', '#00FF00', 1),
('VIEW_APPROVE', 'عرض+موافقة', 'View & Approve', 'عرض البيانات والموافقة على العمليات', 'View data and approve operations', '#FFD700', 2),
('EXECUTIVE', 'تنفيذي', 'Executive', 'تنفيذ العمليات اليومية', 'Execute daily operations', '#87CEEB', 3),
('VIEW', 'عرض/قراءة', 'View/Read Only', 'عرض البيانات فقط', 'View data only', '#90EE90', 4),
('LIMITED', 'محدود', 'Limited', 'صلاحيات محدودة جداً', 'Very limited permissions', '#FFB6C1', 5),
('NONE', 'لا يوجد', 'No Access', 'لا توجد صلاحيات', 'No permissions', '#FF0000', 6)
ON CONFLICT (level_code) DO UPDATE SET
    level_name_ar = EXCLUDED.level_name_ar,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 2. إنشاء جدول الأنظمة الثمانية
-- ============================================================================
CREATE TABLE IF NOT EXISTS systems (
    id SERIAL PRIMARY KEY,
    system_code VARCHAR(50) UNIQUE NOT NULL,
    system_name_ar VARCHAR(200) NOT NULL,
    system_name_en VARCHAR(200) NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    main_functions_ar TEXT[],
    main_functions_en TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO systems (system_code, system_name_ar, system_name_en, description_ar, main_functions_ar, display_order) VALUES
('HR_ADMIN', 'الإداري والموارد البشرية', 'HR & Administration', 'إدارة شؤون الموظفين والهيكل التنظيمي',
    ARRAY['التوظيف', 'الرواتب', 'الإجازات', 'التقييم', 'التدريب'], 1),
('FINANCE', 'المالي والمحاسبي', 'Finance & Accounting', 'إدارة الحسابات والقوائم المالية',
    ARRAY['القيود المحاسبية', 'الميزانية', 'التدفقات النقدية', 'التقارير المالية'], 2),
('PROCUREMENT', 'المشتريات', 'Procurement', 'إدارة عمليات الشراء والموردين',
    ARRAY['طلبات الشراء', 'أوامر الشراء', 'إدارة الموردين', 'المناقصات'], 3),
('SALES', 'المبيعات', 'Sales', 'إدارة عمليات البيع والعملاء',
    ARRAY['عروض الأسعار', 'الفواتير', 'إدارة العملاء (CRM)', 'تتبع الصفقات'], 4),
('MARKETING', 'التسويق', 'Marketing', 'إدارة الحملات التسويقية والعلامة التجارية',
    ARRAY['الحملات', 'تحليل السوق', 'إدارة المحتوى', 'السوشيال ميديا'], 5),
('SUPPLY_CHAIN', 'سلاسل الإمداد واللوجستيات', 'Supply Chain & Logistics', 'إدارة الشحن والتوزيع',
    ARRAY['الشحنات', 'التتبع', 'التسليم', 'إدارة الموردين اللوجستيين'], 6),
('SAFETY', 'السلامة', 'Safety', 'إدارة السلامة المهنية والامتثال',
    ARRAY['تقييم المخاطر', 'الحوادث', 'التدريب الأمني', 'الامتثال'], 7),
('WAREHOUSE', 'المخازن', 'Warehouse', 'إدارة المخزون والمستودعات',
    ARRAY['الإدخال', 'الإخراج', 'الجرد', 'تتبع المواد', 'تقارير المخزون'], 8)
ON CONFLICT (system_code) DO UPDATE SET
    system_name_ar = EXCLUDED.system_name_ar,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 3. تحديث جدول الأدوار - إضافة أعمدة جديدة
-- ============================================================================
ALTER TABLE roles ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS job_title_ar VARCHAR(200);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS job_title_en VARCHAR(200);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS min_approval_limit DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS max_approval_limit DECIMAL(15, 2);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS approval_notes_ar TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS approval_notes_en TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- 4. إضافة الأدوار الـ 33
-- ============================================================================

-- تحديث الأدوار الموجودة وإضافة الجديدة
INSERT INTO roles (name, name_ar, description, level, hierarchy_level, job_title_ar, job_title_en, min_approval_limit, max_approval_limit, approval_notes_ar, is_active) VALUES

-- المستوى 0: المكتب الرئيسي
('SUPER_ADMIN', 'سوبر آدمن', 'Super Administrator', 'HQ', 0, 'سوبر آدمن', 'Super Admin', 0, NULL, 'صلاحيات مطلقة', TRUE),
('FINANCIAL_MANAGER_HQ', 'مدير مالي - HQ', 'Financial Manager - HQ', 'HQ', 0, 'مدير مالي - المكتب الرئيسي', 'Financial Manager - HQ', 0, NULL, 'يخضع لسياسات مجلس الإدارة', TRUE),
('EXECUTIVE_MANAGER_HQ', 'مدير تنفيذي - HQ', 'Executive Manager - HQ', 'HQ', 0, 'مدير تنفيذي - المكتب الرئيسي', 'Executive Manager - HQ', 0, 5000000, 'للموافقات الاستراتيجية', TRUE),
('HR_MANAGER_HQ', 'مدير موارد بشرية - HQ', 'HR Manager - HQ', 'HQ', 0, 'مدير موارد بشرية - المكتب الرئيسي', 'HR Manager - HQ', 0, NULL, 'إدارة كاملة للموارد البشرية', TRUE),
('PROCUREMENT_MANAGER_HQ', 'مدير مشتريات - HQ', 'Procurement Manager - HQ', 'HQ', 0, 'مدير مشتريات - المكتب الرئيسي', 'Procurement Manager - HQ', 0, NULL, 'إدارة المشتريات والموردين', TRUE),
('SALES_MANAGER_HQ', 'مدير مبيعات - HQ', 'Sales Manager - HQ', 'HQ', 0, 'مدير مبيعات - المكتب الرئيسي', 'Sales Manager - HQ', 0, NULL, 'إدارة المبيعات والعملاء', TRUE),
('MARKETING_MANAGER_HQ', 'مدير تسويق - HQ', 'Marketing Manager - HQ', 'HQ', 0, 'مدير تسويق - المكتب الرئيسي', 'Marketing Manager - HQ', 0, NULL, 'إدارة التسويق والحملات', TRUE),
('SUPPLY_CHAIN_MANAGER_HQ', 'مدير سلاسل إمداد - HQ', 'Supply Chain Manager - HQ', 'HQ', 0, 'مدير سلاسل الإمداد - المكتب الرئيسي', 'Supply Chain Manager - HQ', 0, NULL, 'إدارة سلاسل الإمداد', TRUE),
('SAFETY_MANAGER_HQ', 'مدير السلامة - HQ', 'Safety Manager - HQ', 'HQ', 0, 'مدير السلامة - المكتب الرئيسي', 'Safety Manager - HQ', 0, NULL, 'إدارة السلامة المهنية', TRUE),
('WAREHOUSE_MANAGER_HQ', 'مدير المخازن - HQ', 'Warehouse Manager - HQ', 'HQ', 0, 'مدير المخازن - المكتب الرئيسي', 'Warehouse Manager - HQ', 0, NULL, 'إدارة المخازن والمخزون', TRUE),
('ACCOUNTANT_HQ', 'محاسب - HQ', 'Accountant - HQ', 'HQ', 0, 'محاسب - المكتب الرئيسي', 'Accountant - HQ', 0, 50000, 'القيود المحاسبية اليومية', TRUE),

-- المستوى 1: فرع
('BRANCH_MANAGER', 'مدير فرع', 'Branch Manager', 'BRANCH', 1, 'مدير فرع', 'Branch Manager', 0, 2000000, 'ضمن ميزانية الفرع المعتمدة', TRUE),
('ASSISTANT_BRANCH_MANAGER', 'مساعد مدير فرع', 'Assistant Branch Manager', 'BRANCH', 1, 'مساعد مدير فرع', 'Assistant Branch Manager', 0, 50000, 'بالنيابة عن مدير الفرع', TRUE),
('HR_OFFICER_BRANCH', 'مسؤول موارد بشرية - فرع', 'HR Officer - Branch', 'BRANCH', 1, 'مسؤول موارد بشرية - فرع', 'HR Officer - Branch', 0, 20000, 'عمليات الموارد البشرية', TRUE),
('FINANCE_OFFICER_BRANCH', 'مسؤول مالي - فرع', 'Finance Officer - Branch', 'BRANCH', 1, 'مسؤول مالي - فرع', 'Finance Officer - Branch', 0, 30000, 'العمليات المالية اليومية', TRUE),
('SALES_OFFICER_BRANCH', 'مسؤول مبيعات - فرع', 'Sales Officer - Branch', 'BRANCH', 1, 'مسؤول مبيعات - فرع', 'Sales Officer - Branch', 0, 15000, 'عمليات المبيعات', TRUE),

-- المستوى 2: حاضنة
('INCUBATOR_MANAGER', 'مدير حاضنة', 'Incubator Manager', 'INCUBATOR', 2, 'مدير حاضنة', 'Incubator Manager', 0, 500000, 'ضمن ميزانية الحاضنة', TRUE),
('ASSISTANT_INCUBATOR_MANAGER', 'مساعد مدير حاضنة', 'Assistant Incubator Manager', 'INCUBATOR', 2, 'مساعد مدير حاضنة', 'Assistant Incubator Manager', 0, 30000, 'للعمليات اليومية', TRUE),
('HR_SPECIALIST_INCUBATOR', 'أخصائي موارد بشرية - حاضنة', 'HR Specialist - Incubator', 'INCUBATOR', 2, 'أخصائي موارد بشرية - حاضنة', 'HR Specialist - Incubator', 0, 10000, 'شؤون الموظفين', TRUE),
('FINANCE_SPECIALIST_INCUBATOR', 'أخصائي مالي - حاضنة', 'Finance Specialist - Incubator', 'INCUBATOR', 2, 'أخصائي مالي - حاضنة', 'Finance Specialist - Incubator', 0, 15000, 'العمليات المالية', TRUE),

-- المستوى 3: منصة
('PLATFORM_MANAGER', 'مدير منصة', 'Platform Manager', 'PLATFORM', 3, 'مدير منصة', 'Platform Manager', 0, 100000, 'ضمن ميزانية المنصة', TRUE),
('ASSISTANT_PLATFORM_MANAGER', 'مساعد مدير منصة', 'Assistant Platform Manager', 'PLATFORM', 3, 'مساعد مدير منصة', 'Assistant Platform Manager', 0, 20000, 'للعمليات اليومية', TRUE),
('PLATFORM_COORDINATOR', 'منسق منصة', 'Platform Coordinator', 'PLATFORM', 3, 'منسق منصة', 'Platform Coordinator', 0, 5000, 'التنسيق اليومي', TRUE),

-- المستوى 4: مكتب تنفيذي
('EXECUTIVE_OFFICE_MANAGER', 'مسؤول تنفيذي مكاتب', 'Executive Office Manager', 'OFFICE', 4, 'مسؤول تنفيذي مكاتب', 'Executive Office Manager', 0, 10000, 'للمصروفات التشغيلية', TRUE),
('ADMINISTRATIVE_EXECUTIVE', 'إداري تنفيذي', 'Administrative Executive', 'OFFICE', 4, 'إداري تنفيذي', 'Administrative Executive', 0, 5000, 'للمصروفات الصغيرة', TRUE),
('HR_EXECUTIVE', 'تنفيذي موارد بشرية', 'HR Executive', 'OFFICE', 4, 'تنفيذي موارد بشرية', 'HR Executive', 0, 3000, 'العمليات اليومية', TRUE),
('FINANCE_EXECUTIVE', 'تنفيذي مالي', 'Finance Executive', 'OFFICE', 4, 'تنفيذي مالي', 'Finance Executive', 0, 3000, 'المعاملات المالية', TRUE),
('PROCUREMENT_EXECUTIVE', 'تنفيذي مشتريات', 'Procurement Executive', 'OFFICE', 4, 'تنفيذي مشتريات', 'Procurement Executive', 0, 2000, 'طلبات الشراء', TRUE),
('SALES_EXECUTIVE', 'تنفيذي مبيعات', 'Sales Executive', 'OFFICE', 4, 'تنفيذي مبيعات', 'Sales Executive', 0, 2000, 'عمليات البيع', TRUE),
('MARKETING_EXECUTIVE', 'تنفيذي تسويق', 'Marketing Executive', 'OFFICE', 4, 'تنفيذي تسويق', 'Marketing Executive', 0, 2000, 'الحملات التسويقية', TRUE),
('LOGISTICS_EXECUTIVE', 'تنفيذي لوجستيات', 'Logistics Executive', 'OFFICE', 4, 'تنفيذي لوجستيات', 'Logistics Executive', 0, 1000, 'عمليات الشحن', TRUE),
('SAFETY_EXECUTIVE', 'تنفيذي سلامة', 'Safety Executive', 'OFFICE', 4, 'تنفيذي سلامة', 'Safety Executive', 0, 1000, 'تسجيل الحوادث', TRUE),
('WAREHOUSE_EXECUTIVE', 'تنفيذي مخازن', 'Warehouse Executive', 'OFFICE', 4, 'تنفيذي مخازن', 'Warehouse Executive', 0, 1000, 'عمليات المخزون', TRUE),
('EMPLOYEE', 'موظف', 'Regular Employee', 'OFFICE', 4, 'موظف', 'Employee', 0, 0, 'لا توجد صلاحيات موافقة مالية', TRUE)

ON CONFLICT (name) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    description = EXCLUDED.description,
    hierarchy_level = EXCLUDED.hierarchy_level,
    job_title_ar = EXCLUDED.job_title_ar,
    job_title_en = EXCLUDED.job_title_en,
    min_approval_limit = EXCLUDED.min_approval_limit,
    max_approval_limit = EXCLUDED.max_approval_limit,
    approval_notes_ar = EXCLUDED.approval_notes_ar,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 5. إنشاء جدول مصفوفة الصلاحيات
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_system_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    system_id INTEGER REFERENCES systems(id) ON DELETE CASCADE,
    permission_level_id INTEGER REFERENCES permission_levels(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, system_id)
);

-- ============================================================================
-- 6. إنشاء جدول سياسات الأمان
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_policies (
    id SERIAL PRIMARY KEY,
    policy_code VARCHAR(50) UNIQUE NOT NULL,
    policy_name_ar VARCHAR(200) NOT NULL,
    policy_name_en VARCHAR(200) NOT NULL,
    description_ar TEXT,
    responsible_role VARCHAR(100),
    enforcement_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO security_policies (policy_code, policy_name_ar, policy_name_en, description_ar, responsible_role, enforcement_type) VALUES
('TWO_FACTOR_AUTH', 'المصادقة الثنائية (2FA)', 'Two-Factor Authentication', 'إلزامية لجميع المناصب الإدارية والمالية', 'مدير IT', 'MANDATORY'),
('PASSWORD_ROTATION', 'تغيير كلمات المرور', 'Password Rotation', 'كل 90 يوماً للمناصب الحساسة', 'مدير IT', 'MANDATORY'),
('AUDIT_LOGS', 'سجلات التدقيق', 'Audit Logs', 'تسجيل جميع العمليات مع التاريخ والمستخدم', 'سوبر آدمن', 'AUTOMATIC'),
('PERMISSION_REVIEW', 'مراجعة الصلاحيات', 'Permission Review', 'مراجعة دورية كل 6 أشهر', 'مدير الموارد البشرية', 'MANDATORY'),
('IMMEDIATE_REVOKE', 'إلغاء الصلاحيات الفوري', 'Immediate Revocation', 'عند انتهاء العمل أو النقل', 'مدير الموارد البشرية', 'IMMEDIATE'),
('SEPARATION_OF_DUTIES', 'الفصل بين الواجبات', 'Separation of Duties', 'لا يمكن لشخص واحد إنشاء وموافقة وصرف', 'مدير المالي', 'MANDATORY'),
('DAILY_BACKUP', 'النسخ الاحتياطي', 'Daily Backup', 'يومياً للبيانات الحساسة', 'مدير IT', 'AUTOMATIC'),
('DATA_ENCRYPTION', 'تشفير البيانات', 'Data Encryption', 'تشفير البيانات المالية والشخصية', 'مدير IT', 'PERMANENT'),
('LOGIN_ATTEMPTS', 'محاولات الدخول الفاشلة', 'Failed Login Attempts', 'قفل الحساب بعد 5 محاولات فاشلة', 'النظام', 'AUTOMATIC'),
('SECURITY_ALERTS', 'تنبيهات الأمان', 'Security Alerts', 'إشعار فوري لمحاولات الوصول غير المصرح', 'مدير IT', 'AUTOMATIC'),
('SECURITY_TRAINING', 'التدريب الأمني', 'Security Training', 'تدريب سنوي إلزامي لجميع المستخدمين', 'مدير الموارد البشرية', 'ANNUAL'),
('REGULATORY_COMPLIANCE', 'الامتثال التنظيمي', 'Regulatory Compliance', 'الالتزام بالأنظمة المحلية والدولية', 'مدير القانونية', 'PERMANENT')
ON CONFLICT (policy_code) DO UPDATE SET
    policy_name_ar = EXCLUDED.policy_name_ar;

-- ============================================================================
-- 7. إنشاء المؤشرات
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_role_system_permissions_role ON role_system_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_system_permissions_system ON role_system_permissions(system_id);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy ON roles(hierarchy_level);

COMMIT;

SELECT 'تم إنشاء البنية الأساسية بنجاح' AS status;
