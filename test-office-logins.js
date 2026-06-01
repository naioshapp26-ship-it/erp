const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testOfficeLogins() {
  const client = await pool.connect();
  
  try {
    console.log('🔐 اختبار تسجيل الدخول لجميع المكاتب...\n');
    
    const testPassword = 'test123';
    
    // Get all office credentials
    const result = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.office_id,
        uc.username,
        uc.password_hash,
        o.name as office_name,
        o.code as office_code
      FROM users u
      INNER JOIN user_credentials uc ON u.id = uc.user_id
      INNER JOIN offices o ON u.office_id = o.id
      WHERE u.office_id IS NOT NULL
        AND u.is_active = true
        AND uc.is_active = true
      ORDER BY u.office_id
    `);
    
    console.log(`📊 اختبار ${result.rows.length} مكتب...\n`);
    
    let successCount = 0;
    let failCount = 0;
    const failures = [];
    
    for (const row of result.rows) {
      try {
        const passwordMatch = await bcrypt.compare(testPassword, row.password_hash);
        
        if (passwordMatch) {
          successCount++;
          if (successCount <= 5) {
            console.log(`✅ ${row.office_code}: ${row.username} - كلمة المرور صحيحة`);
          }
        } else {
          failCount++;
          failures.push({
            code: row.office_code,
            username: row.username,
            office_id: row.office_id
          });
          console.log(`❌ ${row.office_code}: ${row.username} - كلمة المرور خاطئة`);
        }
      } catch (error) {
        failCount++;
        failures.push({
          code: row.office_code,
          username: row.username,
          error: error.message
        });
        console.log(`❌ ${row.office_code}: خطأ - ${error.message}`);
      }
    }
    
    console.log(`\n📊 النتائج:`);
    console.log(`   ✅ نجح: ${successCount} مكتب`);
    console.log(`   ❌ فشل: ${failCount} مكتب`);
    
    if (failures.length > 0) {
      console.log(`\n❌ المكاتب الفاشلة:`);
      failures.forEach(f => {
        console.log(`   - ${f.code}: ${f.username}${f.error ? ` (${f.error})` : ''}`);
      });
    } else {
      console.log(`\n✅✅✅ جميع المكاتب جاهزة للاختبار! ✅✅✅`);
    }
    
    // Test a random office login
    const randomOffice = result.rows[Math.floor(Math.random() * result.rows.length)];
    console.log(`\n🎲 اختبار عشوائي: ${randomOffice.office_code}`);
    console.log(`   Username: ${randomOffice.username}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Result: ${await bcrypt.compare(testPassword, randomOffice.password_hash) ? '✅ نجح' : '❌ فشل'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testOfficeLogins().catch(console.error);
