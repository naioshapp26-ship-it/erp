-- ========================================
-- Create Missing Strategic Management Tables
-- ========================================

-- Financial Manual Table
CREATE TABLE IF NOT EXISTS financial_manual (
  id SERIAL PRIMARY KEY,
  section_number VARCHAR(20),
  section_title VARCHAR(255) NOT NULL,
  section_order INTEGER,
  content TEXT,
  category VARCHAR(100),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data for Financial Manual
INSERT INTO financial_manual (section_number, section_title, section_order, content, category) VALUES
('1.1', 'السياسات المالية العامة', 1, 'دليل السياسات المالية العامة للشركة وإجراءات التطبيق', 'السياسات'),
('2.1', 'إجراءات الصرف والقبض', 2, 'الإجراءات الخاصة بعمليات الصرف والقبض اليومية', 'الإجراءات'),
('3.1', 'إعداد التقارير المالية', 3, 'دليل إعداد التقارير المالية الشهرية والسنوية', 'التقارير'),
('4.1', 'إدارة الأصول الثابتة', 4, 'سياسات وإجراءات إدارة الأصول الثابتة', 'الأصول'),
('5.1', 'نظام المخزون المحاسبي', 5, 'قواعد تقييم المخزون والجرد الدوري', 'المخزون');

-- Evaluations Table
CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  evaluation_type VARCHAR(100) NOT NULL,
  evaluated_entity VARCHAR(255),
  evaluator_name VARCHAR(255),
  evaluation_date DATE NOT NULL,
  score DECIMAL(5,2),
  max_score DECIMAL(5,2) DEFAULT 100.00,
  percentage DECIMAL(5,2),
  strengths TEXT,
  weaknesses TEXT,
  recommendations TEXT,
  status VARCHAR(50) DEFAULT 'مكتمل',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data for Evaluations
INSERT INTO evaluations (evaluation_type, evaluated_entity, evaluator_name, evaluation_date, score, max_score, percentage, strengths, weaknesses, recommendations, status) VALUES
('تقييم أداء موظف', 'محمد أحمد - قسم المبيعات', 'مدير المبيعات', '2024-01-15', 85.00, 100.00, 85.00, 'التزام بالمواعيد، مهارات تواصل ممتازة', 'يحتاج لتطوير مهارات التفاوض', 'التحاق بدورة تدريبية في التفاوض', 'مكتمل'),
('تقييم جودة منتج', 'منتج ABC-2024', 'قسم الجودة', '2024-01-20', 92.00, 100.00, 92.00, 'جودة عالية، مطابق للمواصفات', 'التغليف يحتاج تحسين', 'تحسين مواد التغليف', 'مكتمل'),
('تقييم مشروع', 'مشروع تطوير النظام', 'مدير المشاريع', '2024-01-25', 88.00, 100.00, 88.00, 'التسليم في الموعد، جودة الكود', 'التوثيق غير كامل', 'استكمال التوثيق الفني', 'قيد المراجعة'),
('تقييم مورد', 'مورد المواد الخام XYZ', 'قسم المشتريات', '2024-01-30', 78.00, 100.00, 78.00, 'أسعار تنافسية', 'التأخر في التوريد', 'مراجعة عقد التوريد', 'مكتمل'),
('تقييم دورة تدريبية', 'دورة إدارة المشاريع', 'إدارة التدريب', '2024-02-05', 90.00, 100.00, 90.00, 'محتوى ممتاز، مدرب محترف', 'مدة الدورة قصيرة', 'زيادة ساعات التدريب', 'مكتمل');

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_financial_manual_category ON financial_manual(category);
CREATE INDEX IF NOT EXISTS idx_financial_manual_section ON financial_manual(section_order);
CREATE INDEX IF NOT EXISTS idx_evaluations_type ON evaluations(evaluation_type);
CREATE INDEX IF NOT EXISTS idx_evaluations_date ON evaluations(evaluation_date);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);

-- Success message
SELECT 'تم إنشاء جداول Financial Manual و Evaluations بنجاح! ✅' as message;
