#!/usr/bin/env node
'use strict';

/**
 * HR ESS + manager portal + RBAC + leave E2E API audit.
 * Run: node test-hr-ess-nav-rbac.js
 */
const assert = require('assert');
const {
  buildPortalPayload,
  buildInventoryRows,
  classifyPersona,
  ESS_CARDS,
  ADMIN_OPS_CARDS
} = require('./hr-portal-access');
const { listHrHomeModules: listHrKeepAsHomeModules } = require('./hr-home-modules');

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const EMPLOYEE = {
  email: process.env.HR_ESS_EMPLOYEE_EMAIL || 'hr-employee@test.local',
  password: process.env.HR_ESS_EMPLOYEE_PASSWORD || 'Employee@123'
};
const MANAGER = {
  email: process.env.HR_ESS_MANAGER_EMAIL || 'hr-manager@test.local',
  password: process.env.HR_ESS_MANAGER_PASSWORD || 'Manager@123'
};

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  assert.ok(data.success, `login failed for ${email}: ${JSON.stringify(data).slice(0, 200)}`);
  const session = data.data?.session;
  const token = (session && typeof session === 'object' ? session.token : session)
    || data.data?.token
    || data.token;
  assert.ok(token, `missing token for ${email}`);
  return { token, user: data.data.user };
}

function headers(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-entity-type': 'HQ',
    'x-entity-id': 'HQ001'
  };
}

async function api(token, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(token), ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('— unit persona / inventory —');
  assert.strictEqual(classifyPersona('EMPLOYEE'), 'employee');
  assert.strictEqual(classifyPersona('MANAGER'), 'manager');
  assert.strictEqual(classifyPersona('HR_MANAGER'), 'hr_admin');
  assert.strictEqual(classifyPersona('company_admin'), 'company_admin');
  assert.strictEqual(classifyPersona('super_admin'), 'platform_owner');

  const ess = buildPortalPayload('EMPLOYEE');
  assert.strictEqual(ess.persona, 'employee');
  assert.ok(ess.adminHidden);
  assert.strictEqual(ess.modules.length, ESS_CARDS.length);
  ESS_CARDS.forEach((c) => assert.ok(ess.modules.some((m) => m.key === c.key)));

  const mgr = buildPortalPayload('MANAGER');
  assert.strictEqual(mgr.persona, 'manager');
  assert.ok(!mgr.adminHidden);
  ADMIN_OPS_CARDS.filter((c) => c.key !== 'admin-hr-settings').forEach((c) => {
    assert.ok(mgr.modules.some((m) => m.key === c.key), `missing admin card ${c.key}`);
  });
  assert.ok(!mgr.modules.some((m) => m.key === 'admin-hr-settings'), 'manager should not see HR settings card');
  const hrAdmin = buildPortalPayload('HR_MANAGER');
  assert.ok(hrAdmin.modules.some((m) => m.key === 'admin-hr-settings'), 'hr_admin missing settings');
  listHrKeepAsHomeModules().forEach((c) => assert.ok(mgr.modules.some((m) => m.key === c.key), `missing KEEP ${c.key}`));

  const inventory = buildInventoryRows();
  assert.ok(inventory.length >= 20, `inventory too small: ${inventory.length}`);
  console.log(`inventory rows=${inventory.length}`);

  console.log('— login employee + manager —');
  const emp = await login(EMPLOYEE.email, EMPLOYEE.password);
  const mgrSession = await login(MANAGER.email, MANAGER.password);
  assert.ok(/employee|موظف/i.test(String(emp.user.role)) || String(emp.user.role).toUpperCase() === 'EMPLOYEE');

  console.log('— portal context —');
  const empCtx = await api(emp.token, '/api/hr/portal-context');
  assert.strictEqual(empCtx.status, 200);
  assert.strictEqual(empCtx.data.persona, 'employee');
  assert.ok(empCtx.data.adminHidden);
  assert.ok(Array.isArray(empCtx.data.nav) && empCtx.data.nav.length >= 5);

  const mgrCtx = await api(mgrSession.token, '/api/hr/portal-context');
  assert.strictEqual(mgrCtx.data.persona, 'manager');
  assert.ok(!mgrCtx.data.adminHidden);

  const empHome = await api(emp.token, '/api/hr/home-modules');
  assert.ok(empHome.data.modules.every((m) => String(m.category).includes('خدمة') || m.key.startsWith('ess-')));
  assert.ok(!empHome.data.modules.some((m) => m.key === 'admin-approvals'));

  const mgrHome = await api(mgrSession.token, '/api/hr/home-modules');
  assert.ok(mgrHome.data.modules.some((m) => m.key === 'admin-approvals'));
  assert.ok(mgrHome.data.modules.some((m) => m.key === 'employee-360'));
  assert.ok(mgrHome.data.keepModules.length === 9);

  console.log('— RBAC denials for employee —');
  const pending = await api(emp.token, '/api/hr/pending-actions');
  assert.strictEqual(pending.status, 403, 'employee pending-actions should 403');

  const dash = await api(emp.token, '/api/hr/manager-dashboard');
  assert.strictEqual(dash.status, 403, 'employee manager-dashboard should 403');

  const employees = await api(emp.token, '/api/employees');
  assert.strictEqual(employees.status, 403, 'employee /api/employees should 403');

  const decideDenied = await api(emp.token, '/api/employee-requests/NOPE/decide', {
    method: 'POST',
    body: JSON.stringify({ decision: 'approve' })
  });
  assert.strictEqual(decideDenied.status, 403);

  console.log('— leave E2E employee → manager → employee —');
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const endDate = new Date(today); endDate.setDate(today.getDate() + 2);
  const end = endDate.toISOString().slice(0, 10);

  const leave = await api(emp.token, '/api/leave-requests', {
    method: 'POST',
    body: JSON.stringify({
      employee_name: emp.user.name,
      employee_id: 'SHOULD-BE-OVERRIDDEN',
      department: 'اختبار',
      leave_type: 'سنوية',
      start_date: start,
      end_date: end,
      reason: 'اختبار ESS إجازة كامل',
      entity_id: 'HQ001'
    })
  });
  assert.ok(leave.status < 300, JSON.stringify(leave.data));
  assert.ok(leave.data.id, 'leave id missing');
  assert.strictEqual(String(leave.data.employee_id), String(emp.user.id), 'employee_id must be stamped from session');
  const leaveReqId = `LR-${leave.data.id}`;

  const myReqs = await api(emp.token, '/api/employee-requests');
  assert.ok(Array.isArray(myReqs.data));
  assert.ok(myReqs.data.some((r) => r.id === leaveReqId), 'leave missing from employee my-requests');
  assert.ok(myReqs.data.every((r) => String(r.employee_id) === String(emp.user.id)), 'employee saw other requests');

  const mgrPending = await api(mgrSession.token, '/api/hr/pending-actions');
  assert.ok(mgrPending.status < 300);
  assert.ok(mgrPending.data.requests.some((r) => r.id === leaveReqId), 'leave not in manager pending');

  const step1 = await api(mgrSession.token, `/api/employee-requests/${encodeURIComponent(leaveReqId)}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'approve', actorName: mgrSession.user.name, notes: 'موافق المدير' })
  });
  assert.ok(step1.status < 300, JSON.stringify(step1.data));
  assert.strictEqual(step1.data.request.current_stage, 'hr');

  const step2 = await api(mgrSession.token, `/api/employee-requests/${encodeURIComponent(leaveReqId)}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'approve', actorName: 'الموارد البشرية', notes: 'معتمد' })
  });
  assert.ok(step2.status < 300, JSON.stringify(step2.data));
  assert.strictEqual(step2.data.request.status, 'APPROVED');
  assert.strictEqual(step2.data.request.current_stage, 'completed');

  const after = await api(emp.token, '/api/employee-requests');
  const mine = after.data.find((r) => r.id === leaveReqId);
  assert.ok(mine, 'approved leave missing from employee list');
  assert.strictEqual(String(mine.status).toUpperCase(), 'APPROVED');

  console.log('PASS hr-ess-nav-rbac');
  console.log(JSON.stringify({
    inventory: inventory.length,
    essCards: ESS_CARDS.length,
    adminOps: ADMIN_OPS_CARDS.length,
    keep: listHrKeepAsHomeModules().length,
    leaveReqId,
    employeeId: emp.user.id,
    managerId: mgrSession.user.id
  }, null, 2));
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
