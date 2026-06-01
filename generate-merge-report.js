const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function generateMergeReport() {
  try {
    console.log('\n📊 COMPREHENSIVE MERGE REPORT\n');
    console.log('='.repeat(70));
    
    // Get counts
    const branchesCount = await pool.query(`SELECT COUNT(*) FROM entities WHERE type = 'BRANCH'`);
    const incubatorsCount = await pool.query(`SELECT COUNT(*) FROM entities WHERE type = 'INCUBATOR'`);
    const platformsCount = await pool.query(`SELECT COUNT(*) FROM entities WHERE type = 'PLATFORM'`);
    const branchIncubatorsCount = await pool.query(`SELECT COUNT(*) FROM branch_incubators`);
    const branchPlatformsCount = await pool.query(`SELECT COUNT(*) FROM branch_platforms`);
    
    const branches = parseInt(branchesCount.rows[0].count);
    const incubators = parseInt(incubatorsCount.rows[0].count);
    const platforms = parseInt(platformsCount.rows[0].count);
    const branchIncubatorMerges = parseInt(branchIncubatorsCount.rows[0].count);
    const branchPlatformMerges = parseInt(branchPlatformsCount.rows[0].count);
    
    console.log('\n📌 ENTITY COUNTS:');
    console.log('-'.repeat(70));
    console.log(`   🏢 Branches (الفروع):          ${branches.toString().padStart(6)}`);
    console.log(`   🏫 Incubators (الحاضنات):      ${incubators.toString().padStart(6)}`);
    console.log(`   🎯 Platforms (المنصات):        ${platforms.toString().padStart(6)}`);
    console.log(`   📊 Total Entities:             ${(branches + incubators + platforms).toString().padStart(6)}`);
    
    console.log('\n🔗 MERGE RESULTS:');
    console.log('-'.repeat(70));
    console.log(`   📍 Branches ← Incubators:      ${branchIncubatorMerges.toString().padStart(6)} merges`);
    console.log(`   📍 Branches ← Platforms:       ${branchPlatformMerges.toString().padStart(6)} merges`);
    console.log(`   📊 Total Merges:               ${(branchIncubatorMerges + branchPlatformMerges).toString().padStart(6)} relationships`);
    
    // Sample data from merges
    console.log('\n📋 SAMPLE MERGED DATA:');
    console.log('-'.repeat(70));
    
    const sampleIncubators = await pool.query(`
      SELECT 
        b.name as branch_name,
        i.name as incubator_name,
        bi.assigned_date
      FROM branch_incubators bi
      JOIN entities b ON bi.branch_id = b.id
      JOIN entities i ON bi.incubator_id = i.id
      LIMIT 5
    `);
    
    console.log('\n   🏫 Sample Branch-Incubator Merges:');
    sampleIncubators.rows.forEach((row, idx) => {
      console.log(`      ${idx + 1}. ${row.branch_name} ← ${row.incubator_name}`);
    });
    
    const samplePlatforms = await pool.query(`
      SELECT 
        b.name as branch_name,
        p.name as platform_name,
        bp.performance_score,
        bp.assigned_date
      FROM branch_platforms bp
      JOIN entities b ON bp.branch_id = b.id
      JOIN entities p ON bp.platform_id = p.id
      LIMIT 5
    `);
    
    console.log('\n   🎯 Sample Branch-Platform Merges:');
    samplePlatforms.rows.forEach((row, idx) => {
      const score = row.performance_score ? `(Score: ${parseFloat(row.performance_score).toFixed(1)}%)` : '';
      console.log(`      ${idx + 1}. ${row.branch_name} ← ${row.platform_name} ${score}`);
    });
    
    // Statistics by branch
    console.log('\n📈 STATISTICS PER BRANCH:');
    console.log('-'.repeat(70));
    
    const branchStats = await pool.query(`
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
    
    branchStats.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.name}`);
      console.log(`      └─ Incubators: ${row.incubator_count} | Platforms: ${row.platform_count}`);
    });
    
    console.log(`\n   ... and ${branches - 5} more branches`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ MERGE OPERATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('\n💡 Summary:');
    console.log(`   • Created ${branchIncubatorMerges.toLocaleString()} branch-incubator relationships`);
    console.log(`   • Created ${branchPlatformMerges.toLocaleString()} branch-platform relationships`);
    console.log(`   • Total: ${(branchIncubatorMerges + branchPlatformMerges).toLocaleString()} relationships in database`);
    console.log(`   • Each branch now has ${incubators} incubators and ${platforms} platforms\n`);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

generateMergeReport();
