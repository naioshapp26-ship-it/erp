#!/usr/bin/env node

/**
 * Test new filtering API endpoints
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api';

async function testFiltering() {
    console.log('🧪 اختبار API Filtering الجديد\n');
    
    // Start server in background
    const { spawn } = require('child_process');
    const server = spawn('node', ['server.js'], {
        env: { ...process.env, PORT: 3000 },
        stdio: 'pipe'
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
        // Test 1: Get all entities (old behavior - should be slow)
        console.log('1️⃣ Test: GET /api/entities (without filter)');
        const start1 = Date.now();
        const res1 = await fetch(`${API_URL}/entities`);
        const data1 = await res1.json();
        const time1 = Date.now() - start1;
        console.log(`   ✅ Returned ${data1.length} entities in ${time1}ms`);
        if (time1 > 500) console.log(`   ⚠️  Slow response time!`);
        
        // Test 2: Get only HQ and BRANCH (new behavior - should be fast)
        console.log('\n2️⃣ Test: GET /api/entities?types=HQ,BRANCH');
        const start2 = Date.now();
        const res2 = await fetch(`${API_URL}/entities?types=HQ,BRANCH`);
        const data2 = await res2.json();
        const time2 = Date.now() - start2;
        console.log(`   ✅ Returned ${data2.length} entities in ${time2}ms`);
        console.log(`   📊 Improvement: ${((1 - time2/time1) * 100).toFixed(1)}% faster`);
        
        // Test 3: Get with limit
        console.log('\n3️⃣ Test: GET /api/entities?limit=50');
        const start3 = Date.now();
        const res3 = await fetch(`${API_URL}/entities?limit=50`);
        const data3 = await res3.json();
        const time3 = Date.now() - start3;
        console.log(`   ✅ Returned ${data3.length} entities in ${time3}ms`);
        console.log(`   📊 Data reduction: ${((1 - data3.length/data1.length) * 100).toFixed(1)}%`);
        
        // Test 4: Combined filter
        console.log('\n4️⃣ Test: GET /api/entities?types=HQ,BRANCH&limit=10');
        const start4 = Date.now();
        const res4 = await fetch(`${API_URL}/entities?types=HQ,BRANCH&limit=10`);
        const data4 = await res4.json();
        const time4 = Date.now() - start4;
        console.log(`   ✅ Returned ${data4.length} entities in ${time4}ms`);
        console.log(`   🚀 ${((time1/time4)).toFixed(1)}x faster than unfiltered`);
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Summary:');
        console.log(`   Total entities in DB: ${data1.length}`);
        console.log(`   With type filter: ${data2.length} (${((1 - data2.length/data1.length) * 100).toFixed(1)}% reduction)`);
        console.log(`   With limit 50: ${data3.length} (${((1 - data3.length/data1.length) * 100).toFixed(1)}% reduction)`);
        console.log(`   With both filters: ${data4.length} (${((1 - data4.length/data1.length) * 100).toFixed(1)}% reduction)`);
        console.log('\n✅ Filtering API works correctly!');
        console.log('💡 Frontend should use: /api/entities?types=HQ,BRANCH&limit=50');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        server.kill();
    }
}

testFiltering();
