const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function verifyData() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 التحقق من البيانات المضافة...\n');
    console.log('='.repeat(80));
    
    // التحقق من المنصات
    console.log('\n📊 إحصائيات المنصات:');
    console.log('-'.repeat(80));
    
    const platformsCount = await client.query('SELECT COUNT(*) FROM platforms');
    console.log(`📈 إجمالي المنصات: ${platformsCount.rows[0].count}`);
    
    const platformsByType = await client.query(`
      SELECT platform_type, COUNT(*) as count
      FROM platforms
      GROUP BY platform_type
      ORDER BY count DESC
    `);
    
    console.log('\n📊 توزيع المنصات حسب النوع:');
    platformsByType.rows.forEach(row => {
      console.log(`  ${row.platform_type}: ${row.count} منصة`);
    });
    
    // التحقق من الحاضنات
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 إحصائيات الحاضنات:');
    console.log('-'.repeat(80));
    
    const incubatorsCount = await client.query('SELECT COUNT(*) FROM incubators');
    console.log(`📈 إجمالي الحاضنات: ${incubatorsCount.rows[0].count}`);
    
    const incubatorsByType = await client.query(`
      SELECT program_type, COUNT(*) as count
      FROM incubators
      WHERE program_type IS NOT NULL
      GROUP BY program_type
      ORDER BY count DESC
    `);
    
    console.log('\n📊 توزيع الحاضنات حسب النوع:');
    incubatorsByType.rows.forEach(row => {
      console.log(`  ${row.program_type}: ${row.count} حاضنة`);
    });
    
    // التحقق من الحاضنات الجديدة (آخر 100)
    const newIncubators = await client.query(`
      SELECT name, code, program_type
      FROM incubators
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log('\n📋 آخر 10 حاضنات تمت إضافتها:');
    console.log('-'.repeat(80));
    newIncubators.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.name} (${row.code}) - ${row.program_type || 'غير محدد'}`);
    });
    
    // التحقق من ربط المنصات بالحاضنات
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 إحصائيات الربط:');
    console.log('-'.repeat(80));
    
    const platformsWithIncubators = await client.query(`
      SELECT COUNT(*) 
      FROM platforms 
      WHERE incubator_id IS NOT NULL
    `);
    console.log(`✅ منصات مربوطة بحاضنات: ${platformsWithIncubators.rows[0].count}`);
    
    const platformsWithoutIncubators = await client.query(`
      SELECT COUNT(*) 
      FROM platforms 
      WHERE incubator_id IS NULL
    `);
    console.log(`❌ منصات غير مربوطة: ${platformsWithoutIncubators.rows[0].count}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ اكتمل التحقق من البيانات بنجاح!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ خطأ في التحقق:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyData()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ فشل في التحقق:', error);
    process.exit(1);
  });
