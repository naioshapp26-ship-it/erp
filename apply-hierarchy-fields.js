const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function applyHierarchyFields() {
  try {
    console.log('🔄 تطبيق حقول التسلسل الهرمي على جميع الجداول...\n');

    // قراءة ملف SQL
    const sqlContent = fs.readFileSync('add-hierarchy-fields-to-all-tables.sql', 'utf8');
    
    // تنفيذ SQL
    await pool.query(sqlContent);
    
    console.log('\n✅ تم تطبيق جميع التحديثات بنجاح!\n');
    
    // التحقق من التحديثات
    console.log('📊 التحقق من الحقول الجديدة...\n');
    
    const tables = [
      'employee_requests',
      'invoices',
      'ads',
      'transactions',
      'ledger',
      'payment_methods',
      'installment_plan_types',
      'tax_settings',
      'request_types'
    ];
    
    for (const tableName of tables) {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND column_name IN ('branch_id', 'incubator_id', 'platform_id', 'office_id')
        ORDER BY column_name
      `, [tableName]);
      
      console.log(`✅ ${tableName}: ${result.rows.map(r => r.column_name).join(', ')}`);
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyHierarchyFields();
