// Check office lookup issue
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function checkOfficeLookup() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');

    // 1. فحص المكاتب الموجودة
    console.log('📋 فحص المكاتب الموجودة:');
    const offices = await client.query(`
      SELECT id, code, name, entity_id, incubator_id
      FROM offices
      WHERE is_active = true
      ORDER BY id
      LIMIT 10
    `);

    console.log(`عدد المكاتب النشطة: ${offices.rows.length}\n`);
    
    if (offices.rows.length === 0) {
      console.log('❌ لا توجد مكاتب نشطة في قاعدة البيانات!');
      return;
    }

    console.log('أمثلة على المكاتب:');
    offices.rows.forEach((office, i) => {
      console.log(`${i+1}. ID: ${office.id}, Code: ${office.code}, Entity: ${office.entity_id || 'NULL'}`);
      console.log(`   الاسم: ${office.name}`);
      console.log(`   Incubator ID: ${office.incubator_id || 'NULL'}\n`);
    });

    // 2. اختبار البحث بطرق مختلفة
    console.log('🔍 اختبار البحث عن المكاتب:\n');
    
    const testOffice = offices.rows[0];
    console.log(`اختبار المكتب: ${testOffice.code}`);
    
    // Test 1: بالـ ID
    const test1 = await client.query(`
      SELECT id, name, code, entity_id
      FROM offices
      WHERE id::text = $1 OR code = $1 OR entity_id = $1
      LIMIT 1
    `, [testOffice.id.toString()]);
    console.log(`1. البحث بالـ ID (${testOffice.id}): ${test1.rows.length > 0 ? '✅ نجح' : '❌ فشل'}`);

    // Test 2: بالـ code
    const test2 = await client.query(`
      SELECT id, name, code, entity_id
      FROM offices
      WHERE id::text = $1 OR code = $1 OR entity_id = $1
      LIMIT 1
    `, [testOffice.code]);
    console.log(`2. البحث بالـ code (${testOffice.code}): ${test2.rows.length > 0 ? '✅ نجح' : '❌ فشل'}`);

    // Test 3: بالـ entity_id
    if (testOffice.entity_id) {
      const test3 = await client.query(`
        SELECT id, name, code, entity_id
        FROM offices
        WHERE id::text = $1 OR code = $1 OR entity_id = $1
        LIMIT 1
      `, [testOffice.entity_id]);
      console.log(`3. البحث بالـ entity_id (${testOffice.entity_id}): ${test3.rows.length > 0 ? '✅ نجح' : '❌ فشل'}`);
    } else {
      console.log(`3. البحث بالـ entity_id: ⚠️  المكتب ليس له entity_id`);
    }

    // 3. فحص عدد المكاتب بدون entity_id
    const noEntityCount = await client.query(`
      SELECT COUNT(*) as count
      FROM offices
      WHERE entity_id IS NULL AND is_active = true
    `);
    
    console.log(`\n⚠️  عدد المكاتب بدون entity_id: ${noEntityCount.rows[0].count}`);

    // 4. اقتراح الحل
    console.log('\n💡 الحل المقترح:');
    if (parseInt(noEntityCount.rows[0].count) > 0) {
      console.log('يجب تحديث جميع المكاتب لتحصل على entity_id');
      console.log('أو تحسين البحث ليعمل بدون entity_id');
    } else {
      console.log('جميع المكاتب لها entity_id ✅');
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('\n✅ تم إغلاق الاتصال');
  }
}

checkOfficeLookup();
