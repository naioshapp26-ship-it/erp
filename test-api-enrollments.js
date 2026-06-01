const http = require('http');

// Test the /api/enrollments endpoint
async function testEnrollmentsAPI() {
  console.log('🧪 اختبار API endpoint /api/enrollments\n');

  // Test 1: Get all enrollments
  console.log('📋 اختبار 1: جلب جميع المتدربين');
  try {
    const response = await fetch('http://localhost:3000/api/enrollments', {
      method: 'GET',
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': '1'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ نجح - عدد المتدربين: ${data.length}`);
      console.log('أول 3 متدربين:');
      console.table(data.slice(0, 3));
    } else {
      console.log(`❌ فشل - Status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
  console.log('');

  // Test 2: Get enrollments by session
  console.log('📋 اختبار 2: جلب متدربي دفعة محددة (session_id=1)');
  try {
    const response = await fetch('http://localhost:3000/api/enrollments?session_id=1', {
      method: 'GET',
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': '1'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ نجح - عدد المتدربين: ${data.length}`);
      console.table(data);
    } else {
      console.log(`❌ فشل - Status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
  console.log('');

  // Test 3: Get enrollments by beneficiary
  console.log('📋 اختبار 3: جلب تسجيلات مستفيد محدد (beneficiary_id=2)');
  try {
    const response = await fetch('http://localhost:3000/api/enrollments?beneficiary_id=2', {
      method: 'GET',
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': '1'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ نجح - عدد التسجيلات: ${data.length}`);
      console.table(data);
    } else {
      console.log(`❌ فشل - Status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
}

// Make sure we wait a bit for server to start
setTimeout(testEnrollmentsAPI, 500);
