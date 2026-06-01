const db = require('./db');

const createTableSql = `
  CREATE TABLE IF NOT EXISTS finance_return_requests (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    customer TEXT NOT NULL,
    reason TEXT NOT NULL,
    condition TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    fee_rate NUMERIC(6, 4) NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    risk TEXT NOT NULL,
    received DATE NOT NULL,
    channel TEXT NOT NULL,
    inspector TEXT NOT NULL,
    refund_type TEXT NOT NULL,
    sla_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const seedData = [
  {
    id: 'RET-7841',
    order_id: 'ORD-99231',
    customer: 'شركة المشرق',
    reason: 'عيب تصنيع',
    condition: 'غير مستخدم',
    category: 'إلكترونيات',
    amount: 12450,
    fee_rate: 0,
    status: 'مقبول',
    risk: 'منخفض',
    received: '2026-02-01',
    channel: 'فرع الرياض',
    inspector: 'سارة الحربي',
    refund_type: 'استرداد كامل',
    sla_days: 2
  },
  {
    id: 'RET-7846',
    order_id: 'ORD-99289',
    customer: 'مؤسسة أفق',
    reason: 'تغيير رغبة',
    condition: 'بحالة جيدة',
    category: 'موضة',
    amount: 3200,
    fee_rate: 0.05,
    status: 'قيد المعالجة',
    risk: 'متوسط',
    received: '2026-02-04',
    channel: 'التطبيق',
    inspector: 'أحمد الدوسري',
    refund_type: 'استرداد جزئي',
    sla_days: 3
  },
  {
    id: 'RET-7849',
    order_id: 'ORD-99321',
    customer: 'شركة بوابة الأعمال',
    reason: 'تلف بالشحن',
    condition: 'متضرر جزئيًا',
    category: 'أجهزة مكتبية',
    amount: 8900,
    fee_rate: 0,
    status: 'مفتوح',
    risk: 'مرتفع',
    received: '2026-02-06',
    channel: 'شريك B2B',
    inspector: 'ليان الغامدي',
    refund_type: 'استبدال',
    sla_days: 4
  },
  {
    id: 'RET-7851',
    order_id: 'ORD-99344',
    customer: 'مجموعة الندى',
    reason: 'مخالفة المواصفات',
    condition: 'غير مستخدم',
    category: 'إلكترونيات',
    amount: 15600,
    fee_rate: 0,
    status: 'مقبول',
    risk: 'منخفض',
    received: '2026-02-02',
    channel: 'فرع جدة',
    inspector: 'نورة القحطاني',
    refund_type: 'استرداد كامل',
    sla_days: 2
  },
  {
    id: 'RET-7854',
    order_id: 'ORD-99371',
    customer: 'شركة مدار',
    reason: 'تغيير رغبة',
    condition: 'بحالة جيدة',
    category: 'موضة',
    amount: 2700,
    fee_rate: 0.07,
    status: 'مرفوض',
    risk: 'متوسط',
    received: '2026-01-20',
    channel: 'التطبيق',
    inspector: 'سلمان العتيبي',
    refund_type: 'غير مؤهل',
    sla_days: 5
  },
  {
    id: 'RET-7857',
    order_id: 'ORD-99380',
    customer: 'شركة ميثاق',
    reason: 'عيب تصنيع',
    condition: 'غير مستخدم',
    category: 'إلكترونيات',
    amount: 22100,
    fee_rate: 0,
    status: 'قيد المعالجة',
    risk: 'مرتفع',
    received: '2026-02-08',
    channel: 'فرع الرياض',
    inspector: 'رهف الشهري',
    refund_type: 'استرداد كامل',
    sla_days: 3
  },
  {
    id: 'RET-7860',
    order_id: 'ORD-99405',
    customer: 'مؤسسة البيان',
    reason: 'تلف بالشحن',
    condition: 'متضرر جزئيًا',
    category: 'أجهزة مكتبية',
    amount: 4150,
    fee_rate: 0,
    status: 'مفتوح',
    risk: 'متوسط',
    received: '2026-02-09',
    channel: 'فرع الدمام',
    inspector: 'دانا السبيعي',
    refund_type: 'استبدال',
    sla_days: 4
  },
  {
    id: 'RET-7863',
    order_id: 'ORD-99422',
    customer: 'شركة الواحة',
    reason: 'مخالفة المواصفات',
    condition: 'غير مستخدم',
    category: 'إلكترونيات',
    amount: 6900,
    fee_rate: 0,
    status: 'مكتمل',
    risk: 'منخفض',
    received: '2026-01-29',
    channel: 'فرع جدة',
    inspector: 'سارة الحربي',
    refund_type: 'استرداد كامل',
    sla_days: 2
  }
];

const insertSql = `
  INSERT INTO finance_return_requests (
    id, order_id, customer, reason, condition, category, amount, fee_rate,
    status, risk, received, channel, inspector, refund_type, sla_days
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15
  )
  ON CONFLICT (id) DO UPDATE SET
    order_id = EXCLUDED.order_id,
    customer = EXCLUDED.customer,
    reason = EXCLUDED.reason,
    condition = EXCLUDED.condition,
    category = EXCLUDED.category,
    amount = EXCLUDED.amount,
    fee_rate = EXCLUDED.fee_rate,
    status = EXCLUDED.status,
    risk = EXCLUDED.risk,
    received = EXCLUDED.received,
    channel = EXCLUDED.channel,
    inspector = EXCLUDED.inspector,
    refund_type = EXCLUDED.refund_type,
    sla_days = EXCLUDED.sla_days,
    updated_at = NOW();
`;

async function seed() {
  try {
    await db.query(createTableSql);
    for (const row of seedData) {
      const values = [
        row.id,
        row.order_id,
        row.customer,
        row.reason,
        row.condition,
        row.category,
        row.amount,
        row.fee_rate,
        row.status,
        row.risk,
        row.received,
        row.channel,
        row.inspector,
        row.refund_type,
        row.sla_days
      ];
      await db.query(insertSql, values);
    }
    console.log('✅ تم إنشاء الجدول وإضافة بيانات الاسترجاع بنجاح.');
  } catch (err) {
    console.error('❌ فشل إدخال بيانات الاسترجاع:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

seed();
