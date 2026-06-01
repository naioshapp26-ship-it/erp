const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

const fs = require('fs');
const path = require('path');

async function createMissingTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 إنشاء الجداول الناقصة...\n');
    
    const sql = fs.readFileSync(path.join(__dirname, 'create-missing-strategic-tables.sql'), 'utf8');
    
    await client.query(sql);
    
    console.log('✅ تم إنشاء الجداول بنجاح!\n');
    
    // Verify tables
    const verifyFinancialManual = await client.query('SELECT COUNT(*) FROM financial_manual');
    console.log(`📊 financial_manual: ${verifyFinancialManual.rows[0].count} سجلات`);
    
    const verifyEvaluations = await client.query('SELECT COUNT(*) FROM evaluations');
    console.log(`📊 evaluations: ${verifyEvaluations.rows[0].count} سجلات`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createMissingTables();
