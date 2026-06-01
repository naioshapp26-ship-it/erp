// Check user_credentials table structure
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function checkCredentialsStructure() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');

    // فحص بنية الجدول
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_credentials'
      ORDER BY ordinal_position
    `);

    console.log('📋 بنية جدول user_credentials:\n');
    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // مثال على سجل موجود
    console.log('\n📋 مثال على سجل موجود:\n');
    const example = await client.query(`
      SELECT * FROM user_credentials LIMIT 1
    `);
    
    if (example.rows.length > 0) {
      console.log('الأعمدة:', Object.keys(example.rows[0]));
      console.log('القيم:', example.rows[0]);
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
  }
}

checkCredentialsStructure();
