-- =====================================================
-- حذف جميع الأدوار ما عدا الـ 33 المطلوبين
-- =====================================================

-- حذف جميع الأدوار التي ليست من القائمة المحددة
DELETE FROM roles 
WHERE name NOT IN (
    'SUPER_ADMIN',
    'IT_MANAGER',
    'HQ_EXECUTIVE_MANAGER',
    'HQ_FINANCIAL_MANAGER',
    'HQ_MARKETING_MANAGER',
    'HQ_PROCUREMENT_MANAGER',
    'HQ_PR_MANAGER',
    'LEGAL_MANAGER',
    'CONTENT_MANAGER',
    'INITIATIVES_MANAGER',
    'FREELANCER_MANAGER',
    'EXECUTIVE_DESIGNER',
    'EXECUTIVE_MARKETER',
    'EXECUTIVE_SALES',
    'EXECUTIVE_CALLCENTER',
    'EXECUTIVE_SOCIAL_MEDIA',
    'EDITOR',
    'BRANCH_MANAGER',
    'ASSISTANT_BRANCH_MANAGER',
    'BRANCH_ADMIN',
    'INCUBATOR_MANAGER',
    'ASSISTANT_INCUBATOR_MANAGER',
    'INCUBATOR_ADMIN',
    'PLATFORM_MANAGER',
    'ASSISTANT_PLATFORM_MANAGER',
    'PLATFORM_ADMIN',
    'OFFICE_EXECUTIVE',
    'OFFICE_ADMIN',
    'LOGISTICS_EMPLOYEE',
    'PERMANENT_TRAINER',
    'FREELANCER_TRAINER',
    'VOLUNTEER_TRAINER',
    'INITIATIVES_VOLUNTEER'
);

-- التأكد من وجود الأدوار الـ 33 (إضافة إذا لم تكن موجودة)
INSERT INTO roles (name, name_ar, description, level, is_system) VALUES
('SUPER_ADMIN', 'سوبر آدمن', 'صلاحيات كاملة على جميع مستويات النظام', 'HQ', true),
('IT_MANAGER', 'مدير برمجيات وتكنولوجيا المعلومات', 'مسؤول عن البنية التحتية التقنية والبرمجيات', 'HQ', false),
('HQ_EXECUTIVE_MANAGER', 'مدير تنفيذي - المكتب الرئيسي', 'مدير تنفيذي في المكتب الرئيسي', 'HQ', false),
('HQ_FINANCIAL_MANAGER', 'مدير مالي - المكتب الرئيسي', 'مسؤول عن الشؤون المالية في المكتب الرئيسي', 'HQ', false),
('HQ_MARKETING_MANAGER', 'مدير تسويق - المكتب الرئيسي', 'مسؤول عن التسويق في المكتب الرئيسي', 'HQ', false),
('HQ_PROCUREMENT_MANAGER', 'مدير مشتريات - المكتب الرئيسي', 'مسؤول عن المشتريات في المكتب الرئيسي', 'HQ', false),
('HQ_PR_MANAGER', 'مدير علاقات عامة - المكتب الرئيسي', 'مسؤول عن العلاقات العامة في المكتب الرئيسي', 'HQ', false),
('LEGAL_MANAGER', 'مدير القانونية والاستشارات', 'مسؤول عن الشؤون القانونية والاستشارات', 'HQ', false),
('CONTENT_MANAGER', 'مدير تحرير محتوى ومقالات', 'مسؤول عن تحرير المحتوى والمقالات', 'HQ', false),
('INITIATIVES_MANAGER', 'مدير المبادرات', 'مسؤول عن إدارة المبادرات', 'HQ', false),
('FREELANCER_MANAGER', 'مدير فريلانسر', 'مسؤول عن إدارة المستقلين', 'HQ', false),
('EXECUTIVE_DESIGNER', 'إداري تنفيذي مصمم', 'إداري تنفيذي متخصص في التصميم', 'HQ', false),
('EXECUTIVE_MARKETER', 'إداري تنفيذي مسوق', 'إداري تنفيذي متخصص في التسويق', 'HQ', false),
('EXECUTIVE_SALES', 'إداري تنفيذي مبيعات', 'إداري تنفيذي متخصص في المبيعات', 'HQ', false),
('EXECUTIVE_CALLCENTER', 'إداري تنفيذي كول سنتر', 'إداري تنفيذي متخصص في مركز الاتصالات', 'HQ', false),
('EXECUTIVE_SOCIAL_MEDIA', 'إداري تنفيذي منصات التواصل', 'إداري تنفيذي متخصص في منصات التواصل الاجتماعي', 'HQ', false),
('EDITOR', 'محرر', 'محرر محتوى ومقالات', 'HQ', false),
('BRANCH_MANAGER', 'مدير فرع', 'مسؤول عن إدارة الفرع', 'BRANCH', false),
('ASSISTANT_BRANCH_MANAGER', 'مساعد مدير فرع', 'مساعد مدير الفرع', 'BRANCH', false),
('BRANCH_ADMIN', 'إداري فرع', 'إداري في الفرع', 'BRANCH', false),
('INCUBATOR_MANAGER', 'مدير حاضنة', 'مسؤول عن إدارة الحاضنة', 'INCUBATOR', false),
('ASSISTANT_INCUBATOR_MANAGER', 'مساعد مدير حاضنة', 'مساعد مدير الحاضنة', 'INCUBATOR', false),
('INCUBATOR_ADMIN', 'إداري حاضنة', 'إداري في الحاضنة', 'INCUBATOR', false),
('PLATFORM_MANAGER', 'مدير منصة', 'مسؤول عن إدارة المنصة', 'PLATFORM', false),
('ASSISTANT_PLATFORM_MANAGER', 'مساعد مدير منصة', 'مساعد مدير المنصة', 'PLATFORM', false),
('PLATFORM_ADMIN', 'إداري منصة', 'إداري في المنصة', 'PLATFORM', false),
('OFFICE_EXECUTIVE', 'مسؤول تنفيذي مكاتب', 'مسؤول تنفيذي للمكاتب', 'OFFICE', false),
('OFFICE_ADMIN', 'إداري تنفيذي مكاتب', 'إداري تنفيذي في المكاتب', 'OFFICE', false),
('LOGISTICS_EMPLOYEE', 'موظف لوجستيات', 'موظف متخصص في اللوجستيات', 'ALL', false),
('PERMANENT_TRAINER', 'مدرب دائم', 'مدرب دائم في النظام', 'ALL', false),
('FREELANCER_TRAINER', 'مدرب فريلانسر', 'مدرب مستقل', 'ALL', false),
('VOLUNTEER_TRAINER', 'مدرب متطوع', 'مدرب متطوع', 'ALL', false),
('INITIATIVES_VOLUNTEER', 'متطوع مبادرات', 'متطوع في المبادرات', 'ALL', false)
ON CONFLICT (name) 
DO UPDATE SET 
  name_ar = EXCLUDED.name_ar,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  updated_at = CURRENT_TIMESTAMP;

-- تحديث timestamp
UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;

-- =====================================================
-- التحقق من النتائج
-- =====================================================
DO $$
DECLARE
    role_count INTEGER;
    deleted_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO role_count FROM roles;
    
    IF role_count = 33 THEN
        RAISE NOTICE '✅ تم الاحتفاظ بـ 33 دور فقط';
    ELSIF role_count < 33 THEN
        RAISE NOTICE '⚠️ عدد الأدوار أقل من المتوقع: %', role_count;
    ELSE
        RAISE NOTICE '⚠️ عدد الأدوار أكثر من المتوقع: %', role_count;
    END IF;
    
    RAISE NOTICE '📊 إجمالي عدد الأدوار الحالي: %', role_count;
END $$;
