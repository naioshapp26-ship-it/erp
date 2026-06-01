const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkIncubators() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 فحص الحاضنات الموجودة...\n');
    
    const result = await client.query(`
      SELECT id, name, code, branch_id
      FROM incubators
      ORDER BY id
      LIMIT 5
    `);
    
    console.log(`✅ عدد الحاضنات: ${result.rowCount}`);
    
    if (result.rowCount > 0) {
      console.log('\nالحاضنات الموجودة:');
      result.rows.forEach(inc => {
        console.log(`  ID: ${inc.id} - ${inc.name} (${inc.code})`);
      });
      
      // سنستخدم أول حاضنة لإضافة المنصات
      return result.rows[0].id;
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkIncubators()
  .then(incId => {
    if (incId) {
      console.log(`\n✅ سنستخدم الحاضنة ID: ${incId} لإضافة المنصات`);
    } else {
      console.log('\n⚠️ لا توجد حاضنات');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ فشل:', error);
    process.exit(1);
  });
