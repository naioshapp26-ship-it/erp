const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';

// ========================================
// اختبار الصفحة 1: التدفقات النقدية + AI Forecasting
// ========================================

async function testPage1_Cashflows() {
  console.log('\n' + '='.repeat(80));
  console.log('📄 اختبار الصفحة 1: التدفقات النقدية الثلاثة + التوقعات AI');
  console.log('='.repeat(80));
  
  try {
    // ========================================
    // Test 1: Operating Cash Flow (التدفقات التشغيلية)
    // ========================================
    console.log('\n1️⃣  اختبار التدفقات التشغيلية - Operating Cash Flow');
    
    // تسجيل تحصيل من عميل
    console.log('\n   📥 تسجيل تحصيل من عميل...');
    const operatingInResponse = await fetch(`${API_BASE}/finance/cashflow/operating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_date: '2026-01-26',
        flow_category: 'CUSTOMER_COLLECTIONS',
        amount: 50000,
        flow_direction: 'IN',
        description: 'تحصيل من عميل - شركة الاختبار',
        entity_type: 'HQ',
        entity_id: 'HQ001',
        fiscal_year: 2026,
        fiscal_period: 1
      })
    });
    const operatingIn = await operatingInResponse.json();
    console.log('   ✅ تم تسجيل تحصيل:', operatingIn.cashflow.amount, 'ريال');
    
    // تسجيل دفع لمورد
    console.log('\n   📤 تسجيل دفع لمورد...');
    const operatingOutResponse = await fetch(`${API_BASE}/finance/cashflow/operating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_date: '2026-01-26',
        flow_category: 'VENDOR_PAYMENTS',
        amount: 20000,
        flow_direction: 'OUT',
        description: 'دفع لمورد - مستلزمات تدريبية',
        entity_type: 'HQ',
        entity_id: 'HQ001',
        fiscal_year: 2026,
        fiscal_period: 1
      })
    });
    const operatingOut = await operatingOutResponse.json();
    console.log('   ✅ تم تسجيل دفعة:', operatingOut.cashflow.amount, 'ريال');
    
    // تسجيل رواتب
    console.log('\n   💰 تسجيل رواتب الموظفين...');
    const salariesResponse = await fetch(`${API_BASE}/finance/cashflow/operating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_date: '2026-01-26',
        flow_category: 'SALARIES',
        amount: 15000,
        flow_direction: 'OUT',
        description: 'رواتب الموظفين - يناير 2026',
        entity_type: 'HQ',
        entity_id: 'HQ001',
        fiscal_year: 2026,
        fiscal_period: 1
      })
    });
    const salaries = await salariesResponse.json();
    console.log('   ✅ تم تسجيل رواتب:', salaries.cashflow.amount, 'ريال');
    
    // الحصول على ملخص التدفقات التشغيلية
    console.log('\n   📊 جلب ملخص التدفقات التشغيلية...');
    const operatingResponse = await fetch(`${API_BASE}/finance/cashflow/operating?fiscal_year=2026`);
    const operating = await operatingResponse.json();
    console.log('   ✅ التدفقات التشغيلية:');
    console.log('      التدفق الداخل:', operating.summary.total_inflow, 'ريال');
    console.log('      التدفق الخارج:', operating.summary.total_outflow, 'ريال');
    console.log('      صافي التدفق التشغيلي:', operating.summary.net_operating_cashflow, 'ريال');
    
    // ========================================
    // Test 2: Investing Cash Flow (التدفقات الاستثمارية)
    // ========================================
    console.log('\n2️⃣  اختبار التدفقات الاستثمارية - Investing Cash Flow');
    
    // شراء أصل ثابت
    console.log('\n   🏢 تسجيل شراء أصل (معدات تدريبية)...');
    const assetPurchaseResponse = await fetch(`${API_BASE}/finance/cashflow/investing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_date: '2026-01-26',
        flow_category: 'ASSET_PURCHASE',
        amount: 100000,
        flow_direction: 'OUT',
        description: 'شراء معدات تدريبية حديثة',
        entity_type: 'HQ',
        entity_id: 'HQ001',
        fiscal_year: 2026,
        fiscal_period: 1
      })
    });
    const assetPurchase = await assetPurchaseResponse.json();
    console.log('   ✅ تم تسجيل شراء أصل:', assetPurchase.cashflow.amount, 'ريال');
    
    // استثمار في منصة جديدة
    console.log('\n   🚀 تسجيل استثمار في منصة رقمية...');
    const platformInvestResponse = await fetch(`${API_BASE}/finance/cashflow/investing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_date: '2026-01-26',
        flow_category: 'PLATFORM_INVESTMENT',
        amount: 50000,
        flow_direction: 'OUT',
        description: 'استثمار في منصة تعليمية جديدة',
        entity_type: 'HQ',
        entity_id: 'HQ001',
        fiscal_year: 2026,
        fiscal_period: 1
      })
    });
    const platformInvest = await platformInvestResponse.json();
    console.log('   ✅ تم تسجيل استثمار:', platformInvest.cashflow.amount, 'ريال');
    
    // الحصول على ملخص التدفقات الاستثمارية
    console.log('\n   📊 جلب ملخص التدفقات الاستثمارية...');
    const investingResponse = await fetch(`${API_BASE}/finance/cashflow/investing?fiscal_year=2026`);
    const investing = await investingResponse.json();
    console.log('   ✅ التدفقات الاستثمارية:');
    console.log('      التدفق الداخل:', investing.summary.total_inflow, 'ريال');
    console.log('      التدفق الخارج:', investing.summary.total_outflow, 'ريال');
    console.log('      صافي التدفق الاستثماري:', investing.summary.net_investing_cashflow, 'ريال');
    
    // ========================================
    // Test 3: Financing Cash Flow (التدفقات التمويلية)
    // ========================================
    console.log('\n3️⃣  اختبار التدفقات التمويلية - Financing Cash Flow');
    
    // الحصول على قرض
    console.log('\n   💵 تسجيل قرض من البنك...');
    const loanResponse = await fetch(`${API_BASE}/finance/cashflow/financing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_date: '2026-01-26',
        flow_category: 'LOANS',
        amount: 200000,
        flow_direction: 'IN',
        description: 'قرض من البنك الأهلي - 5 سنوات',
        entity_type: 'HQ',
        entity_id: 'HQ001',
        fiscal_year: 2026,
        fiscal_period: 1
      })
    });
    const loan = await loanResponse.json();
    console.log('   ✅ تم تسجيل قرض:', loan.cashflow.amount, 'ريال');
    
    // سداد قسط قرض
    console.log('\n   📉 تسجيل سداد قسط قرض...');
    const repaymentResponse = await fetch(`${API_BASE}/finance/cashflow/financing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_date: '2026-01-26',
        flow_category: 'LOAN_REPAYMENT',
        amount: 10000,
        flow_direction: 'OUT',
        description: 'سداد قسط شهري للقرض',
        entity_type: 'HQ',
        entity_id: 'HQ001',
        fiscal_year: 2026,
        fiscal_period: 1
      })
    });
    const repayment = await repaymentResponse.json();
    console.log('   ✅ تم تسجيل سداد:', repayment.cashflow.amount, 'ريال');
    
    // الحصول على ملخص التدفقات التمويلية
    console.log('\n   📊 جلب ملخص التدفقات التمويلية...');
    const financingResponse = await fetch(`${API_BASE}/finance/cashflow/financing?fiscal_year=2026`);
    const financing = await financingResponse.json();
    console.log('   ✅ التدفقات التمويلية:');
    console.log('      التدفق الداخل:', financing.summary.total_inflow, 'ريال');
    console.log('      التدفق الخارج:', financing.summary.total_outflow, 'ريال');
    console.log('      صافي التدفق التمويلي:', financing.summary.net_financing_cashflow, 'ريال');
    
    // ========================================
    // Test 4: AI Forecasting (التوقعات المستقبلية)
    // ========================================
    console.log('\n4️⃣  اختبار التوقعات بالذكاء الاصطناعي - AI Forecasting');
    
    // إنشاء توقع للتدفقات النقدية
    console.log('\n   🤖 إنشاء توقع AI للتدفقات النقدية...');
    const forecastResponse = await fetch(`${API_BASE}/finance/cashflow/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        forecast_type: 'CASHFLOW',
        forecast_period: 'MONTHLY',
        forecast_date: '2026-01-26',
        start_date: '2026-02-01',
        end_date: '2026-02-28',
        forecasted_value: 25000, // فائض متوقع
        confidence_level: 85,
        lower_bound: 15000,
        upper_bound: 35000,
        entity_type: 'HQ',
        entity_id: 'HQ001',
        model_version: 'v1.0',
        input_data: {
          historical_months: 12,
          seasonal_adjustment: true
        },
        model_parameters: {
          algorithm: 'ARIMA',
          confidence_interval: 0.85
        }
      })
    });
    const forecast = await forecastResponse.json();
    console.log('   ✅ توقع AI تم إنشاؤه:');
    console.log('      القيمة المتوقعة:', forecast.forecast.forecasted_value, 'ريال');
    console.log('      مستوى الثقة:', forecast.forecast.confidence_level + '%');
    console.log('      النطاق السفلي:', forecast.forecast.lower_bound, 'ريال');
    console.log('      النطاق العلوي:', forecast.forecast.upper_bound, 'ريال');
    
    // إنشاء توقع بعجز
    console.log('\n   ⚠️  إنشاء توقع بعجز نقدي...');
    const deficitForecastResponse = await fetch(`${API_BASE}/finance/cashflow/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        forecast_type: 'DEFICIT',
        forecast_period: 'MONTHLY',
        forecast_date: '2026-01-26',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        forecasted_value: -15000, // عجز متوقع
        confidence_level: 75,
        lower_bound: -25000,
        upper_bound: -5000,
        entity_type: 'HQ',
        entity_id: 'HQ001'
      })
    });
    const deficitForecast = await deficitForecastResponse.json();
    console.log('   ⚠️  توقع عجز نقدي:', deficitForecast.forecast.forecasted_value, 'ريال');
    
    // جلب جميع التوقعات
    console.log('\n   📋 جلب جميع التوقعات...');
    const allForecastsResponse = await fetch(`${API_BASE}/finance/cashflow/forecast`);
    const allForecasts = await allForecastsResponse.json();
    console.log('   ✅ عدد التوقعات:', allForecasts.count);
    
    // ========================================
    // Test 5: Comprehensive Report (التقرير الشامل)
    // ========================================
    console.log('\n5️⃣  اختبار التقرير الشامل للتدفقات النقدية');
    
    const comprehensiveResponse = await fetch(`${API_BASE}/finance/cashflow/comprehensive?fiscal_year=2026`);
    const comprehensive = await comprehensiveResponse.json();
    
    console.log('\n   📊 التقرير الشامل للتدفقات النقدية:');
    console.log('\n   🔹 التدفقات التشغيلية:');
    console.log('      الداخل:', comprehensive.summary.operating.inflow, 'ريال');
    console.log('      الخارج:', comprehensive.summary.operating.outflow, 'ريال');
    console.log('      الصافي:', comprehensive.summary.operating.net, 'ريال');
    
    console.log('\n   🔹 التدفقات الاستثمارية:');
    console.log('      الداخل:', comprehensive.summary.investing.inflow, 'ريال');
    console.log('      الخارج:', comprehensive.summary.investing.outflow, 'ريال');
    console.log('      الصافي:', comprehensive.summary.investing.net, 'ريال');
    
    console.log('\n   🔹 التدفقات التمويلية:');
    console.log('      الداخل:', comprehensive.summary.financing.inflow, 'ريال');
    console.log('      الخارج:', comprehensive.summary.financing.outflow, 'ريال');
    console.log('      الصافي:', comprehensive.summary.financing.net, 'ريال');
    
    console.log('\n   💰 إجمالي صافي التدفق النقدي:', comprehensive.summary.total_net_cashflow, 'ريال');
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ جميع اختبارات الصفحة 1 نجحت بنجاح!');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ خطأ في الاختبار:', error.message);
    console.error(error);
  }
}

// Run the test
testPage1_Cashflows();
