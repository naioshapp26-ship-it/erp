const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testIncubatorPlatforms() {
  try {
    console.log('🔍 Testing Incubator Platforms Issue...\n');
    
    // 1. Check headquarters
    console.log('1️⃣ Checking headquarters:');
    const hqResult = await pool.query(`
      SELECT id, entity_id, name FROM headquarters ORDER BY id
    `);
    console.log('Headquarters:', hqResult.rows);
    
    // 2. Check incubators
    console.log('\n2️⃣ Checking incubators:');
    const incResult = await pool.query(`
      SELECT id, entity_id, name, headquarters_id FROM incubators ORDER BY id
    `);
    console.log('Incubators:', incResult.rows);
    
    // 3. Check if platforms are linked to HQ or to incubators
    console.log('\n3️⃣ Checking platforms table structure:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'platforms' 
      ORDER BY ordinal_position
    `);
    console.log('Platforms columns:', columnsResult.rows);
    
    // 4. Check platforms data
    console.log('\n4️⃣ Checking platforms:');
    const platformsResult = await pool.query(`
      SELECT id, name, incubator_id, description, code FROM platforms ORDER BY id LIMIT 10
    `);
    console.log('Platforms:', platformsResult.rows);
    
    // 5. Try to find incubator for HQ001
    console.log('\n5️⃣ Finding incubator for HQ001:');
    const incForHq = await pool.query(`
      SELECT i.id, i.entity_id, i.name, i.headquarters_id, h.entity_id as hq_entity_id
      FROM incubators i
      JOIN headquarters h ON i.headquarters_id = h.id
      WHERE h.entity_id = 'HQ001'
    `);
    console.log('Incubators for HQ001:', incForHq.rows);
    
    // 6. Check if there are platforms for these incubators
    if (incForHq.rows.length > 0) {
      console.log('\n6️⃣ Checking platforms for these incubators:');
      const incIds = incForHq.rows.map(r => r.id);
      const platformsForInc = await pool.query(`
        SELECT p.*, i.entity_id as incubator_entity_id
        FROM platforms p
        JOIN incubators i ON p.incubator_id = i.id
        WHERE i.id = ANY($1)
      `, [incIds]);
      console.log('Platforms for incubators:', platformsForInc.rows);
    }
    
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testIncubatorPlatforms();
