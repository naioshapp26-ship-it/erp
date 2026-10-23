'use strict';

const http = require('http');
const PORT = Number(process.env.PORT || 3000);
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
const stamp = Date.now().toString().slice(-8);

function pass(name, detail = '') {
  results.push({ name, ok: true });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpJson(method, urlPath, body) {
  const u = new URL(urlPath, BASE);
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { /* csv */ }
        resolve({ status: res.statusCode, json, raw: raw.slice(0, 40000) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const pages = [
    '/finance/cost-centers.html',
    '/finance/checks.html',
    '/finance/deposits.html',
    '/finance/price-lists.html',
    '/finance/purchase-requests.html',
    '/finance/projects.html',
    '/finance/loyalty.html',
    '/finance/pos.html',
    '/finance/e-invoice-queue.html',
    '/finance/gov-integrations.html',
    '/finance/report-exports.html'
  ];
  for (const page of pages) {
    const r = await httpJson('GET', page);
    const shell = r.raw.includes('id="app"') && r.raw.includes('/finance/ops-shell.css') && r.raw.includes('ops-ui.js');
    if (r.status === 200 && shell && !/قيد التطوير/.test(r.raw)) pass(`page ${page}`);
    else fail(`page ${page}`, `HTTP ${r.status} shell=${shell}`);
  }
  const ui = await httpJson('GET', '/finance/ops-ui.js');
  if (ui.status === 200 && ui.raw.includes('تعديل') && ui.raw.includes('حذف') && ui.raw.includes('إضافة معلومة')) pass('row actions in shared ui');
  else fail('row actions in shared ui', `HTTP ${ui.status}`);

  const entity = { entity_id: 'HQ001', entity_type: 'HQ' };
  const cc = await httpJson('POST', '/finance/ops/cost-centers', { ...entity, title: `مركز ${stamp}`, record_number: `CC-${stamp}` });
  if (cc.status === 201) pass('create cost center', cc.json.record.record_number);
  else fail('create cost center', cc.raw);
  if (cc.json && cc.json.record) {
    const edited = await httpJson('PUT', `/finance/ops/cost-centers/${cc.json.record.record_id}?entity_id=HQ001`, {
      ...entity,
      title: `مركز معدّل ${stamp}`,
      payload: { extra: [{ label: 'الفرع', value: 'الرياض' }] }
    });
    const extra = edited.json && edited.json.record && edited.json.record.payload && edited.json.record.payload.extra;
    if (edited.status === 200 && edited.json.record.title === `مركز معدّل ${stamp}` && extra && extra[0] && extra[0].label === 'الفرع') pass('edit cost center and extra field');
    else fail('edit cost center and extra field', edited.raw);
  }

  const found = await httpJson('GET', `/finance/ops/cost-centers?entity_id=HQ001&q=${encodeURIComponent(stamp)}`);
  if (found.status === 200 && (found.json.records || []).some((row) => row.record_number === `CC-${stamp}`)) pass('search cost center');
  else fail('search cost center', found.raw);
  if (cc.json && cc.json.record) {
    const removed = await httpJson('DELETE', `/finance/ops/cost-centers/${cc.json.record.record_id}?entity_id=HQ001`);
    if (removed.status === 200) pass('delete cost center');
    else fail('delete cost center', removed.raw);
  }

  const chk = await httpJson('POST', '/finance/ops/checks', { ...entity, party_name: `طرف ${stamp}`, amount: 250, title: 'بنك الاختبار' });
  if (chk.status === 201) pass('create check');
  else fail('create check', chk.raw);
  if (chk.json && chk.json.record) {
    const del = await httpJson('DELETE', `/finance/ops/checks/${chk.json.record.record_id}?entity_id=HQ001`);
    if (del.status === 409) pass('block check delete');
    else fail('block check delete', del.raw);
    const cancel = await httpJson('POST', `/finance/ops/checks/${chk.json.record.record_id}/cancel`, { ...entity, reason: 'اختبار إلغاء' });
    if (cancel.status === 200 && cancel.json.record.status === 'CANCELLED') pass('cancel check');
    else fail('cancel check', cancel.raw);
  }

  const pr = await httpJson('POST', '/finance/ops/purchase-requests', { ...entity, title: `طلب ${stamp}`, party_name: `مورد ${stamp}`, amount: 80 });
  if (pr.status === 201) pass('create purchase request');
  else fail('create purchase request', pr.raw);
  if (pr.json && pr.json.record) {
    const conv = await httpJson('POST', `/finance/ops/purchase-requests/${pr.json.record.record_id}/convert`, { ...entity, vendor_name: `مورد ${stamp}` });
    if (conv.status === 200 && conv.json.order) pass('convert purchase request', conv.json.order.po_number);
    else fail('convert purchase request', conv.raw);
    const again = await httpJson('POST', `/finance/ops/purchase-requests/${pr.json.record.record_id}/convert`, { ...entity, vendor_name: `مورد ${stamp}` });
    if (again.status === 409) pass('block double convert');
    else fail('block double convert', again.raw);
    const noteEdit = await httpJson('PUT', `/finance/ops/purchase-requests/${pr.json.record.record_id}?entity_id=HQ001`, {
      ...entity,
      title: `طلب ${stamp} بعد التحويل`,
      amount: 80,
      notes: 'ملاحظة بعد التحويل'
    });
    if (noteEdit.status === 200 && noteEdit.json.record.notes === 'ملاحظة بعد التحويل') pass('edit converted request notes');
    else fail('edit converted request notes', noteEdit.raw);
    const amountEdit = await httpJson('PUT', `/finance/ops/purchase-requests/${pr.json.record.record_id}?entity_id=HQ001`, {
      ...entity,
      amount: 81
    });
    if (amountEdit.status === 409) pass('block converted amount edit');
    else fail('block converted amount edit', amountEdit.raw);
  }

  const loy = await httpJson('POST', '/finance/ops/loyalty', { ...entity, party_name: `عميل ${stamp}`, amount: 15, notes: 'اختبار' });
  if (loy.status === 201) pass('loyalty entry');
  else fail('loyalty entry', loy.raw);
  const bal = await httpJson('GET', `/finance/ops/loyalty/balances?entity_id=HQ001`);
  if (bal.status === 200 && (bal.json.balances || []).some((row) => String(row.party_name).includes(stamp))) pass('loyalty balance');
  else fail('loyalty balance', bal.raw);

  const gov = await httpJson('POST', '/finance/ops/gov-integrations', { ...entity, title: `جهة ${stamp}`, status: 'CONNECTED' });
  if (gov.status === 409) pass('reject fake government connector');
  else fail('reject fake government connector', gov.raw);

  const einv = await httpJson('POST', '/finance/ops/e-invoice-queue', { ...entity, title: 'بلا فاتورة' });
  if (einv.status === 400) pass('e-invoice requires local invoice');
  else fail('e-invoice requires local invoice', einv.raw);

  const target = await httpJson('POST', '/finance/ops/sales-targets', {
    ...entity,
    title: `هدف ${stamp}`,
    amount: 1000,
    payload: { period_start: '2020-01-01', period_end: '2030-12-31' }
  });
  if (target.status === 201 && target.json.record.actual_amount != null) pass('target actual from invoices', String(target.json.record.actual_amount));
  else if (target.status === 201) {
    const reload = await httpJson('GET', `/finance/ops/sales-targets/${target.json.record.record_id}?entity_id=HQ001`);
    if (reload.json && reload.json.record && reload.json.record.actual_amount != null) pass('target actual from invoices', String(reload.json.record.actual_amount));
    else fail('target actual from invoices', reload.raw);
  } else fail('target actual from invoices', target.raw);

  const failed = results.filter((row) => !row.ok).length;
  console.log(`\n=== SUMMARY: ${results.length - failed} PASS / ${failed} FAIL ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
