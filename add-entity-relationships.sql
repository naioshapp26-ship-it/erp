-- ========================================
-- إضافة ربط العناصر بالكيانات الهرمية
-- Entity Relationship Migration
-- ========================================

-- ========================================
-- 1. تحديث جدول users (العملاء/المستخدمين)
-- ========================================

-- إضافة حقول الربط بالكيانات الهرمية
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS incubator_id INTEGER REFERENCES incubators(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL;

-- إضافة حقل نوع الكيان المرتبط
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_entity_type VARCHAR(20) CHECK (linked_entity_type IN ('BRANCH', 'INCUBATOR', 'PLATFORM', 'OFFICE'));

-- إنشاء Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_incubator_id ON users(incubator_id);
CREATE INDEX IF NOT EXISTS idx_users_platform_id ON users(platform_id);
CREATE INDEX IF NOT EXISTS idx_users_office_id ON users(office_id);
CREATE INDEX IF NOT EXISTS idx_users_linked_entity_type ON users(linked_entity_type);

-- إضافة constraint للتأكد من وجود ربط واحد على الأقل
ALTER TABLE users ADD CONSTRAINT check_user_entity_link 
  CHECK (
    (branch_id IS NOT NULL) OR 
    (incubator_id IS NOT NULL) OR 
    (platform_id IS NOT NULL) OR 
    (office_id IS NOT NULL) OR
    (entity_id IS NOT NULL)
  );

COMMENT ON COLUMN users.branch_id IS 'ربط المستخدم بفرع معين';
COMMENT ON COLUMN users.incubator_id IS 'ربط المستخدم بحاضنة معينة';
COMMENT ON COLUMN users.platform_id IS 'ربط المستخدم بمنصة معينة';
COMMENT ON COLUMN users.office_id IS 'ربط المستخدم بمكتب معين';
COMMENT ON COLUMN users.linked_entity_type IS 'نوع الكيان المرتبط به المستخدم';

-- ========================================
-- 2. تحديث جدول invoices (الفواتير)
-- ========================================

-- إضافة حقول الربط بالكيانات الهرمية
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS incubator_id INTEGER REFERENCES incubators(id) ON DELETE SET NULL;

-- إضافة حقل نوع الكيان المصدر للفاتورة
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issuer_entity_type VARCHAR(20) CHECK (issuer_entity_type IN ('BRANCH', 'INCUBATOR', 'OFFICE', 'PLATFORM'));

-- إنشاء Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch_id ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_office_id ON invoices(office_id);
CREATE INDEX IF NOT EXISTS idx_invoices_incubator_id ON invoices(incubator_id);
CREATE INDEX IF NOT EXISTS idx_invoices_issuer_entity_type ON invoices(issuer_entity_type);

COMMENT ON COLUMN invoices.user_id IS 'العميل المرتبط بالفاتورة';
COMMENT ON COLUMN invoices.branch_id IS 'الفرع الذي أصدر الفاتورة';
COMMENT ON COLUMN invoices.office_id IS 'المكتب الذي أصدر الفاتورة';
COMMENT ON COLUMN invoices.incubator_id IS 'الحاضنة التي أصدرت الفاتورة';
COMMENT ON COLUMN invoices.issuer_entity_type IS 'نوع الكيان الذي أصدر الفاتورة';

-- ========================================
-- 3. إنشاء جدول employees (الموظفين)
-- ========================================

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    national_id VARCHAR(50) UNIQUE,
    position VARCHAR(100),
    department VARCHAR(100),
    
    -- ربط بالكيانات الهرمية
    hq_id INTEGER REFERENCES headquarters(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    incubator_id INTEGER REFERENCES incubators(id) ON DELETE CASCADE,
    platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
    
    -- نوع الكيان المرتبط
    assigned_entity_type VARCHAR(20) NOT NULL CHECK (assigned_entity_type IN ('HQ', 'BRANCH', 'INCUBATOR', 'PLATFORM', 'OFFICE')),
    
    -- معلومات التوظيف
    hire_date DATE,
    salary DECIMAL(10, 2),
    employment_type VARCHAR(50) CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')),
    
    -- حالة الموظف
    is_active BOOLEAN DEFAULT true,
    termination_date DATE,
    
    -- بيانات إضافية
    address TEXT,
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(50),
    
    -- التواريخ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Constraint للتأكد من وجود ربط واحد فقط
ALTER TABLE employees ADD CONSTRAINT check_employee_single_entity 
  CHECK (
    (CASE WHEN hq_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN branch_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN incubator_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN platform_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN office_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

-- Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_employees_hq_id ON employees(hq_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_incubator_id ON employees(incubator_id);
CREATE INDEX IF NOT EXISTS idx_employees_platform_id ON employees(platform_id);
CREATE INDEX IF NOT EXISTS idx_employees_office_id ON employees(office_id);
CREATE INDEX IF NOT EXISTS idx_employees_assigned_entity_type ON employees(assigned_entity_type);
CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

COMMENT ON TABLE employees IS 'جدول الموظفين المرتبطين بالكيانات الهرمية';
COMMENT ON COLUMN employees.assigned_entity_type IS 'نوع الكيان الذي يعمل به الموظف';

-- ========================================
-- 4. تحديث جدول ads (الإعلانات)
-- ========================================

-- إضافة حقول الربط بالكيانات الهرمية الجديدة
ALTER TABLE ads ADD COLUMN IF NOT EXISTS hq_id INTEGER REFERENCES headquarters(id) ON DELETE CASCADE;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS new_branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS new_incubator_id INTEGER REFERENCES incubators(id) ON DELETE CASCADE;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS new_platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS new_office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE;

-- إضافة حقل نوع الكيان المصدر
ALTER TABLE ads ADD COLUMN IF NOT EXISTS ad_source_entity_type VARCHAR(20) CHECK (ad_source_entity_type IN ('HQ', 'BRANCH', 'INCUBATOR', 'PLATFORM', 'OFFICE'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ads_hq_id ON ads(hq_id);
CREATE INDEX IF NOT EXISTS idx_ads_new_branch_id ON ads(new_branch_id);
CREATE INDEX IF NOT EXISTS idx_ads_new_incubator_id ON ads(new_incubator_id);
CREATE INDEX IF NOT EXISTS idx_ads_new_platform_id ON ads(new_platform_id);
CREATE INDEX IF NOT EXISTS idx_ads_new_office_id ON ads(new_office_id);
CREATE INDEX IF NOT EXISTS idx_ads_ad_source_entity_type ON ads(ad_source_entity_type);

COMMENT ON COLUMN ads.hq_id IS 'إعلان من المقر الرئيسي';
COMMENT ON COLUMN ads.new_branch_id IS 'إعلان من فرع معين';
COMMENT ON COLUMN ads.new_incubator_id IS 'إعلان من حاضنة معينة';
COMMENT ON COLUMN ads.new_platform_id IS 'إعلان من منصة معينة';
COMMENT ON COLUMN ads.new_office_id IS 'إعلان من مكتب معين';
COMMENT ON COLUMN ads.ad_source_entity_type IS 'نوع الكيان الذي أنشأ الإعلان';

-- ========================================
-- 5. إنشاء View للعرض الشامل
-- ========================================

-- View لعرض المستخدمين مع معلومات الكيان المرتبط
CREATE OR REPLACE VIEW users_with_entity AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    u.tenant_type,
    u.entity_id AS old_entity_id,
    u.linked_entity_type,
    CASE 
        WHEN u.branch_id IS NOT NULL THEN b.name
        WHEN u.incubator_id IS NOT NULL THEN i.name
        WHEN u.platform_id IS NOT NULL THEN p.name
        WHEN u.office_id IS NOT NULL THEN o.name
        ELSE e.name
    END AS entity_name,
    CASE 
        WHEN u.branch_id IS NOT NULL THEN b.code
        WHEN u.incubator_id IS NOT NULL THEN i.code
        WHEN u.platform_id IS NOT NULL THEN p.code
        WHEN u.office_id IS NOT NULL THEN o.code
        ELSE NULL
    END AS entity_code,
    u.branch_id,
    u.incubator_id,
    u.platform_id,
    u.office_id,
    u.is_active,
    u.created_at
FROM users u
LEFT JOIN entities e ON u.entity_id = e.id
LEFT JOIN branches b ON u.branch_id = b.id
LEFT JOIN incubators i ON u.incubator_id = i.id
LEFT JOIN platforms p ON u.platform_id = p.id
LEFT JOIN offices o ON u.office_id = o.id;

-- View للموظفين مع معلومات الكيان
CREATE OR REPLACE VIEW employees_with_entity AS
SELECT 
    emp.id,
    emp.employee_number,
    emp.full_name,
    emp.email,
    emp.position,
    emp.department,
    emp.assigned_entity_type,
    CASE 
        WHEN emp.hq_id IS NOT NULL THEN hq.name
        WHEN emp.branch_id IS NOT NULL THEN b.name
        WHEN emp.incubator_id IS NOT NULL THEN i.name
        WHEN emp.platform_id IS NOT NULL THEN p.name
        WHEN emp.office_id IS NOT NULL THEN o.name
    END AS entity_name,
    CASE 
        WHEN emp.branch_id IS NOT NULL THEN b.code
        WHEN emp.incubator_id IS NOT NULL THEN i.code
        WHEN emp.platform_id IS NOT NULL THEN p.code
        WHEN emp.office_id IS NOT NULL THEN o.code
    END AS entity_code,
    emp.hire_date,
    emp.salary,
    emp.employment_type,
    emp.is_active
FROM employees emp
LEFT JOIN headquarters hq ON emp.hq_id = hq.id
LEFT JOIN branches b ON emp.branch_id = b.id
LEFT JOIN incubators i ON emp.incubator_id = i.id
LEFT JOIN platforms p ON emp.platform_id = p.id
LEFT JOIN offices o ON emp.office_id = o.id;

-- View للفواتير مع معلومات كاملة
CREATE OR REPLACE VIEW invoices_with_details AS
SELECT 
    inv.id,
    inv.entity_id AS old_entity_id,
    inv.type,
    inv.title,
    inv.amount,
    inv.paid_amount,
    inv.status,
    inv.issue_date,
    inv.due_date,
    inv.issuer_entity_type,
    u.name AS customer_name,
    u.email AS customer_email,
    CASE 
        WHEN inv.branch_id IS NOT NULL THEN b.name
        WHEN inv.office_id IS NOT NULL THEN o.name
        WHEN inv.incubator_id IS NOT NULL THEN i.name
        ELSE e.name
    END AS issuer_entity_name,
    inv.created_at
FROM invoices inv
LEFT JOIN users u ON inv.user_id = u.id
LEFT JOIN entities e ON inv.entity_id = e.id
LEFT JOIN branches b ON inv.branch_id = b.id
LEFT JOIN offices o ON inv.office_id = o.id
LEFT JOIN incubators i ON inv.incubator_id = i.id;

-- View للإعلانات مع معلومات المصدر
CREATE OR REPLACE VIEW ads_with_source AS
SELECT 
    a.id,
    a.title,
    a.content,
    a.level,
    a.scope,
    a.status,
    a.ad_source_entity_type,
    CASE 
        WHEN a.hq_id IS NOT NULL THEN hq.name
        WHEN a.new_branch_id IS NOT NULL THEN b.name
        WHEN a.new_incubator_id IS NOT NULL THEN i.name
        WHEN a.new_platform_id IS NOT NULL THEN p.name
        WHEN a.new_office_id IS NOT NULL THEN o.name
        ELSE e.name
    END AS source_entity_name,
    a.cost,
    a.budget,
    a.spent,
    a.impressions,
    a.clicks,
    a.start_date,
    a.end_date,
    a.created_at
FROM ads a
LEFT JOIN entities e ON a.source_entity_id = e.id
LEFT JOIN headquarters hq ON a.hq_id = hq.id
LEFT JOIN branches b ON a.new_branch_id = b.id
LEFT JOIN incubators i ON a.new_incubator_id = i.id
LEFT JOIN platforms p ON a.new_platform_id = p.id
LEFT JOIN offices o ON a.new_office_id = o.id;

-- ========================================
-- 6. إنشاء Triggers للتحديث التلقائي
-- ========================================

-- Trigger لتحديث updated_at في جدول employees
CREATE OR REPLACE FUNCTION update_employee_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employee_timestamp
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_timestamp();

-- ========================================
-- 7. بيانات تجريبية
-- ========================================

-- إضافة موظفين تجريبيين
-- نحتاج إلى التأكد من وجود الكيانات أولاً قبل الإضافة
DO $$
DECLARE
    v_branch_id INTEGER;
    v_incubator_id INTEGER;
    v_platform_id INTEGER;
BEGIN
    -- الحصول على أول branch
    SELECT id INTO v_branch_id FROM branches LIMIT 1;
    
    -- الحصول على أول incubator
    SELECT id INTO v_incubator_id FROM incubators LIMIT 1;
    
    -- الحصول على أول platform
    SELECT id INTO v_platform_id FROM platforms LIMIT 1;
    
    -- إضافة موظف الفرع
    IF v_branch_id IS NOT NULL THEN
        INSERT INTO employees (employee_number, full_name, email, phone, national_id, position, department, branch_id, assigned_entity_type, hire_date, salary, employment_type, is_active)
        VALUES ('EMP-001', 'أحمد محمد السعيد', 'ahmed.saeed@nayosh.com', '+966501234567', '1234567890', 'مدير فرع', 'الإدارة', v_branch_id, 'BRANCH', '2023-01-15', 12000.00, 'FULL_TIME', true)
        ON CONFLICT (employee_number) DO NOTHING;
    END IF;
    
    -- إضافة موظف الحاضنة
    IF v_incubator_id IS NOT NULL THEN
        INSERT INTO employees (employee_number, full_name, email, phone, national_id, position, department, incubator_id, assigned_entity_type, hire_date, salary, employment_type, is_active)
        VALUES ('EMP-002', 'فاطمة خالد الزهراني', 'fatima.zahrani@nayosh.com', '+966502345678', '2345678901', 'مديرة حاضنة', 'العمليات', v_incubator_id, 'INCUBATOR', '2023-03-20', 15000.00, 'FULL_TIME', true)
        ON CONFLICT (employee_number) DO NOTHING;
    END IF;
    
    -- إضافة موظف المنصة
    IF v_platform_id IS NOT NULL THEN
        INSERT INTO employees (employee_number, full_name, email, phone, national_id, position, department, platform_id, assigned_entity_type, hire_date, salary, employment_type, is_active)
        VALUES ('EMP-003', 'عمر يوسف المالكي', 'omar.malki@nayosh.com', '+966503456789', '3456789012', 'فني دعم', 'تقنية المعلومات', v_platform_id, 'PLATFORM', '2023-06-10', 8000.00, 'FULL_TIME', true)
        ON CONFLICT (employee_number) DO NOTHING;
    END IF;
END $$;

-- ========================================
-- نهاية Migration
-- ========================================

SELECT 'تم تحديث الجداول وإضافة العلاقات بنجاح! ✅' AS message;
SELECT 'عدد الموظفين: ' || COUNT(*) AS employee_count FROM employees;
SELECT 'عدد المستخدمين: ' || COUNT(*) AS user_count FROM users;
SELECT 'عدد الفواتير: ' || COUNT(*) AS invoice_count FROM invoices;
SELECT 'عدد الإعلانات: ' || COUNT(*) AS ads_count FROM ads;
