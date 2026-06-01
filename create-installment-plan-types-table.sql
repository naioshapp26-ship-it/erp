-- =====================================================
-- جدول أنواع خطط الأقساط (Installment Plan Types)
-- =====================================================

CREATE TABLE IF NOT EXISTS installment_plan_types (
    id SERIAL PRIMARY KEY,
    plan_code VARCHAR(50) UNIQUE NOT NULL,
    plan_name_ar VARCHAR(255) NOT NULL,
    plan_name_en VARCHAR(255),
    description_ar TEXT,
    description_en TEXT,
    
    -- تفاصيل الخطة
    duration_months INTEGER NOT NULL,  -- مدة الخطة بالأشهر
    number_of_payments INTEGER NOT NULL,  -- عدد الدفعات
    payment_frequency VARCHAR(50) DEFAULT 'MONTHLY',  -- تكرار الدفع: MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL
    
    -- الرسوم والفوائد
    interest_rate DECIMAL(5,2) DEFAULT 0.00,  -- معدل الفائدة (%)
    admin_fee DECIMAL(10,2) DEFAULT 0.00,  -- رسوم إدارية ثابتة
    late_payment_fee DECIMAL(10,2) DEFAULT 0.00,  -- رسوم التأخير
    
    -- الحدود
    min_amount DECIMAL(15,2),  -- الحد الأدنى للمبلغ
    max_amount DECIMAL(15,2),  -- الحد الأقصى للمبلغ
    
    -- ميزات الخطة
    has_grace_period BOOLEAN DEFAULT false,  -- هل يوجد فترة سماح
    grace_period_days INTEGER DEFAULT 0,  -- عدد أيام فترة السماح
    early_payment_discount DECIMAL(5,2) DEFAULT 0.00,  -- خصم الدفع المبكر (%)
    
    -- التصميم
    icon VARCHAR(10) DEFAULT '📅',
    color VARCHAR(20) DEFAULT '#3b82f6',
    badge_text VARCHAR(100),  -- نص الشارة (مثل: "✓ بدون فائدة")
    
    -- الحالة
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,  -- مميز
    display_order INTEGER DEFAULT 0,
    
    -- التدقيق
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_installment_plan_types_active ON installment_plan_types(is_active);
CREATE INDEX IF NOT EXISTS idx_installment_plan_types_code ON installment_plan_types(plan_code);
CREATE INDEX IF NOT EXISTS idx_installment_plan_types_duration ON installment_plan_types(duration_months);
CREATE INDEX IF NOT EXISTS idx_installment_plan_types_order ON installment_plan_types(display_order);

-- Trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_installment_plan_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_installment_plan_types_updated_at
    BEFORE UPDATE ON installment_plan_types
    FOR EACH ROW
    EXECUTE FUNCTION update_installment_plan_types_updated_at();

-- إدراج البيانات الافتراضية (4 خطط)
INSERT INTO installment_plan_types (
    plan_code, plan_name_ar, plan_name_en, description_ar, description_en,
    duration_months, number_of_payments, payment_frequency,
    interest_rate, admin_fee, badge_text, icon, color, display_order, is_active
) VALUES
    -- خطة 3 أشهر
    (
        'PLAN_3M',
        '3 أشهر',
        '3 Months',
        'خطة دفع على 3 أشهر بدون فائدة إضافية',
        '3-month payment plan with no additional interest',
        3,
        3,
        'MONTHLY',
        0.00,
        0.00,
        '✓ بدون فائدة إضافية',
        '📅',
        '#64748b',
        1,
        true
    ),
    -- خطة 6 أشهر
    (
        'PLAN_6M',
        '6 أشهر',
        '6 Months',
        'خطة دفع على 6 أشهر بمعدل فائدة منخفض',
        '6-month payment plan with low interest rate',
        6,
        6,
        'MONTHLY',
        2.50,
        0.00,
        '✓ معدل فائدة منخفض',
        '📅',
        '#64748b',
        2,
        true
    ),
    -- خطة 12 شهر
    (
        'PLAN_12M',
        '12 شهر',
        '12 Months',
        'خطة دفع على سنة كاملة مع مرونة عالية',
        '12-month payment plan with high flexibility',
        12,
        12,
        'MONTHLY',
        5.00,
        0.00,
        '✓ مرونة عالية',
        '📅',
        '#64748b',
        3,
        true
    ),
    -- خطة 24 شهر
    (
        'PLAN_24M',
        '24 شهر',
        '24 Months',
        'خطة دفع على سنتين مع دفعات شهرية صغيرة',
        '24-month payment plan with small monthly payments',
        24,
        24,
        'MONTHLY',
        7.50,
        0.00,
        '✓ مدفوعات صغيرة',
        '📅',
        '#64748b',
        4,
        true
    );

-- عرض للخطط النشطة فقط
CREATE OR REPLACE VIEW active_installment_plan_types AS
SELECT * FROM installment_plan_types
WHERE is_active = true
ORDER BY display_order, duration_months;

COMMENT ON TABLE installment_plan_types IS 'جدول أنواع خطط الأقساط - يحتوي على تعريفات الخطط المختلفة';
COMMENT ON COLUMN installment_plan_types.payment_frequency IS 'تكرار الدفع: MONTHLY (شهري), QUARTERLY (ربع سنوي), SEMI_ANNUAL (نصف سنوي), ANNUAL (سنوي)';
