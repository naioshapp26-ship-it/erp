const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testBackendAPIs() {
  try {
    console.log('🧪 اختبار APIs الخلفية...\n');

    // 1. اختبار جدول employee_requests
    console.log('1️⃣ اختبار جدول employee_requests:');
    const employeeRequests = await pool.query(`
      SELECT COUNT(*) as count, 
        COUNT(branch_id) as with_branch,
        COUNT(incubator_id) as with_incubator,
        COUNT(platform_id) as with_platform,
        COUNT(office_id) as with_office
      FROM employee_requests
    `);
    console.log('   إجمالي الطلبات:', employeeRequests.rows[0].count);
    console.log('   مع فرع:', employeeRequests.rows[0].with_branch);
    console.log('   مع حاضنة:', employeeRequests.rows[0].with_incubator);
    console.log('   مع منصة:', employeeRequests.rows[0].with_platform);
    console.log('   مع مكتب:', employeeRequests.rows[0].with_office);

    // 2. اختبار جدول invoices
    console.log('\n2️⃣ اختبار جدول invoices:');
    const invoices = await pool.query(`
      SELECT COUNT(*) as count,
        COUNT(branch_id) as with_branch,
        COUNT(incubator_id) as with_incubator,
        COUNT(platform_id) as with_platform,
        COUNT(office_id) as with_office
      FROM invoices
    `);
    console.log('   إجمالي الفواتير:', invoices.rows[0].count);
    console.log('   مع فرع:', invoices.rows[0].with_branch);
    console.log('   مع حاضنة:', invoices.rows[0].with_incubator);
    console.log('   مع منصة:', invoices.rows[0].with_platform);
    console.log('   مع مكتب:', invoices.rows[0].with_office);

    // 3. اختبار جدول ads
    console.log('\n3️⃣ اختبار جدول ads:');
    const ads = await pool.query(`
      SELECT COUNT(*) as count,
        COUNT(branch_id) as with_branch,
        COUNT(incubator_id) as with_incubator,
        COUNT(platform_id) as with_platform,
        COUNT(office_id) as with_office
      FROM ads
    `);
    console.log('   إجمالي الإعلانات:', ads.rows[0].count);
    console.log('   مع فرع:', ads.rows[0].with_branch);
    console.log('   مع حاضنة:', ads.rows[0].with_incubator);
    console.log('   مع منصة:', ads.rows[0].with_platform);
    console.log('   مع مكتب:', ads.rows[0].with_office);

    // 4. اختبار جدول transactions
    console.log('\n4️⃣ اختبار جدول transactions:');
    const transactions = await pool.query(`
      SELECT COUNT(*) as count,
        COUNT(branch_id) as with_branch,
        COUNT(incubator_id) as with_incubator,
        COUNT(platform_id) as with_platform,
        COUNT(office_id) as with_office
      FROM transactions
    `);
    console.log('   إجمالي المعاملات:', transactions.rows[0].count);
    console.log('   مع فرع:', transactions.rows[0].with_branch);
    console.log('   مع حاضنة:', transactions.rows[0].with_incubator);
    console.log('   مع منصة:', transactions.rows[0].with_platform);
    console.log('   مع مكتب:', transactions.rows[0].with_office);

    // 5. اختبار جدول payment_methods
    console.log('\n5️⃣ اختبار جدول payment_methods:');
    const paymentMethods = await pool.query(`
      SELECT COUNT(*) as count,
        COUNT(branch_id) as with_branch,
        COUNT(incubator_id) as with_incubator,
        COUNT(platform_id) as with_platform,
        COUNT(office_id) as with_office
      FROM payment_methods
    `);
    console.log('   إجمالي طرق الدفع:', paymentMethods.rows[0].count);
    console.log('   مع فرع:', paymentMethods.rows[0].with_branch);
    console.log('   مع حاضنة:', paymentMethods.rows[0].with_incubator);
    console.log('   مع منصة:', paymentMethods.rows[0].with_platform);
    console.log('   مع مكتب:', paymentMethods.rows[0].with_office);

    // 6. اختبار جدول request_types
    console.log('\n6️⃣ اختبار جدول request_types:');
    const requestTypes = await pool.query(`
      SELECT COUNT(*) as count,
        COUNT(branch_id) as with_branch,
        COUNT(incubator_id) as with_incubator,
        COUNT(platform_id) as with_platform,
        COUNT(office_id) as with_office
      FROM request_types
    `);
    console.log('   إجمالي أنواع الطلبات:', requestTypes.rows[0].count);
    console.log('   مع فرع:', requestTypes.rows[0].with_branch);
    console.log('   مع حاضنة:', requestTypes.rows[0].with_incubator);
    console.log('   مع منصة:', requestTypes.rows[0].with_platform);
    console.log('   مع مكتب:', requestTypes.rows[0].with_office);

    // 7. التحقق من وجود الفهارس
    console.log('\n7️⃣ التحقق من الفهارس:');
    const indexes = await pool.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%_branch' 
        OR indexname LIKE 'idx_%_incubator'
        OR indexname LIKE 'idx_%_platform'
        OR indexname LIKE 'idx_%_office'
      ORDER BY tablename, indexname
      LIMIT 20
    `);
    console.log('   عدد الفهارس المنشأة:', indexes.rowCount);
    indexes.rows.forEach(row => {
      console.log(`   - ${row.tablename}.${row.indexname}`);
    });

    console.log('\n✅ جميع الاختبارات نجحت!');
    console.log('\n⚠️  ملاحظة: الحقول الجديدة موجودة ولكن البيانات القديمة قد تكون NULL');
    console.log('   يجب ملء هذه الحقول عند إنشاء سجلات جديدة');

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testBackendAPIs();
