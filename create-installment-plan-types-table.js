require('dotenv').config();
const db = require('./db');
require('dotenv').config();

const pool = db.pool;
async function createInstallmentPlanTypesTable() {
  try {
    console.log('🔄 Creating installment_plan_types table...');
    
    const fs = require('fs');
    const sql = fs.readFileSync('./create-installment-plan-types-table.sql', 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Table installment_plan_types created successfully');
    
    // التحقق من البيانات
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM installment_plan_types
    `);
    console.log(`✅ جدول installment_plan_types يحتوي على ${result.rows[0].count} خطة`);
    
    // عرض الخطط
    const plans = await pool.query(`
      SELECT plan_code, plan_name_ar, duration_months, number_of_payments, 
             interest_rate, is_active
      FROM installment_plan_types
      ORDER BY display_order
    `);
    
    console.log('\n📋 خطط الأقساط المتاحة:');
    plans.rows.forEach(plan => {
      console.log(`  📅 ${plan.plan_name_ar} (${plan.plan_code}) - ${plan.duration_months} شهر، ${plan.number_of_payments} دفعة - فائدة: ${plan.interest_rate}% - ${plan.is_active ? '✓ نشط' : '✗ غير نشط'}`);
    });
    
    console.log('\n✅ Installment plan types table setup completed!');
    
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createInstallmentPlanTypesTable();
