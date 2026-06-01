const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function clearOtherPlatforms() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🗑️  Clearing data from all platforms except Training Platform (ID: 1)\n');
    console.log('='.repeat(60));
    
    const TRAINING_PLATFORM_ID = 1; // منصة التدريب المهني
    
    // 1. Delete from office_platforms
    console.log('\n1️⃣ Deleting from office_platforms...');
    const officePlatforms = await client.query(`
      DELETE FROM office_platforms 
      WHERE platform_id != $1
      RETURNING platform_id
    `, [TRAINING_PLATFORM_ID]);
    console.log(`✅ Deleted ${officePlatforms.rowCount} records from office_platforms`);
    
    // 2. Delete from enrollments (if exists and has platform_id)
    console.log('\n2️⃣ Checking enrollments...');
    const enrollmentCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'enrollments' AND column_name = 'platform_id'
      )
    `);
    
    if (enrollmentCheck.rows[0].exists) {
      const enrollments = await client.query(`
        DELETE FROM enrollments 
        WHERE platform_id != $1
        RETURNING id
      `, [TRAINING_PLATFORM_ID]);
      console.log(`✅ Deleted ${enrollments.rowCount} records from enrollments`);
    } else {
      console.log('⏭️  Skipped - enrollments table has no platform_id column');
    }
    
    // 3. Delete from training_sessions (if exists and has platform_id)
    console.log('\n3️⃣ Checking training_sessions...');
    const sessionCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'training_sessions' AND column_name = 'platform_id'
      )
    `);
    
    if (sessionCheck.rows[0].exists) {
      const sessions = await client.query(`
        DELETE FROM training_sessions 
        WHERE platform_id != $1
        RETURNING id
      `, [TRAINING_PLATFORM_ID]);
      console.log(`✅ Deleted ${sessions.rowCount} records from training_sessions`);
    } else {
      console.log('⏭️  Skipped - training_sessions table has no platform_id column');
    }
    
    // 4. Delete from training_records (if exists and has platform_id)
    console.log('\n4️⃣ Checking training_records...');
    const recordCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'training_records' AND column_name = 'platform_id'
      )
    `);
    
    if (recordCheck.rows[0].exists) {
      const records = await client.query(`
        DELETE FROM training_records 
        WHERE platform_id != $1
        RETURNING id
      `, [TRAINING_PLATFORM_ID]);
      console.log(`✅ Deleted ${records.rowCount} records from training_records`);
    } else {
      console.log('⏭️  Skipped - training_records table has no platform_id column');
    }
    
    // 5. Delete from training_programs (if exists and has platform_id)
    console.log('\n5️⃣ Checking training_programs...');
    const programCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'training_programs' AND column_name = 'platform_id'
      )
    `);
    
    if (programCheck.rows[0].exists) {
      const programs = await client.query(`
        DELETE FROM training_programs 
        WHERE platform_id != $1
        RETURNING id
      `, [TRAINING_PLATFORM_ID]);
      console.log(`✅ Deleted ${programs.rowCount} records from training_programs`);
    } else {
      console.log('⏭️  Skipped - training_programs table has no platform_id column');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Successfully cleared data from other platforms');
    console.log('✅ Training Platform (منصة التدريب المهني) data preserved');
    
    // Verify
    console.log('\n📊 Verification:');
    const verification = await client.query(`
      SELECT platform_id, COUNT(*) as count 
      FROM office_platforms 
      GROUP BY platform_id
      ORDER BY platform_id
    `);
    
    if (verification.rows.length > 0) {
      verification.rows.forEach(v => {
        console.log(`  Platform ${v.platform_id}: ${v.count} office links`);
      });
    } else {
      console.log('  No office_platforms links found');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

clearOtherPlatforms();
