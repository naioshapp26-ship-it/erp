const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function showAdsSchema() {
  try {
    console.log('📊 مكونات جدول ads في قاعدة البيانات:\n');
    console.log('='.repeat(100) + '\n');
    
    // Get column information
    const result = await pool.query(`
      SELECT 
        column_name as "اسم العمود",
        data_type as "نوع البيانات",
        character_maximum_length as "الطول الأقصى",
        is_nullable as "يقبل NULL",
        column_default as "القيمة الافتراضية"
      FROM information_schema.columns
      WHERE table_name = 'ads'
      ORDER BY ordinal_position;
    `);
    
    console.log(`عدد الأعمدة: ${result.rows.length}\n`);
    
    result.rows.forEach((col, index) => {
      console.log(`${index + 1}. ${col['اسم العمود']}`);
      console.log(`   📌 النوع: ${col['نوع البيانات']}${col['الطول الأقصى'] ? ` (${col['الطول الأقصى']})` : ''}`);
      console.log(`   🔒 يقبل NULL: ${col['يقبل NULL']}`);
      if (col['القيمة الافتراضية']) {
        console.log(`   💡 القيمة الافتراضية: ${col['القيمة الافتراضية']}`);
      }
      console.log('');
    });
    
    console.log('='.repeat(100) + '\n');
    
    // Get a sample record
    const sampleResult = await pool.query('SELECT * FROM ads LIMIT 1');
    if (sampleResult.rows.length > 0) {
      console.log('📋 مثال على سجل من الجدول:\n');
      const sample = sampleResult.rows[0];
      Object.keys(sample).forEach(key => {
        console.log(`   ${key}: ${sample[key]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await pool.end();
  }
}

showAdsSchema();
