-- ========================================
-- NAYOSH ERP - Incubator Training System
-- نظام حاضنة السلامة: تسجيل → تدريب → تقييم → اعتماد → شهادات → متابعة
-- ========================================

-- Table: training_programs (البرامج التدريبية)
CREATE TABLE IF NOT EXISTS training_programs (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'SAFETY', 'TECHNICAL', 'MANAGEMENT', 'ENTREPRENEURSHIP'
    duration_hours INTEGER NOT NULL,
    max_participants INTEGER DEFAULT 30,
    price DECIMAL(10, 2) DEFAULT 0.00,
    passing_score INTEGER DEFAULT 70, -- النسبة المطلوبة للنجاح
    certificate_validity_months INTEGER DEFAULT 12, -- مدة صلاحية الشهادة بالأشهر
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: beneficiaries (المستفيدون/المتدربون)
CREATE TABLE IF NOT EXISTS beneficiaries (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    national_id VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10), -- 'MALE', 'FEMALE'
    education_level VARCHAR(50),
    occupation VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'GRADUATED')),
    registration_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: training_sessions (الدفعات التدريبية)
CREATE TABLE IF NOT EXISTS training_sessions (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES training_programs(id) ON DELETE CASCADE,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    session_code VARCHAR(50) UNIQUE NOT NULL,
    session_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location VARCHAR(255),
    instructor_name VARCHAR(255),
    max_participants INTEGER DEFAULT 30,
    current_participants INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: enrollments (التسجيلات)
CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'ATTENDING', 'COMPLETED', 'WITHDRAWN', 'FAILED')),
    attendance_percentage DECIMAL(5, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, beneficiary_id)
);

-- Table: assessments (التقييمات والاختبارات)
CREATE TABLE IF NOT EXISTS assessments (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE CASCADE,
    assessment_type VARCHAR(50) NOT NULL, -- 'WRITTEN', 'PRACTICAL', 'ORAL', 'PROJECT'
    assessment_date DATE NOT NULL,
    score DECIMAL(5, 2), -- الدرجة من 100
    max_score DECIMAL(5, 2) DEFAULT 100.00,
    passed BOOLEAN DEFAULT false,
    assessor_name VARCHAR(255),
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: certificates (الشهادات)
CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE CASCADE,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES training_programs(id) ON DELETE CASCADE,
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    issue_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    qr_code TEXT, -- QR code data
    final_score DECIMAL(5, 2),
    grade VARCHAR(20), -- 'EXCELLENT', 'VERY_GOOD', 'GOOD', 'PASS'
    status VARCHAR(20) DEFAULT 'VALID' CHECK (status IN ('VALID', 'EXPIRED', 'REVOKED', 'RENEWED')),
    issued_by VARCHAR(255),
    verification_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: training_records (السجل التدريبي للمستفيد)
CREATE TABLE IF NOT EXISTS training_records (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES training_programs(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE,
    certificate_id INTEGER REFERENCES certificates(id) ON DELETE SET NULL,
    completion_date DATE,
    total_hours INTEGER,
    final_score DECIMAL(5, 2),
    status VARCHAR(20), -- 'COMPLETED', 'IN_PROGRESS', 'WITHDRAWN'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: renewals (التجديدات)
CREATE TABLE IF NOT EXISTS renewals (
    id SERIAL PRIMARY KEY,
    original_certificate_id INTEGER REFERENCES certificates(id) ON DELETE CASCADE,
    new_certificate_id INTEGER REFERENCES certificates(id) ON DELETE CASCADE,
    renewal_date DATE DEFAULT CURRENT_DATE,
    renewal_type VARCHAR(50), -- 'STANDARD', 'REFRESHER', 'RE_EXAMINATION'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_programs_entity ON training_programs(entity_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_entity ON beneficiaries(entity_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_national_id ON beneficiaries(national_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_program ON training_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_session ON enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_beneficiary ON enrollments(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_certificates_beneficiary ON certificates(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_training_records_beneficiary ON training_records(beneficiary_id);

-- Insert sample training programs
INSERT INTO training_programs (entity_id, code, name, description, category, duration_hours, max_participants, price, passing_score, certificate_validity_months)
VALUES 
('INC03', 'SAF-101', 'السلامة والصحة المهنية - المستوى الأساسي', 'برنامج تدريبي شامل في أساسيات السلامة والصحة المهنية', 'SAFETY', 40, 25, 1500.00, 70, 12),
('INC03', 'SAF-201', 'السلامة من الحرائق والإطفاء', 'تدريب متقدم في مكافحة الحرائق وإجراءات الطوارئ', 'SAFETY', 32, 20, 1200.00, 75, 12),
('INC03', 'ENT-101', 'ريادة الأعمال للمبتدئين', 'أساسيات ريادة الأعمال وإطلاق المشاريع', 'ENTREPRENEURSHIP', 24, 30, 2000.00, 65, 24),
('INC03', 'TEC-101', 'التحول الرقمي في الأعمال', 'استراتيجيات التحول الرقمي والابتكار التقني', 'TECHNICAL', 30, 25, 2500.00, 70, 18);

-- Insert sample beneficiaries
INSERT INTO beneficiaries (entity_id, national_id, full_name, email, phone, date_of_birth, gender, education_level, occupation)
VALUES 
('INC03', '1234567890', 'محمد بن أحمد العتيبي', 'mohammed.otaibi@email.com', '0501234567', '1995-03-15', 'MALE', 'بكالوريوس', 'مهندس'),
('INC03', '1234567891', 'فاطمة بنت سعيد الغامدي', 'fatima.ghamdi@email.com', '0509876543', '1992-07-22', 'FEMALE', 'دبلوم', 'أخصائية سلامة'),
('INC03', '1234567892', 'خالد بن عبدالله المطيري', 'khalid.mutairi@email.com', '0555555555', '1990-11-10', 'MALE', 'ثانوي', 'فني صيانة'),
('INC03', '1234567893', 'نورة بنت محمد القحطاني', 'noura.qahtani@email.com', '0544444444', '1998-01-30', 'FEMALE', 'بكالوريوس', 'رائدة أعمال');

-- Insert sample training sessions
INSERT INTO training_sessions (program_id, entity_id, session_code, session_name, start_date, end_date, location, instructor_name, max_participants, status)
VALUES 
(1, 'INC03', 'SAF101-2024-01', 'الدفعة الأولى - السلامة الأساسية', '2024-02-01', '2024-02-15', 'قاعة التدريب الرئيسية', 'م. أحمد السلامة', 25, 'COMPLETED'),
(1, 'INC03', 'SAF101-2024-02', 'الدفعة الثانية - السلامة الأساسية', '2024-03-01', '2024-03-15', 'قاعة التدريب الرئيسية', 'م. أحمد السلامة', 25, 'IN_PROGRESS'),
(2, 'INC03', 'SAF201-2024-01', 'الدفعة الأولى - السلامة من الحرائق', '2024-02-10', '2024-02-25', 'مركز التدريب العملي', 'كابتن سعد الإطفاء', 20, 'PLANNED'),
(3, 'INC03', 'ENT101-2024-01', 'الدفعة الأولى - ريادة الأعمال', '2024-01-15', '2024-02-05', 'قاعة الابتكار', 'د. خالد الزهراني', 30, 'COMPLETED');

-- Insert sample enrollments
INSERT INTO enrollments (session_id, beneficiary_id, status, attendance_percentage)
VALUES 
(1, 1, 'COMPLETED', 95.00),
(1, 2, 'COMPLETED', 100.00),
(2, 3, 'ATTENDING', 80.00),
(4, 4, 'COMPLETED', 90.00);

-- Insert sample assessments
INSERT INTO assessments (enrollment_id, assessment_type, assessment_date, score, passed, assessor_name, feedback)
VALUES 
(1, 'WRITTEN', '2024-02-14', 85.00, true, 'م. أحمد السلامة', 'أداء ممتاز في الجانب النظري'),
(1, 'PRACTICAL', '2024-02-15', 90.00, true, 'م. أحمد السلامة', 'مهارات عملية متميزة'),
(2, 'WRITTEN', '2024-02-14', 95.00, true, 'م. أحمد السلامة', 'أداء استثنائي'),
(4, 'PROJECT', '2024-02-05', 88.00, true, 'د. خالد الزهراني', 'مشروع مبتكر ومتكامل');

-- Insert sample certificates
INSERT INTO certificates (enrollment_id, beneficiary_id, program_id, certificate_number, issue_date, expiry_date, final_score, grade, issued_by, verification_url)
VALUES 
(1, 1, 1, 'INC03-SAF101-2024-001', '2024-02-16', '2025-02-16', 87.50, 'VERY_GOOD', 'حاضنة السلامة', 'https://nayosh.sa/verify/INC03-SAF101-2024-001'),
(2, 2, 1, 'INC03-SAF101-2024-002', '2024-02-16', '2025-02-16', 95.00, 'EXCELLENT', 'حاضنة السلامة', 'https://nayosh.sa/verify/INC03-SAF101-2024-002'),
(4, 4, 3, 'INC03-ENT101-2024-001', '2024-02-06', '2026-02-06', 88.00, 'VERY_GOOD', 'حاضنة السلامة', 'https://nayosh.sa/verify/INC03-ENT101-2024-001');

-- Insert sample training records
INSERT INTO training_records (beneficiary_id, program_id, session_id, certificate_id, completion_date, total_hours, final_score, status)
VALUES 
(1, 1, 1, 1, '2024-02-15', 40, 87.50, 'COMPLETED'),
(2, 1, 1, 2, '2024-02-15', 40, 95.00, 'COMPLETED'),
(3, 1, 2, NULL, NULL, 32, NULL, 'IN_PROGRESS'),
(4, 3, 4, 3, '2024-02-05', 24, 88.00, 'COMPLETED');

-- Update QR codes for certificates
UPDATE certificates SET qr_code = 'QR:' || certificate_number || ':' || beneficiary_id || ':' || issue_date WHERE qr_code IS NULL;

-- Success message
SELECT 'تم إضافة نظام حاضنة السلامة بنجاح! ✅' AS message,
       (SELECT COUNT(*) FROM training_programs) as programs,
       (SELECT COUNT(*) FROM beneficiaries) as beneficiaries,
       (SELECT COUNT(*) FROM training_sessions) as sessions,
       (SELECT COUNT(*) FROM certificates) as certificates;
