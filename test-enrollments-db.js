const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function testEnrollments() {
  try {
    console.log('🔌 جاري الاتصال بقاعدة البيانات...');
    await client.connect();
    console.log('✅ تم الاتصال بنجاح!\n');

    // Test 1: Total enrollments
    console.log('📊 اختبار 1: إجمالي المتدربين المسجلين');
    const enrollmentsCount = await client.query('SELECT COUNT(*) as total FROM enrollments;');
    console.log(`النتيجة: ${enrollmentsCount.rows[0].total} متدرب\n`);

    // Test 2: Show enrollments with details
    console.log('📋 اختبار 2: تفاصيل المتدربين المسجلين');
    const enrollments = await client.query(`
      SELECT 
        e.id,
        e.session_id,
        e.beneficiary_id,
        e.status,
        e.attendance_percentage,
        e.enrollment_date,
        b.full_name,
        b.national_id,
        ts.session_name
      FROM enrollments e
      LEFT JOIN beneficiaries b ON e.beneficiary_id = b.id
      LEFT JOIN training_sessions ts ON e.session_id = ts.id
      LIMIT 10;
    `);
    console.log('النتائج:');
    console.table(enrollments.rows);
    console.log(`\nإجمالي الصفوف المعروضة: ${enrollments.rows.length}\n`);

    // Test 3: Check for sessions
    console.log('📅 اختبار 3: الدفعات التدريبية المتاحة');
    const sessions = await client.query('SELECT id, session_name, start_date, end_date FROM training_sessions LIMIT 5;');
    console.log('النتائج:');
    console.table(sessions.rows);
    console.log(`\nإجمالي الدفعات: ${sessions.rows.length}\n`);

    // Test 4: Check for beneficiaries
    console.log('👥 اختبار 4: المستفيدون المتاحون');
    const beneficiaries = await client.query('SELECT id, full_name, national_id, status FROM beneficiaries LIMIT 10;');
    console.log('النتائج:');
    console.table(beneficiaries.rows);
    console.log(`\nإجمالي المستفيدين: ${beneficiaries.rows.length}\n`);

    // Test 5: Enrollments by session
    console.log('🔗 اختبار 5: المتدربون مجمعين حسب الدفعة');
    const enrollmentsBySession = await client.query(`
      SELECT 
        ts.id,
        ts.session_name,
        COUNT(e.id) as enrollment_count
      FROM training_sessions ts
      LEFT JOIN enrollments e ON ts.id = e.session_id
      GROUP BY ts.id, ts.session_name;
    `);
    console.log('النتائج:');
    console.table(enrollmentsBySession.rows);

    console.log('\n✅ جميع الاختبارات نجحت!');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await client.end();
    console.log('🔌 تم إغلاق الاتصال');
  }
}

testEnrollments();
