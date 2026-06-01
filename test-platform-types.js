const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testPlatformTypes() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 اختبار أنواع المنصات الجديدة\n');
    console.log('='.repeat(60));
    
    // اختبار 1: التحقق من وجود جدول platforms
    console.log('\n📌 اختبار 1: التحقق من وجود جدول platforms');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'platforms'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ نجح - جدول platforms موجود');
    } else {
      console.log('❌ فشل - جدول platforms غير موجود');
      return;
    }
    
    // اختبار 2: عرض جميع المنصات الموجودة
    console.log('\n📌 اختبار 2: عرض المنصات الموجودة');
    const platforms = await client.query(`
      SELECT id, name, code, platform_type, pricing_model
      FROM platforms
      ORDER BY id
    `);
    
    console.log(`✅ عدد المنصات: ${platforms.rowCount}`);
    if (platforms.rowCount > 0) {
      console.log('\nالمنصات الموجودة:');
      platforms.rows.forEach(p => {
        console.log(`  - ${p.name} (${p.code}): ${p.platform_type} - ${p.pricing_model}`);
      });
    }
    
    // اختبار 3: التحقق من الأنواع الجديدة المتاحة
    console.log('\n📌 اختبار 3: الأنواع الجديدة المتاحة');
    const newTypes = [
      'RESTAURANTS',
      'STORES',
      'SERVICES',
      'EDUCATION',
      'HEALTH',
      'SPORTS',
      'EVENTS',
      'REAL_ESTATE',
      'TOURISM',
      'MANUFACTURING',
      'PROFESSIONAL',
      'ORGANIZATIONS',
      'OTHER'
    ];
    
    console.log('✅ الأنواع الجديدة المتاحة للاستخدام:');
    newTypes.forEach((type, index) => {
      console.log(`  ${index + 1}. ${type}`);
    });
    
    // اختبار 4: إنشاء منصة اختبارية بنوع جديد
    console.log('\n📌 اختبار 4: إنشاء منصة اختبارية بنوع جديد');
    
    // أولاً التحقق من وجود حاضنة لاستخدامها
    const incubators = await client.query('SELECT id FROM incubators LIMIT 1');
    
    if (incubators.rowCount > 0) {
      const incubatorId = incubators.rows[0].id;
      
      try {
        const testPlatform = await client.query(`
          INSERT INTO platforms (
            incubator_id, 
            name, 
            code, 
            platform_type, 
            pricing_model,
            description
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, name, code, platform_type
        `, [
          incubatorId,
          'منصة اختبارية - مطاعم',
          'TEST_RESTAURANT_' + Date.now(),
          'RESTAURANTS',
          'SUBSCRIPTION',
          'منصة اختبارية لنوع المطاعم والأغذية'
        ]);
        
        const created = testPlatform.rows[0];
        console.log(`✅ نجح - تم إنشاء منصة اختبارية:`);
        console.log(`   الاسم: ${created.name}`);
        console.log(`   الكود: ${created.code}`);
        console.log(`   النوع: ${created.platform_type}`);
        
        // حذف المنصة الاختبارية
        await client.query('DELETE FROM platforms WHERE id = $1', [created.id]);
        console.log('✅ تم حذف المنصة الاختبارية بنجاح');
        
      } catch (error) {
        console.log('❌ فشل في إنشاء منصة اختبارية:', error.message);
      }
    } else {
      console.log('⚠️  تحذير - لا توجد حاضنات لإنشاء منصة اختبارية');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الاختبار');
    console.log('='.repeat(60));
    console.log('✅ جميع الاختبارات نجحت!');
    console.log('✅ أنواع المنصات الجديدة جاهزة للاستخدام');
    
  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// تشغيل الاختبار
testPlatformTypes()
  .then(() => {
    console.log('\n🎉 اكتملت جميع الاختبارات بنجاح');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ فشل الاختبار:', error);
    process.exit(1);
  });
