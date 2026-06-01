const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testBranches() {
  try {
    console.log('🔍 Checking branches schema...\n');
    
    // 1. Check branches table structure
    console.log('1️⃣ Branches table structure:');
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branches' 
      ORDER BY ordinal_position
    `);
    console.log('Branches columns:', columns.rows);
    
    // 2. Check branches data
    console.log('\n2️⃣ Branches data:');
    const data = await pool.query(`SELECT * FROM branches ORDER BY id LIMIT 10`);
    console.log('Branches:', data.rows);
    
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testBranches();
