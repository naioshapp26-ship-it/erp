const { Client } = require('pg');

async function testIncubatorPlatforms() {
  const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
  });

  try {
    await client.connect();
    console.log('🧪 اختبار نظام المنصات التابعة للحاضنات\n');

    // Test 1: Get all incubators
    console.log('✅ اختبار 1: جلب جميع الحاضنات');
    const incubatorsRes = await client.query('SELECT id, name FROM incubators ORDER BY name;');
    console.log(`عدد الحاضنات: ${incubatorsRes.rows.length}\n`);
    console.table(incubatorsRes.rows);

    // Test 2: Get platforms for a specific incubator
    console.log('\n✅ اختبار 2: جلب المنصات لحاضنة معينة (incubator_id=1)');
    const platformsRes = await client.query(`
      SELECT id, name, incubator_id 
      FROM platforms 
      WHERE incubator_id = 1 
      ORDER BY name;
    `);
    console.log(`عدد المنصات: ${platformsRes.rows.length}\n`);
    console.table(platformsRes.rows);

    // Test 3: Get training programs for a platform
    console.log('\n✅ اختبار 3: جلب البرامج التدريبية لمنصة معينة (platform_id=1)');
    const programsRes = await client.query(`
      SELECT id, name, platform_id 
      FROM training_programs 
      WHERE platform_id = 1 
      ORDER BY name;
    `);
    console.log(`عدد البرامج: ${programsRes.rows.length}\n`);
    console.table(programsRes.rows);

    // Test 4: Get complete hierarchy
    console.log('\n✅ اختبار 4: الهيكل الكامل (حاضنة → منصات → برامج)');
    const hierarchyRes = await client.query(`
      SELECT 
        i.id as incubator_id,
        i.name as incubator_name,
        p.id as platform_id,
        p.name as platform_name,
        COUNT(tp.id) as program_count
      FROM incubators i
      LEFT JOIN platforms p ON i.id = p.incubator_id
      LEFT JOIN training_programs tp ON p.id = tp.platform_id
      GROUP BY i.id, i.name, p.id, p.name
      ORDER BY i.name, p.name;
    `);
    console.log('النتائج:');
    console.table(hierarchyRes.rows);

    console.log('\n✅ جميع الاختبارات نجحت!');
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
  }
}

testIncubatorPlatforms();
