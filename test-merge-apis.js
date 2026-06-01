const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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

async function testMergeAPIs() {
  console.log('\n🧪 Testing Merge API Endpoints\n');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}\n`);
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  try {
    // Test 1: Get merge stats
    console.log('📌 Test 1: GET /api/merge-stats');
    try {
      const response = await httpGet(`${BASE_URL}/api/merge-stats`);
      
      if (response.status === 200 && response.data) {
        const data = response.data;
        console.log('✅ PASSED');
        console.log(`   Total Entities: ${(data.entities.branches + data.entities.incubators + data.entities.platforms)}`);
        console.log(`   Branches: ${data.entities.branches}`);
        console.log(`   Incubators: ${data.entities.incubators}`);
        console.log(`   Platforms: ${data.entities.platforms}`);
        console.log(`   Branch-Incubator Merges: ${data.merges.branchIncubators}`);
        console.log(`   Branch-Platform Merges: ${data.merges.branchPlatforms}`);
        console.log(`   Total Merges: ${data.merges.total}`);
        
        results.passed++;
        results.tests.push({
          name: 'GET /api/merge-stats',
          status: 'PASSED',
          data: data
        });
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      results.failed++;
      results.tests.push({
        name: 'GET /api/merge-stats',
        status: 'FAILED',
        error: error.message
      });
    }
    
    // Test 2: Get branches stats
    console.log('\n📌 Test 2: GET /api/branches/stats');
    try {
      const response = await httpGet(`${BASE_URL}/api/branches/stats`);
      
      if (response.status === 200 && response.data && response.data.length > 0) {
        console.log('✅ PASSED');
        console.log(`   Found ${response.data.length} branches with stats`);
        
        // Show first 3 branches
        response.data.slice(0, 3).forEach((branch, idx) => {
          console.log(`   ${idx + 1}. ${branch.name}`);
          console.log(`      └─ Incubators: ${branch.incubator_count} | Platforms: ${branch.platform_count}`);
        });
        
        results.passed++;
        results.tests.push({
          name: 'GET /api/branches/stats',
          status: 'PASSED',
          count: response.data.length
        });
      } else {
        throw new Error('No branch stats found');
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      results.failed++;
      results.tests.push({
        name: 'GET /api/branches/stats',
        status: 'FAILED',
        error: error.message
      });
    }
    
    // Test 3: Get specific branch incubators
    console.log('\n📌 Test 3: GET /api/branches/:id/incubators');
    try {
      // First get a branch ID
      const branchesResponse = await httpGet(`${BASE_URL}/api/entities?type=BRANCH&limit=1`);
      
      if (branchesResponse.data && branchesResponse.data.length > 0) {
        const branchId = branchesResponse.data[0].id;
        const branchName = branchesResponse.data[0].name;
        
        const response = await httpGet(`${BASE_URL}/api/branches/${branchId}/incubators`);
        
        if (response.status === 200 && response.data) {
          console.log('✅ PASSED');
          console.log(`   Branch: ${branchName}`);
          console.log(`   Incubators Count: ${response.data.length}`);
          
          // Show first 3 incubators
          response.data.slice(0, 3).forEach((inc, idx) => {
            console.log(`   ${idx + 1}. ${inc.name} (Status: ${inc.relationship_status})`);
          });
          
          results.passed++;
          results.tests.push({
            name: 'GET /api/branches/:id/incubators',
            status: 'PASSED',
            count: response.data.length
          });
        } else {
          throw new Error('Invalid response');
        }
      } else {
        throw new Error('No branches found');
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      results.failed++;
      results.tests.push({
        name: 'GET /api/branches/:id/incubators',
        status: 'FAILED',
        error: error.message
      });
    }
    
    // Test 4: Get specific branch platforms
    console.log('\n📌 Test 4: GET /api/branches/:id/platforms');
    try {
      // First get a branch ID
      const branchesResponse = await httpGet(`${BASE_URL}/api/entities?type=BRANCH&limit=1`);
      
      if (branchesResponse.data && branchesResponse.data.length > 0) {
        const branchId = branchesResponse.data[0].id;
        const branchName = branchesResponse.data[0].name;
        
        const response = await httpGet(`${BASE_URL}/api/branches/${branchId}/platforms`);
        
        if (response.status === 200 && response.data) {
          console.log('✅ PASSED');
          console.log(`   Branch: ${branchName}`);
          console.log(`   Platforms Count: ${response.data.length}`);
          
          // Show first 3 platforms
          response.data.slice(0, 3).forEach((plat, idx) => {
            const score = plat.performance_score ? `Score: ${parseFloat(plat.performance_score).toFixed(1)}%` : '';
            console.log(`   ${idx + 1}. ${plat.name} (${score})`);
          });
          
          results.passed++;
          results.tests.push({
            name: 'GET /api/branches/:id/platforms',
            status: 'PASSED',
            count: response.data.length
          });
        } else {
          throw new Error('Invalid response');
        }
      } else {
        throw new Error('No branches found');
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      results.failed++;
      results.tests.push({
        name: 'GET /api/branches/:id/platforms',
        status: 'FAILED',
        error: error.message
      });
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 API TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📝 Total:  ${results.passed + results.failed}`);
    console.log('='.repeat(70) + '\n');
    
    if (results.failed > 0) {
      console.log('⚠️  Some tests failed. Check the output above for details.\n');
      process.exit(1);
    } else {
      console.log('🎉 All API tests passed!\n');
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
    console.log('   Please start the server first with: node server.js');
    console.log('   Or set BASE_URL environment variable for remote testing\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await testMergeAPIs();
}

main();
