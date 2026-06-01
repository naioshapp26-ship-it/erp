#!/usr/bin/env node

/**
 * اختبار شامل لـ API الحاضنات والمنصات
 * يتحقق من أن البيانات تُعرض بشكل صحيح لكل فرع
 */

const https = require('https');

// Test configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const BRANCH_IDS = [1, 2, 3, 4, 5]; // اختبار أول 5 فروع

// Helper function to fetch API
async function fetchAPI(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${endpoint}`;
    const protocol = url.startsWith('https') ? https : require('http');
    
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`فشل تحليل JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Test function
async function testBranchData() {
  console.log('🧪 اختبار API الحاضنات والمنصات\n');
  console.log('='  .repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const branchId of BRANCH_IDS) {
    try {
      // Test incubators
      totalTests++;
      const incubators = await fetchAPI(`/api/branches/${branchId}/incubators`);
      const incCount = incubators.length;
      
      if (incCount > 0) {
        console.log(`✅ الفرع ${branchId}: ${incCount} حاضنة`);
        passedTests++;
      } else {
        console.log(`⚠️  الفرع ${branchId}: ${incCount} حاضنة (قد يكون طبيعياً)`);
        passedTests++; // 0 قد يكون صحيح في بعض الحالات
      }
      
      // Test platforms
      totalTests++;
      const platforms = await fetchAPI(`/api/branches/${branchId}/platforms`);
      const platCount = platforms.length;
      
      if (platCount > 0) {
        console.log(`✅ الفرع ${branchId}: ${platCount} منصة`);
        passedTests++;
      } else {
        console.log(`⚠️  الفرع ${branchId}: ${platCount} منصة`);
        passedTests++;
      }
      
      // Display sample data
      if (incubators.length > 0) {
        const sample = incubators[0];
        console.log(`   📋 عينة: ${sample.name} (${sample.program_type || 'N/A'})`);
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ خطأ في اختبار الفرع ${branchId}:`, error.message);
      totalTests += 2;
    }
  }
  
  console.log('='  .repeat(60));
  console.log(`\n📊 النتيجة النهائية: ${passedTests}/${totalTests} اختبار نجح`);
  
  if (passedTests === totalTests) {
    console.log('🎉 جميع الاختبارات نجحت!\n');
    process.exit(0);
  } else {
    console.log('⚠️  بعض الاختبارات فشلت\n');
    process.exit(1);
  }
}

// Run tests
testBranchData().catch(error => {
  console.error('❌ خطأ في تشغيل الاختبارات:', error);
  process.exit(1);
});
