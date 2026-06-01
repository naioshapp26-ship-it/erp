/**
 * 🧪 Test Strategic Financial Reports API Endpoints (Page 37)
 */

const BASE_URL = 'http://localhost:3000';
const ENTITY_ID = '1';
const AR_ENTITY_ID = 'HQ001';

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
                rows: data.invoices?.length ?? data.payments?.length ?? data.rows?.length ?? data.forecasts?.length ?? data.customers?.length ?? data.cashflows?.length ?? data.aging?.length ?? 0
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
    console.log('🧪 اختبار Backend API - التقارير الاستراتيجية والذكاء المالي (صفحة 37)');
    console.log('='.repeat(80));

    const results = { total: 0, passed: 0, failed: 0 };

    results.total++;
    const t1 = await testAPI('1️⃣ الفواتير', `${BASE_URL}/finance/invoices`);
    if (t1.success) results.passed++; else results.failed++;

    results.total++;
    const t2 = await testAPI('2️⃣ المدفوعات', `${BASE_URL}/finance/payments`);
    if (t2.success) results.passed++; else results.failed++;

    results.total++;
    const t3 = await testAPI('3️⃣ تقييمات المخاطر', `${BASE_URL}/finance/ai-risk-scores?entity_id=${ENTITY_ID}`);
    if (t3.success) results.passed++; else results.failed++;

    results.total++;
    const t4 = await testAPI('4️⃣ التوقعات الذكية', `${BASE_URL}/finance/ai-forecasts?entity_id=${ENTITY_ID}`);
    if (t4.success) results.passed++; else results.failed++;

    results.total++;
    const t5 = await testAPI('5️⃣ العملاء', `${BASE_URL}/finance/customers`);
    if (t5.success) results.passed++; else results.failed++;

    results.total++;
    const t6 = await testAPI('6️⃣ ملخص التدفق النقدي', `${BASE_URL}/finance/cashflow/overview?entity_id=${ENTITY_ID}`);
    if (t6.success) results.passed++; else results.failed++;

    results.total++;
    const t7 = await testAPI('7️⃣ أعمار الذمم', `${BASE_URL}/finance/ar-aging?entity_id=${AR_ENTITY_ID}`);
    if (t7.success) results.passed++; else results.failed++;

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
