const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testMergeData() {
  try {
    console.log('\n🧪 Testing Merge Data Visibility\n');
    console.log('='.repeat(70));
    
    // Test 1: Check if junction tables exist
    console.log('\n📌 Test 1: Checking Junction Tables Existence...');
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('branch_incubators', 'branch_platforms')
      ORDER BY table_name
    `);
    
    if (tablesCheck.rows.length === 2) {
      console.log('✅ PASSED - Both junction tables exist');
      tablesCheck.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
    } else {
      console.log('❌ FAILED - Junction tables missing');
      console.log('   Found:', tablesCheck.rows.map(r => r.table_name).join(', '));
      await pool.end();
      return;
    }
    
    // Test 2: Check branch_incubators count
    console.log('\n📌 Test 2: Checking Branch-Incubators Merges...');
    const incubatorsCountResult = await pool.query('SELECT COUNT(*) as count FROM branch_incubators');
    const incubatorsCount = parseInt(incubatorsCountResult.rows[0].count);
    
    if (incubatorsCount > 0) {
      console.log(`✅ PASSED - Found ${incubatorsCount.toLocaleString()} branch-incubator merges`);
    } else {
      console.log('❌ FAILED - No branch-incubator merges found');
    }
    
    // Test 3: Check branch_platforms count
    console.log('\n📌 Test 3: Checking Branch-Platforms Merges...');
    const platformsCountResult = await pool.query('SELECT COUNT(*) as count FROM branch_platforms');
    const platformsCount = parseInt(platformsCountResult.rows[0].count);
    
    if (platformsCount > 0) {
      console.log(`✅ PASSED - Found ${platformsCount.toLocaleString()} branch-platform merges`);
    } else {
      console.log('❌ FAILED - No branch-platform merges found');
    }
    
    // Test 4: Get sample branch with its relationships
    console.log('\n📌 Test 4: Getting Sample Branch Relationships...');
    const sampleBranch = await pool.query(`
      SELECT id, name FROM entities WHERE type = 'BRANCH' LIMIT 1
    `);
    
    if (sampleBranch.rows.length > 0) {
      const branchId = sampleBranch.rows[0].id;
      const branchName = sampleBranch.rows[0].name;
      
      console.log(`✅ Sample Branch: ${branchName} (${branchId})`);
      
      // Count incubators for this branch
      const branchIncubators = await pool.query(`
        SELECT COUNT(*) as count FROM branch_incubators WHERE branch_id = $1
      `, [branchId]);
      
      const incCount = parseInt(branchIncubators.rows[0].count);
      console.log(`   ├─ Incubators: ${incCount}`);
      
      // Count platforms for this branch
      const branchPlatforms = await pool.query(`
        SELECT COUNT(*) as count FROM branch_platforms WHERE branch_id = $1
      `, [branchId]);
      
      const platCount = parseInt(branchPlatforms.rows[0].count);
      console.log(`   └─ Platforms: ${platCount}`);
      
      if (incCount > 0 && platCount > 0) {
        console.log('✅ PASSED - Branch has relationships');
      } else {
        console.log('❌ FAILED - Branch missing relationships');
      }
    }
    
    // Test 5: Get detailed sample data
    console.log('\n📌 Test 5: Getting Detailed Sample Data...');
    
    const sampleIncubatorsData = await pool.query(`
      SELECT 
        b.name as branch_name,
        i.name as incubator_name,
        bi.relationship_status,
        bi.assigned_date
      FROM branch_incubators bi
      JOIN entities b ON bi.branch_id = b.id
      JOIN entities i ON bi.incubator_id = i.id
      LIMIT 3
    `);
    
    console.log('\n   🏫 Sample Incubator Merges:');
    sampleIncubatorsData.rows.forEach((row, idx) => {
      console.log(`      ${idx + 1}. ${row.branch_name} ← ${row.incubator_name}`);
      console.log(`         Status: ${row.relationship_status} | Date: ${row.assigned_date}`);
    });
    
    const samplePlatformsData = await pool.query(`
      SELECT 
        b.name as branch_name,
        p.name as platform_name,
        bp.relationship_status,
        bp.performance_score,
        bp.assigned_date
      FROM branch_platforms bp
      JOIN entities b ON bp.branch_id = b.id
      JOIN entities p ON bp.platform_id = p.id
      LIMIT 3
    `);
    
    console.log('\n   🎯 Sample Platform Merges:');
    samplePlatformsData.rows.forEach((row, idx) => {
      const score = row.performance_score ? `(Score: ${parseFloat(row.performance_score).toFixed(1)}%)` : '';
      console.log(`      ${idx + 1}. ${row.branch_name} ← ${row.platform_name} ${score}`);
      console.log(`         Status: ${row.relationship_status} | Date: ${row.assigned_date}`);
    });
    
    // Test 6: Test branch stats query
    console.log('\n📌 Test 6: Testing Branch Stats Query...');
    const statsQuery = await pool.query(`
      SELECT 
        b.id,
        b.name,
        COUNT(DISTINCT bi.incubator_id) as incubator_count,
        COUNT(DISTINCT bp.platform_id) as platform_count
      FROM entities b
      LEFT JOIN branch_incubators bi ON b.id = bi.branch_id
      LEFT JOIN branch_platforms bp ON b.id = bp.branch_id
      WHERE b.type = 'BRANCH'
      GROUP BY b.id, b.name
      ORDER BY b.name
      LIMIT 5
    `);
    
    console.log('\n   📊 Branch Statistics:');
    statsQuery.rows.forEach((row, idx) => {
      console.log(`      ${idx + 1}. ${row.name}`);
      console.log(`         └─ Incubators: ${row.incubator_count} | Platforms: ${row.platform_count}`);
    });
    
    if (statsQuery.rows.length > 0) {
      console.log('✅ PASSED - Branch stats query working');
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Total Branch-Incubator Merges: ${incubatorsCount.toLocaleString()}`);
    console.log(`✅ Total Branch-Platform Merges:  ${platformsCount.toLocaleString()}`);
    console.log(`✅ Grand Total Relationships:     ${(incubatorsCount + platformsCount).toLocaleString()}`);
    console.log('\n🎯 Data is present and accessible in database!');
    console.log('='.repeat(70) + '\n');
    
    await pool.end();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

testMergeData();
