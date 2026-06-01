const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function activateAllOffices() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking current office status...\n');
    
    // Check current offices status
    const checkResult = await client.query(`
      SELECT 
        office_id,
        office_name,
        is_active,
        status,
        created_at
      FROM offices
      ORDER BY office_id
    `);
    
    console.log(`📊 Total offices found: ${checkResult.rows.length}\n`);
    
    // Show inactive offices
    const inactiveOffices = checkResult.rows.filter(office => 
      office.is_active === false || office.status === 'inactive' || office.status === 'locked'
    );
    
    if (inactiveOffices.length > 0) {
      console.log(`❌ Inactive/Locked offices (${inactiveOffices.length}):`);
      inactiveOffices.forEach(office => {
        console.log(`   - Office ${office.office_id}: ${office.office_name} (is_active: ${office.is_active}, status: ${office.status})`);
      });
      console.log('');
    }
    
    // Activate all offices
    console.log('✅ Activating all offices...\n');
    
    const updateResult = await client.query(`
      UPDATE offices 
      SET 
        is_active = true,
        status = 'active',
        updated_at = NOW()
      WHERE is_active = false OR status != 'active'
      RETURNING office_id, office_name, is_active, status
    `);
    
    if (updateResult.rows.length > 0) {
      console.log(`✅ Updated ${updateResult.rows.length} offices:`);
      updateResult.rows.forEach(office => {
        console.log(`   - Office ${office.office_id}: ${office.office_name} → is_active: ${office.is_active}, status: ${office.status}`);
      });
      console.log('');
    } else {
      console.log('ℹ️  All offices were already active.\n');
    }
    
    // Verify all offices are now active
    console.log('🔍 Verifying all offices are now active...\n');
    
    const verifyResult = await client.query(`
      SELECT 
        office_id,
        office_name,
        is_active,
        status,
        COUNT(*) OVER() as total_offices,
        SUM(CASE WHEN is_active = true AND status = 'active' THEN 1 ELSE 0 END) OVER() as active_count
      FROM offices
      ORDER BY office_id
    `);
    
    if (verifyResult.rows.length > 0) {
      const { total_offices, active_count } = verifyResult.rows[0];
      console.log(`📊 Summary:`);
      console.log(`   - Total offices: ${total_offices}`);
      console.log(`   - Active offices: ${active_count}`);
      console.log(`   - Status: ${active_count === total_offices ? '✅ ALL OFFICES ACTIVE' : '⚠️  Some offices still inactive'}\n`);
      
      // Check specifically office 39
      const office39 = verifyResult.rows.find(o => o.office_id === 39);
      if (office39) {
        console.log(`🏢 Office 39 (من سؤال المستخدم):`);
        console.log(`   - Name: ${office39.office_name}`);
        console.log(`   - is_active: ${office39.is_active}`);
        console.log(`   - status: ${office39.status}`);
        console.log(`   - Status: ${office39.is_active && office39.status === 'active' ? '✅ ACTIVE' : '❌ INACTIVE'}\n`);
      } else {
        console.log(`⚠️  Office 39 not found in database\n`);
      }
      
      // Show any remaining inactive offices
      const stillInactive = verifyResult.rows.filter(office => 
        office.is_active === false || office.status !== 'active'
      );
      
      if (stillInactive.length > 0) {
        console.log(`❌ Still inactive offices (${stillInactive.length}):`);
        stillInactive.forEach(office => {
          console.log(`   - Office ${office.office_id}: ${office.office_name} (is_active: ${office.is_active}, status: ${office.status})`);
        });
      }
    }
    
    console.log('\n✅ All offices have been activated successfully!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

activateAllOffices().catch(console.error);
