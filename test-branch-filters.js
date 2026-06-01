const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Simple HTTP GET request function
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    }).on('error', reject);
  });
}

async function testBranchFilters() {
  console.log('\n🧪 Testing Branch Filter APIs\n');
  console.log('='.repeat(70));
  
  const results = {
    passed: 0,
    failed: 0
  };
  
  try {
    // Get a sample branch ID
    console.log('\n📌 Getting sample branch...');
    const branchesRes = await httpGet(`${BASE_URL}/api/entities`);
    
    if (!branchesRes.data || branchesRes.data.length === 0) {
      console.log('❌ No entities found');
      return;
    }
    
    // Find a BRANCH type entity
    const branch = branchesRes.data.find(e => e.type === 'BRANCH');
    
    if (!branch) {
      console.log('❌ No branches found');
      return;
    }
    
    const branchId = branch.id;
    const branchName = branch.name;
    console.log(`✅ Using branch: ${branchName} (${branchId})`);
    
    // Test 1: Get incubators for branch
    console.log('\n📌 Test 1: GET /api/incubators?branch_id=' + branchId);
    try {
      const incubatorsRes = await httpGet(`${BASE_URL}/api/incubators?branch_id=${branchId}`);
      
      if (incubatorsRes.status === 200 && Array.isArray(incubatorsRes.data)) {
        console.log(`✅ PASSED - Found ${incubatorsRes.data.length} incubators`);
        
        if (incubatorsRes.data.length > 0) {
          console.log('\n   Sample Incubators:');
          incubatorsRes.data.slice(0, 3).forEach((inc, idx) => {
            console.log(`   ${idx + 1}. ${inc.name} (${inc.id})`);
            console.log(`      Status: ${inc.relationship_status || 'N/A'}`);
          });
        }
        
        results.passed++;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      results.failed++;
    }
    
    // Test 2: Get platforms for branch
    console.log('\n📌 Test 2: GET /api/platforms?branch_id=' + branchId);
    try {
      const platformsRes = await httpGet(`${BASE_URL}/api/platforms?branch_id=${branchId}`);
      
      if (platformsRes.status === 200 && Array.isArray(platformsRes.data)) {
        console.log(`✅ PASSED - Found ${platformsRes.data.length} platforms`);
        
        if (platformsRes.data.length > 0) {
          console.log('\n   Sample Platforms:');
          platformsRes.data.slice(0, 3).forEach((plat, idx) => {
            const score = plat.performance_score ? parseFloat(plat.performance_score).toFixed(1) + '%' : 'N/A';
            console.log(`   ${idx + 1}. ${plat.name} (${plat.id})`);
            console.log(`      Status: ${plat.relationship_status || 'N/A'} | Score: ${score}`);
          });
        }
        
        results.passed++;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      results.failed++;
    }
    
    // Test 3: Get all incubators (no filter)
    console.log('\n📌 Test 3: GET /api/incubators (all)');
    try {
      const allIncRes = await httpGet(`${BASE_URL}/api/incubators`);
      
      if (allIncRes.status === 200 && Array.isArray(allIncRes.data)) {
        console.log(`✅ PASSED - Found ${allIncRes.data.length} total incubators`);
        results.passed++;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      results.failed++;
    }
    
    // Test 4: Get all platforms (no filter)
    console.log('\n📌 Test 4: GET /api/platforms (all)');
    try {
      const allPlatRes = await httpGet(`${BASE_URL}/api/platforms`);
      
      if (allPlatRes.status === 200 && Array.isArray(allPlatRes.data)) {
        console.log(`✅ PASSED - Found ${allPlatRes.data.length} total platforms`);
        results.passed++;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      results.failed++;
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📝 Total:  ${results.passed + results.failed}`);
    console.log('='.repeat(70) + '\n');
    
    if (results.failed > 0) {
      console.log('⚠️  Some tests failed\n');
      process.exit(1);
    } else {
      console.log('🎉 All API filter tests passed!\n');
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await httpGet(`${BASE_URL}/`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('\n🔍 Checking if server is running...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('⚠️  Server is not running at', BASE_URL);
    console.log('   Please start the server first with: node server.js\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await testBranchFilters();
}

main();
