// Test incubator platforms API with entity_id support
const { Client } = require('pg');

async function testIncubatorPlatformsAPI() {
  const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
  });

  try {
    await client.connect();
    console.log('🧪 اختبار API المنصات مع entity_id\n');

    // Test 1: Get incubator with entity_id 'INC03'
    console.log('📋 اختبار 1: البحث عن حاضنة بـ entity_id = INC03');
    const incubator = await client.query(`
      SELECT id, name, entity_id 
      FROM incubators 
      WHERE entity_id = 'INC03'
    `);
    
    if (incubator.rows.length === 0) {
      console.log('❌ لا توجد حاضنة بـ entity_id = INC03');
      return;
    }
    
    console.log('✅ تم العثور على الحاضنة:');
    console.table(incubator.rows);
    
    const incubatorId = incubator.rows[0].id;
    
    // Test 2: Get platforms for this incubator
    console.log(`\n📋 اختبار 2: جلب المنصات للحاضنة ID=${incubatorId}`);
    const platforms = await client.query(`
      SELECT id, name, incubator_id, description, code
      FROM platforms
      WHERE incubator_id = $1
      ORDER BY name
    `, [incubatorId]);
    
    console.log(`✅ عدد المنصات: ${platforms.rows.length}`);
    if (platforms.rows.length > 0) {
      console.table(platforms.rows);
    } else {
      console.log('⚠️  لا توجد منصات لهذه الحاضنة');
    }

    // Test 3: Check if platforms table has any data
    console.log('\n📋 اختبار 3: جميع المنصات في القاعدة');
    const allPlatforms = await client.query(`
      SELECT p.id, p.name, p.incubator_id, i.name as incubator_name, i.entity_id
      FROM platforms p
      LEFT JOIN incubators i ON p.incubator_id = i.id
      ORDER BY p.incubator_id, p.id
    `);
    console.log(`✅ إجمالي المنصات: ${allPlatforms.rows.length}`);
    console.table(allPlatforms.rows);

    console.log('\n✅ جميع الاختبارات اكتملت!');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testIncubatorPlatformsAPI();
