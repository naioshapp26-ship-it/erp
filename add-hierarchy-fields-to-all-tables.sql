-- =====================================================
-- إضافة حقول التسلسل الهرمي لجميع الجداول
-- (فرع، حاضنة، منصة، مكتب)
-- =====================================================

-- 1. جدول employee_requests (طلبات الموظفين)
ALTER TABLE employee_requests 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS incubator_id UUID,
ADD COLUMN IF NOT EXISTS platform_id UUID,
ADD COLUMN IF NOT EXISTS office_id UUID;

COMMENT ON COLUMN employee_requests.branch_id IS 'معرف الفرع - مطلوب';
COMMENT ON COLUMN employee_requests.incubator_id IS 'معرف الحاضنة - مطلوب';
COMMENT ON COLUMN employee_requests.platform_id IS 'معرف المنصة - مطلوب';
COMMENT ON COLUMN employee_requests.office_id IS 'معرف المكتب - مطلوب';

-- 2. جدول invoices (الفواتير) - إضافة platform_id فقط
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS platform_id UUID;

COMMENT ON COLUMN invoices.platform_id IS 'معرف المنصة - مطلوب';

-- 3. جدول ads (الإعلانات) - تغيير الحقول الجديدة إلى الحقول القياسية
-- نحتفظ بالحقول الجديدة ونضيف الحقول القياسية أيضاً
ALTER TABLE ads 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS incubator_id UUID,
ADD COLUMN IF NOT EXISTS platform_id UUID,
ADD COLUMN IF NOT EXISTS office_id UUID;

-- ملاحظة: سيتم نسخ البيانات من الحقول الجديدة عند الحاجة
-- UPDATE ads 
-- SET 
--   branch_id = new_branch_id::UUID,
--   incubator_id = new_incubator_id::UUID,
--   platform_id = new_platform_id::UUID,
--   office_id = new_office_id::UUID
-- WHERE branch_id IS NULL OR incubator_id IS NULL OR platform_id IS NULL OR office_id IS NULL;

COMMENT ON COLUMN ads.branch_id IS 'معرف الفرع - مطلوب';
COMMENT ON COLUMN ads.incubator_id IS 'معرف الحاضنة - مطلوب';
COMMENT ON COLUMN ads.platform_id IS 'معرف المنصة - مطلوب';
COMMENT ON COLUMN ads.office_id IS 'معرف المكتب - مطلوب';

-- 4. جدول transactions (المعاملات المالية)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS incubator_id UUID,
ADD COLUMN IF NOT EXISTS platform_id UUID,
ADD COLUMN IF NOT EXISTS office_id UUID;

COMMENT ON COLUMN transactions.branch_id IS 'معرف الفرع - مطلوب';
COMMENT ON COLUMN transactions.incubator_id IS 'معرف الحاضنة - مطلوب';
COMMENT ON COLUMN transactions.platform_id IS 'معرف المنصة - مطلوب';
COMMENT ON COLUMN transactions.office_id IS 'معرف المكتب - مطلوب';

-- 5. جدول ledger (دفتر الأستاذ)
ALTER TABLE ledger 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS incubator_id UUID,
ADD COLUMN IF NOT EXISTS platform_id UUID,
ADD COLUMN IF NOT EXISTS office_id UUID;

COMMENT ON COLUMN ledger.branch_id IS 'معرف الفرع - مطلوب';
COMMENT ON COLUMN ledger.incubator_id IS 'معرف الحاضنة - مطلوب';
COMMENT ON COLUMN ledger.platform_id IS 'معرف المنصة - مطلوب';
COMMENT ON COLUMN ledger.office_id IS 'معرف المكتب - مطلوب';

-- 6. جدول payment_methods (طرق الدفع)
ALTER TABLE payment_methods 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS incubator_id UUID,
ADD COLUMN IF NOT EXISTS platform_id UUID,
ADD COLUMN IF NOT EXISTS office_id UUID;

COMMENT ON COLUMN payment_methods.branch_id IS 'معرف الفرع - اختياري (null = متاح لجميع الفروع)';
COMMENT ON COLUMN payment_methods.incubator_id IS 'معرف الحاضنة - اختياري (null = متاح لجميع الحاضنات)';
COMMENT ON COLUMN payment_methods.platform_id IS 'معرف المنصة - اختياري (null = متاح لجميع المنصات)';
COMMENT ON COLUMN payment_methods.office_id IS 'معرف المكتب - اختياري (null = متاح لجميع المكاتب)';

-- 7. جدول installment_plan_types (أنواع خطط التقسيط)
ALTER TABLE installment_plan_types 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS incubator_id UUID,
ADD COLUMN IF NOT EXISTS platform_id UUID,
ADD COLUMN IF NOT EXISTS office_id UUID;

COMMENT ON COLUMN installment_plan_types.branch_id IS 'معرف الفرع - اختياري (null = متاح لجميع الفروع)';
COMMENT ON COLUMN installment_plan_types.incubator_id IS 'معرف الحاضنة - اختياري (null = متاح لجميع الحاضنات)';
COMMENT ON COLUMN installment_plan_types.platform_id IS 'معرف المنصة - اختياري (null = متاح لجميع المنصات)';
COMMENT ON COLUMN installment_plan_types.office_id IS 'معرف المكتب - اختياري (null = متاح لجميع المكاتب)';

-- 8. جدول tax_settings (إعدادات الضرائب) - إضافة الحقول الناقصة
ALTER TABLE tax_settings 
ADD COLUMN IF NOT EXISTS incubator_id UUID,
ADD COLUMN IF NOT EXISTS platform_id UUID,
ADD COLUMN IF NOT EXISTS office_id UUID;

COMMENT ON COLUMN tax_settings.incubator_id IS 'معرف الحاضنة - اختياري (null = متاح لجميع الحاضنات)';
COMMENT ON COLUMN tax_settings.platform_id IS 'معرف المنصة - اختياري (null = متاح لجميع المنصات)';
COMMENT ON COLUMN tax_settings.office_id IS 'معرف المكتب - اختياري (null = متاح لجميع المكاتب)';

-- 9. جدول request_types (أنواع الطلبات)
ALTER TABLE request_types 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS incubator_id UUID,
ADD COLUMN IF NOT EXISTS platform_id UUID,
ADD COLUMN IF NOT EXISTS office_id UUID;

COMMENT ON COLUMN request_types.branch_id IS 'معرف الفرع - اختياري (null = متاح لجميع الفروع)';
COMMENT ON COLUMN request_types.incubator_id IS 'معرف الحاضنة - اختياري (null = متاح لجميع الحاضنات)';
COMMENT ON COLUMN request_types.platform_id IS 'معرف المنصة - اختياري (null = متاح لجميع المنصات)';
COMMENT ON COLUMN request_types.office_id IS 'معرف المكتب - اختياري (null = متاح لجميع المكاتب)';

-- =====================================================
-- إنشاء فهارس للأداء
-- =====================================================

-- Indexes for employee_requests
CREATE INDEX IF NOT EXISTS idx_employee_requests_branch ON employee_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_incubator ON employee_requests(incubator_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_platform ON employee_requests(platform_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_office ON employee_requests(office_id);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_platform ON invoices(platform_id);

-- Indexes for ads
CREATE INDEX IF NOT EXISTS idx_ads_branch ON ads(branch_id);
CREATE INDEX IF NOT EXISTS idx_ads_incubator ON ads(incubator_id);
CREATE INDEX IF NOT EXISTS idx_ads_platform ON ads(platform_id);
CREATE INDEX IF NOT EXISTS idx_ads_office ON ads(office_id);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_branch ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_incubator ON transactions(incubator_id);
CREATE INDEX IF NOT EXISTS idx_transactions_platform ON transactions(platform_id);
CREATE INDEX IF NOT EXISTS idx_transactions_office ON transactions(office_id);

-- Indexes for ledger
CREATE INDEX IF NOT EXISTS idx_ledger_branch ON ledger(branch_id);
CREATE INDEX IF NOT EXISTS idx_ledger_incubator ON ledger(incubator_id);
CREATE INDEX IF NOT EXISTS idx_ledger_platform ON ledger(platform_id);
CREATE INDEX IF NOT EXISTS idx_ledger_office ON ledger(office_id);

-- Indexes for payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_branch ON payment_methods(branch_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_incubator ON payment_methods(incubator_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_platform ON payment_methods(platform_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_office ON payment_methods(office_id);

-- Indexes for installment_plan_types
CREATE INDEX IF NOT EXISTS idx_installment_plan_types_branch ON installment_plan_types(branch_id);
CREATE INDEX IF NOT EXISTS idx_installment_plan_types_incubator ON installment_plan_types(incubator_id);
CREATE INDEX IF NOT EXISTS idx_installment_plan_types_platform ON installment_plan_types(platform_id);
CREATE INDEX IF NOT EXISTS idx_installment_plan_types_office ON installment_plan_types(office_id);

-- Indexes for tax_settings
CREATE INDEX IF NOT EXISTS idx_tax_settings_incubator ON tax_settings(incubator_id);
CREATE INDEX IF NOT EXISTS idx_tax_settings_platform ON tax_settings(platform_id);
CREATE INDEX IF NOT EXISTS idx_tax_settings_office ON tax_settings(office_id);

-- Indexes for request_types
CREATE INDEX IF NOT EXISTS idx_request_types_branch ON request_types(branch_id);
CREATE INDEX IF NOT EXISTS idx_request_types_incubator ON request_types(incubator_id);
CREATE INDEX IF NOT EXISTS idx_request_types_platform ON request_types(platform_id);
CREATE INDEX IF NOT EXISTS idx_request_types_office ON request_types(office_id);

-- =====================================================
-- تحديث البيانات الموجودة
-- =====================================================
-- ملاحظة: تم تعطيل تحديث البيانات القديمة لتجنب مشاكل اختلاف الأنواع
-- يجب تحديث البيانات يدوياً أو من خلال واجهة النظام

-- =====================================================
-- رسالة النجاح
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ تم إضافة حقول التسلسل الهرمي (فرع، حاضنة، منصة، مكتب) لجميع الجداول بنجاح';
    RAISE NOTICE '✅ تم إنشاء الفهارس للأداء';
    RAISE NOTICE '⚠️ يجب تحديث البيانات الموجودة من خلال واجهة النظام';
END $$;
