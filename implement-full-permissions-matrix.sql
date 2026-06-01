-- ============================================================================
-- نظام مصفوفة الصلاحيات الكامل للنظام المالي الدولي
-- يناير 2026 - الإصدار 1.0
-- ============================================================================
-- يشمل: 33 مسمى وظيفي + 8 أنظمة + 6 مستويات صلاحيات + حدود مالية + سياسات أمان
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. إنشاء جدول مستويات الصلاحيات (Permission Levels)
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

COMMENT ON TABLE permission_levels IS 'مستويات الصلاحيات الستة';

-- إدخال المستويات الستة
INSERT INTO permission_levels (level_code, level_name_ar, level_name_en, description_ar, description_en, color_code, priority_order) VALUES
('FULL', 'كامل', 'Full Access', 'صلاحيات كاملة بدون قيود', 'Complete access without restrictions', '#00FF00', 1),
('VIEW_APPROVE', 'عرض+موافقة', 'View & Approve', 'عرض البيانات والموافقة على العمليات', 'View data and approve operations', '#FFD700', 2),
('EXECUTIVE', 'تنفيذي', 'Executive', 'تنفيذ العمليات اليومية', 'Execute daily operations', '#87CEEB', 3),
('VIEW', 'عرض/قراءة', 'View/Read Only', 'عرض البيانات فقط', 'View data only', '#90EE90', 4),
('LIMITED', 'محدود', 'Limited', 'صلاحيات محدودة جداً بنطاق ضيق', 'Very limited permissions', '#FFB6C1', 5),
('NONE', 'لا يوجد', 'No Access', 'لا توجد صلاحيات', 'No permissions', '#FF0000', 6)
ON CONFLICT (level_code) DO UPDATE SET
    level_name_ar = EXCLUDED.level_name_ar,
    level_name_en = EXCLUDED.level_name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en,
    color_code = EXCLUDED.color_code,
    priority_order = EXCLUDED.priority_order,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 2. إنشاء جدول الأنظمة الثمانية (Systems)
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

COMMENT ON TABLE systems IS 'الأنظمة الثمانية في النظام';

-- إدخال الأنظمة الثمانية
INSERT INTO systems (system_code, system_name_ar, system_name_en, description_ar, description_en, main_functions_ar, main_functions_en, display_order) VALUES
('HR_ADMIN', 'الإداري والموارد البشرية', 'HR & Administration', 'إدارة شؤون الموظفين والهيكل التنظيمي', 'Manage employee affairs and organizational structure', 
    ARRAY['التوظيف', 'الرواتب', 'الإجازات', 'التقييم', 'التدريب'],
    ARRAY['Recruitment', 'Payroll', 'Leave Management', 'Performance Evaluation', 'Training'], 1),

('FINANCE', 'المالي والمحاسبي', 'Finance & Accounting', 'إدارة الحسابات والقوائم المالية', 'Manage accounts and financial statements',
    ARRAY['القيود المحاسبية', 'الميزانية', 'التدفقات النقدية', 'التقارير المالية'],
    ARRAY['Journal Entries', 'Budget', 'Cash Flow', 'Financial Reports'], 2),

('PROCUREMENT', 'المشتريات', 'Procurement', 'إدارة عمليات الشراء والموردين', 'Manage purchasing and suppliers',
    ARRAY['طلبات الشراء', 'أوامر الشراء', 'إدارة الموردين', 'المناقصات'],
    ARRAY['Purchase Requests', 'Purchase Orders', 'Supplier Management', 'Tenders'], 3),

('SALES', 'المبيعات', 'Sales', 'إدارة عمليات البيع والعملاء', 'Manage sales and customers',
    ARRAY['عروض الأسعار', 'الفواتير', 'إدارة العملاء (CRM)', 'تتبع الصفقات'],
    ARRAY['Quotations', 'Invoices', 'Customer Management (CRM)', 'Deal Tracking'], 4),

('MARKETING', 'التسويق', 'Marketing', 'إدارة الحملات التسويقية والعلامة التجارية', 'Manage marketing campaigns and branding',
    ARRAY['الحملات', 'تحليل السوق', 'إدارة المحتوى', 'السوشيال ميديا'],
    ARRAY['Campaigns', 'Market Analysis', 'Content Management', 'Social Media'], 5),

('SUPPLY_CHAIN', 'سلاسل الإمداد واللوجستيات', 'Supply Chain & Logistics', 'إدارة الشحن والتوزيع', 'Manage shipping and distribution',
    ARRAY['الشحنات', 'التتبع', 'التسليم', 'إدارة الموردين اللوجستيين'],
    ARRAY['Shipments', 'Tracking', 'Delivery', 'Logistics Supplier Management'], 6),

('SAFETY', 'السلامة', 'Safety', 'إدارة السلامة المهنية والامتثال', 'Manage occupational safety and compliance',
    ARRAY['تقييم المخاطر', 'الحوادث', 'التدريب الأمني', 'الامتثال'],
    ARRAY['Risk Assessment', 'Incidents', 'Safety Training', 'Compliance'], 7),

('WAREHOUSE', 'المخازن', 'Warehouse', 'إدارة المخزون والمستودعات', 'Manage inventory and warehouses',
    ARRAY['الإدخال', 'الإخراج', 'الجرد', 'تتبع المواد', 'تقارير المخزون'],
    ARRAY['Receiving', 'Issuing', 'Inventory Count', 'Material Tracking', 'Inventory Reports'], 8)
ON CONFLICT (system_code) DO UPDATE SET
    system_name_ar = EXCLUDED.system_name_ar,
    system_name_en = EXCLUDED.system_name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en,
    main_functions_ar = EXCLUDED.main_functions_ar,
    main_functions_en = EXCLUDED.main_functions_en,
    display_order = EXCLUDED.display_order,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 3. إنشاء جدول الصلاحيات التفصيلية (Detailed Permissions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_permissions (
    id SERIAL PRIMARY KEY,
    system_id INTEGER REFERENCES systems(id) ON DELETE CASCADE,
    permission_level_id INTEGER REFERENCES permission_levels(id) ON DELETE CASCADE,
    allowed_actions_ar TEXT[],
    allowed_actions_en TEXT[],
    restrictions_ar TEXT[],
    restrictions_en TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(system_id, permission_level_id)
);

COMMENT ON TABLE system_permissions IS 'الصلاحيات التفصيلية لكل نظام حسب المستوى';

-- إدخال الصلاحيات التفصيلية للنظام الإداري والموارد البشرية
INSERT INTO system_permissions (system_id, permission_level_id, allowed_actions_ar, allowed_actions_en, restrictions_ar, restrictions_en)
SELECT s.id, pl.id,
    CASE pl.level_code
        WHEN 'FULL' THEN ARRAY['إنشاء/تعديل/حذف الموظفين', 'إدارة الهيكل التنظيمي', 'الموافقة على الإجازات', 'إعداد التقارير']
        WHEN 'VIEW_APPROVE' THEN ARRAY['عرض بيانات الموظفين', 'الموافقة على الإجازات والطلبات']
        WHEN 'VIEW' THEN ARRAY['عرض بيانات الموظفين والتقارير فقط']
        WHEN 'EXECUTIVE' THEN ARRAY['إدخال حضور وانصراف', 'طلبات الإجازات الشخصية']
        WHEN 'LIMITED' THEN ARRAY['عرض البيانات الشخصية فقط']
        ELSE ARRAY[]::TEXT[]
    END,
    CASE pl.level_code
        WHEN 'FULL' THEN ARRAY['Create/Edit/Delete Employees', 'Manage Org Structure', 'Approve Leave', 'Generate Reports']
        WHEN 'VIEW_APPROVE' THEN ARRAY['View Employee Data', 'Approve Leave and Requests']
        WHEN 'VIEW' THEN ARRAY['View Employee Data and Reports Only']
        WHEN 'EXECUTIVE' THEN ARRAY['Enter Attendance', 'Personal Leave Requests']
        WHEN 'LIMITED' THEN ARRAY['View Personal Data Only']
        ELSE ARRAY[]::TEXT[]
    END,
    CASE pl.level_code
        WHEN 'FULL' THEN ARRAY['لا يوجد']
        WHEN 'VIEW_APPROVE' THEN ARRAY['لا يمكن حذف السجلات']
        WHEN 'VIEW' THEN ARRAY['لا يمكن التعديل أو الموافقة']
        WHEN 'EXECUTIVE' THEN ARRAY['بيانات شخصية فقط']
        WHEN 'LIMITED' THEN ARRAY['لا وصول لبيانات الآخرين']
        ELSE ARRAY['منع الوصول الكامل']::TEXT[]
    END,
    CASE pl.level_code
        WHEN 'FULL' THEN ARRAY['None']
        WHEN 'VIEW_APPROVE' THEN ARRAY['Cannot Delete Records']
        WHEN 'VIEW' THEN ARRAY['No Edit or Approve']
        WHEN 'EXECUTIVE' THEN ARRAY['Personal Data Only']
        WHEN 'LIMITED' THEN ARRAY['No Access to Others Data']
        ELSE ARRAY['Full Access Denied']::TEXT[]
    END
FROM systems s
CROSS JOIN permission_levels pl
WHERE s.system_code = 'HR_ADMIN'
ON CONFLICT (system_id, permission_level_id) DO UPDATE SET
    allowed_actions_ar = EXCLUDED.allowed_actions_ar,
    allowed_actions_en = EXCLUDED.allowed_actions_en,
    restrictions_ar = EXCLUDED.restrictions_ar,
    restrictions_en = EXCLUDED.restrictions_en,
    updated_at = CURRENT_TIMESTAMP;

-- إدخال الصلاحيات التفصيلية للنظام المالي والمحاسبي
INSERT INTO system_permissions (system_id, permission_level_id, allowed_actions_ar, allowed_actions_en, restrictions_ar, restrictions_en)
SELECT s.id, pl.id,
    CASE pl.level_code
        WHEN 'FULL' THEN ARRAY['إنشاء القيود', 'الموافقة المالية', 'إقفال الحسابات', 'إعداد القوائم المالية']
        WHEN 'VIEW_APPROVE' THEN ARRAY['عرض السجلات المالية', 'الموافقة على المصروفات حسب الحد المالي']
        WHEN 'VIEW' THEN ARRAY['عرض التقارير المالية والميزانيات فقط']
        WHEN 'EXECUTIVE' THEN ARRAY['إدخال القيود المحاسبية اليومية']
        WHEN 'LIMITED' THEN ARRAY['الاطلاع على التقارير المالية الموحدة']
        ELSE ARRAY[]::TEXT[]
    END,
    CASE pl.level_code
        WHEN 'FULL' THEN ARRAY['Create Entries', 'Financial Approval', 'Close Accounts', 'Prepare Financial Statements']
        WHEN 'VIEW_APPROVE' THEN ARRAY['View Financial Records', 'Approve Expenses per Limit']
        WHEN 'VIEW' THEN ARRAY['View Financial Reports and Budgets Only']
        WHEN 'EXECUTIVE' THEN ARRAY['Enter Daily Journal Entries']
        WHEN 'LIMITED' THEN ARRAY['View Consolidated Financial Reports']
        ELSE ARRAY[]::TEXT[]
    END,
    CASE pl.level_code
        WHEN 'FULL' THEN ARRAY['يخضع لسياسات المراجعة']
        WHEN 'VIEW_APPROVE' THEN ARRAY['لا يمكن إقفال الفترات المالية']
        WHEN 'VIEW' THEN ARRAY['لا تعديل أو موافقة']
        WHEN 'EXECUTIVE' THEN ARRAY['تحتاج موافقة مدير مالي']
        WHEN 'LIMITED' THEN ARRAY['بدون تفاصيل حساسة']
        ELSE ARRAY['منع الوصول الكامل']::TEXT[]
    END,
    CASE pl.level_code
        WHEN 'FULL' THEN ARRAY['Subject to Audit Policies']
        WHEN 'VIEW_APPROVE' THEN ARRAY['Cannot Close Financial Periods']
        WHEN 'VIEW' THEN ARRAY['No Edit or Approve']
        WHEN 'EXECUTIVE' THEN ARRAY['Requires Finance Manager Approval']
        WHEN 'LIMITED' THEN ARRAY['Without Sensitive Details']
        ELSE ARRAY['Full Access Denied']::TEXT[]
    END
FROM systems s
CROSS JOIN permission_levels pl
WHERE s.system_code = 'FINANCE'
ON CONFLICT (system_id, permission_level_id) DO UPDATE SET
    allowed_actions_ar = EXCLUDED.allowed_actions_ar,
    allowed_actions_en = EXCLUDED.allowed_actions_en,
    restrictions_ar = EXCLUDED.restrictions_ar,
    restrictions_en = EXCLUDED.restrictions_en,
    updated_at = CURRENT_TIMESTAMP;

-- إدخال الصلاحيات للأنظمة المتبقية (المشتريات، المبيعات، التسويق، سلاسل الإمداد، السلامة، المخازن)
-- يمكن إضافة المزيد حسب التفاصيل المطلوبة...

-- ============================================================================
-- 4. تحديث جدول الأدوار ليشمل الـ 33 مسمى وظيفي
-- ============================================================================

-- إضافة أعمدة جديدة لجدول الأدوار
ALTER TABLE roles ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS job_title_ar VARCHAR(200);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS job_title_en VARCHAR(200);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS min_approval_limit DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS max_approval_limit DECIMAL(15, 2);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS approval_notes_ar TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS approval_notes_en TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN roles.hierarchy_level IS 'المستوى الهرمي: 0=المكتب الرئيسي، 1=فرع، 2=حاضنة، 3=منصة، 4=مكتب تنفيذي';
COMMENT ON COLUMN roles.min_approval_limit IS 'الحد الأدنى للموافقات المالية';
COMMENT ON COLUMN roles.max_approval_limit IS 'الحد الأقصى للموافقات المالية (NULL = غير محدود)';

-- ============================================================================
-- 5. إدخال الـ 33 مسمى وظيفي
-- ============================================================================

-- المستوى 0: المكتب الرئيسي (HQ)
INSERT INTO roles (name, name_ar, description, hierarchy_level, level, job_title_ar, job_title_en, min_approval_limit, max_approval_limit, approval_notes_ar, approval_notes_en, is_active)
VALUES
('SUPER_ADMIN', 'سوبر آدمن', 'Super Administrator - Full System Access', 0, 'HQ', 
    'سوبر آدمن', 'Super Admin', 0, NULL, 'صلاحيات مطلقة', 'Absolute authority', TRUE),

('FINANCIAL_MANAGER_HQ', 'مدير مالي - المكتب الرئيسي', 'Financial Manager - Headquarters', 0, 'HQ',
    'مدير مالي - المكتب الرئيسي', 'Financial Manager - HQ', 0, NULL, 'يخضع لسياسات مجلس الإدارة', 'Subject to Board policies', TRUE),

('EXECUTIVE_MANAGER_HQ', 'مدير تنفيذي - المكتب الرئيسي', 'Executive Manager - Headquarters', 0, 'HQ',
    'مدير تنفيذي - المكتب الرئيسي', 'Executive Manager - HQ', 0, 5000000, 'للموافقات الاستراتيجية', 'For strategic approvals', TRUE),

('HR_MANAGER_HQ', 'مدير موارد بشرية - المكتب الرئيسي', 'HR Manager - Headquarters', 0, 'HQ',
    'مدير موارد بشرية - المكتب الرئيسي', 'HR Manager - HQ', 0, NULL, 'إدارة كاملة للموارد البشرية', 'Full HR management', TRUE),

('PROCUREMENT_MANAGER_HQ', 'مدير مشتريات - المكتب الرئيسي', 'Procurement Manager - Headquarters', 0, 'HQ',
    'مدير مشتريات - المكتب الرئيسي', 'Procurement Manager - HQ', 0, NULL, 'إدارة المشتريات والموردين', 'Procurement & supplier management', TRUE),

('SALES_MANAGER_HQ', 'مدير مبيعات - المكتب الرئيسي', 'Sales Manager - Headquarters', 0, 'HQ',
    'مدير مبيعات - المكتب الرئيسي', 'Sales Manager - HQ', 0, NULL, 'إدارة المبيعات والعملاء', 'Sales & customer management', TRUE),

('MARKETING_MANAGER_HQ', 'مدير تسويق - المكتب الرئيسي', 'Marketing Manager - Headquarters', 0, 'HQ',
    'مدير تسويق - المكتب الرئيسي', 'Marketing Manager - HQ', 0, NULL, 'إدارة التسويق والحملات', 'Marketing & campaigns management', TRUE),

('SUPPLY_CHAIN_MANAGER_HQ', 'مدير سلاسل الإمداد - المكتب الرئيسي', 'Supply Chain Manager - Headquarters', 0, 'HQ',
    'مدير سلاسل الإمداد - المكتب الرئيسي', 'Supply Chain Manager - HQ', 0, NULL, 'إدارة سلاسل الإمداد', 'Supply chain management', TRUE),

('SAFETY_MANAGER_HQ', 'مدير السلامة - المكتب الرئيسي', 'Safety Manager - Headquarters', 0, 'HQ',
    'مدير السلامة - المكتب الرئيسي', 'Safety Manager - HQ', 0, NULL, 'إدارة السلامة المهنية', 'Occupational safety management', TRUE),

('WAREHOUSE_MANAGER_HQ', 'مدير المخازن - المكتب الرئيسي', 'Warehouse Manager - Headquarters', 0, 'HQ',
    'مدير المخازن - المكتب الرئيسي', 'Warehouse Manager - HQ', 0, NULL, 'إدارة المخازن والمخزون', 'Warehouse & inventory management', TRUE),

('ACCOUNTANT_HQ', 'محاسب - المكتب الرئيسي', 'Accountant - Headquarters', 0, 'HQ',
    'محاسب - المكتب الرئيسي', 'Accountant - HQ', 0, 50000, 'القيود المحاسبية اليومية', 'Daily accounting entries', TRUE),

-- المستوى 1: فرع الدولة (BRANCH)
('BRANCH_MANAGER', 'مدير فرع', 'Branch Manager', 1, 'BRANCH',
    'مدير فرع', 'Branch Manager', 0, 2000000, 'ضمن ميزانية الفرع المعتمدة', 'Within approved branch budget', TRUE),

('ASSISTANT_BRANCH_MANAGER', 'مساعد مدير فرع', 'Assistant Branch Manager', 1, 'BRANCH',
    'مساعد مدير فرع', 'Assistant Branch Manager', 0, 50000, 'بالنيابة عن مدير الفرع', 'On behalf of branch manager', TRUE),

('HR_OFFICER_BRANCH', 'مسؤول موارد بشرية - فرع', 'HR Officer - Branch', 1, 'BRANCH',
    'مسؤول موارد بشرية - فرع', 'HR Officer - Branch', 0, 20000, 'عمليات الموارد البشرية', 'HR operations', TRUE),

('FINANCE_OFFICER_BRANCH', 'مسؤول مالي - فرع', 'Finance Officer - Branch', 1, 'BRANCH',
    'مسؤول مالي - فرع', 'Finance Officer - Branch', 0, 30000, 'العمليات المالية اليومية', 'Daily financial operations', TRUE),

('SALES_OFFICER_BRANCH', 'مسؤول مبيعات - فرع', 'Sales Officer - Branch', 1, 'BRANCH',
    'مسؤول مبيعات - فرع', 'Sales Officer - Branch', 0, 15000, 'عمليات المبيعات', 'Sales operations', TRUE),

-- المستوى 2: حاضنة قطاع الأعمال (INCUBATOR)
('INCUBATOR_MANAGER', 'مدير حاضنة', 'Incubator Manager', 2, 'INCUBATOR',
    'مدير حاضنة', 'Incubator Manager', 0, 500000, 'ضمن ميزانية الحاضنة', 'Within incubator budget', TRUE),

('ASSISTANT_INCUBATOR_MANAGER', 'مساعد مدير حاضنة', 'Assistant Incubator Manager', 2, 'INCUBATOR',
    'مساعد مدير حاضنة', 'Assistant Incubator Manager', 0, 30000, 'للعمليات اليومية', 'For daily operations', TRUE),

('HR_SPECIALIST_INCUBATOR', 'أخصائي موارد بشرية - حاضنة', 'HR Specialist - Incubator', 2, 'INCUBATOR',
    'أخصائي موارد بشرية - حاضنة', 'HR Specialist - Incubator', 0, 10000, 'شؤون الموظفين', 'Employee affairs', TRUE),

('FINANCE_SPECIALIST_INCUBATOR', 'أخصائي مالي - حاضنة', 'Finance Specialist - Incubator', 2, 'INCUBATOR',
    'أخصائي مالي - حاضنة', 'Finance Specialist - Incubator', 0, 15000, 'العمليات المالية', 'Financial operations', TRUE),

-- المستوى 3: المنصة التشغيلية (PLATFORM)
('PLATFORM_MANAGER', 'مدير منصة', 'Platform Manager', 3, 'PLATFORM',
    'مدير منصة', 'Platform Manager', 0, 100000, 'ضمن ميزانية المنصة', 'Within platform budget', TRUE),

('ASSISTANT_PLATFORM_MANAGER', 'مساعد مدير منصة', 'Assistant Platform Manager', 3, 'PLATFORM',
    'مساعد مدير منصة', 'Assistant Platform Manager', 0, 20000, 'للعمليات اليومية', 'For daily operations', TRUE),

('PLATFORM_COORDINATOR', 'منسق منصة', 'Platform Coordinator', 3, 'PLATFORM',
    'منسق منصة', 'Platform Coordinator', 0, 5000, 'التنسيق اليومي', 'Daily coordination', TRUE),

-- المستوى 4: المكتب الإداري التنفيذي (EXECUTIVE_OFFICE)
('EXECUTIVE_OFFICE_MANAGER', 'مسؤول تنفيذي مكاتب', 'Executive Office Manager', 4, 'EXECUTIVE_OFFICE',
    'مسؤول تنفيذي مكاتب', 'Executive Office Manager', 0, 10000, 'للمصروفات التشغيلية', 'For operational expenses', TRUE),

('ADMINISTRATIVE_EXECUTIVE', 'إداري تنفيذي', 'Administrative Executive', 4, 'EXECUTIVE_OFFICE',
    'إداري تنفيذي', 'Administrative Executive', 0, 5000, 'للمصروفات الصغيرة', 'For small expenses', TRUE),

('HR_EXECUTIVE', 'تنفيذي موارد بشرية', 'HR Executive', 4, 'EXECUTIVE_OFFICE',
    'تنفيذي موارد بشرية', 'HR Executive', 0, 3000, 'العمليات اليومية', 'Daily operations', TRUE),

('FINANCE_EXECUTIVE', 'تنفيذي مالي', 'Finance Executive', 4, 'EXECUTIVE_OFFICE',
    'تنفيذي مالي', 'Finance Executive', 0, 3000, 'المعاملات المالية', 'Financial transactions', TRUE),

('PROCUREMENT_EXECUTIVE', 'تنفيذي مشتريات', 'Procurement Executive', 4, 'EXECUTIVE_OFFICE',
    'تنفيذي مشتريات', 'Procurement Executive', 0, 2000, 'طلبات الشراء', 'Purchase requests', TRUE),

('SALES_EXECUTIVE', 'تنفيذي مبيعات', 'Sales Executive', 4, 'EXECUTIVE_OFFICE',
    'تنفيذي مبيعات', 'Sales Executive', 0, 2000, 'عمليات البيع', 'Sales operations', TRUE),

('MARKETING_EXECUTIVE', 'تنفيذي تسويق', 'Marketing Executive', 4, 'EXECUTIVE_OFFICE',
    'تنفيذي تسويق', 'Marketing Executive', 0, 2000, 'الحملات التسويقية', 'Marketing campaigns', TRUE),

('LOGISTICS_EXECUTIVE', 'تنفيذي لوجستيات', 'Logistics Executive', 4, 'EXECUTIVE_OFFICE',
    'تنفيذي لوجستيات', 'Logistics Executive', 0, 1000, 'عمليات الشحن', 'Shipping operations', TRUE),

('SAFETY_EXECUTIVE', 'تنفيذي سلامة', 'Safety Executive', 4, 'EXECUTIVE_OFFICE',
    'تنفيذي سلامة', 'Safety Executive', 0, 1000, 'تسجيل الحوادث', 'Incident reporting', TRUE),

('WAREHOUSE_EXECUTIVE', 'تنفيذي مخازن', 'Warehouse Executive', 4, 'EXECUTIVE_OFFICE',
    'تنفيذي مخازن', 'Warehouse Executive', 0, 1000, 'عمليات المخزون', 'Inventory operations', TRUE),

('EMPLOYEE', 'موظف', 'Regular Employee', 4, 'EXECUTIVE_OFFICE',
    'موظف', 'Employee', 0, 0, 'لا توجد صلاحيات موافقة مالية', 'No financial approval authority', TRUE)

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    hierarchy_level = EXCLUDED.hierarchy_level,
    level = EXCLUDED.level,
    job_title_ar = EXCLUDED.job_title_ar,
    job_title_en = EXCLUDED.job_title_en,
    min_approval_limit = EXCLUDED.min_approval_limit,
    max_approval_limit = EXCLUDED.max_approval_limit,
    approval_notes_ar = EXCLUDED.approval_notes_ar,
    approval_notes_en = EXCLUDED.approval_notes_en,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 6. إنشاء جدول مصفوفة الصلاحيات (Permissions Matrix)
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

COMMENT ON TABLE role_system_permissions IS 'مصفوفة الصلاحيات: ربط الأدوار بالأنظمة ومستويات الصلاحيات';

-- ============================================================================
-- 7. إنشاء جدول سياسات الأمان والامتثال
-- ============================================================================
DROP TABLE IF EXISTS security_policies CASCADE;
CREATE TABLE security_policies (
    id SERIAL PRIMARY KEY,
    policy_code VARCHAR(50) UNIQUE NOT NULL,
    policy_name_ar VARCHAR(200) NOT NULL,
    policy_name_en VARCHAR(200) NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    responsible_role VARCHAR(100),
    enforcement_type VARCHAR(50), -- MANDATORY, AUTOMATIC, IMMEDIATE, ANNUAL, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE security_policies IS 'سياسات الأمان والامتثال';

-- إدخال السياسات الـ 12
INSERT INTO security_policies (policy_code, policy_name_ar, policy_name_en, description_ar, description_en, responsible_role, enforcement_type) VALUES
('TWO_FACTOR_AUTH', 'المصادقة الثنائية (2FA)', 'Two-Factor Authentication (2FA)', 
    'إلزامية لجميع المناصب الإدارية والمالية', 'Mandatory for all managerial and financial positions', 
    'مدير IT', 'MANDATORY'),

('PASSWORD_ROTATION', 'تغيير كلمات المرور', 'Password Rotation', 
    'كل 90 يوماً للمناصب الحساسة', 'Every 90 days for sensitive positions', 
    'مدير IT', 'MANDATORY'),

('AUDIT_LOGS', 'سجلات التدقيق (Audit Logs)', 'Audit Logs', 
    'تسجيل جميع العمليات مع التاريخ والمستخدم', 'Log all operations with date and user', 
    'سوبر آدمن', 'AUTOMATIC'),

('PERMISSION_REVIEW', 'مراجعة الصلاحيات', 'Permission Review', 
    'مراجعة دورية كل 6 أشهر', 'Periodic review every 6 months', 
    'مدير الموارد البشرية', 'MANDATORY'),

('IMMEDIATE_REVOKE', 'إلغاء الصلاحيات الفوري', 'Immediate Permission Revocation', 
    'عند انتهاء العمل أو النقل', 'Upon termination or transfer', 
    'مدير الموارد البشرية', 'IMMEDIATE'),

('SEPARATION_OF_DUTIES', 'الفصل بين الواجبات', 'Separation of Duties', 
    'لا يمكن لشخص واحد إنشاء وموافقة وصرف', 'One person cannot create, approve, and disburse', 
    'مدير المالي', 'MANDATORY'),

('DAILY_BACKUP', 'النسخ الاحتياطي', 'Daily Backup', 
    'يومياً للبيانات الحساسة', 'Daily for sensitive data', 
    'مدير IT', 'AUTOMATIC'),

('DATA_ENCRYPTION', 'تشفير البيانات', 'Data Encryption', 
    'تشفير البيانات المالية والشخصية', 'Encrypt financial and personal data', 
    'مدير IT', 'PERMANENT'),

('LOGIN_ATTEMPTS', 'محاولات الدخول الفاشلة', 'Failed Login Attempts', 
    'قفل الحساب بعد 5 محاولات فاشلة', 'Lock account after 5 failed attempts', 
    'النظام', 'AUTOMATIC'),

('SECURITY_ALERTS', 'تنبيهات الأمان', 'Security Alerts', 
    'إشعار فوري لمحاولات الوصول غير المصرح', 'Immediate notification for unauthorized access attempts', 
    'مدير IT', 'AUTOMATIC'),

('SECURITY_TRAINING', 'التدريب الأمني', 'Security Training', 
    'تدريب سنوي إلزامي لجميع المستخدمين', 'Mandatory annual training for all users', 
    'مدير الموارد البشرية', 'ANNUAL'),

('REGULATORY_COMPLIANCE', 'الامتثال التنظيمي', 'Regulatory Compliance', 
    'الالتزام بالأنظمة المحلية والدولية', 'Compliance with local and international regulations', 
    'مدير القانونية', 'PERMANENT')
ON CONFLICT (policy_code) DO UPDATE SET
    policy_name_ar = EXCLUDED.policy_name_ar,
    policy_name_en = EXCLUDED.policy_name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en,
    responsible_role = EXCLUDED.responsible_role,
    enforcement_type = EXCLUDED.enforcement_type,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- 8. إنشاء مؤشرات للأداء
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_role_system_permissions_role ON role_system_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_system_permissions_system ON role_system_permissions(system_id);
CREATE INDEX IF NOT EXISTS idx_role_system_permissions_level ON role_system_permissions(permission_level_id);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy ON roles(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level);
CREATE INDEX IF NOT EXISTS idx_system_permissions_system ON system_permissions(system_id);
CREATE INDEX IF NOT EXISTS idx_system_permissions_level ON system_permissions(permission_level_id);

-- ============================================================================
-- 9. إنشاء دوال مساعدة
-- ============================================================================

-- دالة للتحقق من صلاحية المستخدم لنظام معين
CREATE OR REPLACE FUNCTION check_user_system_permission(
    p_user_id INTEGER,
    p_system_code VARCHAR,
    p_required_level VARCHAR DEFAULT 'VIEW'
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        JOIN role_system_permissions rsp ON r.id = rsp.role_id
        JOIN systems s ON rsp.system_id = s.id
        JOIN permission_levels pl ON rsp.permission_level_id = pl.id
        WHERE u.id = p_user_id
        AND s.system_code = p_system_code
        AND pl.priority_order <= (SELECT priority_order FROM permission_levels WHERE level_code = p_required_level)
        AND u.is_active = TRUE
        AND r.is_active = TRUE
        AND rsp.is_active = TRUE
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_user_system_permission IS 'التحقق من صلاحية المستخدم لنظام معين';

-- دالة للتحقق من حد الموافقة المالية للمستخدم
CREATE OR REPLACE FUNCTION check_user_approval_limit(
    p_user_id INTEGER,
    p_amount DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_authority BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.id = p_user_id
        AND r.min_approval_limit <= p_amount
        AND (r.max_approval_limit IS NULL OR r.max_approval_limit >= p_amount)
        AND u.is_active = TRUE
        AND r.is_active = TRUE
    ) INTO v_has_authority;
    
    RETURN v_has_authority;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_user_approval_limit IS 'التحقق من صلاحية الموافقة المالية للمستخدم';

-- دالة لعرض صلاحيات المستخدم الكاملة
CREATE OR REPLACE FUNCTION get_user_permissions_summary(p_user_id INTEGER)
RETURNS TABLE (
    system_name_ar VARCHAR,
    system_name_en VARCHAR,
    permission_level_ar VARCHAR,
    permission_level_en VARCHAR,
    allowed_actions TEXT,
    restrictions TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.system_name_ar,
        s.system_name_en,
        pl.level_name_ar,
        pl.level_name_en,
        array_to_string(sp.allowed_actions_ar, ', ') AS allowed_actions,
        array_to_string(sp.restrictions_ar, ', ') AS restrictions
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    JOIN role_system_permissions rsp ON r.id = rsp.role_id
    JOIN systems s ON rsp.system_id = s.id
    JOIN permission_levels pl ON rsp.permission_level_id = pl.id
    LEFT JOIN system_permissions sp ON s.id = sp.system_id AND pl.id = sp.permission_level_id
    WHERE u.id = p_user_id
    AND u.is_active = TRUE
    AND r.is_active = TRUE
    AND rsp.is_active = TRUE
    ORDER BY s.display_order, pl.priority_order;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_permissions_summary IS 'عرض ملخص صلاحيات المستخدم الكامل';

COMMIT;

-- ============================================================================
-- نهاية السكريبت - تم بنجاح
-- ============================================================================
-- الخطوة التالية: ملء مصفوفة الصلاحيات لربط الأدوار بالأنظمة
-- ============================================================================
