/**
 * 🧪 Test Unified Accounting Overview API Endpoints (Page 28)
 */

const BASE_URL = 'http://localhost:3000';
const PRIMARY_ENTITY_ID = '1';
const SECONDARY_ENTITY_ID = 'HQ001';

async function testAPI(name, url, allowNotFound = false) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`📍 URL: ${url}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            console.log(`✅ SUCCESS - Status: ${response.status}`);
            console.log(`📊 Data Summary:`, {
                success: data.success,
                rows: data.rows?.length ?? data.entries?.length ?? data.lines?.length ?? data.budgets?.length ?? data.assets?.length ?? data.expenses?.length ?? data.invoices?.length ?? data.payments?.length ?? data.cashflows?.length ?? data.forecasts?.length
            });
            return { success: true, data };
        }

        if (allowNotFound && response.status === 404) {
            console.log(`⚠️  NOT FOUND - Status: ${response.status} (Allowed)`);
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
    console.log('🧪 اختبار Backend API - النظام المحاسبي الشمولي (صفحة 28)');
    console.log('='.repeat(80));

    const results = { total: 0, passed: 0, failed: 0 };

    results.total++;
    const t1 = await testAPI('1️⃣ Journal Entries', `${BASE_URL}/finance/journal/entries?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t1.success) results.passed++; else results.failed++;

    results.total++;
    const t2 = await testAPI('2️⃣ Journal Lines', `${BASE_URL}/finance/journal-lines?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t2.success) results.passed++; else results.failed++;

    results.total++;
    const t3 = await testAPI('3️⃣ Account Balances', `${BASE_URL}/finance/account-balances?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t3.success) results.passed++; else results.failed++;

    results.total++;
    const t4 = await testAPI('4️⃣ Expenses', `${BASE_URL}/finance/expenses?entity_id=${SECONDARY_ENTITY_ID}`);
    if (t4.success) results.passed++; else results.failed++;

    results.total++;
    const t5 = await testAPI('5️⃣ Fixed Assets', `${BASE_URL}/finance/fixed-assets?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t5.success) results.passed++; else results.failed++;

    results.total++;
    const t6 = await testAPI('6️⃣ Budgets', `${BASE_URL}/finance/budgets?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t6.success) results.passed++; else results.failed++;

    results.total++;
    const t7 = await testAPI('7️⃣ Cashflow Operating', `${BASE_URL}/finance/cashflow/operating?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t7.success) results.passed++; else results.failed++;

    results.total++;
    const t8 = await testAPI('8️⃣ AI Forecasts', `${BASE_URL}/finance/ai-forecasts?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t8.success) results.passed++; else results.failed++;

    results.total++;
    const t9 = await testAPI('9️⃣ AI Risk Scores', `${BASE_URL}/finance/ai-risk-scores?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t9.success) results.passed++; else results.failed++;

    results.total++;
    const t10 = await testAPI('🔟 Balance Sheet Complete', `${BASE_URL}/finance/balance-sheet/complete?entity_id=${PRIMARY_ENTITY_ID}`, true);
    if (t10.success) results.passed++; else results.failed++;

    results.total++;
    const t11 = await testAPI('1️⃣1️⃣ Income Statement', `${BASE_URL}/finance/income-statement?entity_id=${PRIMARY_ENTITY_ID}`);
    if (t11.success) results.passed++; else results.failed++;

    results.total++;
    const t12 = await testAPI('1️⃣2️⃣ Invoices', `${BASE_URL}/finance/invoices`);
    if (t12.success) results.passed++; else results.failed++;

    results.total++;
    const t13 = await testAPI('1️⃣3️⃣ Payments', `${BASE_URL}/finance/payments`);
    if (t13.success) results.passed++; else results.failed++;

    results.total++;
    const t14 = await testAPI('1️⃣4️⃣ AR Aging', `${BASE_URL}/finance/ar-aging?entity_id=${SECONDARY_ENTITY_ID}`);
    if (t14.success) results.passed++; else results.failed++;

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
