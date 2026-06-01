-- ============================================================================
-- ملء مصفوفة الصلاحيات الكاملة (33 دور × 8 أنظمة)
-- تنفيذ المصفوفة حسب ملف صلاحيات.xlsx
-- ============================================================================

BEGIN;

-- حذف البيانات القديمة لإعادة البناء
DELETE FROM role_system_permissions;

-- ============================================================================
-- SUPER_ADMIN - صلاحيات كاملة على كل شيء
-- ============================================================================
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, pl.id, 'صلاحيات مطلقة'
FROM roles r
CROSS JOIN systems s
CROSS JOIN permission_levels pl
WHERE r.name = 'SUPER_ADMIN'
AND pl.level_code = 'FULL';

-- ============================================================================
-- المكتب الرئيسي (HQ) - المديرون التنفيذيون
-- ============================================================================

-- مدير مالي - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مدير مالي - تركيز كامل على المالية'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'FINANCIAL_MANAGER_HQ';

-- مدير تنفيذي - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
    END,
    'مدير تنفيذي - إشراف شامل'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'EXECUTIVE_MANAGER_HQ';

-- مدير موارد بشرية - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'مدير موارد بشرية - تركيز على الموظفين'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'HR_MANAGER_HQ';

-- مدير مشتريات - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مدير مشتريات - تركيز على الشراء'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'PROCUREMENT_MANAGER_HQ';

-- مدير مبيعات - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مدير مبيعات - تركيز على المبيعات'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'SALES_MANAGER_HQ';

-- مدير تسويق - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'مدير تسويق - تركيز على التسويق'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'MARKETING_MANAGER_HQ';

-- مدير سلاسل الإمداد - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مدير سلاسل الإمداد'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'SUPPLY_CHAIN_MANAGER_HQ';

-- مدير السلامة - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مدير السلامة'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'SAFETY_MANAGER_HQ';

-- مدير المخازن - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مدير المخازن'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'WAREHOUSE_MANAGER_HQ';

-- محاسب - المكتب الرئيسي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'محاسب تنفيذي'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'ACCOUNTANT_HQ';

-- ============================================================================
-- مستوى الفرع (BRANCH)
-- ============================================================================

-- مدير فرع
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'FULL')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
    END,
    'مدير فرع - إدارة كاملة للفرع'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'BRANCH_MANAGER';

-- مساعد مدير فرع
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مساعد مدير فرع'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'ASSISTANT_BRANCH_MANAGER';

-- مسؤول موارد بشرية - فرع
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'مسؤول موارد بشرية'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'HR_OFFICER_BRANCH';

-- مسؤول مالي - فرع
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مسؤول مالي'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'FINANCE_OFFICER_BRANCH';

-- مسؤول مبيعات - فرع
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'مسؤول مبيعات'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'SALES_OFFICER_BRANCH';

-- ============================================================================
-- مستوى الحاضنة (INCUBATOR)
-- ============================================================================

-- مدير حاضنة
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مدير حاضنة'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'INCUBATOR_MANAGER';

-- مساعد مدير حاضنة
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مساعد مدير حاضنة'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'ASSISTANT_INCUBATOR_MANAGER';

-- أخصائي موارد بشرية - حاضنة
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'أخصائي موارد بشرية'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'HR_SPECIALIST_INCUBATOR';

-- أخصائي مالي - حاضنة
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'أخصائي مالي'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'FINANCE_SPECIALIST_INCUBATOR';

-- ============================================================================
-- مستوى المنصة (PLATFORM)
-- ============================================================================

-- مدير منصة
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW_APPROVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مدير منصة'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'PLATFORM_MANAGER';

-- مساعد مدير منصة
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مساعد مدير منصة'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'ASSISTANT_PLATFORM_MANAGER';

-- منسق منصة
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'LIMITED')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'منسق منصة'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'PLATFORM_COORDINATOR';

-- ============================================================================
-- مستوى المكاتب التنفيذية (EXECUTIVE_OFFICE)
-- ============================================================================

-- مسؤول تنفيذي مكاتب
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'مسؤول تنفيذي مكاتب'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'EXECUTIVE_OFFICE_MANAGER';

-- إداري تنفيذي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'LIMITED')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'إداري تنفيذي'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'ADMINISTRATIVE_EXECUTIVE';

-- تنفيذي موارد بشرية
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'تنفيذي موارد بشرية'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'HR_EXECUTIVE';

-- تنفيذي مالي
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'تنفيذي مالي'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'FINANCE_EXECUTIVE';

-- تنفيذي مشتريات
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'تنفيذي مشتريات'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'PROCUREMENT_EXECUTIVE';

-- تنفيذي مبيعات
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'تنفيذي مبيعات'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'SALES_EXECUTIVE';

-- تنفيذي تسويق
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'تنفيذي تسويق'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'MARKETING_EXECUTIVE';

-- تنفيذي لوجستيات
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'تنفيذي لوجستيات'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'LOGISTICS_EXECUTIVE';

-- تنفيذي سلامة
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'تنفيذي سلامة'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'SAFETY_EXECUTIVE';

-- تنفيذي مخازن
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'WAREHOUSE' THEN (SELECT id FROM permission_levels WHERE level_code = 'EXECUTIVE')
        WHEN 'PROCUREMENT' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'SUPPLY_CHAIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
        WHEN 'FINANCE' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SALES' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'MARKETING' THEN (SELECT id FROM permission_levels WHERE level_code = 'NONE')
        WHEN 'SAFETY' THEN (SELECT id FROM permission_levels WHERE level_code = 'VIEW')
    END,
    'تنفيذي مخازن'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'WAREHOUSE_EXECUTIVE';

-- موظف عادي (لا صلاحيات)
INSERT INTO role_system_permissions (role_id, system_id, permission_level_id, notes)
SELECT r.id, s.id, 
    CASE s.system_code
        WHEN 'HR_ADMIN' THEN (SELECT id FROM permission_levels WHERE level_code = 'LIMITED')
        ELSE (SELECT id FROM permission_levels WHERE level_code = 'NONE')
    END,
    'موظف عادي - صلاحيات محدودة جداً'
FROM roles r
CROSS JOIN systems s
WHERE r.name = 'EMPLOYEE';

COMMIT;

-- ============================================================================
-- تقرير النجاح
-- ============================================================================
SELECT 
    'تم إنشاء مصفوفة الصلاحيات بنجاح' AS status,
    COUNT(*) AS total_permissions
FROM role_system_permissions;

SELECT 
    r.job_title_ar,
    COUNT(rsp.id) AS systems_count
FROM roles r
LEFT JOIN role_system_permissions rsp ON r.id = rsp.role_id
GROUP BY r.id, r.job_title_ar
ORDER BY r.hierarchy_level, r.id;
