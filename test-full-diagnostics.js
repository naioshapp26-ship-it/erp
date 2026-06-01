const { Client } = require('pg');

async function fullDiagnostics() {
  const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
  });

  try {
    await client.connect();
    console.log('✅ متصل بقاعدة البيانات\n');

    // 1. Check training_sessions
    console.log('🔍 اختبار 1: الدفعات التدريبية');
    const sessionsResult = await client.query('SELECT id, session_name FROM training_sessions LIMIT 5;');
    console.log(`عدد الدفعات: ${sessionsResult.rows.length}`);
    console.table(sessionsResult.rows);
    console.log('');

    // 2. Check beneficiaries
    console.log('🔍 اختبار 2: المستفيدون');
    const beneficiariesResult = await client.query('SELECT id, full_name FROM beneficiaries LIMIT 5;');
    console.log(`عدد المستفيدين: ${beneficiariesResult.rows.length}`);
    console.table(beneficiariesResult.rows);
    console.log('');

    // 3. Check enrollments
    console.log('🔍 اختبار 3: المتدربون (enrollments)');
    const enrollmentsResult = await client.query('SELECT COUNT(*) as total FROM enrollments;');
    console.log(`إجمالي المتدربين: ${enrollmentsResult.rows[0].total}`);
    console.log('');

    // 4. Test the EXACT query that the API uses
    console.log('🔍 اختبار 4: اختبار query API بالضبط');
    const apiQuery = `
      SELECT 
        e.*,
        b.full_name as beneficiary_name,
        b.national_id as beneficiary_national_id,
        ts.session_name,
        tp.duration_hours,
        ROUND((a.score / a.max_score * 100)::numeric, 2) as final_grade
      FROM enrollments e
      LEFT JOIN beneficiaries b ON e.beneficiary_id = b.id
      LEFT JOIN training_sessions ts ON e.session_id = ts.id
      LEFT JOIN training_programs tp ON ts.program_id = tp.id
      LEFT JOIN assessments a ON e.id = a.enrollment_id
      WHERE 1=1
      ORDER BY e.enrollment_date DESC
      LIMIT 5;
    `;
    
    try {
      const result = await client.query(apiQuery);
      console.log(`✅ Query نجح - عدد النتائج: ${result.rows.length}`);
      if (result.rows.length > 0) {
        console.log('أول نتيجة:');
        console.log(JSON.stringify(result.rows[0], null, 2));
      }
    } catch (error) {
      console.error('❌ خطأ في Query:', error.message);
    }
    console.log('');

    // 5. Test for specific session
    console.log('🔍 اختبار 5: جلب متدربي دفعة محددة (session_id=35)');
    const sessionEnrollments = await client.query(`
      SELECT 
        e.*,
        b.full_name as beneficiary_name,
        ts.session_name
      FROM enrollments e
      LEFT JOIN beneficiaries b ON e.beneficiary_id = b.id
      LEFT JOIN training_sessions ts ON e.session_id = ts.id
      WHERE e.session_id = 35;
    `);
    console.log(`عدد المتدربين: ${sessionEnrollments.rows.length}`);
    console.table(sessionEnrollments.rows.map(r => ({
      id: r.id,
      name: r.beneficiary_name,
      session: r.session_name,
      status: r.status
    })));

    console.log('\n✅ جميع الاختبارات نجحت!');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

fullDiagnostics();
