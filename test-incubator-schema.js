const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testSchema() {
  try {
    console.log('🔍 Checking database schema...\n');
    
    // 1. Check incubators table structure
    console.log('1️⃣ Incubators table structure:');
    const incColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'incubators' 
      ORDER BY ordinal_position
    `);
    console.log('Incubators columns:', incColumns.rows);
    
    // 2. Check incubators data
    console.log('\n2️⃣ Incubators data:');
    const incData = await pool.query(`SELECT * FROM incubators ORDER BY id LIMIT 5`);
    console.log('Incubators:', incData.rows);
    
    // 3. Check platforms table structure
    console.log('\n3️⃣ Platforms table structure:');
    const platColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'platforms' 
      ORDER BY ordinal_position
    `);
    console.log('Platforms columns:', platColumns.rows);
    
    // 4. Check platforms data
    console.log('\n4️⃣ Platforms data:');
    const platData = await pool.query(`SELECT * FROM platforms ORDER BY id LIMIT 5`);
    console.log('Platforms:', platData.rows);
    
    console.log('\n✅ Schema check completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testSchema();
