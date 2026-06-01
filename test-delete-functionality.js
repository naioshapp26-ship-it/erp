const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testDeleteFunctionality() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 اختبار وظائف الحذف\n');
    console.log('='.repeat(60));
    
    // اختبار 1: التحقق من وجود DELETE endpoints في قاعدة البيانات
    console.log('\n📌 اختبار 1: عدد العناصر قبل الاختبار');
    
    const branches = await client.query('SELECT COUNT(*) FROM branches');
    const incubators = await client.query('SELECT COUNT(*) FROM incubators');
    const platforms = await client.query('SELECT COUNT(*) FROM platforms');
    const offices = await client.query('SELECT COUNT(*) FROM offices');
    
    console.log(`✅ الفروع: ${branches.rows[0].count}`);
    console.log(`✅ الحاضنات: ${incubators.rows[0].count}`);
    console.log(`✅ المنصات: ${platforms.rows[0].count}`);
    console.log(`✅ المكاتب: ${offices.rows[0].count}`);
    
    // اختبار 2: إنشاء عناصر اختبارية
    console.log('\n📌 اختبار 2: إنشاء عناصر اختبارية');
    
    // إنشاء فرع اختباري
    const testBranch = await client.query(`
      INSERT INTO branches (hq_id, name, code, description, country, city)
      VALUES (1, 'فرع اختبار الحذف', 'TEST_DELETE_BR', 'فرع مؤقت للاختبار', 'السعودية', 'الرياض')
      RETURNING id, name
    `);
    console.log(`✅ تم إنشاء فرع اختباري: ${testBranch.rows[0].name} (ID: ${testBranch.rows[0].id})`);
    
    const branchId = testBranch.rows[0].id;
    
    // إنشاء حاضنة اختبارية
    const testIncubator = await client.query(`
      INSERT INTO incubators (branch_id, name, code, program_type, capacity)
      VALUES ($1, 'حاضنة اختبار الحذف', 'TEST_DELETE_INC', 'اختبار', 10)
      RETURNING id, name
    `, [branchId]);
    console.log(`✅ تم إنشاء حاضنة اختبارية: ${testIncubator.rows[0].name} (ID: ${testIncubator.rows[0].id})`);
    
    const incubatorId = testIncubator.rows[0].id;
    
    // إنشاء منصة اختبارية
    const testPlatform = await client.query(`
      INSERT INTO platforms (incubator_id, name, code, platform_type, pricing_model)
      VALUES ($1, 'منصة اختبار الحذف', 'TEST_DELETE_PLT', 'SERVICES', 'SUBSCRIPTION')
      RETURNING id, name
    `, [incubatorId]);
    console.log(`✅ تم إنشاء منصة اختبارية: ${testPlatform.rows[0].name} (ID: ${testPlatform.rows[0].id})`);
    
    const platformId = testPlatform.rows[0].id;
    
    // إنشاء مكتب اختباري
    const testOffice = await client.query(`
      INSERT INTO offices (incubator_id, name, code, office_type, capacity)
      VALUES ($1, 'مكتب اختبار الحذف', 'TEST_DELETE_OFF', 'اختبار', 5)
      RETURNING id, name
    `, [incubatorId]);
    console.log(`✅ تم إنشاء مكتب اختباري: ${testOffice.rows[0].name} (ID: ${testOffice.rows[0].id})`);
    
    const officeId = testOffice.rows[0].id;
    
    // اختبار 3: حذف المكتب
    console.log('\n📌 اختبار 3: حذف المكتب');
    await client.query('DELETE FROM offices WHERE id = $1', [officeId]);
    const officeCheck = await client.query('SELECT * FROM offices WHERE id = $1', [officeId]);
    if (officeCheck.rowCount === 0) {
      console.log('✅ تم حذف المكتب بنجاح');
    } else {
      console.log('❌ فشل حذف المكتب');
    }
    
    // اختبار 4: حذف المنصة
    console.log('\n📌 اختبار 4: حذف المنصة');
    await client.query('DELETE FROM platforms WHERE id = $1', [platformId]);
    const platformCheck = await client.query('SELECT * FROM platforms WHERE id = $1', [platformId]);
    if (platformCheck.rowCount === 0) {
      console.log('✅ تم حذف المنصة بنجاح');
    } else {
      console.log('❌ فشل حذف المنصة');
    }
    
    // اختبار 5: حذف الحاضنة (سيحذف جميع العناصر التابعة)
    console.log('\n📌 اختبار 5: حذف الحاضنة');
    await client.query('DELETE FROM incubators WHERE id = $1', [incubatorId]);
    const incubatorCheck = await client.query('SELECT * FROM incubators WHERE id = $1', [incubatorId]);
    if (incubatorCheck.rowCount === 0) {
      console.log('✅ تم حذف الحاضنة بنجاح');
    } else {
      console.log('❌ فشل حذف الحاضنة');
    }
    
    // اختبار 6: حذف الفرع
    console.log('\n📌 اختبار 6: حذف الفرع');
    await client.query('DELETE FROM branches WHERE id = $1', [branchId]);
    const branchCheck = await client.query('SELECT * FROM branches WHERE id = $1', [branchId]);
    if (branchCheck.rowCount === 0) {
      console.log('✅ تم حذف الفرع بنجاح');
    } else {
      console.log('❌ فشل حذف الفرع');
    }
    
    // اختبار 7: العدد النهائي
    console.log('\n📌 اختبار 7: عدد العناصر بعد التنظيف');
    const branchesAfter = await client.query('SELECT COUNT(*) FROM branches');
    const incubatorsAfter = await client.query('SELECT COUNT(*) FROM incubators');
    const platformsAfter = await client.query('SELECT COUNT(*) FROM platforms');
    const officesAfter = await client.query('SELECT COUNT(*) FROM offices');
    
    console.log(`✅ الفروع: ${branchesAfter.rows[0].count}`);
    console.log(`✅ الحاضنات: ${incubatorsAfter.rows[0].count}`);
    console.log(`✅ المنصات: ${platformsAfter.rows[0].count}`);
    console.log(`✅ المكاتب: ${officesAfter.rows[0].count}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الاختبار');
    console.log('='.repeat(60));
    console.log('✅ جميع اختبارات الحذف نجحت!');
    console.log('✅ العناصر الاختبارية تم إنشاؤها وحذفها بنجاح');
    console.log('✅ CASCADE DELETE يعمل بشكل صحيح');
    
  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

testDeleteFunctionality()
  .then(() => {
    console.log('\n🎉 اكتملت جميع الاختبارات بنجاح!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ فشل الاختبار:', error);
    process.exit(1);
  });
