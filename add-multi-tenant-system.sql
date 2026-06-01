-- ========================================
-- Multi-Tenant Hierarchical System
-- نظام متعدد المستأجرين مع هيكل هرمي
-- ========================================
-- الهيكل: HQ (المقر الرئيسي) → Branch (فرع) → Incubator (حاضنة) → Platform (منصة) → Office (مكتب)
-- ========================================

-- 1. جدول المقر الرئيسي (HeadQuarters)
CREATE TABLE IF NOT EXISTS headquarters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  country VARCHAR(100),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول الفروع (Branches)
-- كل فرع تابع لمقر رئيسي واحد
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  hq_id INTEGER NOT NULL REFERENCES headquarters(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  country VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  manager_name VARCHAR(255),
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hq_id, code)
);

-- 3. جدول الحاضنات (Incubators)
-- كل حاضنة تابعة لفرع واحد
CREATE TABLE IF NOT EXISTS incubators (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  program_type VARCHAR(100), -- نوع البرنامج: تدريب، تأهيل، احتضان...
  capacity INTEGER DEFAULT 0, -- السعة الاستيعابية
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  manager_name VARCHAR(255),
  start_date DATE,
  end_date DATE,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(branch_id, code)
);

-- 4. جدول المنصات (Platforms)
-- كل منصة تابعة لحاضنة واحدة
CREATE TABLE IF NOT EXISTS platforms (
  id SERIAL PRIMARY KEY,
  incubator_id INTEGER NOT NULL REFERENCES incubators(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  platform_type VARCHAR(100), -- نوع المنصة: خدمات، منتجات، برامج...
  pricing_model VARCHAR(50), -- نموذج التسعير: مجاني، اشتراك، دفع لكل استخدام...
  base_price DECIMAL(10, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  features JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(incubator_id, code)
);

-- 5. جدول المكاتب (Offices)
-- كل مكتب تابع لحاضنة واحدة (يمكن أن يخدم عدة منصات)
CREATE TABLE IF NOT EXISTS offices (
  id SERIAL PRIMARY KEY,
  incubator_id INTEGER NOT NULL REFERENCES incubators(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  office_type VARCHAR(100), -- نوع المكتب: إلكتروني، قاعة، مركز خدمة...
  location VARCHAR(255),
  address TEXT,
  capacity INTEGER DEFAULT 0,
  working_hours JSONB DEFAULT '{}',
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  manager_name VARCHAR(255),
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(incubator_id, code)
);

-- 6. جدول ربط المكاتب بالمنصات (Office-Platform Association)
-- مكتب واحد يمكن أن يخدم عدة منصات
CREATE TABLE IF NOT EXISTS office_platforms (
  id SERIAL PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(office_id, platform_id)
);

-- 7. تحديث جدول الكيانات (Entities) ليكون متوافق مع النظام الجديد
-- نضيف حقول tenant_type و tenant_id لربط الكيانات بالهيكل الهرمي
ALTER TABLE entities ADD COLUMN IF NOT EXISTS tenant_type VARCHAR(50);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- نضيف حقول للتعرف على موقع الكيان في الهيكل
ALTER TABLE entities ADD COLUMN IF NOT EXISTS hq_id INTEGER REFERENCES headquarters(id);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS incubator_id INTEGER REFERENCES incubators(id);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS platform_id INTEGER REFERENCES platforms(id);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES offices(id);

-- 8. فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_branches_hq ON branches(hq_id);
CREATE INDEX IF NOT EXISTS idx_incubators_branch ON incubators(branch_id);
CREATE INDEX IF NOT EXISTS idx_platforms_incubator ON platforms(incubator_id);
CREATE INDEX IF NOT EXISTS idx_offices_incubator ON offices(incubator_id);
CREATE INDEX IF NOT EXISTS idx_office_platforms_office ON office_platforms(office_id);
CREATE INDEX IF NOT EXISTS idx_office_platforms_platform ON office_platforms(platform_id);
CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities(tenant_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_hq ON entities(hq_id);
CREATE INDEX IF NOT EXISTS idx_entities_branch ON entities(branch_id);
CREATE INDEX IF NOT EXISTS idx_entities_incubator ON entities(incubator_id);

-- 9. إنشاء View للحصول على المسار الكامل للكيان في الهيكل
CREATE OR REPLACE VIEW entity_hierarchy AS
SELECT 
  e.id as entity_id,
  e.name as entity_name,
  e.tenant_type,
  e.tenant_id,
  hq.id as hq_id,
  hq.name as hq_name,
  hq.code as hq_code,
  b.id as branch_id,
  b.name as branch_name,
  b.code as branch_code,
  i.id as incubator_id,
  i.name as incubator_name,
  i.code as incubator_code,
  p.id as platform_id,
  p.name as platform_name,
  p.code as platform_code,
  o.id as office_id,
  o.name as office_name,
  o.code as office_code
FROM entities e
LEFT JOIN headquarters hq ON e.hq_id = hq.id
LEFT JOIN branches b ON e.branch_id = b.id
LEFT JOIN incubators i ON e.incubator_id = i.id
LEFT JOIN platforms p ON e.platform_id = p.id
LEFT JOIN offices o ON e.office_id = o.id;

-- 10. Triggers لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_headquarters_updated_at BEFORE UPDATE ON headquarters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incubators_updated_at BEFORE UPDATE ON incubators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platforms_updated_at BEFORE UPDATE ON platforms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON offices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. إدراج بيانات تجريبية
-- المقر الرئيسي
INSERT INTO headquarters (name, code, description, country, contact_email)
VALUES 
  ('NAIOSH Global HQ', 'HQ-001', 'المقر الرئيسي العالمي لنيوش', 'International', 'hq@nayosh.com')
ON CONFLICT (code) DO NOTHING;

-- الفروع
INSERT INTO branches (hq_id, name, code, country, city, contact_email)
VALUES 
  (1, 'فرع المملكة العربية السعودية', 'BR-SA', 'Saudi Arabia', 'Riyadh', 'sa@nayosh.com'),
  (1, 'فرع جمهورية مصر العربية', 'BR-EG', 'Egypt', 'Cairo', 'eg@nayosh.com'),
  (1, 'فرع الإمارات العربية المتحدة', 'BR-AE', 'UAE', 'Dubai', 'ae@nayosh.com')
ON CONFLICT (hq_id, code) DO NOTHING;

-- الحاضنات
INSERT INTO incubators (branch_id, name, code, program_type, capacity)
VALUES 
  (1, 'حاضنة الرياض للأعمال', 'INC-SA-01', 'احتضان أعمال', 50),
  (2, 'حاضنة القاهرة للتقنية', 'INC-EG-01', 'حاضنة تقنية', 30),
  (3, 'حاضنة دبي للابتكار', 'INC-AE-01', 'ابتكار وتطوير', 40)
ON CONFLICT (branch_id, code) DO NOTHING;

-- المنصات
INSERT INTO platforms (incubator_id, name, code, platform_type, pricing_model, base_price)
VALUES 
  (1, 'منصة التدريب المهني', 'PLT-TR-01', 'تدريب', 'اشتراك شهري', 99.99),
  (1, 'منصة الاستشارات', 'PLT-CS-01', 'استشارات', 'دفع لكل جلسة', 149.99),
  (2, 'منصة البرمجة', 'PLT-PG-01', 'خدمات تقنية', 'اشتراك سنوي', 1200.00),
  (3, 'منصة الابتكار', 'PLT-IN-01', 'ابتكار', 'مجاني', 0.00)
ON CONFLICT (incubator_id, code) DO NOTHING;

-- المكاتب
INSERT INTO offices (incubator_id, name, code, office_type, capacity)
VALUES 
  (1, 'مكتب خدمة العملاء - الرياض', 'OFF-SA-CS', 'مركز خدمة', 20),
  (1, 'القاعة التدريبية - الرياض', 'OFF-SA-TR', 'قاعة تدريب', 30),
  (2, 'مكتب إلكتروني - القاهرة', 'OFF-EG-VR', 'إلكتروني', 100),
  (3, 'مركز الابتكار - دبي', 'OFF-AE-IC', 'مركز ابتكار', 25)
ON CONFLICT (incubator_id, code) DO NOTHING;

-- ربط المكاتب بالمنصات
INSERT INTO office_platforms (office_id, platform_id)
VALUES 
  (1, 1), -- مكتب خدمة العملاء يخدم منصة التدريب
  (1, 2), -- مكتب خدمة العملاء يخدم منصة الاستشارات
  (2, 1), -- القاعة التدريبية تخدم منصة التدريب
  (3, 3), -- المكتب الإلكتروني يخدم منصة البرمجة
  (4, 4)  -- مركز الابتكار يخدم منصة الابتكار
ON CONFLICT (office_id, platform_id) DO NOTHING;

-- ========================================
-- تم إنشاء النظام بنجاح
-- ========================================
