const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function deletePlatforms() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🗑️  Deleting all platforms except Training Platform (منصة التدريب المهني)\n');
    console.log('='.repeat(70));
    
    const TRAINING_PLATFORM_ID = 1;
    
    // 1. First, get list of platforms to be deleted
    console.log('\n1️⃣ Platforms to be deleted:');
    const platformsToDelete = await client.query(`
      SELECT id, name, code 
      FROM platforms 
      WHERE id != $1
      ORDER BY id
    `, [TRAINING_PLATFORM_ID]);
    
    if (platformsToDelete.rows.length === 0) {
      console.log('✅ No platforms to delete (only Training Platform exists)');
      await client.query('ROLLBACK');
      return;
    }
    
    platformsToDelete.rows.forEach(p => {
      console.log(`   🔹 Platform #${p.id}: ${p.name} (${p.code})`);
    });
    
    // 2. Delete platforms (CASCADE will handle related data)
    console.log('\n2️⃣ Deleting platforms and related data...');
    const deleteResult = await client.query(`
      DELETE FROM platforms 
      WHERE id != $1
      RETURNING id, name, code
    `, [TRAINING_PLATFORM_ID]);
    
    console.log(`✅ Deleted ${deleteResult.rowCount} platform(s)`);
    deleteResult.rows.forEach(p => {
      console.log(`   ✅ Deleted: ${p.name} (${p.code}) [ID: ${p.id}]`);
    });
    
    // 3. Commit transaction
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Successfully deleted all platforms except Training Platform');
    console.log('✅ Training Platform (منصة التدريب المهني) preserved with all its data');
    console.log('='.repeat(70));
    
    // 4. Verify
    console.log('\n📊 Verification - Remaining platforms:');
    const remaining = await client.query(`
      SELECT id, name, code FROM platforms ORDER BY id
    `);
    
    if (remaining.rows.length > 0) {
      remaining.rows.forEach(p => {
        console.log(`   ✅ ${p.name} (${p.code}) [ID: ${p.id}]`);
      });
    } else {
      console.log('   ⚠️  No platforms found!');
    }
    
    // Check office_platforms
    console.log('\n📊 Office links for Training Platform:');
    const officeLinks = await client.query(`
      SELECT COUNT(*) as count FROM office_platforms WHERE platform_id = $1
    `, [TRAINING_PLATFORM_ID]);
    console.log(`   Office links: ${officeLinks.rows[0].count}`);
    
    // Check employees
    const employees = await client.query(`
      SELECT COUNT(*) as count FROM employees WHERE platform_id = $1
    `, [TRAINING_PLATFORM_ID]);
    console.log(`   Employees: ${employees.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deletePlatforms();
