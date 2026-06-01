/**
 * اختبار واجهات Dashboard المختلفة
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const DB_URL = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function makeRequest(endpoint, entityType = 'HQ', entityId = 'HQ001') {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-entity-type': entityType,
        'x-entity-id': entityId
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ خطأ في الطلب ${endpoint}:`, error.message);
    throw error;
  }
}

async function testDashboards() {
  console.log('\n🧪 === اختبار واجهات Dashboard المختلفة ===\n');

  try {
    // Test 1: Dashboard Type Detection
    console.log('📋 اختبار 1: تحديد نوع Dashboard');
    const dashboardType = await makeRequest('/dashboard/type?entity_id=INC03', 'INCUBATOR', 'INC03');
    console.log(`   ✅ نوع Dashboard: ${dashboardType.dashboard_type}`);
    console.log(`   📊 مستوى الكيان: ${dashboardType.entity_level}`);

    // Test 2: Incubator Dashboard
    console.log('\n📋 اختبار 2: Incubator Dashboard');
    const incubatorDashboard = await makeRequest('/dashboard/incubator?entity_id=INC03', 'INCUBATOR', 'INC03');
    console.log(`   ✅ عدد المستفيدين: ${incubatorDashboard.beneficiaries?.length || 0}`);
    console.log(`   ✅ عدد البرامج: ${incubatorDashboard.programs?.length || 0}`);
    console.log(`   ✅ الجلسات الأخيرة: ${incubatorDashboard.recent_sessions?.length || 0}`);
    console.log(`   📊 الإحصائيات:`, incubatorDashboard.statistics);

    // Test 3: Platform Dashboard
    console.log('\n📋 اختبار 3: Platform Dashboard');
    const platformDashboard = await makeRequest('/dashboard/platform?entity_id=PLT01', 'PLATFORM', 'PLT01');
    console.log(`   ✅ عدد الخدمات: ${platformDashboard.services?.length || 0}`);
    console.log(`   ✅ عدد الاشتراكات: ${platformDashboard.subscriptions?.length || 0}`);
    console.log(`   ✅ إحصائيات المحتوى: ${platformDashboard.content_stats?.length || 0}`);
    console.log(`   💰 الإيرادات:`, platformDashboard.revenue);

    // Test 4: Office Dashboard
    console.log('\n📋 اختبار 4: Office Dashboard');
    const officeDashboard = await makeRequest('/dashboard/office?entity_id=OFF01', 'OFFICE', 'OFF01');
    console.log(`   ✅ عدد المواعيد: ${officeDashboard.appointments?.length || 0}`);
    console.log(`   ✅ عدد العملاء: ${officeDashboard.customers?.length || 0}`);
    console.log(`   ✅ جدول اليوم: ${officeDashboard.today_schedule?.length || 0}`);
    console.log(`   📊 الإحصائيات:`, officeDashboard.statistics);

    // Test 5: HQ Access (should see all)
    console.log('\n📋 اختبار 5: HQ Dashboard Type');
    const hqDashboard = await makeRequest('/dashboard/type?entity_id=HQ001', 'HQ', 'HQ001');
    console.log(`   ✅ نوع Dashboard للمكتب الرئيسي: ${hqDashboard.dashboard_type}`);

    // Test 6: Test different entity levels
    console.log('\n📋 اختبار 6: اختبار مستويات الكيانات المختلفة');
    
    const entities = [
      { id: 'INC03', type: 'INCUBATOR', expected: 'incubator' },
      { id: 'PLT01', type: 'PLATFORM', expected: 'platform' },
      { id: 'OFF01', type: 'OFFICE', expected: 'office' }
    ];

    for (const entity of entities) {
      try {
        const typeResult = await makeRequest(`/dashboard/type?entity_id=${entity.id}`, entity.type, entity.id);
        const match = typeResult.dashboard_type === entity.expected ? '✅' : '❌';
        console.log(`   ${match} ${entity.id} (${entity.type}): ${typeResult.dashboard_type} (متوقع: ${entity.expected})`);
      } catch (error) {
        console.log(`   ⚠️ ${entity.id}: ${error.message}`);
      }
    }

    console.log('\n✅ === اكتملت جميع اختبارات Dashboard بنجاح ===\n');

  } catch (error) {
    console.error('\n❌ === فشل الاختبار ===');
    console.error('الخطأ:', error.message);
    process.exit(1);
  }
}

// تشغيل الاختبارات
if (require.main === module) {
  testDashboards();
}

module.exports = { testDashboards };
