// Simulate the new endpoint logic locally
const { Client } = require('pg');

async function testNewEndpointLogic() {
  const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
  });

  try {
    await client.connect();
    console.log('🧪 اختبار منطق endpoint الجديد\n');

    const testCases = [
      { id: 'INC03', description: 'entity_id نصي' },
      { id: '3', description: 'numeric ID كنص' },
      { id: 3, description: 'numeric ID كرقم' },
      { id: 'INC04', description: 'entity_id نصي آخر' },
      { id: 'INVALID', description: 'entity_id غير موجود' }
    ];

    for (const testCase of testCases) {
      console.log(`\n📋 اختبار: ${testCase.description} (id=${testCase.id})`);
      
      const id = testCase.id.toString();
      let incubatorId;
      
      if (isNaN(id)) {
        // It's an entity_id, get the numeric ID
        console.log(`   → البحث عن entity_id = '${id}'`);
        const incubatorResult = await client.query(`
          SELECT id FROM incubators WHERE entity_id = $1
        `, [id]);
        
        if (incubatorResult.rows.length === 0) {
          console.log(`   ❌ لم يتم العثور على الحاضنة`);
          continue;
        }
        incubatorId = incubatorResult.rows[0].id;
        console.log(`   ✅ تم العثور على incubator_id = ${incubatorId}`);
      } else {
        incubatorId = parseInt(id);
        console.log(`   → استخدام numeric ID = ${incubatorId}`);
      }
      
      const result = await client.query(`
        SELECT id, name, incubator_id, description, code
        FROM platforms
        WHERE incubator_id = $1
        ORDER BY name
      `, [incubatorId]);
      
      console.log(`   ✅ عدد المنصات: ${result.rows.length}`);
      if (result.rows.length > 0) {
        result.rows.forEach(p => {
          console.log(`      - ${p.name} (${p.code})`);
        });
      }
    }

    console.log('\n✅ جميع الاختبارات اكتملت!');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
  }
}

testNewEndpointLogic();
