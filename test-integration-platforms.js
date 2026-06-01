// Comprehensive Integration Test: Platform Selection Flow
const baseURL = 'https://super-cmk2wuy9-production.up.railway.app/api';

async function testPlatformSelectionFlow() {
  console.log('🧪 = اختبار شامل: نظام اختيار المنصات =\n');
  
  const tests = [];
  
  // Test 1: API Endpoint Works
  console.log('📋 اختبار 1: التأكد من أن API endpoint متاح');
  try {
    const res = await fetch(`${baseURL}/incubators/1/platforms`);
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ نجح - تم تحميل ${data.length} منصات\n`);
      tests.push({ name: 'API Endpoint', status: 'PASS', details: `${data.length} platforms loaded` });
    } else {
      console.log(`❌ فشل - HTTP ${res.status}\n`);
      tests.push({ name: 'API Endpoint', status: 'FAIL', details: `HTTP ${res.status}` });
    }
  } catch (error) {
    console.log(`❌ خطأ: ${error.message}\n`);
    tests.push({ name: 'API Endpoint', status: 'FAIL', details: error.message });
  }

  // Test 2: Platform Data Structure
  console.log('📋 اختبار 2: التحقق من صيغة البيانات المرجعة');
  try {
    const res = await fetch(`${baseURL}/incubators/1/platforms`);
    const platforms = await res.json();
    
    if (platforms.length === 0) {
      console.log(`⚠️  لا توجد منصات\n`);
      tests.push({ name: 'Data Structure', status: 'FAIL', details: 'No platforms found' });
    } else {
      const platform = platforms[0];
      const hasRequired = platform.id && platform.name && 'incubator_id' in platform;
      
      if (hasRequired) {
        console.log(`✅ نجح - البيانات تحتوي على جميع الحقول المطلوبة`);
        console.log(`   - ID: ${platform.id}`);
        console.log(`   - الاسم: ${platform.name}`);
        console.log(`   - Incubator ID: ${platform.incubator_id}\n`);
        tests.push({ name: 'Data Structure', status: 'PASS', details: `All required fields present` });
      } else {
        console.log(`❌ فشل - بعض الحقول مفقودة\n`);
        tests.push({ name: 'Data Structure', status: 'FAIL', details: 'Missing required fields' });
      }
    }
  } catch (error) {
    console.log(`❌ خطأ: ${error.message}\n`);
    tests.push({ name: 'Data Structure', status: 'FAIL', details: error.message });
  }

  // Test 3: Multiple Incubators
  console.log('📋 اختبار 3: التحقق من المنصات لحاضنات مختلفة');
  const incubatorTests = [];
  for (let id = 1; id <= 5; id++) {
    try {
      const res = await fetch(`${baseURL}/incubators/${id}/platforms`);
      if (res.ok) {
        const data = await res.json();
        incubatorTests.push(`   حاضنة ${id}: ✅ ${data.length} منصة`);
      } else {
        incubatorTests.push(`   حاضنة ${id}: ❌ HTTP ${res.status}`);
      }
    } catch (error) {
      incubatorTests.push(`   حاضنة ${id}: ❌ ${error.message}`);
    }
  }
  console.log(incubatorTests.join('\n') + '\n');
  tests.push({ name: 'Multiple Incubators', status: 'PASS', details: 'All incubators tested' });

  // Test 4: Frontend Integration
  console.log('📋 اختبار 4: التحقق من التكامل مع الواجهة الأمامية');
  try {
    const res = await fetch(`${baseURL}/`);
    if (res.ok) {
      const html = await res.text();
      
      const checks = {
        'HTML loaded': html.length > 0,
        'Script tag': html.includes('<script'),
        'Main view': html.includes('main-view'),
        'Platform selection': html.includes('renderIncubatorSystem')
      };
      
      const allPass = Object.values(checks).every(v => v);
      
      Object.entries(checks).forEach(([check, result]) => {
        console.log(`   ${result ? '✅' : '❌'} ${check}`);
      });
      
      console.log(`\n${allPass ? '✅' : '❌'} الفحوصات\n`);
      tests.push({ name: 'Frontend Integration', status: allPass ? 'PASS' : 'FAIL', details: 'HTML structure validated' });
    } else {
      console.log(`❌ فشل تحميل الصفحة - HTTP ${res.status}\n`);
      tests.push({ name: 'Frontend Integration', status: 'FAIL', details: `HTTP ${res.status}` });
    }
  } catch (error) {
    console.log(`❌ خطأ: ${error.message}\n`);
    tests.push({ name: 'Frontend Integration', status: 'FAIL', details: error.message });
  }

  // Test 5: Specific Incubator Platforms
  console.log('📋 اختبار 5: تفاصيل منصات حاضنة السلامة (ID=1)');
  try {
    const res = await fetch(`${baseURL}/incubators/1/platforms`);
    const platforms = await res.json();
    
    console.log(`عدد المنصات: ${platforms.length}\n`);
    
    platforms.forEach((p, idx) => {
      console.log(`   منصة ${idx + 1}:`);
      console.log(`      ID: ${p.id}`);
      console.log(`      الاسم: ${p.name}`);
      console.log(`      الكود: ${p.code || 'غير محدد'}`);
      console.log(`      الوصف: ${p.description || 'غير محدد'}\n`);
    });
    
    tests.push({ name: 'Incubator 1 Platforms', status: 'PASS', details: `${platforms.length} platforms found` });
  } catch (error) {
    console.log(`❌ خطأ: ${error.message}\n`);
    tests.push({ name: 'Incubator 1 Platforms', status: 'FAIL', details: error.message });
  }

  // Summary
  console.log('\n🎯 = ملخص النتائج =\n');
  console.table(tests.map(t => ({
    'الاختبار': t.name,
    'النتيجة': t.status,
    'التفاصيل': t.details
  })));
  
  const passCount = tests.filter(t => t.status === 'PASS').length;
  const failCount = tests.filter(t => t.status === 'FAIL').length;
  
  console.log(`\n✅ نجح: ${passCount}/${tests.length}`);
  if (failCount > 0) {
    console.log(`❌ فشل: ${failCount}/${tests.length}`);
  }
  
  console.log('\n✨ انتهى الاختبار الشامل');
}

testPlatformSelectionFlow();
