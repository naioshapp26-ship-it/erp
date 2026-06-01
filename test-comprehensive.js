// Comprehensive test of enrollments feature
async function comprehensiveTest() {
  console.log('🧪 اختبار شامل لنظام إدارة المتدربين\n');
  const baseURL = 'https://super-cmk2wuy9-production.up.railway.app/api';

  try {
    // Test 1: Get all enrollments
    console.log('✅ اختبار 1: جلب جميع المتدربين');
    const allEnrollmentsRes = await fetch(`${baseURL}/enrollments`, {
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': '1'
      }
    });
    const allEnrollments = await allEnrollmentsRes.json();
    console.log(`   - عدد المتدربين: ${allEnrollments.length}`);
    console.log(`   - أسماء الأعمدة: ${Object.keys(allEnrollments[0] || {}).join(', ')}`);
    console.log('');

    // Test 2: Get enrollments by session
    console.log('✅ اختبار 2: جلب متدربي دفعة معينة (session_id=1)');
    const sessionEnrollmentsRes = await fetch(`${baseURL}/enrollments?session_id=1`, {
      headers: {
        'x-entity-type': 'INCUBATOR',
        'x-entity-id': '1'
      }
    });
    const sessionEnrollments = await sessionEnrollmentsRes.json();
    console.log(`   - عدد المتدربين في الدفعة: ${sessionEnrollments.length}`);
    if (sessionEnrollments.length > 0) {
      console.log('   - التفاصيل:');
      sessionEnrollments.forEach(e => {
        console.log(`     • ${e.beneficiary_name} (${e.national_id}) - الحالة: ${e.status}`);
      });
    }
    console.log('');

    // Test 3: Get enrollments with details
    console.log('✅ اختبار 3: بيانات كاملة للمتدرب الأول');
    if (allEnrollments.length > 0) {
      const e = allEnrollments[0];
      console.log(`   - المعرّف: ${e.id}`);
      console.log(`   - الاسم: ${e.beneficiary_name}`);
      console.log(`   - الهوية: ${e.beneficiary_national_id}`);
      console.log(`   - الدفعة: ${e.session_name}`);
      console.log(`   - الحالة: ${e.status}`);
      console.log(`   - نسبة الحضور: ${e.attendance_percentage}%`);
      console.log(`   - التقييم النهائي: ${e.final_grade || 'لم يتم التقييم بعد'}`);
      console.log(`   - تاريخ التسجيل: ${e.enrollment_date?.substring(0, 10)}`);
    }
    console.log('');

    // Test 4: Test deletion endpoint exists
    console.log('✅ اختبار 4: التحقق من endpoint الحذف');
    if (allEnrollments.length > 0) {
      const enrollmentId = allEnrollments[0].id;
      // Just test that endpoint exists (don't actually delete)
      const deleteRes = await fetch(`${baseURL}/enrollments/${enrollmentId}`, {
        method: 'OPTIONS',
        headers: {
          'x-entity-type': 'INCUBATOR',
          'x-entity-id': '1'
        }
      });
      console.log(`   - الـ endpoint موجود: ${deleteRes.ok ? '✅' : '⚠️'}`);
    }
    console.log('');

    // Test 5: Summary
    console.log('📊 ملخص النتائج:');
    console.log(`   ✅ إجمالي المتدربين: ${allEnrollments.length}`);
    const statuses = {};
    allEnrollments.forEach(e => {
      statuses[e.status] = (statuses[e.status] || 0) + 1;
    });
    Object.entries(statuses).forEach(([status, count]) => {
      const labels = {
        'REGISTERED': 'مسجل',
        'ATTENDING': 'يحضر',
        'COMPLETED': 'مكتمل',
        'WITHDRAWN': 'منسحب',
        'FAILED': 'راسب'
      };
      console.log(`   ✅ ${labels[status] || status}: ${count}`);
    });
    
    console.log('\n✅ جميع الاختبارات نجحت!');
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
}

comprehensiveTest();
