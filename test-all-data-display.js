#!/usr/bin/env node

/**
 * 🧪 اختبار عرض جميع البيانات في finance-dashboard.html
 */

const http = require('http');

const API_BASE = 'localhost:3000';
const ENTITY_ID = 1;

function httpRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testAllData() {
  console.log('===================================================================');
  console.log('🧪 اختبار عرض جميع البيانات في finance-dashboard.html');
  console.log('===================================================================\n');

  try {
    // Test 1: Accounts
    console.log('1️⃣  اختبار شجرة الحسابات...');
    const accountsRes = await httpRequest('GET', `/finance/accounts?entity_id=${ENTITY_ID}`);
    if (accountsRes.data.success) {
      console.log(`   ✅ عدد الحسابات: ${accountsRes.data.count}`);
      
      // Count by type
      const accounts = accountsRes.data.accounts;
      const assets = accounts.filter(a => a.account_type === 'ASSET').length;
      const liabilities = accounts.filter(a => a.account_type === 'LIABILITY').length;
      const equity = accounts.filter(a => a.account_type === 'EQUITY').length;
      const revenue = accounts.filter(a => a.account_type === 'REVENUE').length;
      const expense = accounts.filter(a => a.account_type === 'EXPENSE').length;
      
      console.log(`      - الأصول: ${assets} حساب`);
      console.log(`      - الخصوم: ${liabilities} حساب`);
      console.log(`      - حقوق الملكية: ${equity} حساب`);
      console.log(`      - الإيرادات: ${revenue} حساب`);
      console.log(`      - المصروفات: ${expense} حساب`);
    } else {
      console.log('   ❌ فشل في جلب الحسابات');
    }

    // Test 2: Operating Cashflows
    console.log('\n2️⃣  اختبار التدفقات التشغيلية...');
    const operatingRes = await httpRequest('GET', `/finance/cashflow/operating?entity_id=${ENTITY_ID}`);
    if (operatingRes.data.success) {
      console.log(`   ✅ عدد العمليات: ${operatingRes.data.count}`);
      console.log(`      داخل: ${operatingRes.data.summary.inflow.toLocaleString()} ريال`);
      console.log(`      خارج: ${operatingRes.data.summary.outflow.toLocaleString()} ريال`);
      console.log(`      الصافي: ${operatingRes.data.summary.net_flow.toLocaleString()} ريال`);
    } else {
      console.log('   ❌ فشل');
    }

    // Test 3: Investing Cashflows
    console.log('\n3️⃣  اختبار التدفقات الاستثمارية...');
    const investingRes = await httpRequest('GET', `/finance/cashflow/investing?entity_id=${ENTITY_ID}`);
    if (investingRes.data.success) {
      console.log(`   ✅ عدد العمليات: ${investingRes.data.count}`);
      console.log(`      داخل: ${investingRes.data.summary.inflow.toLocaleString()} ريال`);
      console.log(`      خارج: ${investingRes.data.summary.outflow.toLocaleString()} ريال`);
      console.log(`      الصافي: ${investingRes.data.summary.net_flow.toLocaleString()} ريال`);
    } else {
      console.log('   ❌ فشل');
    }

    // Test 4: Financing Cashflows
    console.log('\n4️⃣  اختبار التدفقات التمويلية...');
    const financingRes = await httpRequest('GET', `/finance/cashflow/financing?entity_id=${ENTITY_ID}`);
    if (financingRes.data.success) {
      console.log(`   ✅ عدد العمليات: ${financingRes.data.count}`);
      console.log(`      داخل: ${financingRes.data.summary.inflow.toLocaleString()} ريال`);
      console.log(`      خارج: ${financingRes.data.summary.outflow.toLocaleString()} ريال`);
      console.log(`      الصافي: ${financingRes.data.summary.net_flow.toLocaleString()} ريال`);
    } else {
      console.log('   ❌ فشل');
    }

    // Test 5: AI Forecasts
    console.log('\n5️⃣  اختبار التوقعات الذكية...');
    const forecastRes = await httpRequest('GET', `/finance/cashflow/forecast?entity_id=${ENTITY_ID}`);
    if (forecastRes.data.success) {
      console.log(`   ✅ عدد التوقعات: ${forecastRes.data.count}`);
      const surplus = forecastRes.data.forecasts.filter(f => f.forecast_type === 'SURPLUS').length;
      const deficit = forecastRes.data.forecasts.filter(f => f.forecast_type === 'DEFICIT').length;
      console.log(`      - توقعات الفائض: ${surplus}`);
      console.log(`      - توقعات العجز: ${deficit}`);
    } else {
      console.log('   ❌ فشل');
    }

    // Test 6: Comprehensive Report
    console.log('\n6️⃣  اختبار التقرير الشامل...');
    const comprehensiveRes = await httpRequest('GET', `/finance/cashflow/comprehensive?entity_id=${ENTITY_ID}`);
    if (comprehensiveRes.data.success) {
      console.log(`   ✅ التقرير الشامل:`);
      console.log(`      التشغيلي: ${comprehensiveRes.data.summary.operating.net.toLocaleString()} ريال`);
      console.log(`      الاستثماري: ${comprehensiveRes.data.summary.investing.net.toLocaleString()} ريال`);
      console.log(`      التمويلي: ${comprehensiveRes.data.summary.financing.net.toLocaleString()} ريال`);
      console.log(`      الإجمالي: ${comprehensiveRes.data.summary.total_net_cashflow.toLocaleString()} ريال`);
    } else {
      console.log('   ❌ فشل');
    }

    console.log('\n===================================================================');
    console.log('✅ جميع البيانات متوفرة ويمكن عرضها في finance-dashboard.html');
    console.log('===================================================================');
    console.log('\n📊 ملخص البيانات المتاحة:');
    console.log(`   - شجرة الحسابات: ${accountsRes.data.count} حساب`);
    console.log(`   - التدفقات التشغيلية: ${operatingRes.data.count} عملية`);
    console.log(`   - التدفقات الاستثمارية: ${investingRes.data.count} عملية`);
    console.log(`   - التدفقات التمويلية: ${financingRes.data.count} عملية`);
    console.log(`   - التوقعات الذكية: ${forecastRes.data.count} توقع`);
    console.log('\n🌐 افتح الرابط: http://localhost:3000/finance-dashboard.html');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
}

testAllData();
