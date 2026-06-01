const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkAndUnlockOffices() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking for locked accounts related to offices...\n');
    
    // Check credentials table for locked accounts
    const lockedCredsResult = await client.query(`
      SELECT 
        id,
        username,
        office_id,
        is_locked,
        lock_reason,
        failed_login_attempts,
        last_failed_login
      FROM credentials
      WHERE is_locked = true OR failed_login_attempts > 0
      ORDER BY id
    `);
    
    if (lockedCredsResult.rows.length > 0) {
      console.log(`❌ Found ${lockedCredsResult.rows.length} locked or failed credentials:\n`);
      lockedCredsResult.rows.forEach(cred => {
        console.log(`   - ID: ${cred.id}, Username: ${cred.username}, Office: ${cred.office_id}`);
        console.log(`     Locked: ${cred.is_locked}, Failed attempts: ${cred.failed_login_attempts}`);
        console.log(`     Lock reason: ${cred.lock_reason || 'N/A'}`);
        console.log(`     Last failed: ${cred.last_failed_login || 'N/A'}`);
        console.log('');
      });
      
      // Unlock all credentials
      console.log('🔓 Unlocking all credentials...\n');
      
      const unlockResult = await client.query(`
        UPDATE credentials
        SET 
          is_locked = false,
          lock_reason = NULL,
          failed_login_attempts = 0,
          last_failed_login = NULL,
          updated_at = NOW()
        WHERE is_locked = true OR failed_login_attempts > 0
        RETURNING id, username, office_id
      `);
      
      console.log(`✅ Unlocked ${unlockResult.rows.length} credentials:\n`);
      unlockResult.rows.forEach(cred => {
        console.log(`   - ID: ${cred.id}, Username: ${cred.username}, Office: ${cred.office_id}`);
      });
      console.log('');
    } else {
      console.log('✅ No locked credentials found.\n');
    }
    
    // Check all offices status
    console.log('🔍 Checking all offices status...\n');
    
    const officesResult = await client.query(`
      SELECT 
        id,
        name,
        code,
        incubator_id,
        is_active
      FROM offices
      ORDER BY id
    `);
    
    const inactiveOffices = officesResult.rows.filter(o => !o.is_active);
    
    if (inactiveOffices.length > 0) {
      console.log(`❌ Found ${inactiveOffices.length} inactive offices:\n`);
      inactiveOffices.forEach(office => {
        console.log(`   - Office ${office.id}: ${office.name} (Code: ${office.code})`);
      });
      console.log('');
      
      // Activate all offices
      console.log('✅ Activating all offices...\n');
      
      const activateResult = await client.query(`
        UPDATE offices
        SET 
          is_active = true,
          updated_at = NOW()
        WHERE is_active = false
        RETURNING id, name, code
      `);
      
      console.log(`✅ Activated ${activateResult.rows.length} offices:\n`);
      activateResult.rows.forEach(office => {
        console.log(`   - Office ${office.id}: ${office.name} (Code: ${office.code})`);
      });
      console.log('');
    } else {
      console.log('✅ All offices are already active.\n');
    }
    
    // Check specifically office 39
    console.log('🏢 Checking office 39 specifically...\n');
    
    const office39Result = await client.query(`
      SELECT 
        o.id,
        o.name,
        o.code,
        o.is_active as office_active,
        o.incubator_id,
        i.name as incubator_name,
        i.is_active as incubator_active
      FROM offices o
      LEFT JOIN incubators i ON o.incubator_id = i.id
      WHERE o.id = 39
    `);
    
    if (office39Result.rows.length > 0) {
      const office = office39Result.rows[0];
      console.log(`📋 Office 39 details:`);
      console.log(`   - Name: ${office.name}`);
      console.log(`   - Code: ${office.code}`);
      console.log(`   - Office Active: ${office.office_active ? '✅ Yes' : '❌ No'}`);
      console.log(`   - Incubator ID: ${office.incubator_id}`);
      console.log(`   - Incubator Name: ${office.incubator_name || 'N/A'}`);
      console.log(`   - Incubator Active: ${office.incubator_active ? '✅ Yes' : '❌ No'}`);
      console.log('');
      
      // Check credentials for office 39
      const creds39Result = await client.query(`
        SELECT 
          id,
          username,
          is_locked,
          failed_login_attempts,
          is_active
        FROM credentials
        WHERE office_id = 39
      `);
      
      if (creds39Result.rows.length > 0) {
        console.log(`🔑 Credentials for office 39:`);
        creds39Result.rows.forEach(cred => {
          console.log(`   - Username: ${cred.username}`);
          console.log(`     Active: ${cred.is_active ? '✅ Yes' : '❌ No'}`);
          console.log(`     Locked: ${cred.is_locked ? '❌ Yes' : '✅ No'}`);
          console.log(`     Failed attempts: ${cred.failed_login_attempts}`);
        });
        console.log('');
      }
    } else {
      console.log('❌ Office 39 not found!\n');
    }
    
    // Final summary
    console.log('📊 Final Summary:\n');
    
    const summaryResult = await client.query(`
      SELECT 
        COUNT(*) as total_offices,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_offices,
        SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_offices
      FROM offices
    `);
    
    const summary = summaryResult.rows[0];
    console.log(`   - Total offices: ${summary.total_offices}`);
    console.log(`   - Active offices: ${summary.active_offices}`);
    console.log(`   - Inactive offices: ${summary.inactive_offices}`);
    console.log(`   - Status: ${summary.inactive_offices === '0' ? '✅ ALL OFFICES ACTIVE' : '⚠️  Some offices inactive'}`);
    console.log('');
    
    const credsSummaryResult = await client.query(`
      SELECT 
        COUNT(*) as total_credentials,
        SUM(CASE WHEN is_locked = true THEN 1 ELSE 0 END) as locked_credentials,
        SUM(CASE WHEN failed_login_attempts > 0 THEN 1 ELSE 0 END) as failed_credentials
      FROM credentials
    `);
    
    const credsSummary = credsSummaryResult.rows[0];
    console.log(`   - Total credentials: ${credsSummary.total_credentials}`);
    console.log(`   - Locked credentials: ${credsSummary.locked_credentials}`);
    console.log(`   - Credentials with failed attempts: ${credsSummary.failed_credentials}`);
    console.log(`   - Status: ${credsSummary.locked_credentials === '0' ? '✅ NO LOCKED CREDENTIALS' : '⚠️  Some credentials locked'}`);
    
    console.log('\n✅ All checks and fixes completed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndUnlockOffices().catch(console.error);
