const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function unlockAllOfficesAndUsers() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Step 1: Checking user_credentials schema...\n');
    
    // Check user_credentials schema
    const schemaResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_credentials'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 user_credentials columns:');
    schemaResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    console.log('');
    
    // Check users schema
    const usersSchemaResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 users table columns:');
    usersSchemaResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    console.log('');
    
    console.log('🔍 Step 2: Checking for locked/inactive users...\n');
    
    // Check for locked or inactive users
    const lockedUsersResult = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.office_id,
        u.is_active,
        uc.username,
        uc.failed_attempts,
        uc.locked_until
      FROM users u
      LEFT JOIN user_credentials uc ON u.id = uc.user_id
      WHERE u.is_active = false OR uc.locked_until IS NOT NULL OR uc.failed_attempts > 0
      ORDER BY u.id
    `);
    
    if (lockedUsersResult.rows.length > 0) {
      console.log(`❌ Found ${lockedUsersResult.rows.length} locked/inactive users:\n`);
      lockedUsersResult.rows.forEach(user => {
        console.log(`   - User ID: ${user.id}, Name: ${user.name}, Username: ${user.username}, Office: ${user.office_id}`);
        console.log(`     Active: ${user.is_active}, Failed attempts: ${user.failed_attempts}`);
        if (user.locked_until) console.log(`     Locked until: ${user.locked_until}`);
        console.log('');
      });
      
      // Unlock all user_credentials
      console.log('🔓 Step 3: Unlocking all user_credentials...\n');
      
      const unlockCredsResult = await client.query(`
        UPDATE user_credentials
        SET 
          locked_until = NULL,
          failed_attempts = 0,
          updated_at = NOW()
        WHERE locked_until IS NOT NULL OR failed_attempts > 0
        RETURNING user_id
      `);
      
      console.log(`✅ Unlocked ${unlockCredsResult.rows.length} user credentials\n`);
      
      // Activate all users
      console.log('✅ Step 4: Activating all users...\n');
      
      const activateUsersResult = await client.query(`
        UPDATE users
        SET 
          is_active = true,
          updated_at = NOW()
        WHERE is_active = false
        RETURNING id, name, office_id
      `);
      
      if (activateUsersResult.rows.length > 0) {
        console.log(`✅ Activated ${activateUsersResult.rows.length} users:\n`);
        activateUsersResult.rows.forEach(user => {
          console.log(`   - User ID: ${user.id}, Name: ${user.name}, Office: ${user.office_id}`);
        });
        console.log('');
      }
    } else {
      console.log('✅ No locked or inactive users found.\n');
    }
    
    console.log('🔍 Step 5: Checking all offices...\n');
    
    // Check offices
    const officesResult = await client.query(`
      SELECT id, name, is_active, incubator_id
      FROM offices
      ORDER BY id
    `);
    
    const inactiveOffices = officesResult.rows.filter(o => !o.is_active);
    
    if (inactiveOffices.length > 0) {
      console.log(`❌ Found ${inactiveOffices.length} inactive offices:\n`);
      inactiveOffices.forEach(office => {
        console.log(`   - Office ${office.id}: ${office.name}`);
      });
      console.log('');
      
      // Activate all offices
      console.log('✅ Step 6: Activating all offices...\n');
      
      const activateOfficesResult = await client.query(`
        UPDATE offices
        SET 
          is_active = true,
          updated_at = NOW()
        WHERE is_active = false
        RETURNING id, name
      `);
      
      console.log(`✅ Activated ${activateOfficesResult.rows.length} offices:\n`);
      activateOfficesResult.rows.forEach(office => {
        console.log(`   - Office ${office.id}: ${office.name}`);
      });
      console.log('');
    } else {
      console.log('✅ All offices are already active.\n');
    }
    
    // Check office 39 specifically
    console.log('🏢 Step 7: Checking office 39 and its users...\n');
    
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
      console.log(`📋 Office 39:`);
      console.log(`   - Name: ${office.name}`);
      console.log(`   - Code: ${office.code}`);
      console.log(`   - Office Active: ${office.office_active ? '✅ Yes' : '❌ No'}`);
      console.log(`   - Incubator: ${office.incubator_name || 'N/A'} (ID: ${office.incubator_id})`);
      console.log(`   - Incubator Active: ${office.incubator_active ? '✅ Yes' : '❌ No'}`);
      console.log('');
      
      // Check users for office 39
      const users39Result = await client.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.is_active,
          uc.username,
          uc.failed_attempts,
          uc.locked_until
        FROM users u
        LEFT JOIN user_credentials uc ON u.id = uc.user_id
        WHERE u.office_id = 39
        ORDER BY u.id
      `);
      
      if (users39Result.rows.length > 0) {
        console.log(`👤 Users in office 39 (${users39Result.rows.length} total):\n`);
        users39Result.rows.forEach(user => {
          console.log(`   - ${user.name} (Username: ${user.username}, ID: ${user.id})`);
          console.log(`     Email: ${user.email || 'N/A'}`);
          console.log(`     Active: ${user.is_active ? '✅ Yes' : '❌ No'}`);
          console.log(`     Locked until: ${user.locked_until || '✅ Not locked'}`);
          console.log(`     Failed attempts: ${user.failed_attempts || 0}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No users found for office 39\n');
      }
      
      // Check if incubator is inactive
      if (!office.incubator_active) {
        console.log('⚠️  Office 39\'s incubator is INACTIVE! Activating...\n');
        
        await client.query(`
          UPDATE incubators
          SET is_active = true, updated_at = NOW()
          WHERE id = $1
        `, [office.incubator_id]);
        
        console.log('✅ Incubator activated!\n');
      }
    } else {
      console.log('❌ Office 39 not found!\n');
    }
    
    // Final summary
    console.log('📊 Final Summary:\n');
    
    const summaryResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM offices) as total_offices,
        (SELECT COUNT(*) FROM offices WHERE is_active = true) as active_offices,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
        (SELECT COUNT(*) FROM user_credentials WHERE locked_until IS NOT NULL) as locked_credentials,
        (SELECT COUNT(*) FROM incubators) as total_incubators,
        (SELECT COUNT(*) FROM incubators WHERE is_active = true) as active_incubators
    `);
    
    const summary = summaryResult.rows[0];
    console.log(`   📍 Offices: ${summary.active_offices}/${summary.total_offices} active`);
    console.log(`   👤 Users: ${summary.active_users}/${summary.total_users} active`);
    console.log(`   🔒 Locked credentials: ${summary.locked_credentials}`);
    console.log(`   🏢 Incubators: ${summary.active_incubators}/${summary.total_incubators} active`);
    console.log('');
    
    if (summary.locked_credentials === '0' && 
        summary.active_offices === summary.total_offices &&
        summary.active_users === summary.total_users &&
        summary.active_incubators === summary.total_incubators) {
      console.log('✅✅✅ ALL SYSTEMS ACTIVE - NO LOCKED ACCOUNTS! ✅✅✅\n');
    } else {
      console.log('⚠️  Some items may still need attention\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

unlockAllOfficesAndUsers().catch(console.error);
