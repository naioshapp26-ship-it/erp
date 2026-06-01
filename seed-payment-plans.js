const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';
const BRANCH_ID = process.env.SEED_BRANCH_ID || 'BR001';
const INCUBATOR_ID = process.env.SEED_INCUBATOR_ID || 'INC01';

const customers = [
  {
    code: 'CUST-ENTERPRISE-001',
    nameAr: 'شركة الخليج للطاقة',
    nameEn: 'Gulf Energy Co.',
    type: 'ENTERPRISE',
    email: 'billing@gulf-energy.sa',
    phone: '+966-11-555-1001',
    riskScore: 72,
    riskLevel: 'MEDIUM'
  },
  {
    code: 'CUST-RETAIL-002',
    nameAr: 'متاجر الصفاء',
    nameEn: 'Al Safaa Retail',
    type: 'RETAIL',
    email: 'finance@safaa.sa',
    phone: '+966-12-222-3322',
    riskScore: 55,
    riskLevel: 'LOW'
  },
  {
    code: 'CUST-GOV-003',
    nameAr: 'هيئة المدن الذكية',
    nameEn: 'Smart Cities Authority',
    type: 'GOVERNMENT',
    email: 'ap@smartcities.gov.sa',
    phone: '+966-11-800-2020',
    riskScore: 64,
    riskLevel: 'MEDIUM'
  },
  {
    code: 'CUST-SME-004',
    nameAr: 'حلول الأعمال السريعة',
    nameEn: 'QuickBiz Solutions',
    type: 'SME',
    email: 'billing@quickbiz.sa',
    phone: '+966-13-773-4411',
    riskScore: 48,
    riskLevel: 'LOW'
  },
  {
    code: 'CUST-TECH-005',
    nameAr: 'تقنيات الرؤية المستقبلية',
    nameEn: 'Future Vision Tech',
    type: 'TECH',
    email: 'finance@fvt.sa',
    phone: '+966-50-111-2200',
    riskScore: 81,
    riskLevel: 'HIGH'
  },
  {
    code: 'CUST-EDU-006',
    nameAr: 'أكاديمية النجاح',
    nameEn: 'Najah Academy',
    type: 'EDUCATION',
    email: 'accounts@najah.edu.sa',
    phone: '+966-55-889-7744',
    riskScore: 62,
    riskLevel: 'MEDIUM'
  }
];

const invoices = [
  {
    number: 'INV-PP-0001',
    customerCode: 'CUST-ENTERPRISE-001',
    invoiceDate: '2026-01-01',
    dueDate: '2026-03-01',
    total: 180000,
    paid: 60000,
    status: 'ISSUED',
    paymentStatus: 'PARTIAL',
    allowInstallments: true
  },
  {
    number: 'INV-PP-0002',
    customerCode: 'CUST-RETAIL-002',
    invoiceDate: '2026-01-10',
    dueDate: '2026-02-15',
    total: 95000,
    paid: 25000,
    status: 'ISSUED',
    paymentStatus: 'PARTIAL',
    allowInstallments: true
  },
  {
    number: 'INV-PP-0003',
    customerCode: 'CUST-GOV-003',
    invoiceDate: '2026-02-01',
    dueDate: '2026-04-30',
    total: 210000,
    paid: 125000,
    status: 'ISSUED',
    paymentStatus: 'PARTIAL',
    allowInstallments: true
  },
  {
    number: 'INV-PP-0004',
    customerCode: 'CUST-SME-004',
    invoiceDate: '2025-12-15',
    dueDate: '2026-01-30',
    total: 68000,
    paid: 68000,
    status: 'ISSUED',
    paymentStatus: 'PAID',
    allowInstallments: true
  },
  {
    number: 'INV-PP-0005',
    customerCode: 'CUST-TECH-005',
    invoiceDate: '2026-01-25',
    dueDate: '2026-03-15',
    total: 120000,
    paid: 40000,
    status: 'ISSUED',
    paymentStatus: 'PARTIAL',
    allowInstallments: true
  },
  {
    number: 'INV-PP-0006',
    customerCode: 'CUST-EDU-006',
    invoiceDate: '2026-02-05',
    dueDate: '2026-04-05',
    total: 45000,
    paid: 15000,
    status: 'ISSUED',
    paymentStatus: 'PARTIAL',
    allowInstallments: true
  }
];

const payments = [
  { number: 'PAY-PP-0001', customerCode: 'CUST-ENTERPRISE-001', amount: 40000, method: 'BANK_TRANSFER', status: 'COMPLETED', paymentDate: '2026-01-12' },
  { number: 'PAY-PP-0002', customerCode: 'CUST-ENTERPRISE-001', amount: 20000, method: 'CARD', status: 'COMPLETED', paymentDate: '2026-01-20' },
  { number: 'PAY-PP-0003', customerCode: 'CUST-RETAIL-002', amount: 25000, method: 'BANK_TRANSFER', status: 'COMPLETED', paymentDate: '2026-01-22' },
  { number: 'PAY-PP-0004', customerCode: 'CUST-GOV-003', amount: 50000, method: 'BANK_TRANSFER', status: 'PENDING', paymentDate: '2026-02-05' },
  { number: 'PAY-PP-0005', customerCode: 'CUST-GOV-003', amount: 75000, method: 'BANK_TRANSFER', status: 'COMPLETED', paymentDate: '2026-02-12' },
  { number: 'PAY-PP-0006', customerCode: 'CUST-SME-004', amount: 68000, method: 'BANK_TRANSFER', status: 'COMPLETED', paymentDate: '2026-01-18' },
  { number: 'PAY-PP-0007', customerCode: 'CUST-TECH-005', amount: 40000, method: 'CARD', status: 'COMPLETED', paymentDate: '2026-02-01' },
  { number: 'PAY-PP-0008', customerCode: 'CUST-EDU-006', amount: 15000, method: 'CASH', status: 'PENDING', paymentDate: '2026-02-10' }
];

const plans = [
  {
    number: 'PLAN-PP-0001',
    invoiceNumber: 'INV-PP-0001',
    customerCode: 'CUST-ENTERPRISE-001',
    totalAmount: 180000,
    numberOfInstallments: 6,
    installmentAmount: 30000,
    startDate: '2026-01-05',
    endDate: '2026-06-05',
    status: 'active',
    riskScore: 72,
    riskLevel: 'MEDIUM'
  },
  {
    number: 'PLAN-PP-0002',
    invoiceNumber: 'INV-PP-0002',
    customerCode: 'CUST-RETAIL-002',
    totalAmount: 95000,
    numberOfInstallments: 4,
    installmentAmount: 23750,
    startDate: '2026-01-15',
    endDate: '2026-04-15',
    status: 'active',
    riskScore: 55,
    riskLevel: 'LOW'
  },
  {
    number: 'PLAN-PP-0003',
    invoiceNumber: 'INV-PP-0003',
    customerCode: 'CUST-GOV-003',
    totalAmount: 210000,
    numberOfInstallments: 7,
    installmentAmount: 30000,
    startDate: '2026-02-01',
    endDate: '2026-08-01',
    status: 'in_progress',
    riskScore: 64,
    riskLevel: 'MEDIUM'
  },
  {
    number: 'PLAN-PP-0004',
    invoiceNumber: 'INV-PP-0004',
    customerCode: 'CUST-SME-004',
    totalAmount: 68000,
    numberOfInstallments: 3,
    installmentAmount: 22666.67,
    startDate: '2025-12-10',
    endDate: '2026-02-10',
    status: 'completed',
    riskScore: 48,
    riskLevel: 'LOW'
  },
  {
    number: 'PLAN-PP-0005',
    invoiceNumber: 'INV-PP-0005',
    customerCode: 'CUST-TECH-005',
    totalAmount: 120000,
    numberOfInstallments: 5,
    installmentAmount: 24000,
    startDate: '2026-01-25',
    endDate: '2026-06-25',
    status: 'active',
    riskScore: 81,
    riskLevel: 'HIGH'
  },
  {
    number: 'PLAN-PP-0006',
    invoiceNumber: 'INV-PP-0006',
    customerCode: 'CUST-EDU-006',
    totalAmount: 45000,
    numberOfInstallments: 5,
    installmentAmount: 9000,
    startDate: '2026-02-05',
    endDate: '2026-07-05',
    status: 'overdue',
    riskScore: 62,
    riskLevel: 'MEDIUM'
  }
];

const allocations = [
  { paymentNumber: 'PAY-PP-0001', invoiceNumber: 'INV-PP-0001', amount: 40000 },
  { paymentNumber: 'PAY-PP-0002', invoiceNumber: 'INV-PP-0001', amount: 20000 },
  { paymentNumber: 'PAY-PP-0003', invoiceNumber: 'INV-PP-0002', amount: 25000 },
  { paymentNumber: 'PAY-PP-0004', invoiceNumber: 'INV-PP-0003', amount: 50000 },
  { paymentNumber: 'PAY-PP-0005', invoiceNumber: 'INV-PP-0003', amount: 75000 },
  { paymentNumber: 'PAY-PP-0006', invoiceNumber: 'INV-PP-0004', amount: 68000 },
  { paymentNumber: 'PAY-PP-0007', invoiceNumber: 'INV-PP-0005', amount: 40000 },
  { paymentNumber: 'PAY-PP-0008', invoiceNumber: 'INV-PP-0006', amount: 15000 }
];

async function upsertCustomer(cust) {
  const result = await pool.query(
    `INSERT INTO finance_customers (customer_code, customer_name_ar, customer_name_en, customer_type, email, phone, risk_score, risk_level, entity_type, entity_id, branch_id, incubator_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'HQ',$9,$10,$11)
     ON CONFLICT (customer_code) DO UPDATE
       SET customer_name_ar = EXCLUDED.customer_name_ar,
           customer_name_en = EXCLUDED.customer_name_en,
           customer_type = EXCLUDED.customer_type,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           risk_score = EXCLUDED.risk_score,
           risk_level = EXCLUDED.risk_level,
           entity_id = EXCLUDED.entity_id,
           branch_id = EXCLUDED.branch_id,
           incubator_id = EXCLUDED.incubator_id
     RETURNING customer_id`,
    [cust.code, cust.nameAr, cust.nameEn, cust.type, cust.email, cust.phone, cust.riskScore, cust.riskLevel, ENTITY_ID, BRANCH_ID, INCUBATOR_ID]
  );
  return result.rows[0].customer_id;
}

async function upsertInvoice(inv, customerId) {
  const remaining = inv.total - (inv.paid || 0);
  const result = await pool.query(
    `INSERT INTO finance_invoices (invoice_number, invoice_date, due_date, customer_id, total_amount, paid_amount, remaining_amount, status, payment_status, allow_installments, entity_type, entity_id, branch_id, incubator_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'HQ',$11,$12,$13)
     ON CONFLICT (invoice_number) DO UPDATE
       SET invoice_date = EXCLUDED.invoice_date,
           due_date = EXCLUDED.due_date,
           customer_id = EXCLUDED.customer_id,
           total_amount = EXCLUDED.total_amount,
           paid_amount = EXCLUDED.paid_amount,
           remaining_amount = EXCLUDED.remaining_amount,
           status = EXCLUDED.status,
           payment_status = EXCLUDED.payment_status,
           allow_installments = EXCLUDED.allow_installments,
           entity_id = EXCLUDED.entity_id,
           branch_id = EXCLUDED.branch_id,
           incubator_id = EXCLUDED.incubator_id
     RETURNING invoice_id`,
    [inv.number, inv.invoiceDate, inv.dueDate, customerId, inv.total, inv.paid || 0, remaining, inv.status, inv.paymentStatus, inv.allowInstallments, ENTITY_ID, BRANCH_ID, INCUBATOR_ID]
  );
  return result.rows[0].invoice_id;
}

async function upsertPayment(payment, customerId) {
  const result = await pool.query(
    `INSERT INTO finance_payments (payment_number, payment_date, customer_id, payment_amount, payment_method, status, entity_type, entity_id, branch_id, incubator_id)
     VALUES ($1,$2,$3,$4,$5,$6,'HQ',$7,$8,$9)
     ON CONFLICT (payment_number) DO UPDATE
       SET payment_date = EXCLUDED.payment_date,
           customer_id = EXCLUDED.customer_id,
           payment_amount = EXCLUDED.payment_amount,
           payment_method = EXCLUDED.payment_method,
           status = EXCLUDED.status,
           entity_id = EXCLUDED.entity_id,
           branch_id = EXCLUDED.branch_id,
           incubator_id = EXCLUDED.incubator_id
     RETURNING payment_id`,
    [payment.number, payment.paymentDate, customerId, payment.amount, payment.method, payment.status, ENTITY_ID, BRANCH_ID, INCUBATOR_ID]
  );
  return result.rows[0].payment_id;
}

async function upsertPlan(plan, customerId, invoiceId) {
  const result = await pool.query(
    `INSERT INTO finance_payment_plans (
      plan_number, customer_id, invoice_id, start_date, end_date, total_amount, paid_amount, remaining_amount,
      number_of_installments, installment_amount, installment_frequency, status, risk_score_at_creation, risk_level_at_creation,
      entity_type, entity_id, branch_id, incubator_id
    ) VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13,'HQ',$14,$15,$16)
    ON CONFLICT (plan_number) DO UPDATE
      SET customer_id = EXCLUDED.customer_id,
          invoice_id = EXCLUDED.invoice_id,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          total_amount = EXCLUDED.total_amount,
          number_of_installments = EXCLUDED.number_of_installments,
          installment_amount = EXCLUDED.installment_amount,
          installment_frequency = EXCLUDED.installment_frequency,
          status = EXCLUDED.status,
          risk_score_at_creation = EXCLUDED.risk_score_at_creation,
          risk_level_at_creation = EXCLUDED.risk_level_at_creation,
          entity_id = EXCLUDED.entity_id,
          branch_id = EXCLUDED.branch_id,
          incubator_id = EXCLUDED.incubator_id
    RETURNING plan_id`,
    [
      plan.number,
      customerId,
      invoiceId,
      plan.startDate,
      plan.endDate,
      plan.totalAmount,
      plan.totalAmount,
      plan.numberOfInstallments,
      plan.installmentAmount,
      plan.installmentFrequency || 'MONTHLY',
      plan.status || 'active',
      plan.riskScore || null,
      plan.riskLevel || null,
      ENTITY_ID,
      BRANCH_ID,
      INCUBATOR_ID
    ]
  );
  return result.rows[0].plan_id;
}

async function insertAllocation(allocation, paymentId, invoiceId) {
  await pool.query('DELETE FROM finance_payment_allocations WHERE payment_id = $1 AND invoice_id = $2', [paymentId, invoiceId]);
  await pool.query(
    `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount)
     VALUES ($1,$2,$3)`,
    [paymentId, invoiceId, allocation.amount]
  );
}

async function recalcInvoicesAndPlans() {
  await pool.query(`
    UPDATE finance_invoices inv
    SET paid_amount = COALESCE(paid.sum_paid, 0),
        remaining_amount = GREATEST(inv.total_amount - COALESCE(paid.sum_paid, 0), 0),
        payment_status = CASE
          WHEN inv.total_amount - COALESCE(paid.sum_paid, 0) <= 0 THEN 'PAID'
          WHEN COALESCE(paid.sum_paid, 0) > 0 THEN 'PARTIAL'
          ELSE 'UNPAID'
        END
    FROM (
      SELECT invoice_id, SUM(allocated_amount) AS sum_paid
      FROM finance_payment_allocations
      GROUP BY invoice_id
    ) paid
    WHERE inv.invoice_id = paid.invoice_id;
  `);

  await pool.query(`
    UPDATE finance_payment_plans p
    SET paid_amount = COALESCE(inv.paid_amount, 0),
        remaining_amount = GREATEST(p.total_amount - COALESCE(inv.paid_amount, 0), 0),
        status = CASE
          WHEN p.total_amount - COALESCE(inv.paid_amount, 0) <= 0 THEN 'completed'
          ELSE COALESCE(p.status, 'active')
        END
    FROM finance_invoices inv
    WHERE p.invoice_id = inv.invoice_id;
  `);
}

async function seed() {
  const customerMap = new Map();
  const invoiceMap = new Map();
  const paymentMap = new Map();

  try {
    console.log('🚀 Seeding payment plans data...');
    await pool.query('BEGIN');

    for (const cust of customers) {
      const id = await upsertCustomer(cust);
      customerMap.set(cust.code, id);
    }

    for (const inv of invoices) {
      const customerId = customerMap.get(inv.customerCode);
      const id = await upsertInvoice(inv, customerId);
      invoiceMap.set(inv.number, id);
    }

    for (const pay of payments) {
      const customerId = customerMap.get(pay.customerCode);
      const id = await upsertPayment(pay, customerId);
      paymentMap.set(pay.number, id);
    }

    for (const plan of plans) {
      const customerId = customerMap.get(plan.customerCode);
      const invoiceId = invoiceMap.get(plan.invoiceNumber);
      await upsertPlan(plan, customerId, invoiceId);
    }

    for (const alloc of allocations) {
      const paymentId = paymentMap.get(alloc.paymentNumber);
      const invoiceId = invoiceMap.get(alloc.invoiceNumber);
      if (paymentId && invoiceId) {
        await insertAllocation(alloc, paymentId, invoiceId);
      }
    }

    await recalcInvoicesAndPlans();
    await pool.query('COMMIT');
    console.log('✅ Payment plans dataset ready.');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error seeding payment plans:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
