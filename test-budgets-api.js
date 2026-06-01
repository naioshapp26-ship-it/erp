/**
 * 🧪 Test Budgets API Endpoints
 */

const BASE_URL = 'http://localhost:3000';
const ENTITY_ID = '1';

async function testAPI(name, url) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`📍 URL: ${url}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            console.log(`✅ SUCCESS - Status: ${response.status}`);
            console.log(`📊 Data Summary:`, {
                success: data.success,
                total_budgets: data.summary?.total_budgets,
                total_lines: data.summary?.total_lines,
                total_variances: data.summary?.total_variances
            });
            return { success: true, data };
        } else {
            console.log(`❌ FAILED - Status: ${response.status}`);
            console.log(`❌ Error:`, data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('='.repeat(80));
    console.log('🧪 اختبار Backend API - الميزانيات والانحرافات');
    console.log('='.repeat(80));

    const results = { total: 0, passed: 0, failed: 0 };

    results.total++;
    const test1 = await testAPI(
        '1️⃣ Test Database Connection',
        `${BASE_URL}/finance/budgets/test`
    );
    if (test1.success) results.passed++;
    else results.failed++;

    results.total++;
    const test2 = await testAPI(
        '2️⃣ Get Budgets Report',
        `${BASE_URL}/finance/budgets?entity_id=${ENTITY_ID}`
    );
    if (test2.success) results.passed++;
    else results.failed++;

    console.log('\n' + '='.repeat(80));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${results.passed}/${results.total}`);
    console.log(`❌ Failed: ${results.failed}/${results.total}`);
    console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    if (results.failed === 0) {
        console.log('\n🎉 جميع الاختبارات نجحت! يمكن النشر بأمان.');
        return true;
    }

    console.log('\n⚠️  يوجد اختبارات فاشلة. يجب إصلاح المشاكل قبل النشر.');
    return false;
}

runAllTests().then(success => process.exit(success ? 0 : 1));
