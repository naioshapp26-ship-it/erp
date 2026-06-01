#!/usr/bin/env node

/**
 * 🧪 اختبار شامل للنظام المالي - الصفحة 1
 * Testing Finance Dashboard UI Integration
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

console.log('===================================================================');
console.log('🧪 اختبار شامل لنظام المالية - الصفحة 1 + الواجهة الأمامية');
console.log('===================================================================\n');

async function testAll() {
  let passCount = 0;
  let failCount = 0;

  // Test 1: Comprehensive Report
  console.log('1️⃣  اختبار التقرير الشامل...');
  try {
    const res = await httpRequest('GET', `/finance/cashflow/comprehensive?entity_id=${ENTITY_ID}`);
    if (res.data.success && res.data.summary) {
      console.log('   ✅ التقرير الشامل يعمل');
      console.log(`      التشغيلي: ${res.data.summary.operating.net.toLocaleString()} ريال`);
      console.log(`      الاستثماري: ${res.data.summary.investing.net.toLocaleString()} ريال`);
      console.log(`      التمويلي: ${res.data.summary.financing.net.toLocaleString()} ريال`);
      console.log(`      الإجمالي: ${res.data.summary.total_net_cashflow.toLocaleString()} ريال`);
      passCount++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ❌ فشل التقرير الشامل:', error.message);
    failCount++;
  }

  // Test 2: Operating GET
  console.log('\n2️⃣  اختبار GET للتدفقات التشغيلية...');
  try {
    const res = await httpRequest('GET', `/finance/cashflow/operating?entity_id=${ENTITY_ID}`);
    if (res.data.success && res.data.summary && res.data.flows) {
      console.log('   ✅ GET التشغيلي يعمل');
      console.log(`      عدد العمليات: ${res.data.count}`);
      console.log(`      داخل: ${res.data.summary.inflow.toLocaleString()} ريال`);
      console.log(`      خارج: ${res.data.summary.outflow.toLocaleString()} ريال`);
      console.log(`      صافي: ${res.data.summary.net_flow.toLocaleString()} ريال`);
      passCount++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ❌ فشل GET التشغيلي:', error.message);
    failCount++;
  }

  // Test 3: Operating POST
  console.log('\n3️⃣  اختبار POST للتدفقات التشغيلية...');
  try {
    const res = await httpRequest('POST', `/finance/cashflow/operating`, {
      entity_id: ENTITY_ID,
      flow_type: 'vendor_payment',
      amount: 5000,
      description: 'دفع لمورد - اختبار شامل',
      flow_date: '2026-01-26'
    });
    if (res.data.success && res.data.cashflow) {
      console.log('   ✅ POST التشغيلي يعمل');
      console.log(`      ID: ${res.data.cashflow.cashflow_id}`);
      console.log(`      المبلغ: ${parseFloat(res.data.cashflow.amount).toLocaleString()} ريال`);
      passCount++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ❌ فشل POST التشغيلي:', error.message);
    failCount++;
  }

  // Test 4: Investing POST
  console.log('\n4️⃣  اختبار POST للتدفقات الاستثمارية...');
  try {
    const res = await httpRequest('POST', `/finance/cashflow/investing`, {
      entity_id: ENTITY_ID,
      flow_type: 'equipment_purchase',
      amount: 15000,
      description: 'شراء معدات - اختبار شامل',
      flow_date: '2026-01-26'
    });
    if (res.data.success && res.data.cashflow) {
      console.log('   ✅ POST الاستثماري يعمل');
      console.log(`      ID: ${res.data.cashflow.cashflow_id}`);
      console.log(`      المبلغ: ${parseFloat(res.data.cashflow.amount).toLocaleString()} ريال`);
      passCount++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ❌ فشل POST الاستثماري:', error.message);
    failCount++;
  }

  // Test 5: Financing POST
  console.log('\n5️⃣  اختبار POST للتدفقات التمويلية...');
  try {
    const res = await httpRequest('POST', `/finance/cashflow/financing`, {
      entity_id: ENTITY_ID,
      flow_type: 'capital_increase',
      amount: 100000,
      description: 'زيادة رأس المال - اختبار شامل',
      flow_date: '2026-01-26'
    });
    if (res.data.success && res.data.cashflow) {
      console.log('   ✅ POST التمويلي يعمل');
      console.log(`      ID: ${res.data.cashflow.cashflow_id}`);
      console.log(`      المبلغ: ${parseFloat(res.data.cashflow.amount).toLocaleString()} ريال`);
      passCount++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ❌ فشل POST التمويلي:', error.message);
    failCount++;
  }

  // Test 6: AI Forecast POST
  console.log('\n6️⃣  اختبار POST للتوقعات الذكية...');
  try {
    const res = await httpRequest('POST', `/finance/cashflow/forecast`, {
      entity_id: ENTITY_ID,
      forecast_type: 'surplus',
      forecast_date: '2026-02-01',
      predicted_amount: 50000,
      confidence_level: 90,
      lower_bound: 40000,
      upper_bound: 60000,
      influencing_factors: ['زيادة المبيعات', 'تحسن التحصيل']
    });
    if (res.data.success && res.data.forecast) {
      console.log('   ✅ POST التوقعات يعمل');
      console.log(`      ID: ${res.data.forecast.forecast_id}`);
      console.log(`      التوقع: ${parseFloat(res.data.forecast.predicted_amount).toLocaleString()} ريال`);
      console.log(`      الثقة: ${res.data.forecast.confidence_level}%`);
      passCount++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ❌ فشل POST التوقعات:', error.message);
    failCount++;
  }

  // Test 7: AI Forecast GET
  console.log('\n7️⃣  اختبار GET للتوقعات الذكية...');
  try {
    const res = await httpRequest('GET', `/finance/cashflow/forecast?entity_id=${ENTITY_ID}`);
    if (res.data.success && res.data.forecasts) {
      console.log('   ✅ GET التوقعات يعمل');
      console.log(`      عدد التوقعات: ${res.data.forecasts.length}`);
      passCount++;
    } else {
      throw new Error('Invalid response');
    }
  } catch (error) {
    console.log('   ❌ فشل GET التوقعات:', error.message);
    failCount++;
  }

  // Test 8: Check Dashboard HTML
  console.log('\n8️⃣  اختبار صفحة الواجهة الأمامية...');
  try {
    const res = await httpRequest('GET', `/finance-dashboard.html`);
    if (res.status === 200 && res.data.includes('نظام المالية')) {
      console.log('   ✅ صفحة الواجهة متاحة');
      console.log(`      الرابط: http://localhost:3000/finance-dashboard.html`);
      passCount++;
    } else {
      throw new Error('Invalid HTML');
    }
  } catch (error) {
    console.log('   ❌ فشل صفحة الواجهة:', error.message);
    failCount++;
  }

  // Summary
  console.log('\n===================================================================');
  console.log('📊 ملخص الاختبار:');
  console.log(`   ✅ نجح: ${passCount} اختبار`);
  console.log(`   ❌ فشل: ${failCount} اختبار`);
  console.log(`   📈 نسبة النجاح: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log('===================================================================');

  if (failCount === 0) {
    console.log('\n🎉 جميع الاختبارات نجحت! النظام جاهز للاستخدام.');
    console.log('🌐 افتح الرابط: http://localhost:3000/finance-dashboard.html');
  } else {
    console.log('\n⚠️  بعض الاختبارات فشلت، يرجى المراجعة.');
  }
}

testAll().catch(error => {
  console.error('❌ خطأ في الاختبار:', error.message);
  process.exit(1);
});
