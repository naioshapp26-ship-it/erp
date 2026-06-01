// Test the fixed office lookup
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function testOfficeLookup() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');

    // اختبار البحث بطرق مختلفة
    const testCases = [
      { value: '39', description: 'رقم المكتب (ID)' },
      { value: 'OFF-5657-FIN', description: 'كود المكتب (code)' },
      { value: 'off-5657-fin', description: 'كود المكتب بحروف صغيرة' },
      { value: 'OFF039', description: 'Entity ID' },
      { value: 'مكتب الاستشارات', description: 'جزء من اسم المكتب' },
      { value: '999', description: 'رقم غير موجود' },
      { value: 'INVALID-CODE', description: 'كود غير موجود' }
    ];

    console.log('🔍 اختبار البحث عن المكاتب:\n');

    for (const test of testCases) {
      try {
        const result = await client.query(`
          SELECT id, name, code, entity_id
          FROM offices
          WHERE id::text = $1 
             OR UPPER(code) = UPPER($1)
             OR entity_id = $1
             OR UPPER(name) LIKE UPPER($1 || '%')
          LIMIT 1
        `, [test.value]);

        if (result.rows.length > 0) {
          const office = result.rows[0];
          console.log(`✅ ${test.description} (${test.value}):`);
          console.log(`   وجد: ${office.name} (${office.code})`);
        } else {
          console.log(`❌ ${test.description} (${test.value}):`);
          console.log(`   لم يجد نتائج`);
        }
        console.log();
      } catch (err) {
        console.log(`❌ ${test.description} (${test.value}):`);
        console.log(`   خطأ: ${err.message}`);
        console.log();
      }
    }

    console.log('✅ انتهى الاختبار');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
  }
}

testOfficeLookup();
