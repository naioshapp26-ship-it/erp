const http = require('http');

const BASE_URL = 'http://localhost:3000';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    }).on('error', reject);
  });
}

async function testAPIs() {
  try {
    console.log('🧪 اختبار APIs المالية...\n');

    // Test 1: Accounts
    console.log('1️⃣ اختبار شجرة الحسابات...');
    const accountsRes = await httpGet(`${BASE_URL}/finance/accounts?entity_id=1`);
    console.log(`✅ الحسابات: ${accountsRes.accounts?.length || 0} حساب\n`);

    // Test 2: Operating Cashflow
    console.log('2️⃣ اختبار التدفقات التشغيلية...');
    const operatingRes = await httpGet(`${BASE_URL}/finance/cashflow/operating?entity_id=1`);
    console.log(`✅ التدفقات التشغيلية: ${operatingRes.cashflows?.length || 0} عملية\n`);

    // Test 3: Investing Cashflow
    console.log('3️⃣ اختبار التدفقات الاستثمارية...');
    const investingRes = await httpGet(`${BASE_URL}/finance/cashflow/investing?entity_id=1`);
    console.log(`✅ التدفقات الاستثمارية: ${investingRes.cashflows?.length || 0} عملية\n`);

    // Test 4: Financing Cashflow
    console.log('4️⃣ اختبار التدفقات التمويلية...');
    const financingRes = await httpGet(`${BASE_URL}/finance/cashflow/financing?entity_id=1`);
    console.log(`✅ التدفقات التمويلية: ${financingRes.cashflows?.length || 0} عملية\n`);

    // Test 5: AI Forecasts
    console.log('5️⃣ اختبار التوقعات الذكية...');
    const forecastsRes = await httpGet(`${BASE_URL}/finance/cashflow/forecasts?entity_id=1`);
    console.log(`✅ التوقعات الذكية: ${forecastsRes.forecasts?.length || 0} توقع\n`);

    // Test 6: Overview
    console.log('6️⃣ اختبار نظرة عامة...');
    const overviewRes = await httpGet(`${BASE_URL}/finance/cashflow/overview?entity_id=1`);
    console.log(`✅ النظرة العامة:`);
    console.log(`   - التشغيلي: ${overviewRes.operating?.net_cashflow || 0} ريال`);
    console.log(`   - الاستثماري: ${overviewRes.investing?.net_cashflow || 0} ريال`);
    console.log(`   - التمويلي: ${overviewRes.financing?.net_cashflow || 0} ريال\n`);

    console.log('✅ جميع الاختبارات نجحت!');

  } catch (error) {
    console.error('❌ خطأ في الاختبار:', error.message);
    process.exit(1);
  }
}

testAPIs();
