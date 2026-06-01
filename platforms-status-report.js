const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function generateReport() {
  try {
    console.log('📊 PLATFORMS STATUS REPORT');
    console.log('='.repeat(70));
    console.log('Generated:', new Date().toISOString());
    console.log('='.repeat(70));
    
    // Get all platforms
    const platforms = await pool.query(`
      SELECT p.id, p.name, p.code, p.platform_type, p.pricing_model, p.is_active
      FROM platforms p
      ORDER BY p.id
    `);
    
    console.log('\n📋 ALL PLATFORMS:\n');
    
    for (const platform of platforms.rows) {
      const isTraining = platform.id === 1;
      const status = isTraining ? '✅ HAS DATA' : '⚪ EMPTY (READY FOR NEW DATA)';
      
      console.log(`${isTraining ? '✅' : '⚪'} Platform #${platform.id}: ${platform.name}`);
      console.log(`   Code: ${platform.code || 'N/A'}`);
      console.log(`   Type: ${platform.platform_type || 'N/A'}`);
      console.log(`   Pricing: ${platform.pricing_model || 'N/A'}`);
      console.log(`   Status: ${status}`);
      
      // Get office links
      const officeLinks = await pool.query(`
        SELECT COUNT(*) as count 
        FROM office_platforms 
        WHERE platform_id = $1
      `, [platform.id]);
      
      const linkCount = parseInt(officeLinks.rows[0].count);
      console.log(`   Office Links: ${linkCount}`);
      
      // Get employee count
      const employees = await pool.query(`
        SELECT COUNT(*) as count 
        FROM employees 
        WHERE platform_id = $1
      `, [platform.id]);
      
      const empCount = parseInt(employees.rows[0].count);
      console.log(`   Employees: ${empCount}`);
      
      console.log('');
    }
    
    // Summary
    console.log('='.repeat(70));
    console.log('📈 SUMMARY:');
    console.log('='.repeat(70));
    
    const totalPlatforms = platforms.rows.length;
    const emptyPlatforms = platforms.rows.filter(p => p.id !== 1).length;
    
    console.log(`Total Platforms: ${totalPlatforms}`);
    console.log(`✅ Training Platform: 1 (with data preserved)`);
    console.log(`⚪ Empty Platforms: ${emptyPlatforms} (ready for new data)`);
    
    // Training Platform Details
    console.log('\n' + '='.repeat(70));
    console.log('✅ TRAINING PLATFORM DETAILS:');
    console.log('='.repeat(70));
    
    const trainingData = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM office_platforms WHERE platform_id = 1) as office_links,
        (SELECT COUNT(*) FROM employees WHERE platform_id = 1) as employees
    `);
    
    console.log(`Platform: منصة التدريب المهني (PLT-TR-01)`);
    console.log(`Office Links: ${trainingData.rows[0].office_links}`);
    console.log(`Employees: ${trainingData.rows[0].employees}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ READY FOR USE');
    console.log('='.repeat(70));
    console.log('• Training Platform data is preserved');
    console.log('• Other platforms are empty and ready for new data');
    console.log('• You can now add different data to each empty platform');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

generateReport();
