const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkOfficesSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking offices table schema...\n');
    
    // Get table schema
    const schemaResult = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'offices'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Offices table columns:');
    schemaResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    console.log('');
    
    // Get sample data
    const dataResult = await client.query(`
      SELECT *
      FROM offices
      LIMIT 5
    `);
    
    console.log('📊 Sample data (first 5 rows):');
    console.log(JSON.stringify(dataResult.rows, null, 2));
    console.log('');
    
    // Count total offices
    const countResult = await client.query(`SELECT COUNT(*) as count FROM offices`);
    console.log(`📊 Total offices: ${countResult.rows[0].count}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkOfficesSchema().catch(console.error);
