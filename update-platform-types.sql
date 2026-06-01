-- ========================================
-- تحديث أنواع المنصات الرقمية
-- Update Platform Types
-- ========================================

-- حذف البيانات القديمة من platforms إذا كانت موجودة (اختياري)
-- يمكن تعديل هذا الجزء إذا كان هناك بيانات مهمة

-- تحديث platform_type في جدول platforms
-- من الأنواع القديمة إلى الأنواع الجديدة:
-- مطاعم واغذية - Restaurants and Food
-- متاجر - Stores  
-- خدمات - Services
-- تعليم - Education
-- صحة - Health
-- رياضه وترفيه - Sports and Entertainment
-- فعاليات وترفيه - Events and Entertainment
-- عقارات واسكان - Real Estate and Housing
-- سياحه - Tourism
-- تصنيع وصناعه - Manufacturing and Industry
-- احترافيه - Professional Services
-- منظمات - Organizations
-- اخري - Other

-- تحديث الأنواع القديمة إلى الأنواع الجديدة
UPDATE platforms 
SET platform_type = CASE 
    WHEN platform_type = 'ECOMMERCE' THEN 'STORES'
    WHEN platform_type = 'MARKETPLACE' THEN 'STORES'
    WHEN platform_type = 'SAAS' THEN 'PROFESSIONAL'
    WHEN platform_type = 'EDUCATION' THEN 'EDUCATION'
    WHEN platform_type = 'OTHER' THEN 'OTHER'
    ELSE platform_type
END;

-- رسالة تأكيد
DO $$
BEGIN
    RAISE NOTICE 'تم تحديث أنواع المنصات بنجاح';
    RAISE NOTICE 'الأنواع الجديدة المتاحة:';
    RAISE NOTICE '1. RESTAURANTS - مطاعم وأغذية';
    RAISE NOTICE '2. STORES - متاجر';
    RAISE NOTICE '3. SERVICES - خدمات';
    RAISE NOTICE '4. EDUCATION - تعليم';
    RAISE NOTICE '5. HEALTH - صحة';
    RAISE NOTICE '6. SPORTS - رياضة وترفيه';
    RAISE NOTICE '7. EVENTS - فعاليات وترفيه';
    RAISE NOTICE '8. REAL_ESTATE - عقارات وإسكان';
    RAISE NOTICE '9. TOURISM - سياحة';
    RAISE NOTICE '10. MANUFACTURING - تصنيع وصناعة';
    RAISE NOTICE '11. PROFESSIONAL - احترافية';
    RAISE NOTICE '12. ORGANIZATIONS - منظمات';
    RAISE NOTICE '13. OTHER - أخرى';
END $$;
