const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

async function seedPlanInstallments() {
  const client = await pool.connect();

  try {
    console.log('🚀 تجهيز أقساط خطط السداد...');
    await client.query('BEGIN');

    const plansResult = await client.query(
      `
      SELECT plan_id, plan_number, customer_id, start_date, number_of_installments, installment_amount, paid_amount
      FROM finance_payment_plans
      WHERE entity_id = $1 OR entity_id IS NULL
      ORDER BY plan_id
      `,
      [ENTITY_ID]
    );

    const paymentsResult = await client.query(
      `
      SELECT payment_id, customer_id, payment_amount, payment_date, status
      FROM finance_payments
      WHERE entity_id = $1 OR entity_id IS NULL
      ORDER BY payment_date ASC, payment_id ASC
      `,
      [ENTITY_ID]
    );

    const paymentsByCustomer = new Map();
    paymentsResult.rows.forEach(payment => {
      if (!paymentsByCustomer.has(payment.customer_id)) {
        paymentsByCustomer.set(payment.customer_id, []);
      }
      paymentsByCustomer.get(payment.customer_id).push(payment);
    });

    let inserted = 0;
    let skipped = 0;

    for (const plan of plansResult.rows) {
      const exists = await client.query(
        'SELECT COUNT(*)::int AS count FROM finance_plan_installments WHERE plan_id = $1',
        [plan.plan_id]
      );

      if (exists.rows[0].count > 0) {
        skipped++;
        continue;
      }

      const count = parseInt(plan.number_of_installments || 0, 10);
      const amount = parseFloat(plan.installment_amount || 0);
      const paidTotal = parseFloat(plan.paid_amount || 0);

      if (!count || !amount) {
        skipped++;
        continue;
      }

      const paidInstallments = Math.min(count, Math.floor(paidTotal / amount));
      const startDate = plan.start_date ? new Date(plan.start_date) : new Date();
      const today = new Date();

      for (let i = 1; i <= count; i += 1) {
        const dueDate = addMonths(startDate, i - 1);
        let status = 'PENDING';
        let paidAmount = 0;
        let paidDate = null;
        let paymentId = null;

        if (i <= paidInstallments) {
          status = 'PAID';
          paidAmount = amount;
          paidDate = new Date(dueDate);
          paidDate.setDate(dueDate.getDate() + 2);

          const customerPayments = paymentsByCustomer.get(plan.customer_id) || [];
          if (customerPayments.length) {
            paymentId = customerPayments.shift().payment_id;
          }
        } else if (dueDate < today) {
          status = 'OVERDUE';
        }

        await client.query(
          `
          INSERT INTO finance_plan_installments (
            plan_id, installment_number, due_date, amount, paid_amount, status, paid_date, payment_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `,
          [
            plan.plan_id,
            i,
            dueDate.toISOString().slice(0, 10),
            amount,
            paidAmount,
            status,
            paidDate ? paidDate.toISOString().slice(0, 10) : null,
            paymentId
          ]
        );

        inserted++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ تم إضافة ${inserted} قسط جديد`);
    console.log(`ℹ️ تم تخطي ${skipped} خطة لديها بيانات أو ناقصة`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ فشل تجهيز أقساط خطط السداد:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedPlanInstallments();
