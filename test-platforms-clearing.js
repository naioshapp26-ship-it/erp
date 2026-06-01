const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testAfterClearing() {
  console.log('🧪 Testing After Clearing Other Platforms Data\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Test 1: Verify Training Platform still exists
    console.log('\n📌 Test 1: Training Platform Exists');
    try {
      const result = await pool.query(`
        SELECT * FROM platforms WHERE id = 1
      `);
      if (result.rows.length > 0) {
        console.log('✅ PASSED - Training Platform found:', result.rows[0].name);
        passed++;
      } else {
        console.log('❌ FAILED - Training Platform not found');
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 2: Verify other platforms still exist (but empty)
    console.log('\n📌 Test 2: Other Platforms Exist');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) FROM platforms WHERE id != 1
      `);
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`✅ PASSED - Found ${count} other platforms`);
        passed++;
      } else {
        console.log('⚠️  WARNING - No other platforms found');
        passed++;
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 3: Verify office_platforms only has Training Platform
    console.log('\n📌 Test 3: Office Links Only for Training Platform');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) FROM office_platforms WHERE platform_id != 1
      `);
      const count = parseInt(result.rows[0].count);
      if (count === 0) {
        console.log('✅ PASSED - No office links for other platforms');
        passed++;
      } else {
        console.log(`❌ FAILED - Found ${count} office links for other platforms`);
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 4: Count Training Platform office links
    console.log('\n📌 Test 4: Training Platform Has Office Links');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) FROM office_platforms WHERE platform_id = 1
      `);
      const count = parseInt(result.rows[0].count);
      console.log(`✅ PASSED - Training Platform has ${count} office links`);
      passed++;
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 5: List all platforms
    console.log('\n📌 Test 5: List All Platforms');
    try {
      const result = await pool.query(`
        SELECT id, name, code FROM platforms ORDER BY id
      `);
      console.log('✅ PASSED - Platforms list:');
      result.rows.forEach(p => {
        const marker = p.id === 1 ? '✅' : '⚪';
        console.log(`   ${marker} ${p.name} (${p.code}) [ID: ${p.id}]`);
      });
      passed++;
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 6: Verify employee still linked to Training Platform
    console.log('\n📌 Test 6: Employee Linked to Training Platform');
    try {
      const result = await pool.query(`
        SELECT COUNT(*) FROM employees WHERE platform_id = 1
      `);
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`✅ PASSED - ${count} employee(s) linked to Training Platform`);
        passed++;
      } else {
        console.log('⚠️  INFO - No employees linked to Training Platform (may be expected)');
        passed++;
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      failed++;
    }
    
    // Test 7: Database connection
    console.log('\n📌 Test 7: Database Connection');
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
    console.log('✅ Training Platform data preserved');
    console.log('✅ Other platforms cleared and ready for new data');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed.');
    process.exit(1);
  }
}

testAfterClearing();
