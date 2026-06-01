const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkPlatformData() {
  try {
    console.log('🔍 Checking platform data...\n');
    
    // 1. Get all platforms
    console.log('1️⃣ Getting all platforms:');
    const platforms = await pool.query(`
      SELECT id, name, code FROM platforms ORDER BY id
    `);
    console.log('Platforms:');
    platforms.rows.forEach(p => {
      console.log(`  - ${p.name} (${p.code}) [ID: ${p.id}]`);
    });
    
    // Find the training platform
    const trainingPlatform = platforms.rows.find(p => 
      p.code === 'PLT-TR-01' || p.name.includes('التدريب المهني')
    );
    
    if (!trainingPlatform) {
      console.log('\n⚠️  Warning: Training platform not found!');
    } else {
      console.log(`\n✅ Training platform found: ${trainingPlatform.name} [ID: ${trainingPlatform.id}]`);
    }
    
    // 2. Check what tables exist that might have platform-related data
    console.log('\n2️⃣ Checking tables with platform-related data:');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const relevantTables = tables.rows.filter(t => 
      t.table_name.includes('enrollment') ||
      t.table_name.includes('training') ||
      t.table_name.includes('student') ||
      t.table_name.includes('course') ||
      t.table_name.includes('session') ||
      t.table_name.includes('office_platform') ||
      t.table_name.includes('platform')
    );
    
    console.log('Relevant tables:', relevantTables.map(t => t.table_name).join(', '));
    
    // 3. Check data in each relevant table
    for (const table of relevantTables) {
      const tableName = table.table_name;
      
      // Check if table has platform_id column
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [tableName]);
      
      const hasPlatformId = columns.rows.some(c => c.column_name === 'platform_id');
      
      if (hasPlatformId) {
        console.log(`\n3️⃣ Table: ${tableName}`);
        
        // Count records per platform
        const counts = await pool.query(`
          SELECT platform_id, COUNT(*) as count 
          FROM ${tableName} 
          GROUP BY platform_id
          ORDER BY platform_id
        `);
        
        if (counts.rows.length > 0) {
          counts.rows.forEach(c => {
            const platform = platforms.rows.find(p => p.id === c.platform_id);
            const platformName = platform ? platform.name : 'Unknown';
            const isTraining = platform && platform.id === (trainingPlatform ? trainingPlatform.id : -1);
            const marker = isTraining ? '✅' : '🔹';
            console.log(`  ${marker} Platform ${c.platform_id} (${platformName}): ${c.count} records`);
          });
        } else {
          console.log('  (no records)');
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

checkPlatformData();
