// Verify offices are accessible for office permissions
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';

async function verifyOffices() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات\n');

    // إحصائيات المكاتب
    const countResult = await client.query('SELECT COUNT(*) as count FROM offices WHERE is_active = true');
    console.log(`📊 عدد المكاتب النشطة: ${countResult.rows[0].count}\n`);

    // عرض بعض المكاتب
    console.log('📋 أمثلة على المكاتب المتاحة:\n');
    const offices = await client.query(`
      SELECT o.id, o.code, o.name, i.name as incubator_name
      FROM offices o
      LEFT JOIN incubators i ON o.incubator_id = i.id
      WHERE o.is_active = true
      ORDER BY o.id
      LIMIT 20
    `);

    offices.rows.forEach((office, index) => {
      console.log(`${index + 1}. المكتب: ${office.code}`);
      console.log(`   الاسم: ${office.name}`);
      console.log(`   الحاضنة: ${office.incubator_name}`);
      console.log(`   ID: ${office.id}\n`);
    });

    console.log('✅ يمكنك الآن استخدام أي من هذه الأكواد في صفحة صلاحيات المكتب');
    console.log('مثال: OFF-5657-FIN أو OFF-5658-MKT\n');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
    console.log('✅ تم إغلاق الاتصال');
  }
}

verifyOffices();
