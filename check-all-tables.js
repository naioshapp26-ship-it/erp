const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkAllTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking all tables in database...\n');
    
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`📋 Found ${tablesResult.rows.length} tables:\n`);
    tablesResult.rows.forEach(table => {
      console.log(`   - ${table.table_name} (${table.table_type})`);
    });
    console.log('');
    
    // Look for user-related tables
    const userTables = tablesResult.rows.filter(t => 
      t.table_name.includes('user') || 
      t.table_name.includes('account') || 
      t.table_name.includes('auth') ||
      t.table_name.includes('login') ||
      t.table_name.includes('credential')
    );
    
    if (userTables.length > 0) {
      console.log('👤 User/Auth related tables:');
      userTables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAllTables().catch(console.error);
