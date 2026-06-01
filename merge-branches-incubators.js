const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function mergeBranchesIncubators() {
  try {
    console.log('\n🔄 Starting Merge: Incubators × Branches\n');
    console.log('='.repeat(60));
    
    // Create junction table for branch-incubator relationships
    console.log('\n📋 Step 1: Creating junction table branch_incubators...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branch_incubators (
        id SERIAL PRIMARY KEY,
        branch_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
        incubator_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
        relationship_status VARCHAR(20) DEFAULT 'ACTIVE',
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        UNIQUE(branch_id, incubator_id)
      )
    `);
    console.log('✅ Table branch_incubators created');
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_branch_incubators_branch ON branch_incubators(branch_id);
      CREATE INDEX IF NOT EXISTS idx_branch_incubators_incubator ON branch_incubators(incubator_id);
    `);
    console.log('✅ Indexes created');
    
    // Get all branches
    console.log('\n📋 Step 2: Fetching all branches...');
    const branchesResult = await pool.query(`
      SELECT id, name FROM entities WHERE type = 'BRANCH' ORDER BY id
    `);
    const branches = branchesResult.rows;
    console.log(`✅ Found ${branches.length} branches`);
    
    // Get all incubators
    console.log('\n📋 Step 3: Fetching all incubators...');
    const incubatorsResult = await pool.query(`
      SELECT id, name FROM entities WHERE type = 'INCUBATOR' ORDER BY id
    `);
    const incubators = incubatorsResult.rows;
    console.log(`✅ Found ${incubators.length} incubators`);
    
    // Merge: Create all combinations
    console.log('\n📋 Step 4: Creating merges (this may take a moment)...');
    let mergeCount = 0;
    let batchSize = 100;
    let currentBatch = [];
    
    for (const branch of branches) {
      for (const incubator of incubators) {
        currentBatch.push({
          branch_id: branch.id,
          incubator_id: incubator.id
        });
        
        if (currentBatch.length >= batchSize) {
          // Insert batch
          for (const merge of currentBatch) {
            try {
              await pool.query(`
                INSERT INTO branch_incubators (branch_id, incubator_id, relationship_status)
                VALUES ($1, $2, 'ACTIVE')
                ON CONFLICT (branch_id, incubator_id) DO NOTHING
              `, [merge.branch_id, merge.incubator_id]);
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
          INSERT INTO branch_incubators (branch_id, incubator_id, relationship_status)
          VALUES ($1, $2, 'ACTIVE')
          ON CONFLICT (branch_id, incubator_id) DO NOTHING
        `, [merge.branch_id, merge.incubator_id]);
        mergeCount++;
      } catch (err) {
        // Skip duplicates
      }
    }
    
    console.log(`\n✅ Created ${mergeCount} branch-incubator merges`);
    
    // Verify count
    const verifyResult = await pool.query('SELECT COUNT(*) as count FROM branch_incubators');
    const finalCount = parseInt(verifyResult.rows[0].count);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 MERGE RESULTS:');
    console.log('='.repeat(60));
    console.log(`✅ Total Merges Created: ${finalCount}`);
    console.log(`📌 Branches: ${branches.length}`);
    console.log(`📌 Incubators: ${incubators.length}`);
    console.log(`📌 Expected: ${branches.length} × ${incubators.length} = ${branches.length * incubators.length}`);
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

mergeBranchesIncubators();
