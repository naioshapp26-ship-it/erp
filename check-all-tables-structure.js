const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkAllTables() {
  try {
    console.log('🔍 فحص هيكل الجداول الرئيسية...\n');

    const mainTables = [
      'employee_requests',
      'invoices',
      'ads',
      'transactions',
      'approvals',
      'employees',
      'entities',
      'ledger',
      'payment_methods',
      'installment_plan_types',
      'tax_settings',
      'request_types'
    ];

    for (const tableName of mainTables) {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      console.log(`\n📋 جدول: ${tableName}`);
      console.log('الأعمدة:');
      
      const columns = result.rows.map(r => r.column_name);
      
      // فحص الحقول المطلوبة
      const requiredFields = ['branch_id', 'incubator_id', 'platform_id', 'office_id'];
      const missingFields = requiredFields.filter(f => !columns.includes(f));
      const existingFields = requiredFields.filter(f => columns.includes(f));
      
      if (existingFields.length > 0) {
        console.log('✅ الحقول الموجودة:', existingFields.join(', '));
      }
      
      if (missingFields.length > 0) {
        console.log('❌ الحقول الناقصة:', missingFields.join(', '));
      }
      
      console.log('   جميع الأعمدة:', columns.join(', '));
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await pool.end();
  }
}

checkAllTables();
