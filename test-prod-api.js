// Test production API
async function testProductionAPI() {
  console.log('🌐 اختبار API على الـ Production\n');

  const baseURL = 'https://super-cmk2wuy9-production.up.railway.app/api';
  
  try {
    console.log('📋 جلب جميع المتدربين...');
    const response = await fetch(`${baseURL}/enrollments`, {
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': '1'
      }
    });

    if (!response.ok) {
      console.log(`❌ الخادم أرجع status: ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ تم جلب ${data.length} متدرب\n`);
    
    if (data.length > 0) {
      console.log('أول 3 متدربين:');
      console.table(data.slice(0, 3).map(e => ({
        id: e.id,
        name: e.beneficiary_name,
        session: e.session_name,
        status: e.status,
        date: e.enrollment_date
      })));
    } else {
      console.log('⚠️ لا توجد متدربون في النتيجة');
    }

    // Test for specific session
    console.log('\n📋 اختبار جلب متدربي دفعة محددة (session_id=35)...');
    const response2 = await fetch(`${baseURL}/enrollments?session_id=35`, {
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': '1'
      }
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`✅ تم جلب ${data2.length} متدرب للدفعة\n`);
      if (data2.length > 0) {
        console.table(data2.map(e => ({
          id: e.id,
          name: e.beneficiary_name,
          status: e.status,
          attendance: e.attendance_percentage + '%'
        })));
      }
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
}

testProductionAPI();
