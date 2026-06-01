const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function linkAllPlatformsAndIncubators() {
  try {
    console.log('=== ربط جميع المنصات والحاضنات بجميع الفروع ===\n');
    
    // جلب جميع الفروع من entities
    const branchesResult = await pool.query('SELECT id, name FROM entities WHERE type = \'BRANCH\' ORDER BY name');
    const branches = branchesResult.rows;
    console.log(`عدد الفروع: ${branches.length}`);
    
    // جلب جميع المنصات من entities
    const platformsResult = await pool.query('SELECT id, name FROM entities WHERE type = \'PLATFORM\' ORDER BY name');
    const platforms = platformsResult.rows;
    console.log(`عدد المنصات: ${platforms.length}`);
    
    // جلب جميع الحاضنات من entities
    const incubatorsResult = await pool.query('SELECT id, name FROM entities WHERE type = \'INCUBATOR\' ORDER BY name');
    const incubators = incubatorsResult.rows;
    console.log(`عدد الحاضنات: ${incubators.length}\n`);
    
    // حذف الروابط الحالية
    console.log('حذف الروابط الحالية...');
    await pool.query('DELETE FROM branch_platforms');
    await pool.query('DELETE FROM branch_incubators');
    console.log('✓ تم حذف الروابط القديمة\n');
    
    // ربط جميع المنصات بجميع الفروع
    console.log('ربط المنصات بالفروع...');
    let platformLinksCount = 0;
    for (const platform of platforms) {
      for (const branch of branches) {
        await pool.query(
          'INSERT INTO branch_platforms (branch_id, platform_id) VALUES ($1, $2)',
          [branch.id, platform.id]
        );
        platformLinksCount++;
      }
    }
    console.log(`✓ تم ربط ${platformLinksCount} رابط (${platforms.length} منصة × ${branches.length} فرع)\n`);
    
    // ربط جميع الحاضنات بجميع الفروع
    console.log('ربط الحاضنات بالفروع...');
    let incubatorLinksCount = 0;
    for (const incubator of incubators) {
      for (const branch of branches) {
        await pool.query(
          'INSERT INTO branch_incubators (branch_id, incubator_id) VALUES ($1, $2)',
          [branch.id, incubator.id]
        );
        incubatorLinksCount++;
      }
    }
    console.log(`✓ تم ربط ${incubatorLinksCount} رابط (${incubators.length} حاضنة × ${branches.length} فرع)\n`);
    
    // التحقق من النتائج
    const platformCheckResult = await pool.query('SELECT COUNT(*) as count FROM branch_platforms');
    const incubatorCheckResult = await pool.query('SELECT COUNT(*) as count FROM branch_incubators');
    
    console.log('=== النتائج النهائية ===');
    console.log(`✅ عدد روابط المنصات: ${platformCheckResult.rows[0].count}`);
    console.log(`✅ عدد روابط الحاضنات: ${incubatorCheckResult.rows[0].count}`);
    console.log(`✅ المتوقع للمنصات: ${platforms.length} × ${branches.length} = ${platforms.length * branches.length}`);
    console.log(`✅ المتوقع للحاضنات: ${incubators.length} × ${branches.length} = ${incubators.length * branches.length}\n`);
    
    if (platformCheckResult.rows[0].count == platforms.length * branches.length &&
        incubatorCheckResult.rows[0].count == incubators.length * branches.length) {
      console.log('✅ تم ربط جميع المنصات والحاضنات بجميع الفروع بنجاح!\n');
    } else {
      console.log('⚠️ هناك مشكلة في الروابط!\n');
    }
    
    await pool.end();
  } catch (err) {
    console.error('خطأ:', err);
    await pool.end();
  }
}

linkAllPlatformsAndIncubators();
