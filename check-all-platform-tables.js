const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkAllTables() {
  try {
    console.log('🔍 Checking all tables for platform-related data...\n');
    
    // Get all tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} tables\n`);
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      // Get columns
      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      const columnNames = columns.rows.map(c => c.column_name);
      
      // Check if table has platform_id
      if (columnNames.includes('platform_id')) {
        console.log(`\n📋 Table: ${tableName}`);
        console.log(`   Columns: ${columnNames.join(', ')}`);
        
        // Count records per platform
        try {
          const counts = await pool.query(`
            SELECT platform_id, COUNT(*) as count 
            FROM ${tableName} 
            GROUP BY platform_id
            ORDER BY platform_id
          `);
          
          if (counts.rows.length > 0) {
            counts.rows.forEach(c => {
              const marker = c.platform_id === 1 ? '✅' : '🔹';
              console.log(`   ${marker} Platform ${c.platform_id}: ${c.count} records`);
            });
          } else {
            console.log('   (empty table)');
          }
        } catch (error) {
          console.log(`   ⚠️  Error counting: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Check completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAllTables();
