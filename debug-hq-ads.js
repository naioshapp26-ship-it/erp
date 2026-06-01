const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function debugHQAds() {
  try {
    console.log('🔍 تحليل مشكلة عرض الإعلانات للمكتب الرئيسي\n');
    console.log('='.repeat(80) + '\n');
    
    // 1. Total ads
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM ads');
    console.log(`📊 إجمالي الإعلانات في قاعدة البيانات: ${totalResult.rows[0].total}\n`);
    
    // 2. Ads by source_type
    const bySourceResult = await pool.query(`
      SELECT source_type, COUNT(*) as count 
      FROM ads 
      GROUP BY source_type 
      ORDER BY count DESC
    `);
    
    console.log('📈 الإعلانات حسب source_type:');
    bySourceResult.rows.forEach(row => {
      console.log(`   - ${row.source_type}: ${row.count} إعلان`);
    });
    console.log('');
    
    // 3. All ads details
    const allAdsResult = await pool.query(`
      SELECT id, title, entity_id, source_entity_id, source_type, status, level
      FROM ads 
      ORDER BY id
    `);
    
    console.log('📋 تفاصيل جميع الإعلانات:\n');
    allAdsResult.rows.forEach((ad, index) => {
      console.log(`${index + 1}. [ID: ${ad.id}] ${ad.title}`);
      console.log(`   entity_id: ${ad.entity_id}`);
      console.log(`   source_entity_id: ${ad.source_entity_id}`);
      console.log(`   source_type: ${ad.source_type}`);
      console.log(`   status: ${ad.status}`);
      console.log(`   level: ${ad.level}`);
      console.log('');
    });
    
    console.log('='.repeat(80) + '\n');
    
    // 4. What HQ should see
    console.log('✅ ما يجب أن يراه المكتب الرئيسي (HQ001):\n');
    console.log('   المكتب الرئيسي يرى جميع الإعلانات = 9 إعلانات\n');
    
    // 5. Breakdown by source type for HQ
    console.log('📊 التوزيع المتوقع:');
    console.log(`   - إعلانات HQ: ${bySourceResult.rows.find(r => r.source_type === 'HQ')?.count || 0}`);
    console.log(`   - إعلانات BRANCH: ${bySourceResult.rows.find(r => r.source_type === 'BRANCH')?.count || 0}`);
    console.log(`   - إعلانات PLATFORM: ${bySourceResult.rows.find(r => r.source_type === 'PLATFORM')?.count || 0}`);
    console.log(`   - إعلانات INCUBATOR: ${bySourceResult.rows.find(r => r.source_type === 'INCUBATOR')?.count || 0}`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await pool.end();
  }
}

debugHQAds();
