const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function verifyFinalBranches() {
  try {
    console.log('🔍 التحقق من الفروع النهائية في قاعدة البيانات\n');
    console.log('='.repeat(80));
    
    const result = await pool.query(`
      SELECT id, name, code, country, entity_id, is_active 
      FROM branches 
      ORDER BY id
    `);
    
    console.log(`\n📊 إجمالي عدد الفروع: ${result.rows.length}\n`);
    console.log('قائمة الفروع الكاملة:\n');
    console.log('-'.repeat(80));
    console.log('الرقم | الاسم العربي                    | الدولة          | الرمز      | الكيان');
    console.log('-'.repeat(80));
    
    result.rows.forEach(branch => {
      const id = branch.id.toString().padStart(2, ' ');
      const name = branch.name.padEnd(32, ' ');
      const country = (branch.country || '').padEnd(16, ' ');
      const code = (branch.code || '').padEnd(10, ' ');
      const entity = branch.entity_id || 'N/A';
      
      console.log(`${id}   | ${name} | ${country} | ${code} | ${entity}`);
    });
    
    console.log('-'.repeat(80));
    console.log(`\n✅ تم التحقق بنجاح من ${result.rows.length} فرع\n`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await pool.end();
  }
}

verifyFinalBranches();
