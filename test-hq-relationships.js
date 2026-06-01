const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testRelationships() {
  try {
    console.log('🔍 Testing HQ -> Branches -> Incubators -> Platforms...\n');
    
    // 1. Get HQ001
    console.log('1️⃣ Getting HQ001:');
    const hq = await pool.query(`SELECT * FROM headquarters WHERE entity_id = 'HQ001'`);
    console.log('HQ:', hq.rows[0]);
    
    if (hq.rows.length === 0) {
      console.log('❌ HQ001 not found');
      return;
    }
    
    const hqId = hq.rows[0].id;
    
    // 2. Get branches for this HQ
    console.log('\n2️⃣ Getting branches for HQ001:');
    const branches = await pool.query(`SELECT * FROM branches WHERE headquarters_id = $1`, [hqId]);
    console.log('Branches:', branches.rows);
    
    if (branches.rows.length === 0) {
      console.log('⚠️  No branches found for HQ001');
      return;
    }
    
    const branchIds = branches.rows.map(b => b.id);
    
    // 3. Get incubators for these branches
    console.log('\n3️⃣ Getting incubators for these branches:');
    const incubators = await pool.query(`
      SELECT i.*, b.entity_id as branch_entity_id, b.name as branch_name
      FROM incubators i
      JOIN branches b ON i.branch_id = b.id
      WHERE i.branch_id = ANY($1)
    `, [branchIds]);
    console.log('Incubators:', incubators.rows);
    
    if (incubators.rows.length === 0) {
      console.log('⚠️  No incubators found for these branches');
      return;
    }
    
    const incubatorIds = incubators.rows.map(i => i.id);
    
    // 4. Get platforms for these incubators
    console.log('\n4️⃣ Getting platforms for these incubators:');
    const platforms = await pool.query(`
      SELECT p.*, i.name as incubator_name, i.entity_id as incubator_entity_id
      FROM platforms p
      JOIN incubators i ON p.incubator_id = i.id
      WHERE p.incubator_id = ANY($1)
    `, [incubatorIds]);
    console.log('Platforms:', platforms.rows);
    
    console.log('\n✅ Test completed');
    console.log('\n📊 Summary:');
    console.log('- HQ: 1');
    console.log('- Branches:', branches.rows.length);
    console.log('- Incubators:', incubators.rows.length);
    console.log('- Platforms:', platforms.rows.length);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testRelationships();
