require('dotenv').config();
const { Client } = require('pg');

const connectionString = (process.env.DATABASE_URL || '').replace(/@localhost([:/])/gi, '@127.0.0.1$1');
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;

async function testDatabase() {
  console.log('🔄 جاري اختبار الاتصال بقاعدة البيانات...\n');

  const client = new Client({ connectionString, ssl });

  try {
    await client.connect();
    // Test 1: Connection
    console.log('✅ اختبار 1: الاتصال بقاعدة البيانات');
    const timeResult = await client.query('SELECT NOW()');
    console.log('   ⏰ الوقت الحالي:', timeResult.rows[0].now);
    
    // Test 2: Check if tables exist
    console.log('\n✅ اختبار 2: التحقق من وجود الجداول');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('   📊 الجداول الموجودة:');
    tablesResult.rows.forEach(row => {
      console.log(`      - ${row.table_name}`);
    });

    // Test 3: Count records
    console.log('\n✅ اختبار 3: عدد السجلات في كل جدول');
    
    const entities = await client.query('SELECT COUNT(*) FROM entities');
    console.log(`   - entities: ${entities.rows[0].count} سجل`);
    
    const users = await client.query('SELECT COUNT(*) FROM users');
    console.log(`   - users: ${users.rows[0].count} سجل`);
    
    const invoices = await client.query('SELECT COUNT(*) FROM invoices');
    console.log(`   - invoices: ${invoices.rows[0].count} سجل`);
    
    const transactions = await client.query('SELECT COUNT(*) FROM transactions');
    console.log(`   - transactions: ${transactions.rows[0].count} سجل`);
    
    const ledger = await client.query('SELECT COUNT(*) FROM ledger');
    console.log(`   - ledger: ${ledger.rows[0].count} سجل`);
    
    const ads = await client.query('SELECT COUNT(*) FROM ads');
    console.log(`   - ads: ${ads.rows[0].count} سجل`);

    // Test 4: Sample data queries
    console.log('\n✅ اختبار 4: استعلام بيانات نموذجية');
    
    const sampleEntity = await client.query('SELECT * FROM entities LIMIT 1');
    console.log('   📌 مثال على كيان:', sampleEntity.rows[0]?.name || 'لا يوجد');
    
    const sampleUser = await client.query('SELECT * FROM users LIMIT 1');
    console.log('   👤 مثال على مستخدم:', sampleUser.rows[0]?.name || 'لا يوجد');

    console.log('\n✅ جميع الاختبارات نجحت! قاعدة البيانات جاهزة للاستخدام 🎉\n');
    
  } catch (error) {
    console.error('❌ خطأ في الاختبار:', error.message);
    console.error(error);
  } finally {
    try {
      await client.end();
    } catch (_) {
      /* ignore */
    }
    process.exit(0);
  }
}

testDatabase();
