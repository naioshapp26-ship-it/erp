#!/usr/bin/env node
/**
 * Data Isolation Tests - تحقق من عزل البيانات الكامل
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: defaultHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testDataIsolation() {
  console.log('🔐 اختبار عزل البيانات المتعدد المستأجرين\n');

  const testCases = [
    {
      name: 'المقر الرئيسي HQ001',
      headers: { 'x-entity-type': 'HQ', 'x-entity-id': 'HQ001' },
      tests: [
        { endpoint: '/api/employees', expectedMin: 3, expectedMax: 5, label: 'الموظفين' },
        { endpoint: '/api/invoices', expectedMin: 3, expectedMax: 5, label: 'الفواتير' },
        { endpoint: '/api/ads', expectedMin: 8, expectedMax: 12, label: 'الإعلانات' },
        { endpoint: '/api/users', expectedMin: 8, expectedMax: 12, label: 'المستخدمين' }
      ]
    },
    {
      name: 'الفرع BR015',
      headers: { 'x-entity-type': 'BRANCH', 'x-entity-id': 'BR015' },
      tests: [
        { endpoint: '/api/employees', expectedMin: 1, expectedMax: 1, label: 'الموظفين' },
        { endpoint: '/api/invoices', expectedMin: 3, expectedMax: 3, label: 'الفواتير' },
        { endpoint: '/api/ads', expectedMin: 2, expectedMax: 2, label: 'الإعلانات' }
      ]
    }
  ];

  for (const testCase of testCases) {
    console.log(`📍 ${testCase.name}`);
    console.log('═'.repeat(50));

    for (const test of testCase.tests) {
      try {
        const response = await makeRequest(test.endpoint, testCase.headers);
        const count = Array.isArray(response.data) ? response.data.length : 0;
        const passed = count >= test.expectedMin && count <= test.expectedMax;

        const icon = passed ? '✅' : '❌';
        console.log(`${icon} ${test.label}: ${count} (متوقع: ${test.expectedMin}-${test.expectedMax})`);

        if (!passed) {
          console.log(`   ⚠️  تحذير: النتيجة غير متطابقة!`);
        }
      } catch (error) {
        console.log(`❌ ${test.label}: خطأ - ${error.message}`);
      }
    }
    console.log();
  }

  console.log('═'.repeat(50));
  console.log('✨ اكتملت الاختبارات!');
}

// Run tests
testDataIsolation().catch(console.error);
