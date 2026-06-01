// Test production API with error details
async function testProductionAPIWithErrors() {
  console.log('🌐 اختبار API على الـ Production مع تفاصيل الأخطاء\n');

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
      const text = await response.text();
      console.log('رسالة الخطأ:');
      console.log(text);
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
        date: e.enrollment_date?.substring(0, 10)
      })));
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
}

testProductionAPIWithErrors();
