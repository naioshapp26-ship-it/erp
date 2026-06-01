/**
 * 🧪 Test Journal API Endpoints
 * Backend testing before deployment
 */

const BASE_URL = 'http://localhost:3000';
const ENTITY_ID = '1';

async function testAPI(name, url, options = {}) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`📍 URL: ${url}`);
    
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (response.ok) {
            console.log(`✅ SUCCESS - Status: ${response.status}`);
            console.log(`📊 Data:`, JSON.stringify(data, null, 2));
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
    console.log('=' .repeat(80));
    console.log('🧪 اختبار Backend API - دفتر اليومية والأستاذ العام');
    console.log('=' .repeat(80));

    let results = {
        total: 0,
        passed: 0,
        failed: 0
    };

    // Test 1: Database Connection
    results.total++;
    const test1 = await testAPI(
        '1️⃣ Test Database Connection',
        `${BASE_URL}/finance/journal/test`
    );
    if (test1.success) results.passed++;
    else results.failed++;

    // Test 2: Get Journal Entries
    results.total++;
    const test2 = await testAPI(
        '2️⃣ Get All Journal Entries',
        `${BASE_URL}/finance/journal/entries?entity_id=${ENTITY_ID}`
    );
    if (test2.success) results.passed++;
    else results.failed++;

    // Test 3: Get Account Balances (Trial Balance)
    results.total++;
    const test3 = await testAPI(
        '3️⃣ Get Account Balances (Trial Balance)',
        `${BASE_URL}/finance/journal/balances?entity_id=${ENTITY_ID}`
    );
    if (test3.success) results.passed++;
    else results.failed++;

    // Test 4: Get Specific Journal Entry (if we have any)
    if (test2.success && test2.data.entries && test2.data.entries.length > 0) {
        results.total++;
        const firstEntry = test2.data.entries[0];
        const test4 = await testAPI(
            `4️⃣ Get Journal Entry #${firstEntry.entry_id}`,
            `${BASE_URL}/finance/journal/entries/${firstEntry.entry_id}?entity_id=${ENTITY_ID}`
        );
        if (test4.success) results.passed++;
        else results.failed++;
    }

    // Test 5: Get Account Ledger (if we have any balances)
    if (test3.success && test3.data.balances && test3.data.balances.length > 0) {
        results.total++;
        const firstAccount = test3.data.balances[0];
        const test5 = await testAPI(
            `5️⃣ Get Account Ledger for #${firstAccount.account_id}`,
            `${BASE_URL}/finance/journal/ledger/${firstAccount.account_id}?entity_id=${ENTITY_ID}`
        );
        if (test5.success) results.passed++;
        else results.failed++;
    }

    // Summary
    console.log('\n' + '=' .repeat(80));
    console.log('📊 Test Results Summary');
    console.log('=' .repeat(80));
    console.log(`✅ Passed: ${results.passed}/${results.total}`);
    console.log(`❌ Failed: ${results.failed}/${results.total}`);
    console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
    console.log('=' .repeat(80));

    if (results.failed === 0) {
        console.log('\n🎉 جميع الاختبارات نجحت! يمكن النشر بأمان.');
        return true;
    } else {
        console.log('\n⚠️  يوجد اختبارات فاشلة. يجب إصلاح المشاكل قبل النشر.');
        return false;
    }
}

// Run tests
runAllTests().then(success => {
    process.exit(success ? 0 : 1);
});
