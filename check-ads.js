const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkAds() {
  try {
    console.log('🔍 جاري التحقق من الإعلانات في قاعدة البيانات...\n');
    
    // عدد الإعلانات
    const countResult = await pool.query('SELECT COUNT(*) as total FROM ads');
    console.log(`📊 عدد الإعلانات الإجمالي: ${countResult.rows[0].total}\n`);
    
    // جميع الإعلانات
    const adsResult = await pool.query(`
      SELECT * 
      FROM ads 
      ORDER BY created_at DESC
    `);
    
    console.log('📋 قائمة الإعلانات:\n');
    adsResult.rows.forEach((ad, index) => {
      console.log(`${index + 1}. ${ad.title}`);
      console.log(`   - ID: ${ad.id}`);
      console.log(`   - Entity ID: ${ad.entity_id}`);
      console.log(`   - Status: ${ad.status}`);
      console.log(`   - Level: ${ad.level}`);
      console.log(`   - Source Entity: ${ad.source_entity_id || 'N/A'}`);
      console.log(`   - Source Type: ${ad.source_type || 'N/A'}`);
      console.log(`   - Target IDs: ${ad.target_ids || 'N/A'}`);
      console.log(`   - Created: ${ad.created_at}`);
      console.log('');
    });
    
    // الإعلانات حسب entity_id
    const byEntityResult = await pool.query(`
      SELECT entity_id, COUNT(*) as count 
      FROM ads 
      GROUP BY entity_id 
      ORDER BY count DESC
    `);
    
    console.log('\n📊 الإعلانات حسب Entity ID:');
    byEntityResult.rows.forEach(row => {
      console.log(`   - ${row.entity_id}: ${row.count} إعلان`);
    });
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await pool.end();
  }
}

checkAds();
