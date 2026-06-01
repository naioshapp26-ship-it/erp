require('dotenv').config();
const db = require('./db');
const pool = db.pool;
const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';
const ENTITY_TYPE = process.env.SEED_ENTITY_TYPE || 'HQ';

const CUSTOMERS = [
  { code: 'عميل-1001', nameAr: 'مجموعة الشروق للتجارة', nameEn: 'Alshurooq Trading Group', type: 'CORPORATE', city: 'الرياض' },
  { code: 'عميل-1002', nameAr: 'شركة المدى للخدمات', nameEn: 'Almada Services', type: 'CORPORATE', city: 'جدة' },
  { code: 'عميل-1003', nameAr: 'مؤسسة النخبة', nameEn: 'Elite Establishment', type: 'SMB', city: 'الدمام' },
  { code: 'عميل-1004', nameAr: 'مصنع التميز الصناعي', nameEn: 'Industrial Excellence', type: 'CORPORATE', city: 'الجبيل' },
  { code: 'عميل-1005', nameAr: 'رواد التقنية المتقدمة', nameEn: 'Tech Pioneers', type: 'SMB', city: 'المدينة' },
  { code: 'عميل-1006', nameAr: 'شبكة أفق اللوجستية', nameEn: 'Horizon Logistics', type: 'CORPORATE', city: 'الرياض' }
];

function buildDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function buildInvoiceNumber(index) {
  return `AR-${ENTITY_ID}-${String(index).padStart(4, '0')}`;
}

function deriveStatus(total, paid, dueDate) {
  if (paid >= total) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  if (new Date(dueDate) < new Date()) return 'OVERDUE';
  return 'ISSUED';
}

function derivePaymentStatus(total, paid) {
  if (paid >= total) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'UNPAID';
}

async function ensureCustomers() {
  const ids = [];
  for (const customer of CUSTOMERS) {
    const result = await pool.query(
      `INSERT INTO finance_customers (
        customer_code,
        customer_name_ar,
        customer_name_en,
        customer_type,
        city,
        entity_type,
        entity_id,
        branch_id,
        incubator_id,
        created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (customer_code) DO UPDATE SET
        customer_name_ar = EXCLUDED.customer_name_ar,
        customer_name_en = EXCLUDED.customer_name_en,
        customer_type = EXCLUDED.customer_type,
        city = EXCLUDED.city,
        entity_type = EXCLUDED.entity_type,
        entity_id = EXCLUDED.entity_id,
        branch_id = EXCLUDED.branch_id,
        incubator_id = EXCLUDED.incubator_id,
        updated_at = NOW()
      RETURNING customer_id;`,
      [
        customer.code,
        customer.nameAr,
        customer.nameEn,
        customer.type,
        customer.city,
        ENTITY_TYPE,
        ENTITY_ID,
        'BR001',
        'INC01',
        'تهيئة البيانات'
      ]
    );
    ids.push({ id: result.rows[0].customer_id, nameAr: customer.nameAr });
  }
  return ids;
}

async function seedInvoices(customerIds) {
  await pool.query("DELETE FROM finance_invoices WHERE invoice_number LIKE 'AR-%'");

  const invoicePlans = [
    { daysAgo: 75, dueDaysAgo: 45, total: 185000, paid: 25000 },
    { daysAgo: 50, dueDaysAgo: 20, total: 98000, paid: 0 },
    { daysAgo: 40, dueDaysAgo: 10, total: 72000, paid: 20000 },
    { daysAgo: 30, dueDaysAgo: 5, total: 56000, paid: 15000 },
    { daysAgo: 25, dueDaysAgo: -5, total: 43000, paid: 0 },
    { daysAgo: 20, dueDaysAgo: -10, total: 120000, paid: 60000 },
    { daysAgo: 18, dueDaysAgo: -12, total: 95000, paid: 0 },
    { daysAgo: 14, dueDaysAgo: -16, total: 32000, paid: 8000 },
    { daysAgo: 10, dueDaysAgo: -20, total: 150000, paid: 45000 },
    { daysAgo: 8, dueDaysAgo: -25, total: 67000, paid: 12000 },
    { daysAgo: 5, dueDaysAgo: -30, total: 89000, paid: 0 },
    { daysAgo: 3, dueDaysAgo: -40, total: 210000, paid: 90000 }
  ];

  let index = 1;
  for (const plan of invoicePlans) {
    const customer = customerIds[index % customerIds.length];
    const invoiceDate = buildDate(plan.daysAgo);
    const dueDate = buildDate(plan.dueDaysAgo);
    const total = plan.total;
    const paid = plan.paid;
    const remaining = Math.max(total - paid, 0);
    const status = deriveStatus(total, paid, dueDate);
    const paymentStatus = derivePaymentStatus(total, paid);

    await pool.query(
      `INSERT INTO finance_invoices (
        invoice_number,
        invoice_date,
        due_date,
        customer_id,
        customer_name,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        paid_amount,
        remaining_amount,
        status,
        payment_status,
        entity_type,
        entity_id,
        branch_id,
        incubator_id,
        notes,
        created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )`,
      [
        buildInvoiceNumber(index),
        invoiceDate,
        dueDate,
        customer.id,
        customer.nameAr,
        total,
        0,
        0,
        total,
        paid,
        remaining,
        status,
        paymentStatus,
        ENTITY_TYPE,
        ENTITY_ID,
        'BR001',
        'INC01',
        `فاتورة ذمم المدينة رقم ${index}`,
        'تهيئة البيانات'
      ]
    );
    index += 1;
  }
}

async function seedARAging() {
  console.log('🧾 بدء تجهيز بيانات أعمار الذمم المدينة...');
  const customerIds = await ensureCustomers();
  await seedInvoices(customerIds);
  console.log('✅ تم تجهيز بيانات أعمار الذمم المدينة بنجاح.');
}

seedARAging()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('❌ حدث خطأ أثناء تجهيز البيانات:', err);
    process.exit(1);
  });
