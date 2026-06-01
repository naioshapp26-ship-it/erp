// Test the incubator platforms API
async function testIncubatorPlatformsAPI() {
  console.log('🧪 اختبار API المنصات التابعة للحاضنات\n');

  const baseURL = 'https://super-cmk2wuy9-production.up.railway.app/api';

  try {
    // Test 1: Get platforms for incubator ID 1
    console.log('✅ اختبار 1: جلب المنصات للحاضنة ID=1');
    const response1 = await fetch(`${baseURL}/incubators/1/platforms`, {
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': '1'
      }
    });

    if (!response1.ok) {
      console.log(`❌ فشل الطلب - Status: ${response1.status}`);
      const error = await response1.text();
      console.log('رسالة الخطأ:', error);
    } else {
      const data = await response1.json();
      console.log(`✅ عدد المنصات: ${data.length}\n`);
      console.table(data.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        incubator_id: p.incubator_id
      })));
    }

    // Test 2: Try different incubator IDs
    console.log('\n✅ اختبار 2: المنصات لكل الحاضنات');
    for (let id = 1; id <= 5; id++) {
      try {
        const res = await fetch(`${baseURL}/incubators/${id}/platforms`, {
          headers: {
            'x-entity-type': 'INCUBATOR',
            'x-entity-id': '1'
          }
        });
        if (res.ok) {
          const platforms = await res.json();
          console.log(`   الحاضنة ${id}: ${platforms.length} منصة`);
        }
      } catch (e) {
        console.log(`   الحاضنة ${id}: خطأ`);
      }
    }

    console.log('\n✅ جميع الاختبارات اكتملت!');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
}

testIncubatorPlatformsAPI();
