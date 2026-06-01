// Check users table structure
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function checkUsersTable() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');

    // فحص بنية الجدول
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('📋 بنية جدول users:\n');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // عرض بعض المستخدمين
    console.log('\n📋 أمثلة على المستخدمين:\n');
    const users = await client.query('SELECT * FROM users LIMIT 3');
    console.log('Columns:', Object.keys(users.rows[0] || {}));
    users.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email || user.user_email}, Name: ${user.full_name || user.name}`);
    });

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
  }
}

checkUsersTable();
