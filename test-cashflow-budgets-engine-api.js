/**
 * 🧪 Test Cashflow & Budgets Engine API Endpoints (Page 30)
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
                rows: data.rows?.length ?? data.cashflows?.length ?? data.forecasts?.length ?? data.budgets?.length ?? data.lines?.length ?? data.variances?.length
            });
            return { success: true, data };
        }

        console.log(`❌ FAILED - Status: ${response.status}`);
        console.log(`❌ Error:`, data);
        return { success: false, error: data };
    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('='.repeat(80));
    console.log('🧪 اختبار Backend API - التدفقات والميزانيات (صفحة 30)');
    console.log('='.repeat(80));

    const results = { total: 0, passed: 0, failed: 0 };

    results.total++;
    const t1 = await testAPI('1️⃣ نظرة التدفقات', `${BASE_URL}/finance/cashflow/overview?entity_id=${ENTITY_ID}`);
    if (t1.success) results.passed++; else results.failed++;

    results.total++;
    const t2 = await testAPI('2️⃣ التدفقات التشغيلية', `${BASE_URL}/finance/cashflow/operating?entity_id=${ENTITY_ID}`);
    if (t2.success) results.passed++; else results.failed++;

    results.total++;
    const t3 = await testAPI('3️⃣ التدفقات الاستثمارية', `${BASE_URL}/finance/cashflow/investing?entity_id=${ENTITY_ID}`);
    if (t3.success) results.passed++; else results.failed++;

    results.total++;
    const t4 = await testAPI('4️⃣ التدفقات التمويلية', `${BASE_URL}/finance/cashflow/financing?entity_id=${ENTITY_ID}`);
    if (t4.success) results.passed++; else results.failed++;

    results.total++;
    const t5 = await testAPI('5️⃣ التوقعات المستقبلية', `${BASE_URL}/finance/ai-forecasts?entity_id=${ENTITY_ID}`);
    if (t5.success) results.passed++; else results.failed++;

    results.total++;
    const t6 = await testAPI('6️⃣ الميزانيات', `${BASE_URL}/finance/budgets?entity_id=${ENTITY_ID}`);
    if (t6.success) results.passed++; else results.failed++;

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
