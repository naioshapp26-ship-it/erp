const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function verifyFinalIncubators() {
  try {
    console.log('🔍 التحقق من الحاضنات النهائية في قاعدة البيانات\n');
    console.log('='.repeat(100));
    
    const result = await pool.query(`
      SELECT id, name, code, entity_id, is_active 
      FROM incubators 
      ORDER BY id
    `);
    
    console.log(`\n📊 إجمالي عدد الحاضنات: ${result.rows.length}\n`);
    console.log('قائمة الحاضنات الكاملة:\n');
    console.log('-'.repeat(100));
    console.log('الرقم | الاسم                                      | الرمز      | الكيان  | نشط');
    console.log('-'.repeat(100));
    
    result.rows.forEach(inc => {
      const id = inc.id.toString().padStart(2, ' ');
      const name = inc.name.padEnd(46, ' ');
      const code = (inc.code || '').padEnd(10, ' ');
      const entity = inc.entity_id || 'N/A';
      const active = inc.is_active ? '✅' : '❌';
      
      console.log(`${id}   | ${name} | ${code} | ${entity} | ${active}`);
    });
    
    console.log('-'.repeat(100));
    console.log(`\n✅ تم التحقق بنجاح من ${result.rows.length} حاضنة\n`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await pool.end();
  }
}

verifyFinalIncubators();
