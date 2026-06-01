-- Create request_types table for managing different types of employee requests
-- This allows admins to add new request types dynamically

CREATE TABLE IF NOT EXISTS request_types (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'leave', 'vacation', 'transfer'
    type_name_ar VARCHAR(255) NOT NULL,       -- Arabic name: 'طلب إجازة'
    type_name_en VARCHAR(255),                 -- English name (optional)
    description_ar TEXT,
    description_en TEXT,
    icon VARCHAR(100),                         -- Icon class or emoji
    color VARCHAR(50) DEFAULT '#ffffff',       -- Background color for the card
    category VARCHAR(100),                     -- Category: 'hr', 'admin', 'financial', etc.
    is_active BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT TRUE,
    requires_manager_approval BOOLEAN DEFAULT FALSE,
    requires_hr_approval BOOLEAN DEFAULT FALSE,
    approval_levels INTEGER DEFAULT 1,
    
    -- Form fields configuration (JSON)
    form_fields JSONB,
    
    -- Display order
    display_order INTEGER DEFAULT 0,
    
    -- Audit fields
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_request_types_code ON request_types(type_code);
CREATE INDEX IF NOT EXISTS idx_request_types_active ON request_types(is_active);
CREATE INDEX IF NOT EXISTS idx_request_types_category ON request_types(category);
CREATE INDEX IF NOT EXISTS idx_request_types_order ON request_types(display_order);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_request_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_request_types_timestamp ON request_types;
CREATE TRIGGER update_request_types_timestamp
    BEFORE UPDATE ON request_types
    FOR EACH ROW
    EXECUTE FUNCTION update_request_types_updated_at();

-- Insert default request types
INSERT INTO request_types (type_code, type_name_ar, type_name_en, description_ar, icon, color, category, display_order, form_fields) VALUES
('work_request', 'طلب عمل', 'Work Request', 'طلب تقديم عمل أو مهمة جديدة', '💼', '#f5f5f5', 'general', 1, 
 '{"fields": [{"name": "job_title", "label": "المسمى الوظيفي", "type": "text", "required": true}]}'),

('return_request', 'طلب عودة', 'Return Request', 'طلب العودة للعمل بعد إجازة أو غياب', '📄', '#fff5f5', 'hr', 2,
 '{"fields": [{"name": "return_date", "label": "تاريخ العودة", "type": "date", "required": true}]}'),

('graduation_certificate', 'طلب إثبات التخرج', 'Graduation Certificate', 'طلب شهادة إثبات التخرج', '📋', '#f0fff4', 'admin', 3,
 '{"fields": [{"name": "graduation_year", "label": "سنة التخرج", "type": "text", "required": true}]}'),

('flight_request', 'طلب رحلة', 'Flight Request', 'طلب حجز رحلة جوية', '✈️', '#e3f2fd', 'travel', 4,
 '{"fields": [{"name": "destination", "label": "الوجهة", "type": "text", "required": true}, {"name": "travel_date", "label": "تاريخ السفر", "type": "date", "required": true}]}'),

('salary_file', 'طلب تعريف بالراتب', 'Salary Certificate', 'طلب ملف التعريف بالراتب', '💵', '#fff8e1', 'hr', 5,
 '{"fields": [{"name": "purpose", "label": "الغرض من الطلب", "type": "text", "required": true}]}'),

('student_transfer', 'طلب تحويل طالب', 'Student Transfer', 'طلب تحويل طالب من فرع لآخر', '👥', '#fce4ec', 'admin', 6,
 '{"fields": [{"name": "student_name", "label": "اسم الطالب", "type": "text", "required": true}, {"name": "from_branch", "label": "من فرع", "type": "text", "required": true}, {"name": "to_branch", "label": "إلى فرع", "type": "text", "required": true}]}'),

('change_request', 'طلب تغيير', 'Change Request', 'طلب تغيير معلومات أو إعدادات', '⚙️', '#f3e5f5', 'admin', 7,
 '{"fields": [{"name": "change_type", "label": "نوع التغيير", "type": "text", "required": true}]}'),

('vacation_request', 'طلب إجازة', 'Vacation Request', 'طلب إجازة سنوية أو طارئة', '🏖️', '#e8f5e9', 'hr', 8,
 '{"fields": [{"name": "start_date", "label": "من تاريخ", "type": "date", "required": true}, {"name": "end_date", "label": "إلى تاريخ", "type": "date", "required": true}, {"name": "reason", "label": "السبب", "type": "textarea", "required": true}]}'),

('flights_booking', 'طلب حجز رحلات', 'Flights Booking', 'طلب حجز رحلات متعددة', '🛫', '#e1f5fe', 'travel', 9,
 '{"fields": [{"name": "number_of_flights", "label": "عدد الرحلات", "type": "number", "required": true}]}'),

('course_request', 'طلب دورة', 'Course Request', 'طلب التسجيل في دورة تدريبية', '📚', '#fff3e0', 'training', 10,
 '{"fields": [{"name": "course_name", "label": "اسم الدورة", "type": "text", "required": true}]}'),

('certificate_request', 'طلب شهادة', 'Certificate Request', 'طلب شهادة رسمية', '📜', '#fafafa', 'admin', 11,
 '{"fields": [{"name": "certificate_type", "label": "نوع الشهادة", "type": "text", "required": true}]}'),

('purchase_request', 'طلب مشتريات', 'Purchase Request', 'طلب شراء معدات أو مواد', '🛒', '#e8eaf6', 'procurement', 12,
 '{"fields": [{"name": "item_description", "label": "وصف المشتريات", "type": "textarea", "required": true}]}'),

('private_doctor', 'طلب حجز طبيب خصوصي', 'Private Doctor Booking', 'طلب حجز موعد مع طبيب خصوصي', '💊', '#e0f2f1', 'health', 13,
 '{"fields": [{"name": "doctor_name", "label": "اسم الطبيب", "type": "text", "required": false}, {"name": "appointment_date", "label": "تاريخ الموعد", "type": "date", "required": true}]}'),

('excuse_request', 'طلب استئذان', 'Excuse Request', 'طلب إذن للغياب أو التأخر', '🙋', '#f1f8e9', 'hr', 14,
 '{"fields": [{"name": "excuse_date", "label": "تاريخ الاستئذان", "type": "date", "required": true}, {"name": "duration", "label": "المدة", "type": "text", "required": true}]}'),

('loan_request', 'طلب قرض', 'Loan Request', 'طلب قرض أو سلفة', '💰', '#fff9c4', 'financial', 15,
 '{"fields": [{"name": "amount", "label": "المبلغ", "type": "number", "required": true}, {"name": "reason", "label": "السبب", "type": "textarea", "required": true}]}'),

('gift_voucher', 'طلب قسيمة هدية', 'Gift Voucher', 'طلب قسيمة هدية', '🎁', '#fce4ec', 'hr', 16,
 '{"fields": [{"name": "occasion", "label": "المناسبة", "type": "text", "required": false}]}'),

('renewal_request', 'طلب تجديد', 'Renewal Request', 'طلب تجديد عقد أو اشتراك', '🔄', '#f9fbe7', 'admin', 17,
 '{"fields": [{"name": "renewal_type", "label": "نوع التجديد", "type": "text", "required": true}]}'),

('training_session', 'طلب جلسة تدريب', 'Training Session', 'طلب عقد جلسة تدريبية', '🎓', '#e0f7fa', 'training', 18,
 '{"fields": [{"name": "topic", "label": "موضوع التدريب", "type": "text", "required": true}, {"name": "target_audience", "label": "الفئة المستهدفة", "type": "text", "required": false}]}')

ON CONFLICT (type_code) DO NOTHING;

-- Create view for active request types
CREATE OR REPLACE VIEW active_request_types AS
SELECT * FROM request_types
WHERE is_active = TRUE
ORDER BY display_order, type_name_ar;

COMMENT ON TABLE request_types IS 'جدول أنواع الطلبات - يسمح بإضافة أنواع طلبات جديدة ديناميكياً';
COMMENT ON COLUMN request_types.form_fields IS 'حقول النموذج بصيغة JSON - تحدد الحقول المطلوبة لكل نوع طلب';
