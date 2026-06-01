/**
 * 🧪 Test Balance Sheet API Endpoints
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
            console.log(`📊 Data Summary:`, {
                success: data.success,
                dataKeys: Object.keys(data),
                counts: {
                    assets: data.assets?.length,
                    liabilities: data.liabilities?.length,
                    equity: data.equity?.length
                }
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
    console.log('🧪 اختبار Backend API - الميزانية العمومية');
    console.log('='.repeat(80));

    let results = {
        total: 0,
        passed: 0,
        failed: 0
    };

    // Test 1: Database Connection
    results.total++;
    const test1 = await testAPI(
        '1️⃣ Test Database Connection',
        `${BASE_URL}/finance/balance-sheet/test`
    );
    if (test1.success) results.passed++;
    else results.failed++;

    // Test 2: Get Balance Sheet Info
    results.total++;
    const test2 = await testAPI(
        '2️⃣ Get Balance Sheet Info',
        `${BASE_URL}/finance/balance-sheet?entity_id=${ENTITY_ID}`
    );
    if (test2.success) results.passed++;
    else results.failed++;

    // Test 3: Get Assets
    results.total++;
    const test3 = await testAPI(
        '3️⃣ Get Assets',
        `${BASE_URL}/finance/balance-sheet/assets?entity_id=${ENTITY_ID}`
    );
    if (test3.success) {
        results.passed++;
        console.log(`   📊 Assets Summary:`, test3.data.summary);
    } else {
        results.failed++;
    }

    // Test 4: Get Liabilities
    results.total++;
    const test4 = await testAPI(
        '4️⃣ Get Liabilities',
        `${BASE_URL}/finance/balance-sheet/liabilities?entity_id=${ENTITY_ID}`
    );
    if (test4.success) {
        results.passed++;
        console.log(`   📊 Liabilities Summary:`, test4.data.summary);
    } else {
        results.failed++;
    }

    // Test 5: Get Equity
    results.total++;
    const test5 = await testAPI(
        '5️⃣ Get Equity',
        `${BASE_URL}/finance/balance-sheet/equity?entity_id=${ENTITY_ID}`
    );
    if (test5.success) {
        results.passed++;
        console.log(`   📊 Equity Summary:`, test5.data.summary);
    } else {
        results.failed++;
    }

    // Test 6: Get Complete Balance Sheet
    results.total++;
    const test6 = await testAPI(
        '6️⃣ Get Complete Balance Sheet',
        `${BASE_URL}/finance/balance-sheet/complete?entity_id=${ENTITY_ID}`
    );
    if (test6.success) {
        results.passed++;
        console.log(`   📊 Balance Sheet Totals:`, test6.data.totals);
        
        // Verify balance equation
        const totals = test6.data.totals;
        const leftSide = totals.total_assets;
        const rightSide = totals.total_liabilities + totals.total_equity;
        console.log(`\n   📐 Balance Equation:`);
        console.log(`      Assets: ${leftSide.toFixed(2)}`);
        console.log(`      Liabilities + Equity: ${rightSide.toFixed(2)}`);
        console.log(`      Balanced: ${totals.is_balanced ? '✅ YES' : '❌ NO'}`);
        
        if (!totals.is_balanced) {
            console.log(`      Difference: ${totals.difference.toFixed(2)}`);
        }
    } else {
        results.failed++;
    }

    // Summary
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
    } else {
        console.log('\n⚠️  يوجد اختبارات فاشلة. يجب إصلاح المشاكل قبل النشر.');
        return false;
    }
}

// Run tests
runAllTests().then(success => {
    process.exit(success ? 0 : 1);
});
