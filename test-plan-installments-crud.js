/**
 * 🧪 اختبار CRUD لأقساط خطط السداد
 */

const { Pool } = require('pg');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function run() {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  let installmentId = null;

  try {
    console.log('='.repeat(80));
    console.log('🧪 اختبار CRUD لأقساط خطط السداد');
    console.log('='.repeat(80));

    const planRes = await client.query(
      `
      SELECT plan_id
      FROM finance_payment_plans
      WHERE entity_id = $1 OR entity_id IS NULL
      ORDER BY plan_id
      LIMIT 1
      `,
      [ENTITY_ID]
    );

    if (!planRes.rows.length) {
      throw new Error('لا توجد خطط سداد متاحة للاختبار');
    }

    const planId = planRes.rows[0].plan_id;
    const today = new Date();
    const dueDate = today.toISOString().slice(0, 10);

    const insertRes = await client.query(
      `
      INSERT INTO finance_plan_installments (
        plan_id, installment_number, due_date, amount, paid_amount, status, paid_date, payment_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING installment_id
      `,
      [planId, 99, dueDate, 1234.5, 0, 'PENDING', null, null]
    );

    installmentId = insertRes.rows[0].installment_id;
    console.log(`✅ تم إنشاء قسط مؤقت برقم: ${installmentId}`);

    const updateRes = await fetch(`${BASE_URL}/finance/plan-installments/${installmentId}?entity_id=${ENTITY_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'PAID',
        paid_amount: 1234.5,
        paid_date: dueDate
      })
    });

    const updateData = await updateRes.json();
    if (!updateRes.ok || !updateData.success) {
      throw new Error(updateData.error || 'فشل اختبار التعديل');
    }

    console.log('✅ اختبار التعديل نجح');

    const deleteRes = await fetch(`${BASE_URL}/finance/plan-installments/${installmentId}?entity_id=${ENTITY_ID}`, {
      method: 'DELETE'
    });

    const deleteData = await deleteRes.json();
    if (!deleteRes.ok || !deleteData.success) {
      throw new Error(deleteData.error || 'فشل اختبار الحذف');
    }

    console.log('✅ اختبار الحذف نجح');
    console.log('🎉 تم اجتياز اختبار CRUD بالكامل');
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
    process.exitCode = 1;
  } finally {
    if (installmentId) {
      await client.query('DELETE FROM finance_plan_installments WHERE installment_id = $1', [installmentId]);
    }
    client.release();
    await pool.end();
  }
}

run();
