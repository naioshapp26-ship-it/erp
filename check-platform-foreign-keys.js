const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkForeignKeys() {
  try {
    console.log('🔍 Checking foreign key constraints on platforms table...\n');
    
    // Check all foreign keys referencing platforms table
    const fkCheck = await pool.query(`
      SELECT
        tc.table_name, 
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'platforms'
      ORDER BY tc.table_name
    `);
    
    console.log('Foreign keys referencing platforms:');
    if (fkCheck.rows.length > 0) {
      fkCheck.rows.forEach(fk => {
        console.log(`  - ${fk.table_name}.${fk.column_name} -> platforms.${fk.foreign_column_name}`);
        console.log(`    Delete Rule: ${fk.delete_rule}`);
      });
    } else {
      console.log('  No foreign keys found (or NO ACTION by default)');
    }
    
    // Check data in tables that might reference platforms
    console.log('\n📊 Checking data that references platforms (excluding Training Platform ID=1):\n');
    
    const tables = ['office_platforms', 'employees', 'users', 'entities'];
    
    for (const table of tables) {
      try {
        // Check if table has platform_id column
        const colCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = 'platform_id'
          )
        `, [table]);
        
        if (colCheck.rows[0].exists) {
          const count = await pool.query(`
            SELECT COUNT(*) as count 
            FROM ${table} 
            WHERE platform_id IS NOT NULL 
              AND platform_id != 1
          `, []);
          
          console.log(`${table}: ${count.rows[0].count} records referencing other platforms`);
        }
      } catch (error) {
        console.log(`${table}: Error - ${error.message}`);
      }
    }
    
    console.log('\n✅ Check completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkForeignKeys();
