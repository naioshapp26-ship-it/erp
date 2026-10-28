'use strict';

const { resolveActor } = require('./finance-posting-service');

const ACTION_PERMISSION = {
  view: 'payroll.view',
  overtime_create: 'payroll.overtime.create',
  overtime_approve: 'payroll.overtime.approve',
  overtime_post: 'payroll.overtime.post',
  payroll_create: 'payroll.run.create',
  payroll_approve: 'payroll.run.approve',
  payroll_post: 'payroll.run.post',
  payroll_view_all: 'payroll.view_all',
  coa_view: 'accounts.coa.view',
  coa_edit: 'accounts.coa.edit',
  coa_approve: 'accounts.coa.approve'
};

const ROLE_ACTIONS = {
  admin: ['*'],
  administrator: ['*'],
  super_admin: ['*'],
  company_admin: ['*'],
  system_admin: ['*'],
  'مسؤول النظام': ['*'],
  manager: ['view', 'overtime_create', 'overtime_approve', 'overtime_post', 'payroll_create', 'payroll_approve', 'payroll_view_all', 'coa_view', 'coa_edit'],
  accountant: ['view', 'overtime_create', 'overtime_post', 'payroll_create', 'payroll_approve', 'payroll_post', 'payroll_view_all', 'coa_view', 'coa_edit', 'coa_approve'],
  finance: ['view', 'overtime_create', 'overtime_post', 'payroll_create', 'payroll_approve', 'payroll_post', 'payroll_view_all', 'coa_view', 'coa_edit'],
  hr_manager: ['view', 'overtime_create', 'overtime_approve', 'payroll_create', 'payroll_view_all'],
  hr: ['view', 'overtime_create', 'payroll_view_all'],
  employee: ['view'],
  viewer: ['view', 'coa_view'],
  user: ['view']
};

function isAdminRole(role) {
  const r = String(role || '').trim();
  return /^(admin|administrator|super_admin|company_admin|system_admin)$/i.test(r) || r === 'مسؤول النظام' || /مسؤول/.test(r);
}

function actorAllows(actor, action) {
  if (!actor || !actor.authenticated) {
    return { ok: false, status: 401, code: 'AUTH_REQUIRED', message: 'يجب تسجيل الدخول' };
  }
  const perm = ACTION_PERMISSION[action] || action;
  const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (permissions.includes('*') || permissions.includes(perm) || permissions.includes('payroll.*') || permissions.includes('accounts.*')) {
    return { ok: true, mode: 'explicit_permission', permission: perm };
  }
  if (isAdminRole(actor.role)) return { ok: true, mode: 'role_admin', permission: perm };
  const allowed = ROLE_ACTIONS[String(actor.role || '').trim().toLowerCase()] || [];
  if (allowed.includes('*') || allowed.includes(action)) return { ok: true, mode: 'role_map', permission: perm };
  if (actor.role === 'محاسب' && ['view', 'overtime_create', 'overtime_post', 'payroll_create', 'payroll_approve', 'payroll_post', 'payroll_view_all', 'coa_view', 'coa_edit', 'coa_approve'].includes(action)) {
    return { ok: true, mode: 'role_ar', permission: perm };
  }
  if ((actor.role === 'مشاهد' || actor.role === 'عرض') && (action === 'view' || action === 'coa_view')) {
    return { ok: true, mode: 'role_ar_viewer', permission: perm };
  }
  return {
    ok: false,
    status: 403,
    code: 'PERMISSION_DENIED',
    message: `غير مصرح — مطلوب ${perm}`,
    permission: perm,
    role: actor.role || null
  };
}

function assertAction(reqOrCtx, action) {
  const actor = reqOrCtx.actor && reqOrCtx.trustedTestActor
    ? resolveActor(reqOrCtx)
    : resolveActor({ req: reqOrCtx.req || reqOrCtx });
  return { actor, ...actorAllows(actor, action) };
}

function denyUnless(req, res, action) {
  const result = assertAction(req, action);
  if (result.ok) {
    req.hrFinanceActor = result.actor;
    return null;
  }
  res.status(result.status).json({
    success: false,
    error: result.message,
    code: result.code,
    permission: result.permission || null
  });
  return result;
}

module.exports = { ACTION_PERMISSION, ROLE_ACTIONS, actorAllows, assertAction, denyUnless, resolveActor };
