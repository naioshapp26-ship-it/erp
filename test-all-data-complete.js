const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + data.substring(0, 100)));
        }
      });
    }).on('error', reject);
  });
}

async function testAllData() {
  try {
    console.log('🧪 اختبار شامل لجميع البيانات في قاعدة البيانات Railway...\n');

    // Test 1: Accounts
    console.log('1️⃣ شجرة الحسابات:');
    const accounts = await httpGet(`${BASE_URL}/finance/accounts?entity_id=1`);
    console.log(`   ✅ العدد: ${accounts.accounts?.length || 0}`);
    
    if (accounts.accounts && accounts.accounts.length > 0) {
      const types = {};
      accounts.accounts.forEach(acc => {
        types[acc.account_type] = (types[acc.account_type] || 0) + 1;
      });
      Object.keys(types).forEach(type => {
        console.log(`      - ${type}: ${types[type]} حساب`);
      });
    }
    console.log();

    // Test 2: Operating Cashflows
    console.log('2️⃣ التدفقات التشغيلية:');
    const operating = await httpGet(`${BASE_URL}/finance/cashflow/operating?entity_id=1`);
    console.log(`   ✅ العدد: ${operating.cashflows?.length || 0}`);
    if (operating.summary) {
      console.log(`      - الداخل: ${operating.summary.inflow} ريال`);
      console.log(`      - الخارج: ${operating.summary.outflow} ريال`);
      console.log(`      - الصافي: ${operating.summary.net_flow} ريال`);
    }
    console.log();

    // Test 3: Investing Cashflows
    console.log('3️⃣ التدفقات الاستثمارية:');
    const investing = await httpGet(`${BASE_URL}/finance/cashflow/investing?entity_id=1`);
    console.log(`   ✅ العدد: ${investing.cashflows?.length || 0}`);
    if (investing.summary) {
      console.log(`      - الداخل: ${investing.summary.inflow} ريال`);
      console.log(`      - الخارج: ${investing.summary.outflow} ريال`);
      console.log(`      - الصافي: ${investing.summary.net_flow} ريال`);
    }
    console.log();

    // Test 4: Financing Cashflows
    console.log('4️⃣ التدفقات التمويلية:');
    const financing = await httpGet(`${BASE_URL}/finance/cashflow/financing?entity_id=1`);
    console.log(`   ✅ العدد: ${financing.cashflows?.length || 0}`);
    if (financing.summary) {
      console.log(`      - الداخل: ${financing.summary.inflow} ريال`);
      console.log(`      - الخارج: ${financing.summary.outflow} ريال`);
      console.log(`      - الصافي: ${financing.summary.net_flow} ريال`);
    }
    console.log();

    // Test 5: AI Forecasts
    console.log('5️⃣ التوقعات الذكية:');
    const forecasts = await httpGet(`${BASE_URL}/finance/cashflow/forecasts?entity_id=1`);
    console.log(`   ✅ العدد: ${forecasts.forecasts?.length || 0}`);
    if (forecasts.forecasts && forecasts.forecasts.length > 0) {
      forecasts.forecasts.forEach((f, i) => {
        console.log(`      ${i+1}. ${f.forecast_period}: ${f.forecast_amount} ريال (${f.forecast_type})`);
      });
    }
    console.log();

    // Test 6: Overview
    console.log('6️⃣ نظرة عامة:');
    const overview = await httpGet(`${BASE_URL}/finance/cashflow/overview?entity_id=1`);
    if (overview.success) {
      console.log(`   ✅ التشغيلي: ${overview.operating.net_cashflow} ريال`);
      console.log(`   ✅ الاستثماري: ${overview.investing.net_cashflow} ريال`);
      console.log(`   ✅ التمويلي: ${overview.financing.net_cashflow} ريال`);
      console.log(`   📊 الإجمالي الصافي: ${overview.total_net_cashflow} ريال`);
    }
    console.log();

    // Summary
    const totalRecords = 
      (accounts.accounts?.length || 0) +
      (operating.cashflows?.length || 0) +
      (investing.cashflows?.length || 0) +
      (financing.cashflows?.length || 0) +
      (forecasts.forecasts?.length || 0);

    console.log('═══════════════════════════════════════');
    console.log('📊 ملخص البيانات الإجمالي:');
    console.log('═══════════════════════════════════════');
    console.log(`✅ إجمالي السجلات: ${totalRecords} سجل`);
    console.log(`   - الحسابات: ${accounts.accounts?.length || 0}`);
    console.log(`   - التدفقات التشغيلية: ${operating.cashflows?.length || 0}`);
    console.log(`   - التدفقات الاستثمارية: ${investing.cashflows?.length || 0}`);
    console.log(`   - التدفقات التمويلية: ${financing.cashflows?.length || 0}`);
    console.log(`   - التوقعات الذكية: ${forecasts.forecasts?.length || 0}`);
    console.log('═══════════════════════════════════════');
    console.log('\n✅ جميع البيانات متوفرة وجاهزة للعرض!');

  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    process.exit(1);
  }
}

testAllData();
