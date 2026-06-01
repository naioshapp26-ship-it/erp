const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkEntity() {
  try {
    const result = await pool.query(`
      SELECT id, name, type FROM entities WHERE name = 'أنظمة الطاقة الشمسية'
    `);
    
    console.log('\n📌 Entity Info:');
    console.log(result.rows);
    
    // Get a real branch
    const branchResult = await pool.query(`
      SELECT id, name FROM entities WHERE type = 'BRANCH' LIMIT 1
    `);
    
    console.log('\n📌 Sample Branch:');
    console.log(branchResult.rows);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

checkEntity();
