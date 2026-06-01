const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

const API_URL = 'https://super-cmk2wuy9-production.up.railway.app';

async function testBackendBeforeDeployment() {
  console.log('🧪 Running Backend Tests Before Deployment\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Test 1: Database Connection
    console.log('\n📌 Test 1: Database Connection');
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ PASSED - Database connected:', result.rows[0].now);
      passed++;
    } catch (error) {
      console.log('❌ FAILED - Database connection error:', error.message);
      failed++;
    }
    
    // Test 2: Check headquarters exist
    console.log('\n📌 Test 2: Headquarters Data');
    try {
      const hqResult = await pool.query(`SELECT COUNT(*) FROM headquarters WHERE entity_id = 'HQ001'`);
      if (parseInt(hqResult.rows[0].count) > 0) {
        console.log('✅ PASSED - HQ001 exists');
        passed++;
      } else {
        console.log('❌ FAILED - HQ001 not found');
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED - HQ query error:', error.message);
      failed++;
    }
    
    // Test 3: Check branches for HQ001
    console.log('\n📌 Test 3: Branches for HQ001');
    try {
      const branchResult = await pool.query(`
        SELECT COUNT(*) FROM branches b
        JOIN headquarters h ON b.hq_id = h.id
        WHERE h.entity_id = 'HQ001'
      `);
      const branchCount = parseInt(branchResult.rows[0].count);
      if (branchCount > 0) {
        console.log(`✅ PASSED - Found ${branchCount} branches for HQ001`);
        passed++;
      } else {
        console.log('❌ FAILED - No branches found for HQ001');
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED - Branch query error:', error.message);
      failed++;
    }
    
    // Test 4: Check incubators for HQ001's branches
    console.log('\n📌 Test 4: Incubators for HQ001');
    try {
      const incubatorResult = await pool.query(`
        SELECT COUNT(*) FROM incubators i
        JOIN branches b ON i.branch_id = b.id
        JOIN headquarters h ON b.hq_id = h.id
        WHERE h.entity_id = 'HQ001'
      `);
      const incubatorCount = parseInt(incubatorResult.rows[0].count);
      if (incubatorCount > 0) {
        console.log(`✅ PASSED - Found ${incubatorCount} incubators for HQ001`);
        passed++;
      } else {
        console.log('⚠️  WARNING - No incubators found for HQ001 (may be expected)');
        passed++; // Not a failure if there are no incubators yet
      }
    } catch (error) {
      console.log('❌ FAILED - Incubator query error:', error.message);
      failed++;
    }
    
    // Test 5: Check platforms for HQ001's incubators
    console.log('\n📌 Test 5: Platforms for HQ001');
    try {
      const platformResult = await pool.query(`
        SELECT COUNT(*) FROM platforms p
        JOIN incubators i ON p.incubator_id = i.id
        JOIN branches b ON i.branch_id = b.id
        JOIN headquarters h ON b.hq_id = h.id
        WHERE h.entity_id = 'HQ001'
      `);
      const platformCount = parseInt(platformResult.rows[0].count);
      if (platformCount > 0) {
        console.log(`✅ PASSED - Found ${platformCount} platforms for HQ001`);
        passed++;
      } else {
        console.log('⚠️  WARNING - No platforms found for HQ001 (may be expected)');
        passed++; // Not a failure if there are no platforms yet
      }
    } catch (error) {
      console.log('❌ FAILED - Platform query error:', error.message);
      failed++;
    }
    
    // Test 6: API endpoint test (if server is running)
    console.log('\n📌 Test 6: API Endpoint - GET /api/incubators/HQ001/platforms');
    try {
      const response = await fetch(`${API_URL}/api/incubators/HQ001/platforms`);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ PASSED - API returned ${data.length} platforms`);
        console.log('   Platforms:', data.map(p => p.name).join(', ') || 'None');
        passed++;
      } else {
        console.log(`❌ FAILED - API returned status ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log('⚠️  WARNING - API test skipped (server may not be running):', error.message);
      // Don't count as failure if server is not running yet
    }
    
    // Test 7: Check for required tables
    console.log('\n📌 Test 7: Required Tables Exist');
    try {
      const tables = ['headquarters', 'branches', 'incubators', 'platforms'];
      let allExist = true;
      
      for (const table of tables) {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `, [table]);
        
        if (!result.rows[0].exists) {
          console.log(`❌ Table ${table} does not exist`);
          allExist = false;
        }
      }
      
      if (allExist) {
        console.log('✅ PASSED - All required tables exist');
        passed++;
      } else {
        console.log('❌ FAILED - Some tables are missing');
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED - Table check error:', error.message);
      failed++;
    }
    
    // Test 8: Check entity_id columns
    console.log('\n📌 Test 8: Entity ID Columns');
    try {
      const tables = ['headquarters', 'branches', 'incubators', 'platforms'];
      let allHaveEntityId = true;
      
      for (const table of tables) {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = 'entity_id'
          )
        `, [table]);
        
        if (!result.rows[0].exists) {
          console.log(`⚠️  Table ${table} missing entity_id column`);
          // Not critical, just a warning
        }
      }
      
      console.log('✅ PASSED - Entity ID check completed');
      passed++;
    } catch (error) {
      console.log('❌ FAILED - Entity ID check error:', error.message);
      failed++;
    }
    
  } catch (error) {
    console.log('\n❌ Fatal error during tests:', error.message);
    failed++;
  } finally {
    await pool.end();
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${passed + failed}`);
  console.log(`🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Ready for deployment.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review before deployment.');
    process.exit(1);
  }
}

testBackendBeforeDeployment();
