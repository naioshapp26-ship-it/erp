-- =============================================
-- إنشاء جداول الإدارة الاستراتيجية
-- Strategic Management Tables
-- =============================================

-- ===========================================
-- 1. الإدارة التنفيذية - Executive Management
-- ===========================================

-- جدول مؤشرات الأداء التنفيذي
CREATE TABLE IF NOT EXISTS executive_kpis (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    target_value DECIMAL(10,2),
    metric_unit VARCHAR(50),
    period VARCHAR(50) DEFAULT 'شهري',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول الأهداف التنفيذية
CREATE TABLE IF NOT EXISTS executive_goals (
    id SERIAL PRIMARY KEY,
    goal_title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'in_progress',
    assigned_to INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول العمليات التنفيذية
CREATE TABLE IF NOT EXISTS executive_operations (
    id SERIAL PRIMARY KEY,
    operation_name VARCHAR(255) NOT NULL,
    operation_type VARCHAR(100),
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 2. الأنظمة الذكية - Smart Systems
-- ===========================================

-- جدول أنظمة التسويق الإلكتروني
CREATE TABLE IF NOT EXISTS digital_marketing_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(100) DEFAULT 'إلكتروني',
    budget DECIMAL(12,2),
    spent DECIMAL(12,2) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول التسويق المجتمعي
CREATE TABLE IF NOT EXISTS community_marketing (
    id SERIAL PRIMARY KEY,
    initiative_name VARCHAR(255) NOT NULL,
    community_name VARCHAR(255),
    target_audience VARCHAR(255),
    participants_count INTEGER DEFAULT 0,
    impact_score DECIMAL(5,2),
    event_date DATE,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول التسويق عبر الفعاليات
CREATE TABLE IF NOT EXISTS event_marketing (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(100),
    venue VARCHAR(255),
    event_date DATE,
    expected_attendees INTEGER,
    actual_attendees INTEGER DEFAULT 0,
    budget DECIMAL(12,2),
    leads_generated INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 3. إدارة الاشتراكات - Subscription Management
-- ===========================================

-- جدول الدورات التدريبية
CREATE TABLE IF NOT EXISTS training_courses (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    course_code VARCHAR(50) UNIQUE,
    duration_hours INTEGER,
    instructor_name VARCHAR(255),
    max_participants INTEGER DEFAULT 30,
    current_participants INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول المهارات
CREATE TABLE IF NOT EXISTS skills_registry (
    id SERIAL PRIMARY KEY,
    skill_name VARCHAR(255) NOT NULL,
    skill_category VARCHAR(100),
    skill_level VARCHAR(50),
    description TEXT,
    prerequisite VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول تقييمات KPI
CREATE TABLE IF NOT EXISTS kpi_evaluations (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES users(id),
    evaluation_period VARCHAR(50),
    kpi_score DECIMAL(5,2),
    performance_rating VARCHAR(50),
    strengths TEXT,
    areas_for_improvement TEXT,
    evaluated_by INTEGER REFERENCES users(id),
    evaluation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 4. إدارة العمليات - Operations Management
-- ===========================================

-- جدول العمليات اليومية
CREATE TABLE IF NOT EXISTS daily_operations (
    id SERIAL PRIMARY KEY,
    operation_date DATE NOT NULL,
    branch_id INTEGER REFERENCES branches(id),
    incubator_id INTEGER REFERENCES incubators(id),
    platform_id INTEGER REFERENCES platforms(id),
    operation_type VARCHAR(100),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to INTEGER REFERENCES users(id),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول مراقبة الأداء التشغيلي
CREATE TABLE IF NOT EXISTS operational_monitoring (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    metric_name VARCHAR(255),
    metric_value DECIMAL(10,2),
    threshold_min DECIMAL(10,2),
    threshold_max DECIMAL(10,2),
    alert_status VARCHAR(50) DEFAULT 'normal',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 5. الموافقات المالية - Financial Approvals
-- ===========================================

-- جدول السياسات والإجراءات
CREATE TABLE IF NOT EXISTS financial_policies (
    id SERIAL PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL,
    policy_code VARCHAR(50) UNIQUE,
    category VARCHAR(100),
    description TEXT,
    approval_threshold DECIMAL(12,2),
    effective_date DATE,
    review_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول دليل التشغيل المالي
CREATE TABLE IF NOT EXISTS financial_operating_manual (
    id SERIAL PRIMARY KEY,
    section_title VARCHAR(255) NOT NULL,
    section_number VARCHAR(50),
    content TEXT,
    version VARCHAR(20),
    last_updated DATE,
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول أخبار الموافقات المالية
CREATE TABLE IF NOT EXISTS financial_news (
    id SERIAL PRIMARY KEY,
    news_title VARCHAR(255) NOT NULL,
    news_content TEXT,
    priority VARCHAR(50) DEFAULT 'normal',
    published_date TIMESTAMP,
    expires_date TIMESTAMP,
    published_by INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 6. التدريب والتطوير - Training & Development
-- ===========================================

-- جدول البرامج التدريبية
CREATE TABLE IF NOT EXISTS development_programs (
    id SERIAL PRIMARY KEY,
    program_name VARCHAR(255) NOT NULL,
    program_type VARCHAR(100),
    target_audience VARCHAR(255),
    duration_weeks INTEGER,
    trainer VARCHAR(255),
    capacity INTEGER DEFAULT 20,
    enrolled INTEGER DEFAULT 0,
    start_date DATE,
    completion_rate DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول تقييم البرامج التدريبية
CREATE TABLE IF NOT EXISTS training_evaluations (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES development_programs(id),
    participant_id INTEGER REFERENCES users(id),
    attendance_rate DECIMAL(5,2),
    performance_score DECIMAL(5,2),
    feedback TEXT,
    certification_awarded BOOLEAN DEFAULT FALSE,
    evaluation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 7. الجودة والتدقيق - Quality & Audit
-- ===========================================

-- جدول معايير الجودة
CREATE TABLE IF NOT EXISTS quality_standards (
    id SERIAL PRIMARY KEY,
    standard_name VARCHAR(255) NOT NULL,
    standard_code VARCHAR(50) UNIQUE,
    category VARCHAR(100),
    description TEXT,
    compliance_level VARCHAR(50),
    audit_frequency VARCHAR(50),
    last_audit_date DATE,
    next_audit_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول التدقيق
CREATE TABLE IF NOT EXISTS quality_audits (
    id SERIAL PRIMARY KEY,
    audit_name VARCHAR(255) NOT NULL,
    audit_type VARCHAR(100),
    audited_entity_type VARCHAR(50),
    audited_entity_id INTEGER,
    auditor_id INTEGER REFERENCES users(id),
    audit_date DATE,
    findings TEXT,
    recommendations TEXT,
    compliance_score DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 8. التقييم - Evaluation
-- ===========================================

-- جدول التقييمات العامة
CREATE TABLE IF NOT EXISTS general_evaluations (
    id SERIAL PRIMARY KEY,
    evaluation_name VARCHAR(255) NOT NULL,
    evaluation_type VARCHAR(100),
    evaluator_id INTEGER REFERENCES users(id),
    evaluated_entity_type VARCHAR(50),
    evaluated_entity_id INTEGER,
    score DECIMAL(5,2),
    max_score DECIMAL(5,2) DEFAULT 100,
    grade VARCHAR(20),
    comments TEXT,
    evaluation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول معايير التقييم
CREATE TABLE IF NOT EXISTS evaluation_criteria (
    id SERIAL PRIMARY KEY,
    criteria_name VARCHAR(255) NOT NULL,
    criteria_category VARCHAR(100),
    weight DECIMAL(5,2),
    description TEXT,
    scoring_method VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 9. مركز المعلومات - Information Center
-- ===========================================

-- جدول المعلومات العامة
CREATE TABLE IF NOT EXISTS information_repository (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    content TEXT,
    file_path VARCHAR(500),
    tags TEXT,
    access_level VARCHAR(50) DEFAULT 'public',
    views_count INTEGER DEFAULT 0,
    published_by INTEGER REFERENCES users(id),
    published_date TIMESTAMP,
    last_updated TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول قاعدة المعرفة
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    question TEXT,
    answer TEXT,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- الفهارس لتحسين الأداء
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_executive_kpis_period ON executive_kpis(period);
CREATE INDEX IF NOT EXISTS idx_executive_goals_status ON executive_goals(status);
CREATE INDEX IF NOT EXISTS idx_digital_marketing_status ON digital_marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_training_courses_status ON training_courses(status);
CREATE INDEX IF NOT EXISTS idx_daily_operations_date ON daily_operations(operation_date);
CREATE INDEX IF NOT EXISTS idx_financial_policies_status ON financial_policies(status);
CREATE INDEX IF NOT EXISTS idx_quality_audits_status ON quality_audits(status);
CREATE INDEX IF NOT EXISTS idx_information_category ON information_repository(category);

COMMIT;
