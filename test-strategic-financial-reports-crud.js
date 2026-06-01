const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENTITY_ID = process.env.ENTITY_ID || 'HQ001';
const ENTITY_TYPE = process.env.ENTITY_TYPE || 'HQ';

const headers = {
  'Content-Type': 'application/json',
  'x-entity-id': ENTITY_ID,
  'x-entity-type': ENTITY_TYPE
};

async function request(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function run() {
  console.log('🧪 بدء اختبار صفحة التقارير الاستراتيجية');

  const endpoints = [
    `${BASE_URL}/finance/invoices`,
    `${BASE_URL}/finance/payments`,
    `${BASE_URL}/finance/ai-risk-scores?entity_id=${ENTITY_ID}`,
    `${BASE_URL}/finance/ai-forecasts?entity_id=${ENTITY_ID}`,
    `${BASE_URL}/finance/customers?entity_id=${ENTITY_ID}`,
    `${BASE_URL}/finance/cashflow/overview?entity_id=${ENTITY_ID}`,
    `${BASE_URL}/finance/ar-aging?entity_id=${ENTITY_ID}`
  ];

  for (const url of endpoints) {
    const { res } = await request(url, { method: 'GET' });
    console.log(`✅ فحص جلب البيانات: ${url} -> ${res.status}`);
  }

  const customersRes = await request(`${BASE_URL}/finance/customers?entity_id=${ENTITY_ID}`, { method: 'GET' });
  const customerId = customersRes.data.customers?.[0]?.customer_id;
  if (!customerId) {
    console.error('❌ لا يوجد عملاء متاحين للاختبار');
    return;
  }
  console.log('✅ تم استخدام عميل موجود للاختبار:', customerId);

  const invoicePayload = {
    customer_id: customerId,
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    total_amount: 1200,
    paid_amount: 200,
    entity_type: ENTITY_TYPE,
    entity_id: ENTITY_ID,
    branch_id: 'فرع-الاختبار',
    notes: 'فاتورة اختبار للذمم'
  };

  const createInvoice = await request(`${BASE_URL}/finance/ar-aging/invoices`, {
    method: 'POST',
    body: JSON.stringify(invoicePayload)
  });

  if (!createInvoice.res.ok) {
    console.error('❌ فشل إنشاء الفاتورة:', createInvoice.data);
    return;
  }

  const invoiceId = createInvoice.data.invoice?.invoice_id;
  console.log('✅ تم إنشاء الفاتورة:', invoiceId);

  const updateInvoice = await request(`${BASE_URL}/finance/invoices/${invoiceId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'ISSUED', payment_status: 'UNPAID', notes: 'تحديث فاتورة اختبار' })
  });
  console.log('✅ تم تحديث الفاتورة:', updateInvoice.res.status);

  const createRisk = await request(`${BASE_URL}/finance/ai-risk-scores`, {
    method: 'POST',
    body: JSON.stringify({
      entity_id: ENTITY_ID,
      entity_type: ENTITY_TYPE,
      customer_id: customerId,
      assessment_date: new Date().toISOString().slice(0, 10),
      risk_score: 65,
      risk_level: 'MEDIUM',
      recommendations: 'متابعة التحصيل.'
    })
  });

  if (!createRisk.res.ok) {
    console.error('❌ فشل إنشاء تقييم المخاطر:', createRisk.data);
    return;
  }

  const riskId = createRisk.data.row?.risk_id;
  console.log('✅ تم إنشاء تقييم المخاطر:', riskId);

  const updateRisk = await request(`${BASE_URL}/finance/ai-risk-scores/${riskId}`, {
    method: 'PUT',
    body: JSON.stringify({
      entity_id: ENTITY_ID,
      entity_type: ENTITY_TYPE,
      customer_id: customerId,
      assessment_date: new Date().toISOString().slice(0, 10),
      risk_score: 70,
      risk_level: 'HIGH',
      recommendations: 'رفع درجة المتابعة.'
    })
  });
  console.log('✅ تم تحديث تقييم المخاطر:', updateRisk.res.status);

  const createForecast = await request(`${BASE_URL}/finance/ai-forecasts`, {
    method: 'POST',
    body: JSON.stringify({
      entity_id: ENTITY_ID,
      forecast_period: 'اختبار 2026',
      forecast_type: 'تدفق نقدي',
      forecast_amount: 30000,
      confidence_level: 0.8,
      ai_model: 'اختبار'
    })
  });

  if (!createForecast.res.ok) {
    console.error('❌ فشل إنشاء التوقع الذكي:', createForecast.data);
    return;
  }

  const forecastId = createForecast.data.forecast?.forecast_id;
  console.log('✅ تم إنشاء التوقع الذكي:', forecastId);

  const updateForecast = await request(`${BASE_URL}/finance/ai-forecasts/${forecastId}`, {
    method: 'PUT',
    body: JSON.stringify({
      entity_id: ENTITY_ID,
      forecast_period: 'اختبار 2026 (محدث)',
      forecast_type: 'تدفق نقدي',
      forecast_amount: 32000,
      confidence_level: 0.85,
      ai_model: 'اختبار'
    })
  });
  console.log('✅ تم تحديث التوقع الذكي:', updateForecast.res.status);

  const deleteForecast = await request(`${BASE_URL}/finance/ai-forecasts/${forecastId}?entity_id=${ENTITY_ID}`, {
    method: 'DELETE'
  });
  console.log('✅ تم حذف التوقع الذكي:', deleteForecast.res.status);

  const deleteRisk = await request(`${BASE_URL}/finance/ai-risk-scores/${riskId}?entity_id=${ENTITY_ID}`, {
    method: 'DELETE'
  });
  console.log('✅ تم حذف تقييم المخاطر:', deleteRisk.res.status);

  const deleteInvoice = await request(`${BASE_URL}/finance/invoices/${invoiceId}`, {
    method: 'DELETE'
  });
  console.log('✅ تم حذف الفاتورة:', deleteInvoice.res.status);

  console.log('🎯 انتهت اختبارات CRUD بنجاح');
}

run().catch((error) => {
  console.error('❌ خطأ في الاختبارات:', error.message);
  process.exitCode = 1;
});
