const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function mergeBranchesPlatforms() {
  try {
    console.log('\n🔄 Starting Merge: Platforms × Branches\n');
    console.log('='.repeat(60));
    
    // Create junction table for branch-platform relationships
    console.log('\n📋 Step 1: Creating junction table branch_platforms...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branch_platforms (
        id SERIAL PRIMARY KEY,
        branch_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
        platform_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
        relationship_status VARCHAR(20) DEFAULT 'ACTIVE',
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        performance_score DECIMAL(5,2),
        monthly_revenue DECIMAL(10,2),
        notes TEXT,
        UNIQUE(branch_id, platform_id)
      )
    `);
    console.log('✅ Table branch_platforms created');
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_branch_platforms_branch ON branch_platforms(branch_id);
      CREATE INDEX IF NOT EXISTS idx_branch_platforms_platform ON branch_platforms(platform_id);
      CREATE INDEX IF NOT EXISTS idx_branch_platforms_status ON branch_platforms(relationship_status);
    `);
    console.log('✅ Indexes created');
    
    // Get all branches
    console.log('\n📋 Step 2: Fetching all branches...');
    const branchesResult = await pool.query(`
      SELECT id, name FROM entities WHERE type = 'BRANCH' ORDER BY id
    `);
    const branches = branchesResult.rows;
    console.log(`✅ Found ${branches.length} branches`);
    
    // Get all platforms
    console.log('\n📋 Step 3: Fetching all platforms...');
    const platformsResult = await pool.query(`
      SELECT id, name FROM entities WHERE type = 'PLATFORM' ORDER BY id
    `);
    const platforms = platformsResult.rows;
    console.log(`✅ Found ${platforms.length} platforms`);
    
    // Merge: Create all combinations
    console.log('\n📋 Step 4: Creating merges (this may take a moment)...');
    let mergeCount = 0;
    let batchSize = 100;
    let currentBatch = [];
    
    for (const branch of branches) {
      for (const platform of platforms) {
        currentBatch.push({
          branch_id: branch.id,
          platform_id: platform.id
        });
        
        if (currentBatch.length >= batchSize) {
          // Insert batch
          for (const merge of currentBatch) {
            try {
              await pool.query(`
                INSERT INTO branch_platforms (branch_id, platform_id, relationship_status, performance_score)
                VALUES ($1, $2, 'ACTIVE', $3)
                ON CONFLICT (branch_id, platform_id) DO NOTHING
              `, [merge.branch_id, merge.platform_id, (Math.random() * 100).toFixed(2)]);
              mergeCount++;
            } catch (err) {
              // Skip duplicates
            }
          }
          process.stdout.write(`\r   Progress: ${mergeCount} merges created...`);
          currentBatch = [];
        }
      }
    }
    
    // Insert remaining batch
    for (const merge of currentBatch) {
      try {
        await pool.query(`
          INSERT INTO branch_platforms (branch_id, platform_id, relationship_status, performance_score)
          VALUES ($1, $2, 'ACTIVE', $3)
          ON CONFLICT (branch_id, platform_id) DO NOTHING
        `, [merge.branch_id, merge.platform_id, (Math.random() * 100).toFixed(2)]);
        mergeCount++;
      } catch (err) {
        // Skip duplicates
      }
    }
    
    console.log(`\n✅ Created ${mergeCount} branch-platform merges`);
    
    // Verify count
    const verifyResult = await pool.query('SELECT COUNT(*) as count FROM branch_platforms');
    const finalCount = parseInt(verifyResult.rows[0].count);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 MERGE RESULTS:');
    console.log('='.repeat(60));
    console.log(`✅ Total Merges Created: ${finalCount}`);
    console.log(`📌 Branches: ${branches.length}`);
    console.log(`📌 Platforms: ${platforms.length}`);
    console.log(`📌 Expected: ${branches.length} × ${platforms.length} = ${branches.length * platforms.length}`);
    console.log('='.repeat(60) + '\n');
    
    await pool.end();
    
    return finalCount;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

mergeBranchesPlatforms();
