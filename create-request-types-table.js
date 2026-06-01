/**
 * إنشاء جدول request_types في قاعدة البيانات
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: false
});

async function createRequestTypesTable() {
  try {
    console.log('\n🔄 Creating request_types table...\n');
    
    // Read SQL file
    const sqlFile = path.join(__dirname, 'create-request-types-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute SQL
    await pool.query(sql);
    
    console.log('✅ Table request_types created successfully');
    
    // Verify table exists and check data
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM request_types
    `);
    
    console.log(`✅ جدول request_types يحتوي على ${result.rows[0].count} نوع طلب`);
    
    // Show sample data
    const sample = await pool.query(`
      SELECT id, type_code, type_name_ar, category, icon, color, is_active
      FROM request_types
      ORDER BY display_order
      LIMIT 10
    `);
    
    console.log('\n📋 عينة من أنواع الطلبات:');
    sample.rows.forEach(row => {
      console.log(`  ${row.icon} ${row.type_name_ar} (${row.type_code}) - ${row.category} - ${row.is_active ? '✓ نشط' : '✗ غير نشط'}`);
    });
    
    await pool.end();
    console.log('\n✅ Request types table setup completed!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createRequestTypesTable();
