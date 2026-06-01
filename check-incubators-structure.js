const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkIncubatorsSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 فحص بنية جدول الحاضنات...\n');
    
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'incubators'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 أعمدة جدول incubators:');
    console.log('='.repeat(80));
    result.rows.forEach(row => {
      console.log(`  ${row.column_name} - ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''} - ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // عد الحاضنات
    const count = await client.query('SELECT COUNT(*) FROM incubators');
    console.log('\n📊 عدد الحاضنات الحالي:', count.rows[0].count);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkIncubatorsSchema();
