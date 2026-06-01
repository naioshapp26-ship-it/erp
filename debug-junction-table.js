const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkJunctionTable() {
  try {
    console.log('\n🔍 Checking branch_incubators table...\n');
    
    // Check table structure
    const structure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branch_incubators'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Table Structure:');
    structure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    // Check sample data
    const sample = await pool.query(`
      SELECT * FROM branch_incubators LIMIT 5
    `);
    
    console.log('\n📊 Sample Data (first 5 rows):');
    sample.rows.forEach((row, idx) => {
      console.log(`\n   ${idx + 1}. Branch ID: ${row.branch_id} (type: ${typeof row.branch_id})`);
      console.log(`      Incubator ID: ${row.incubator_id} (type: ${typeof row.incubator_id})`);
      console.log(`      Status: ${row.relationship_status}`);
    });
    
    // Check if BR027 exists
    const br027 = await pool.query(`
      SELECT COUNT(*) as count FROM branch_incubators WHERE branch_id = 'BR027'
    `);
    
    console.log(`\n🔍 Branch BR027: ${br027.rows[0].count} relationships found`);
    
    // Check entities table for BR027
    const entity = await pool.query(`
      SELECT id, name, type FROM entities WHERE id = 'BR027'
    `);
    
    console.log('\n📌 Entity BR027:');
    if (entity.rows.length > 0) {
      console.log(`   Name: ${entity.rows[0].name}`);
      console.log(`   Type: ${entity.rows[0].type}`);
    } else {
      console.log('   NOT FOUND');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

checkJunctionTable();
