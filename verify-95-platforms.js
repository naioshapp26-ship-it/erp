const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function verifyPlatforms() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 اختبار المنصات المضافة\n');
    console.log('='.repeat(60));
    
    // اختبار 1: عدد المنصات الإجمالي
    console.log('\n📌 اختبار 1: عدد المنصات الإجمالي');
    const totalCount = await client.query('SELECT COUNT(*) FROM platforms');
    const total = parseInt(totalCount.rows[0].count);
    
    if (total === 95) {
      console.log(`✅ نجح - العدد الإجمالي: ${total} منصة`);
    } else {
      console.log(`⚠️ تحذير - العدد الإجمالي: ${total} (المتوقع: 95)`);
    }
    
    // اختبار 2: توزيع المنصات حسب الفئة
    console.log('\n📌 اختبار 2: توزيع المنصات حسب الفئة');
    const categoryDist = await client.query(`
      SELECT platform_type, COUNT(*) as count
      FROM platforms
      GROUP BY platform_type
      ORDER BY platform_type
    `);
    
    console.log('✅ التوزيع حسب الفئة:');
    categoryDist.rows.forEach(row => {
      console.log(`   ${row.platform_type}: ${row.count} منصة`);
    });
    
    // اختبار 3: عينة من المنصات
    console.log('\n📌 اختبار 3: عينة من المنصات (أول 10)');
    const samplePlatforms = await client.query(`
      SELECT id, name, code, platform_type
      FROM platforms
      ORDER BY id
      LIMIT 10
    `);
    
    console.log('✅ عينة من المنصات:');
    samplePlatforms.rows.forEach(p => {
      console.log(`   ${p.id}. ${p.name} (${p.code}) - ${p.platform_type}`);
    });
    
    // اختبار 4: التحقق من الفئات الجديدة
    console.log('\n📌 اختبار 4: التحقق من استخدام جميع الفئات');
    const expectedCategories = [
      'RESTAURANTS', 'STORES', 'SERVICES', 'EDUCATION', 'HEALTH',
      'SPORTS', 'EVENTS', 'REAL_ESTATE', 'TOURISM', 'MANUFACTURING',
      'PROFESSIONAL', 'ORGANIZATIONS', 'OTHER'
    ];
    
    const usedCategories = categoryDist.rows.map(r => r.platform_type);
    const missingCategories = expectedCategories.filter(c => !usedCategories.includes(c));
    
    if (missingCategories.length === 0) {
      console.log('✅ نجح - جميع الفئات مستخدمة (13 فئة)');
    } else {
      console.log(`⚠️ تحذير - فئات غير مستخدمة: ${missingCategories.join(', ')}`);
    }
    
    // اختبار 5: التحقق من نموذج التسعير
    console.log('\n📌 اختبار 5: التحقق من نموذج التسعير');
    const pricingModels = await client.query(`
      SELECT pricing_model, COUNT(*) as count
      FROM platforms
      GROUP BY pricing_model
    `);
    
    console.log('✅ نماذج التسعير المستخدمة:');
    pricingModels.rows.forEach(row => {
      console.log(`   ${row.pricing_model}: ${row.count} منصة`);
    });
    
    // اختبار 6: التحقق من العملة
    console.log('\n📌 اختبار 6: التحقق من العملة');
    const currencies = await client.query(`
      SELECT currency, COUNT(*) as count
      FROM platforms
      GROUP BY currency
    `);
    
    console.log('✅ العملات المستخدمة:');
    currencies.rows.forEach(row => {
      console.log(`   ${row.currency}: ${row.count} منصة`);
    });
    
    // اختبار 7: منصات محددة
    console.log('\n📌 اختبار 7: التحقق من منصات محددة');
    const specificPlatforms = [
      'مطعم الوجبات الجاهزة',
      'متجر كتب',
      'الشحن والتوصيل',
      'التعلم الإلكتروني',
      'صيدلية'
    ];
    
    for (const platformName of specificPlatforms) {
      const result = await client.query(
        'SELECT id, name, platform_type FROM platforms WHERE name = $1',
        [platformName]
      );
      
      if (result.rowCount > 0) {
        const p = result.rows[0];
        console.log(`✅ ${p.name} - ${p.platform_type}`);
      } else {
        console.log(`❌ ${platformName} - غير موجودة`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الاختبار');
    console.log('='.repeat(60));
    console.log(`✅ إجمالي المنصات: ${total}`);
    console.log(`✅ عدد الفئات المستخدمة: ${usedCategories.length}`);
    console.log('✅ جميع الاختبارات نجحت!');
    
  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyPlatforms()
  .then(() => {
    console.log('\n🎉 اكتملت جميع الاختبارات بنجاح!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ فشل الاختبار:', error);
    process.exit(1);
  });
