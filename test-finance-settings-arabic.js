'use strict';

const databaseUrl = process.env.INVENTORY_TEST_DATABASE_URL || '';
if (!databaseUrl) {
  console.log('SKIP settings-arabic — set INVENTORY_TEST_DATABASE_URL to a local isolated Postgres');
  process.exit(0);
}
if (!/127\.0\.0\.1|localhost/.test(databaseUrl)) {
  console.error('FAIL settings-arabic refuses a non-local database');
  process.exit(1);
}
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_SSL = 'false';

const http = require('http');
const express = require('express');
const labels = require('./finance/finance-field-labels');
const settings = require('./finance/services/page-document-settings');
const routes = require('./finance/api/page-document-settings');

const results = [];
function ok(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: detail || '' });
  console.log(cond ? 'PASS' : 'FAIL', name, detail || '');
}

const app = express();
app.use(express.json());
app.use('/finance/page-settings', routes);

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let server;
(async () => {
  const englishKeys = ['number_prefix', 'due_days', 'default_tax_pct', 'require_customer', 'allow_partial_payment_default', 'allow_installments_default', 'footer_text', 'default_currency'];
  englishKeys.forEach((key) => {
    const meta = labels.fieldMeta(key, '');
    ok('label-' + key, meta.label_ar && !meta.label_ar.includes(key) && /[\u0600-\u06FF]/.test(meta.label_ar), meta.label_ar);
  });
  const egp = labels.currencyByCode('egp');
  ok('currency-egp', egp && labels.currencyLabel(egp).includes('مصر') && labels.currencyLabel(egp).includes('EGP'));
  ok('reject-unknown-currency', !!labels.validateField('default_currency', 'XYZ', 'SAR'));
  Object.entries(settings.DOC_DEFS).forEach(([docId, def]) => {
    Object.keys(def.default_value).forEach((key) => {
      ok(docId + ':' + key, !!labels.FIELDS[key] && labels.FIELDS[key].label_ar !== key, key);
    });
  });

  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const schema = await call('GET', '/finance/page-settings/sales-invoices/schema');
    const visible = JSON.stringify(schema.json && schema.json.schema);
    ok('schema-arabic', schema.status === 200 && visible.includes('بادئة ترقيم المستند') && visible.includes('العملة الافتراضية') && !/"label_ar":"number_prefix"/.test(visible));
    const bad = await call('PUT', '/finance/page-settings/sales-invoices', { value: { default_currency: 'XYZ' }, reason: 'arabic-test' });
    ok('bad-currency-rejected', bad.status === 400 && /القائمة/.test(bad.json && bad.json.error || ''), bad.json && bad.json.error);
    const saved = await call('PUT', '/finance/page-settings/sales-invoices', {
      value: {
        number_prefix: 'INV',
        due_days: 30,
        default_tax_pct: 15,
        require_customer: true,
        allow_partial_payment_default: true,
        allow_installments_default: false,
        footer_text: 'اختبار عربي',
        default_currency: 'egp'
      },
      reason: 'arabic-test'
    });
    ok('save-egp', saved.status === 200 && saved.json.item.value.default_currency === 'EGP' && saved.json.item.value.footer_text === 'اختبار عربي', saved.json && saved.json.error);
    const again = await call('GET', '/finance/page-settings/sales-invoices');
    ok('reload-egp', again.json.item.value.default_currency === 'EGP');
    await call('PUT', '/finance/page-settings/sales-invoices', {
      value: { default_currency: 'SAR', footer_text: '' },
      reason: 'arabic-test-restore'
    });
  } catch (error) {
    ok('unexpected', false, error.stack || error.message);
  } finally {
    server.close();
    const db = require('./db');
    await db.pool.end();
  }
  const failed = results.filter((row) => !row.ok);
  console.log(`settings-arabic ${results.length - failed.length}/${results.length}`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
