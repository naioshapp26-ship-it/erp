#!/usr/bin/env node
const assert = require('assert');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const headers = {
  'Content-Type': 'application/json',
  'x-entity-type': 'HQ',
  'x-entity-id': 'HQ001'
};

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers, ...options });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${data.error || text.slice(0, 180)}`);
  }
  return data;
}

async function page(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { ...headers, Accept: 'application/json,text/html;q=0.8' } });
  const html = await res.text();
  assert.ok(res.ok, `${path} status ${res.status}`);
  assert.ok(!html.includes('login-page') || html.includes('hr-sidebar') || html.includes('إعدادات'), `${path} looks like a login wall`);
  return html;
}

async function main() {
  const catalog = await api('/api/hr/system-settings/catalog');
  assert.strictEqual(catalog.success, true);
  assert.strictEqual(catalog.groups.length, 8, 'expected 8 settings groups');
  const itemCount = catalog.groups.reduce((n, g) => n + g.items.length, 0);
  assert.ok(itemCount >= 40, `expected 40+ items, got ${itemCount}`);
  assert.strictEqual(catalog.groups[0].items[0].key, 'users');
  assert.ok(catalog.groups.some((g) => g.items.some((i) => i.isNew)));

  const users = await api('/api/hr/system-settings/users');
  assert.ok(users.success && users.item && users.records.length >= 1, 'users settings should seed');

  const created = await api('/api/hr/system-settings/users', {
    method: 'POST',
    body: JSON.stringify({
      code: `USR-T-${Date.now()}`,
      name: 'مستخدم اختبار الإعدادات',
      email: 'settings-test@nayosh.com',
      role: 'موظف',
      department: 'العمليات',
      status: 'نشط'
    })
  });
  assert.ok(created.success && created.record && created.record.id, 'create user setting failed');

  const leaveTypes = await api('/api/hr/system-settings/leave-types');
  assert.ok(leaveTypes.success && leaveTypes.records.length >= 1, 'leave types should seed');

  const letters = await api('/api/hr/ops/letters');
  assert.ok(letters.success && letters.module.requestType === 'خطاب');
  const letterSave = await api('/api/hr/ops/letters', {
    method: 'POST',
    body: JSON.stringify({
      name: 'تعريف راتب اختبار',
      employee_name: 'موظف تجربة',
      destination: 'بنك الرياض',
      status: 'نشط'
    })
  });
  assert.ok(letterSave.success, 'letter ops save failed');

  const reqId = `OPS-TEST-${Date.now()}`;
  const request = await api('/api/employee-requests', {
    method: 'POST',
    body: JSON.stringify({
      id: reqId,
      entityId: 'HQ001',
      employeeId: 'EMP-SETTINGS',
      employeeName: 'موظف تجربة',
      requestType: 'خطاب',
      requestTitle: 'طلب خطاب تعريف راتب اختبار',
      description: 'اختبار مسار المدير',
      requestedDate: new Date().toISOString().slice(0, 10),
      requestData: { name: 'تعريف راتب اختبار' },
      createdBy: 'موظف تجربة'
    })
  });
  assert.ok(request.success && request.request, 'employee request create failed');
  assert.strictEqual(request.request.current_stage, 'manager', `stage expected manager got ${request.request.current_stage}`);

  const pending = await api('/api/hr/pending-actions');
  assert.ok(pending.count >= 1, 'pending actions should include manager queue');
  assert.ok(pending.requests.some((r) => r.id === reqId), 'new request missing from pending actions');

  const decided = await api(`/api/employee-requests/${encodeURIComponent(reqId)}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'approve', actorName: 'المدير المباشر', notes: 'موافق' })
  });
  assert.ok(decided.success, 'manager approve failed');
  assert.ok(['hr', 'completed'].includes(decided.request.current_stage), `after manager got ${decided.request.current_stage}`);

  for (const path of [
    '/hr/system-settings',
    '/hr/system-settings/users',
    '/hr/letters',
    '/hr/human-resources',
    '/hr/reports',
    '/hr/my-requests',
    '/hr/pending-actions',
    '/hr/manager',
    '/hr/employees'
  ]) {
    await page(path);
  }

  console.log(`ok live: ${itemCount} settings items, request ${reqId} started at manager`);
}

main().catch((err) => {
  console.error('LIVE TEST FAILED:', err.message);
  process.exit(1);
});
