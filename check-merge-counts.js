const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkCounts() {
  try {
    console.log('\n📊 Checking Current Counts...\n');
    console.log('='.repeat(60));
    
    // Count branches
    const branchesResult = await pool.query(`
      SELECT COUNT(*) as count FROM entities WHERE type = 'BRANCH'
    `);
    const branchesCount = parseInt(branchesResult.rows[0].count);
    console.log(`\n🏢 Branches (الفروع): ${branchesCount}`);
    
    // Count incubators
    const incubatorsResult = await pool.query(`
      SELECT COUNT(*) as count FROM entities WHERE type = 'INCUBATOR'
    `);
    const incubatorsCount = parseInt(incubatorsResult.rows[0].count);
    console.log(`🏫 Incubators (الحاضنات): ${incubatorsCount}`);
    
    // Count platforms
    const platformsResult = await pool.query(`
      SELECT COUNT(*) as count FROM entities WHERE type = 'PLATFORM'
    `);
    const platformsCount = parseInt(platformsResult.rows[0].count);
    console.log(`🎯 Platforms (المنصات): ${platformsCount}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('\n💡 Expected Merges:');
    console.log(`   Incubators × Branches = ${incubatorsCount} × ${branchesCount} = ${incubatorsCount * branchesCount} merges`);
    console.log(`   Platforms × Branches = ${platformsCount} × ${branchesCount} = ${platformsCount * branchesCount} merges`);
    console.log(`   Total Merges = ${(incubatorsCount * branchesCount) + (platformsCount * branchesCount)}`);
    console.log('\n' + '='.repeat(60) + '\n');
    
    await pool.end();
    
    return {
      branches: branchesCount,
      incubators: incubatorsCount,
      platforms: platformsCount
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkCounts();
