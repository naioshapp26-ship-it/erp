require('dotenv').config();
const db = require('./db');
const pool = db.pool;
const ensureTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hr_employee_profiles (
      id SERIAL PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      department TEXT,
      status TEXT,
      hire_date DATE,
      manager TEXT,
      avatar_initials TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS hr_employee_records (
      id SERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      section TEXT NOT NULL,
      status TEXT,
      period TEXT,
      record JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_hr_emp_records_employee ON hr_employee_records(employee_id);
    CREATE INDEX IF NOT EXISTS idx_hr_emp_records_section ON hr_employee_records(section);
    CREATE INDEX IF NOT EXISTS idx_hr_emp_records_period ON hr_employee_records(period);
    CREATE INDEX IF NOT EXISTS idx_hr_emp_records_status ON hr_employee_records(status);
  `);
};

const seedProfile = async () => {
  await pool.query(
    `INSERT INTO hr_employee_profiles
     (employee_id, name, title, department, status, hire_date, manager, avatar_initials)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8
     WHERE NOT EXISTS (
       SELECT 1 FROM hr_employee_profiles WHERE employee_id = $1
     )`,
    [
      'EMP001',
      'رانيا السبيعي',
      'مدير شؤون الموظفين',
      'الموارد البشرية',
      'نشط',
      '2019-04-12',
      'مها الفقيه',
      'را'
    ]
  );
};

const seedRecords = async () => {
  const existing = await pool.query(
    'SELECT COUNT(*)::int AS count FROM hr_employee_records WHERE employee_id = $1',
    ['EMP001']
  );

  if (existing.rows[0]?.count > 0) {
    return { inserted: 0 };
  }

  const records = [
    ['EMP001', 'attendance', 'حضور', '2026-02-20', { date: '2026-02-20', checkIn: '08:45', checkOut: '17:05', shift: 'صباحي', status: 'حضور' }],
    ['EMP001', 'attendance', 'حضور', '2026-02-19', { date: '2026-02-19', checkIn: '08:50', checkOut: '17:00', shift: 'صباحي', status: 'حضور' }],
    ['EMP001', 'attendance', 'غياب', '2026-02-18', { date: '2026-02-18', checkIn: '--', checkOut: '--', shift: 'صباحي', status: 'غياب' }],
    ['EMP001', 'attendance', 'إجازة', '2026-02-17', { date: '2026-02-17', checkIn: '--', checkOut: '--', shift: 'صباحي', status: 'إجازة' }],
    ['EMP001', 'attendance', 'حضور', '2026-02-16', { date: '2026-02-16', checkIn: '08:35', checkOut: '17:10', shift: 'صباحي', status: 'حضور' }],
    ['EMP001', 'payroll', 'تم الصرف', '2026-02', { month: '2026-02', base: 14500, bonuses: 1200, deductions: 450, net: 15250, status: 'تم الصرف' }],
    ['EMP001', 'payroll', 'تم الصرف', '2026-01', { month: '2026-01', base: 14500, bonuses: 900, deductions: 650, net: 14750, status: 'تم الصرف' }],
    ['EMP001', 'payroll', 'تم الصرف', '2025-12', { month: '2025-12', base: 14000, bonuses: 1100, deductions: 500, net: 14600, status: 'تم الصرف' }],
    ['EMP001', 'evaluations', 'ممتاز', '2025 Q4', { period: '2025 Q4', score: 4.7, reviewer: 'مها الفقيه', status: 'ممتاز', notes: 'أداء قيادي مميز' }],
    ['EMP001', 'evaluations', 'جيد جدا', '2025 Q3', { period: '2025 Q3', score: 4.5, reviewer: 'مها الفقيه', status: 'جيد جدا', notes: 'تحسن في مؤشرات الالتزام' }],
    ['EMP001', 'evaluations', 'جيد جدا', '2025 Q2', { period: '2025 Q2', score: 4.3, reviewer: 'مها الفقيه', status: 'جيد جدا', notes: 'تطوير ملحوظ في العمليات' }],
    ['EMP001', 'trainings', 'مكتملة', '2026-02-10', { course: 'إدارة المواهب المتقدمة', provider: 'Nayosh Academy', date: '2026-02-10', hours: 12, status: 'مكتملة' }],
    ['EMP001', 'trainings', 'مكتملة', '2026-01-18', { course: 'تحليل بيانات الموارد البشرية', provider: 'Coursera', date: '2026-01-18', hours: 20, status: 'مكتملة' }],
    ['EMP001', 'trainings', 'مكتملة', '2025-12-05', { course: 'التخطيط الاستراتيجي', provider: 'CIPD', date: '2025-12-05', hours: 16, status: 'مكتملة' }],
    ['EMP001', 'warnings', 'مغلق', '2025-11-12', { type: 'تنبيه التزام', severity: 'منخفض', date: '2025-11-12', action: 'تذكير شفهي', status: 'مغلق' }],
    ['EMP001', 'warnings', 'متابعة', '2025-09-22', { type: 'تنبيه تأخير', severity: 'متوسط', date: '2025-09-22', action: 'خطة تحسين', status: 'متابعة' }],
    ['EMP001', 'attachments', 'معتمد', '2019-04-12', { name: 'عقد العمل', type: 'PDF', date: '2019-04-12', size: '1.2 MB', status: 'معتمد' }],
    ['EMP001', 'attachments', 'موثق', '2025-12-10', { name: 'شهادة تدريب قيادي', type: 'PDF', date: '2025-12-10', size: '850 KB', status: 'موثق' }],
    ['EMP001', 'attachments', 'موثق', '2025-12-30', { name: 'مراجعة أداء 2025', type: 'PDF', date: '2025-12-30', size: '980 KB', status: 'موثق' }]
  ];

  const insertSql = `
    INSERT INTO hr_employee_records
      (employee_id, section, status, period, record)
    VALUES ($1, $2, $3, $4, $5)
  `;

  for (const row of records) {
    await pool.query(insertSql, [row[0], row[1], row[2], row[3], JSON.stringify(row[4])]);
  }

  return { inserted: records.length };
};

const run = async () => {
  try {
    await ensureTables();
    await seedProfile();
    const { inserted } = await seedRecords();
    console.log(`Seed complete. Inserted records: ${inserted}`);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
  }
};

run();
