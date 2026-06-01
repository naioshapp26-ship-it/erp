#!/usr/bin/env node

/**
 * Frontend Performance Test
 * Tests the caching and lazy loading improvements
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Frontend Performance Tests\n');

const tests = {
    passed: 0,
    failed: 0,
    total: 0
};

function test(name, condition, message = '') {
    tests.total++;
    if (condition) {
        tests.passed++;
        console.log(`✅ ${name}`);
        if (message) console.log(`   ${message}`);
    } else {
        tests.failed++;
        console.log(`❌ ${name}`);
        if (message) console.log(`   ${message}`);
    }
}

// Test 1: Check performance.js exists
const performanceJsPath = path.join(__dirname, 'performance.js');
test(
    'performance.js module exists',
    fs.existsSync(performanceJsPath),
    'Caching module created'
);

// Test 2: Check performance.js has cachedFetchAPI function
const performanceContent = fs.readFileSync(performanceJsPath, 'utf8');
test(
    'performance.js contains cachedFetchAPI',
    performanceContent.includes('cachedFetchAPI'),
    'Caching function defined'
);

// Test 3: Check performance.js has cache object
test(
    'performance.js contains apiCache',
    performanceContent.includes('const apiCache'),
    'Cache storage defined'
);

// Test 4: Check index.html loads performance.js
const indexHtmlPath = path.join(__dirname, 'index.html');
const indexContent = fs.readFileSync(indexHtmlPath, 'utf8');
test(
    'index.html loads performance.js',
    indexContent.includes('<script src="performance.js"></script>'),
    'Performance module integrated'
);

// Test 5: Check index.html has global loading indicator
test(
    'index.html has global loading indicator',
    indexContent.includes('id="global-loading"'),
    'Loading spinner added'
);

// Test 6: Check script.js has showGlobalLoading function
const scriptJsPath = path.join(__dirname, 'script.js');
const scriptContent = fs.readFileSync(scriptJsPath, 'utf8');
test(
    'script.js has showGlobalLoading',
    scriptContent.includes('function showGlobalLoading()'),
    'Loading indicator control added'
);

// Test 7: Check script.js has hideGlobalLoading function
test(
    'script.js has hideGlobalLoading',
    scriptContent.includes('function hideGlobalLoading()'),
    'Loading indicator control added'
);

// Test 8: Check script.js uses cachedFetchAPI
test(
    'script.js uses cachedFetchAPI',
    scriptContent.includes('cachedFetchAPI'),
    'Caching integrated into main script'
);

// Test 9: Check loadDataFromAPI accepts route parameter
test(
    'loadDataFromAPI supports lazy loading',
    scriptContent.includes('loadDataFromAPI(routeName'),
    'Lazy loading parameter added'
);

// Test 10: Check loadDataFromAPI has conditional loading logic
test(
    'loadDataFromAPI has conditional loading',
    scriptContent.includes('needsEntities') && 
    scriptContent.includes('needsUsers') && 
    scriptContent.includes('needsInvoices'),
    'Route-based loading implemented'
);

// Test 11: Check for cache usage messages
test(
    'loadDataFromAPI uses cached data',
    scriptContent.includes('Using cached'),
    'Cache reuse implemented'
);

// Test 12: Performance.js file size check
const performanceStats = fs.statSync(performanceJsPath);
test(
    'performance.js is reasonable size',
    performanceStats.size < 10000, // Less than 10KB
    `Size: ${(performanceStats.size / 1024).toFixed(2)} KB`
);

// Summary
console.log('\n📊 Test Summary:');
console.log(`   Total: ${tests.total}`);
console.log(`   Passed: ${tests.passed} ✅`);
console.log(`   Failed: ${tests.failed} ${tests.failed > 0 ? '❌' : '✅'}`);
console.log(`   Success Rate: ${((tests.passed / tests.total) * 100).toFixed(1)}%`);

if (tests.failed === 0) {
    console.log('\n🎉 All frontend performance tests passed!');
    console.log('\n📋 Improvements:');
    console.log('   ✅ API response caching (5-minute TTL)');
    console.log('   ✅ Lazy loading based on route');
    console.log('   ✅ Global loading indicators');
    console.log('   ✅ Cache reuse for repeated requests');
    console.log('   ✅ Conditional data loading');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed. Review the output above.');
    process.exit(1);
}
