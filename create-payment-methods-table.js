/**
 * إنشاء جدول payment_methods في قاعدة البيانات
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: false
});

async function createPaymentMethodsTable() {
  try {
    console.log('\n🔄 Creating payment_methods table...\n');
    
    // Read SQL file
    const sqlFile = path.join(__dirname, 'create-payment-methods-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute SQL
    await pool.query(sql);
    
    console.log('✅ Table payment_methods created successfully');
    
    // Verify table exists and check data
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM payment_methods
    `);
    
    console.log(`✅ جدول payment_methods يحتوي على ${result.rows[0].count} طريقة دفع`);
    
    // Show sample data
    const sample = await pool.query(`
      SELECT id, method_code, method_name_ar, icon, color, is_active
      FROM payment_methods
      ORDER BY display_order
    `);
    
    console.log('\n📋 طرق الدفع المتاحة:');
    sample.rows.forEach(row => {
      console.log(`  ${row.icon} ${row.method_name_ar} (${row.method_code}) - ${row.is_active ? '✓ نشط' : '✗ غير نشط'}`);
    });
    
    await pool.end();
    console.log('\n✅ Payment methods table setup completed!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createPaymentMethodsTable();
