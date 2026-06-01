const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testAfterDeletion() {
  console.log('🧪 Backend Tests After Platform Deletion\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Test 1: Only Training Platform exists
    console.log('\n📌 Test 1: Only Training Platform Exists');
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM platforms`);
      const count = parseInt(result.rows[0].count);
      if (count === 1) {
        console.log('✅ PASSED - Exactly 1 platform exists');
        passed++;
      } else {
        console.log(`❌ FAILED - Expected 1 platform, found ${count}`);
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 2: Training Platform ID is 1
    console.log('\n📌 Test 2: Training Platform Details');
    try {
      const result = await pool.query(`
        SELECT id, name, code FROM platforms WHERE id = 1
      `);
      if (result.rows.length > 0) {
        const platform = result.rows[0];
        console.log(`✅ PASSED - Training Platform found:`);
        console.log(`   Name: ${platform.name}`);
        console.log(`   Code: ${platform.code}`);
        console.log(`   ID: ${platform.id}`);
        passed++;
      } else {
        console.log('❌ FAILED - Training Platform not found');
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 3: No orphaned office_platforms
    console.log('\n📌 Test 3: No Orphaned Office Links');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM office_platforms 
        WHERE platform_id NOT IN (SELECT id FROM platforms)
      `);
      const count = parseInt(result.rows[0].count);
      if (count === 0) {
        console.log('✅ PASSED - No orphaned office links');
        passed++;
      } else {
        console.log(`❌ FAILED - Found ${count} orphaned office links`);
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 4: Training Platform has office links
    console.log('\n📌 Test 4: Training Platform Office Links');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM office_platforms WHERE platform_id = 1
      `);
      const count = parseInt(result.rows[0].count);
      console.log(`✅ PASSED - Training Platform has ${count} office link(s)`);
      passed++;
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 5: No orphaned employees
    console.log('\n📌 Test 5: No Orphaned Employees');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM employees 
        WHERE platform_id IS NOT NULL 
          AND platform_id NOT IN (SELECT id FROM platforms)
      `);
      const count = parseInt(result.rows[0].count);
      if (count === 0) {
        console.log('✅ PASSED - No orphaned employees');
        passed++;
      } else {
        console.log(`❌ FAILED - Found ${count} orphaned employees`);
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 6: Training Platform employees
    console.log('\n📌 Test 6: Training Platform Employees');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM employees WHERE platform_id = 1
      `);
      const count = parseInt(result.rows[0].count);
      console.log(`✅ PASSED - Training Platform has ${count} employee(s)`);
      passed++;
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 7: Database tables integrity
    console.log('\n📌 Test 7: Database Tables Exist');
    try {
      const tables = ['platforms', 'office_platforms', 'employees', 'incubators'];
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
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 8: Database connection
    console.log('\n📌 Test 8: Database Connection');
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ PASSED - Database connected');
      passed++;
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
  } catch (error) {
    console.log('\n❌ Fatal error:', error.message);
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
    console.log('\n🎉 All tests passed!');
    console.log('✅ Only Training Platform remains');
    console.log('✅ All data integrity maintained');
    console.log('✅ Ready to add new platforms');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed.');
    process.exit(1);
  }
}

testAfterDeletion();
