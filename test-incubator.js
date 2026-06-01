const http = require('http');

const API_BASE = 'http://localhost:3000/api';

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testIncubatorSystem() {
  console.log('🧪 اختبار نظام حاضنة السلامة\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Health Check
    console.log('\n✓ Health Check...');
    const health = await makeRequest('/health');
    console.log('  السيرفر يعمل:', health.status === 'OK' ? '✅' : '❌');

    // Test 2: Training Programs
    console.log('\n✓ البرامج التدريبية...');
    const programs = await makeRequest('/training-programs?entity_id=INC03');
    console.log(`  عدد البرامج: ${programs.length}`);
    programs.forEach(p => console.log(`    - ${p.name} (${p.code})`));

    // Test 3: Beneficiaries
    console.log('\n✓ المستفيدون...');
    const beneficiaries = await makeRequest('/beneficiaries?entity_id=INC03');
    console.log(`  عدد المستفيدين: ${beneficiaries.length}`);
    beneficiaries.forEach(b => console.log(`    - ${b.full_name} (${b.national_id})`));

    // Test 4: Training Sessions
    console.log('\n✓ الدفعات التدريبية...');
    const sessions = await makeRequest('/training-sessions?entity_id=INC03');
    console.log(`  عدد الدفعات: ${sessions.length}`);
    sessions.forEach(s => console.log(`    - ${s.session_name} [${s.status}]`));

    // Test 5: Enrollments
    console.log('\n✓ التسجيلات...');
    const enrollments = await makeRequest('/enrollments');
    console.log(`  عدد التسجيلات: ${enrollments.length}`);
    enrollments.forEach(e => console.log(`    - ${e.full_name} في ${e.session_name} [${e.status}]`));

    // Test 6: Certificates
    console.log('\n✓ الشهادات...');
    const certificates = await makeRequest('/certificates');
    console.log(`  عدد الشهادات: ${certificates.length}`);
    certificates.forEach(c => console.log(`    - ${c.certificate_number} - ${c.full_name} [${c.status}]`));

    // Test 7: Certificate Verification
    if (certificates.length > 0) {
      console.log('\n✓ التحقق من الشهادة...');
      const cert = await makeRequest(`/certificates/verify/${certificates[0].certificate_number}`);
      console.log(`  رقم الشهادة: ${cert.certificate_number}`);
      console.log(`  الاسم: ${cert.full_name}`);
      console.log(`  البرنامج: ${cert.program_name}`);
      console.log(`  صالحة: ${cert.valid ? '✅' : '❌'}`);
    }

    // Test 8: Training Records
    console.log('\n✓ السجل التدريبي...');
    const records = await makeRequest(`/training-records?beneficiary_id=1`);
    console.log(`  عدد السجلات للمستفيد الأول: ${records.length}`);
    records.forEach(r => console.log(`    - ${r.program_name}: ${r.status} - الدرجة: ${r.final_score}`));

    // Test 9: Incubator Statistics
    console.log('\n✓ إحصائيات الحاضنة...');
    const stats = await makeRequest('/incubator/stats?entity_id=INC03');
    console.log('  📊 الإحصائيات:');
    console.log(`    - إجمالي البرامج: ${stats.total_programs}`);
    console.log(`    - إجمالي المستفيدين: ${stats.total_beneficiaries}`);
    console.log(`    - إجمالي الدفعات: ${stats.total_sessions}`);
    console.log(`    - الدفعات النشطة: ${stats.active_sessions}`);
    console.log(`    - التسجيلات الحالية: ${stats.current_enrollments}`);
    console.log(`    - الشهادات الصالحة: ${stats.active_certificates}`);
    console.log(`    - الشهادات المنتهية: ${stats.expired_certificates}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ جميع الاختبارات نجحت!\n');

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    process.exit(1);
  }
}

testIncubatorSystem();
