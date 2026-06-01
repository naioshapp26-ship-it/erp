const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testBackend() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 بدء اختبارات الخلفية...\n');
    console.log('='.repeat(80));
    
    let passedTests = 0;
    let failedTests = 0;
    
    // Test 1: التحقق من الاتصال بقاعدة البيانات
    console.log('\n📋 اختبار 1: الاتصال بقاعدة البيانات');
    try {
      const result = await client.query('SELECT NOW()');
      console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
      console.log(`   الوقت الحالي: ${result.rows[0].now}`);
      passedTests++;
    } catch (error) {
      console.log('❌ فشل الاتصال بقاعدة البيانات:', error.message);
      failedTests++;
    }
    
    // Test 2: التحقق من وجود جدول المنصات
    console.log('\n📋 اختبار 2: التحقق من جدول المنصات');
    try {
      const result = await client.query('SELECT COUNT(*) FROM platforms');
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`✅ جدول المنصات موجود ويحتوي على ${count} منصة`);
        passedTests++;
      } else {
        console.log('❌ جدول المنصات فارغ');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ فشل في الوصول لجدول المنصات:', error.message);
      failedTests++;
    }
    
    // Test 3: التحقق من وجود جدول الحاضنات
    console.log('\n📋 اختبار 3: التحقق من جدول الحاضنات');
    try {
      const result = await client.query('SELECT COUNT(*) FROM incubators');
      const count = parseInt(result.rows[0].count);
      if (count >= 100) {
        console.log(`✅ جدول الحاضنات موجود ويحتوي على ${count} حاضنة`);
        passedTests++;
      } else {
        console.log(`⚠️ جدول الحاضنات يحتوي على ${count} حاضنة فقط (متوقع 100 على الأقل)`);
        failedTests++;
      }
    } catch (error) {
      console.log('❌ فشل في الوصول لجدول الحاضنات:', error.message);
      failedTests++;
    }
    
    // Test 4: التحقق من ربط المنصات بالحاضنات
    console.log('\n📋 اختبار 4: التحقق من ربط المنصات بالحاضنات');
    try {
      const result = await client.query(`
        SELECT COUNT(*) 
        FROM platforms p
        INNER JOIN incubators i ON p.incubator_id = i.id
      `);
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`✅ يوجد ${count} منصة مربوطة بحاضنات بشكل صحيح`);
        passedTests++;
      } else {
        console.log('❌ لا توجد منصات مربوطة بحاضنات');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ فشل في التحقق من الربط:', error.message);
      failedTests++;
    }
    
    // Test 5: التحقق من بيانات الحاضنات الجديدة
    console.log('\n📋 اختبار 5: التحقق من بيانات الحاضنات الجديدة');
    try {
      const result = await client.query(`
        SELECT COUNT(*) 
        FROM incubators 
        WHERE code LIKE '%_0%' OR code LIKE '%_1%'
      `);
      const count = parseInt(result.rows[0].count);
      if (count >= 100) {
        console.log(`✅ تم العثور على ${count} حاضنة من الحاضنات الجديدة`);
        passedTests++;
      } else {
        console.log(`⚠️ عدد الحاضنات الجديدة: ${count} (متوقع 100)`);
        failedTests++;
      }
    } catch (error) {
      console.log('❌ فشل في التحقق من الحاضنات الجديدة:', error.message);
      failedTests++;
    }
    
    // Test 6: التحقق من صحة بنية البيانات
    console.log('\n📋 اختبار 6: التحقق من صحة بنية البيانات');
    try {
      const result = await client.query(`
        SELECT 
          p.name as platform_name,
          i.name as incubator_name,
          p.platform_type,
          i.program_type
        FROM platforms p
        INNER JOIN incubators i ON p.incubator_id = i.id
        LIMIT 5
      `);
      
      if (result.rows.length > 0) {
        console.log('✅ بنية البيانات صحيحة، عينة من البيانات:');
        result.rows.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.platform_name} -> ${row.incubator_name}`);
        });
        passedTests++;
      } else {
        console.log('❌ لا توجد بيانات مرتبطة');
        failedTests++;
      }
    } catch (error) {
      console.log('❌ فشل في التحقق من بنية البيانات:', error.message);
      failedTests++;
    }
    
    // Test 7: التحقق من المفاتيح الأجنبية
    console.log('\n📋 اختبار 7: التحقق من المفاتيح الأجنبية');
    try {
      const result = await client.query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name IN ('platforms', 'incubators')
      `);
      
      console.log(`✅ تم العثور على ${result.rows.length} مفتاح أجنبي`);
      if (result.rows.length > 0) {
        result.rows.forEach(row => {
          console.log(`   ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
        });
      }
      passedTests++;
    } catch (error) {
      console.log('⚠️ تحذير: ', error.message);
      passedTests++;
    }
    
    // Test 8: التحقق من عدم وجود قيم NULL في الحقول المطلوبة
    console.log('\n📋 اختبار 8: التحقق من صحة البيانات');
    try {
      const nullPlatforms = await client.query(`
        SELECT COUNT(*) FROM platforms WHERE name IS NULL OR code IS NULL
      `);
      const nullIncubators = await client.query(`
        SELECT COUNT(*) FROM incubators WHERE name IS NULL OR code IS NULL
      `);
      
      const nullPlatformsCount = parseInt(nullPlatforms.rows[0].count);
      const nullIncubatorsCount = parseInt(nullIncubators.rows[0].count);
      
      if (nullPlatformsCount === 0 && nullIncubatorsCount === 0) {
        console.log('✅ جميع البيانات المطلوبة موجودة (لا توجد قيم NULL)');
        passedTests++;
      } else {
        console.log(`❌ توجد قيم NULL: منصات=${nullPlatformsCount}, حاضنات=${nullIncubatorsCount}`);
        failedTests++;
      }
    } catch (error) {
      console.log('❌ فشل في التحقق من القيم الفارغة:', error.message);
      failedTests++;
    }
    
    // النتيجة النهائية
    console.log('\n' + '='.repeat(80));
    console.log('📊 نتائج الاختبارات:');
    console.log('='.repeat(80));
    console.log(`✅ اجتاز: ${passedTests} اختبار`);
    console.log(`❌ فشل: ${failedTests} اختبار`);
    console.log(`📈 الإجمالي: ${passedTests + failedTests} اختبار`);
    
    const percentage = ((passedTests / (passedTests + failedTests)) * 100).toFixed(2);
    console.log(`📊 نسبة النجاح: ${percentage}%`);
    
    if (failedTests === 0) {
      console.log('\n🎉 جميع الاختبارات نجحت!');
    } else {
      console.log(`\n⚠️ ${failedTests} اختبار فشل، يرجى المراجعة`);
    }
    
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ خطأ في تشغيل الاختبارات:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

testBackend()
  .then(() => {
    console.log('\n✅ اكتملت اختبارات الخلفية');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ فشلت اختبارات الخلفية:', error);
    process.exit(1);
  });
