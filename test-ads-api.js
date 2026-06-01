const API_URL = 'http://localhost:3000/api';

async function testAdsAPI() {
  try {
    console.log('🧪 اختبار API الإعلانات...\n');
    
    // Test 1: HQ يرى جميع الإعلانات
    console.log('1️⃣ اختبار: المكتب الرئيسي (HQ) يرى جميع الإعلانات');
    const hqResponse = await fetch(`${API_URL}/ads`, {
      headers: {
        'x-entity-type': 'HQ',
        'x-entity-id': 'HQ001'
      }
    });
    
    const hqData = await hqResponse.json();
    
    console.log(`   ✅ عدد الإعلانات للمكتب الرئيسي: ${hqData.length}`);
    console.log(`   📋 قائمة الإعلانات:`);
    hqData.forEach((ad, index) => {
      console.log(`      ${index + 1}. ${ad.title} (Entity: ${ad.entity_id}, Source: ${ad.source_entity_id || 'N/A'})`);
    });
    
    // Test 2: فرع محدد يرى إعلاناته فقط
    console.log('\n2️⃣ اختبار: الفرع (BR015) يرى إعلاناته');
    const branchResponse = await fetch(`${API_URL}/ads`, {
      headers: {
        'x-entity-type': 'BRANCH',
        'x-entity-id': 'BR015'
      }
    });
    
    const branchData = await branchResponse.json();
    
    console.log(`   ✅ عدد الإعلانات للفرع BR015: ${branchData.length}`);
    branchData.forEach((ad, index) => {
      console.log(`      ${index + 1}. ${ad.title} (Entity: ${ad.entity_id})`);
    });
    
    // Test 3: منصة
    console.log('\n3️⃣ اختبار: المنصة (PLT01) يرى إعلاناته');
    const platformResponse = await fetch(`${API_URL}/ads`, {
      headers: {
        'x-entity-type': 'PLATFORM',
        'x-entity-id': 'PLT01'
      }
    });
    
    const platformData = await platformResponse.json();
    
    console.log(`   ✅ عدد الإعلانات للمنصة PLT01: ${platformData.length}`);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  }
}

testAdsAPI();
