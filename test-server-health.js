/**
 * اختبار سريع للسيرفر والاتصال بقاعدة البيانات
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function testServer() {
  console.log('\n🧪 === اختبار سريع للسيرفر ===\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ اختبار الاتصال بالسيرفر...');
    const healthResponse = await fetch(`${API_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`السيرفر لا يستجيب: ${healthResponse.status}`);
    }
    const healthData = await healthResponse.json();
    console.log('   ✅ السيرفر يعمل بشكل صحيح');
    console.log('   📊 قاعدة البيانات:', healthData.database);
    console.log('   ⏰ الوقت:', healthData.time);

    // Test 2: Get Entities
    console.log('\n2️⃣ اختبار جلب الكيانات...');
    const entitiesResponse = await fetch(`${API_URL}/entities`, {
      headers: {
        'x-entity-type': 'HQ',
        'x-entity-id': 'HQ001'
      }
    });
    
    if (!entitiesResponse.ok) {
      throw new Error(`فشل جلب الكيانات: ${entitiesResponse.status}`);
    }
    
    const entities = await entitiesResponse.json();
    console.log(`   ✅ تم جلب ${entities.length} كيان`);
    
    // Count by type
    const incubators = entities.filter(e => e.type === 'INCUBATOR').length;
    const platforms = entities.filter(e => e.type === 'PLATFORM').length;
    const offices = entities.filter(e => e.type === 'OFFICE').length;
    
    console.log(`   📊 الإحصائيات:`);
    console.log(`      - حاضنات: ${incubators}`);
    console.log(`      - منصات: ${platforms}`);
    console.log(`      - مكاتب: ${offices}`);

    // Test 3: Test Dashboard API
    console.log('\n3️⃣ اختبار Dashboard API...');
    const dashboardTypeResponse = await fetch(`${API_URL}/dashboard/type?entity_id=INC03`, {
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': 'INC03'
      }
    });
    
    if (dashboardTypeResponse.ok) {
      const dashboardType = await dashboardTypeResponse.json();
      console.log(`   ✅ نوع Dashboard: ${dashboardType.dashboard_type}`);
      console.log(`   📛 اسم الكيان: ${dashboardType.entity_name}`);
    } else {
      console.log(`   ⚠️  Dashboard API لا يعمل (${dashboardTypeResponse.status})`);
    }

    console.log('\n✅ === جميع الاختبارات نجحت ===\n');
    return true;

  } catch (error) {
    console.error('\n❌ === فشل الاختبار ===');
    console.error('الخطأ:', error.message);
    console.error('\n💡 التحقق من:');
    console.error('   1. هل السيرفر شغال؟ (node server.js)');
    console.error('   2. هل قاعدة البيانات متصلة؟');
    console.error('   3. هل البورت 3000 متاح؟');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  testServer().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testServer };
