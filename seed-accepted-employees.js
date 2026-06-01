// Seed initial accepted employees into accepted_employees table.
const db = require('./db');

const employees = [
  {
    full_name: 'أحمد العتيبي',
    job_title: 'أخصائي موارد بشرية',
    email: 'ahmad.alotaibi@example.com',
    phone: '+966500000101',
    hire_date: '2024-11-01',
    entity_id: 'HQ001'
  },
  {
    full_name: 'سارة القحطاني',
    job_title: 'محاسب أول',
    email: 'sara.alqahtani@example.com',
    phone: '+966500000102',
    hire_date: '2024-11-15',
    entity_id: 'BR001'
  },
  {
    full_name: 'فهد الدوسري',
    job_title: 'مسؤول توظيف',
    email: 'fahad.aldosari@example.com',
    phone: '+966500000103',
    hire_date: '2024-12-01',
    entity_id: 'BR002'
  },
  {
    full_name: 'ريم الحربي',
    job_title: 'تنفيذي شؤون موظفين',
    email: 'reem.alharbi@example.com',
    phone: '+966500000104',
    hire_date: '2025-01-05',
    entity_id: 'INC-01'
  },
  {
    full_name: 'ماجد المطيري',
    job_title: 'مسؤول كشوفات الرواتب',
    email: 'majed.almotairi@example.com',
    phone: '+966500000105',
    hire_date: '2025-01-20',
    entity_id: 'PLAT-01'
  },
  {
    full_name: 'دلال الشهري',
    job_title: 'منسق تدريب',
    email: 'dalal.alshahri@example.com',
    phone: '+966500000106',
    hire_date: '2025-02-01',
    entity_id: 'OFF-001'
  },
  {
    full_name: 'عبدالله الغامدي',
    job_title: 'محلل رواتب',
    email: 'abdullah.alghamdi@example.com',
    phone: '+966500000107',
    hire_date: '2025-02-10',
    entity_id: 'HQ001'
  },
  {
    full_name: 'نوف العتيق',
    job_title: 'أخصائي علاقات الموظفين',
    email: 'nouf.alateeq@example.com',
    phone: '+966500000108',
    hire_date: '2025-02-15',
    entity_id: 'BR003'
  }
];

async function seed() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS accepted_employees (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        job_title TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        hire_date DATE NOT NULL,
        entity_id TEXT DEFAULT 'HQ001',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_accepted_employees_entity ON accepted_employees(entity_id);
      CREATE INDEX IF NOT EXISTS idx_accepted_employees_hire_date ON accepted_employees(hire_date);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_accepted_employees_identity ON accepted_employees(full_name, job_title, hire_date, entity_id);
    `);

    console.log('Seeding accepted_employees ...');
    for (const emp of employees) {
      await db.query(
        `INSERT INTO accepted_employees (full_name, job_title, email, phone, hire_date, entity_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (full_name, job_title, hire_date, entity_id) DO NOTHING`,
        [emp.full_name, emp.job_title, emp.email, emp.phone, emp.hire_date, emp.entity_id || 'HQ001']
      );
    }
    console.log('✅ Done seeding accepted employees');
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    db.pool.end();
  }
}

seed();
