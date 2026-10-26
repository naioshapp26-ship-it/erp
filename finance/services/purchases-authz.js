'use strict';

/**
 * Server-side authorization for procurement APIs.
 * Client headers (x-user-role / x-finance-permissions) are NEVER trusted alone —
 * only req.authUser from session (resolveActor) or trustedTestActor in unit tests.
 */

const { resolveActor } = require('./finance-posting-service');

const ACTION_PERMISSION = {
  view: 'purchases.view',
  create: 'purchases.create',
  update: 'purchases.update',
  approve: 'purchases.approve',
  receive: 'purchases.receive',
  cancel: 'purchases.cancel',
  invoice: 'purchases.invoice',
  pay: 'purchases.pay',
  vendors: 'purchases.vendors',
  quotes: 'purchases.quotes',
  delete_draft: 'purchases.delete_draft'
};

const ROLE_ACTIONS = {
  admin: ['*'],
  administrator: ['*'],
  super_admin: ['*'],
  company_admin: ['*'],
  system_admin: ['*'],
  'مسؤول النظام': ['*'],
  manager: ['view', 'create', 'update', 'approve', 'receive', 'cancel', 'invoice', 'pay', 'vendors', 'quotes', 'delete_draft'],
  hr_manager: ['view'],
  accountant: ['view', 'create', 'update', 'invoice', 'pay', 'vendors', 'quotes', 'delete_draft'],
  finance: ['view', 'create', 'update', 'invoice', 'pay', 'vendors', 'quotes', 'delete_draft'],
  warehouse: ['view', 'receive'],
  storekeeper: ['view', 'receive'],
  viewer: ['view'],
  employee: ['view'],
  user: ['view']
};

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isAdminRole(role) {
  const r = String(role || '').trim();
  const n = r.toLowerCase();
  return (
    /^(admin|administrator|super_admin|company_admin|system_admin)$/i.test(n) ||
    r === 'مسؤول النظام' ||
    /مسؤول/.test(r)
  );
}

function actorAllows(actor, action) {
  if (!actor || !actor.authenticated) {
    return {
      ok: false,
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'يجب تسجيل الدخول قبل تنفيذ عمليات المشتريات'
    };
  }
  const perm = ACTION_PERMISSION[action] || `purchases.${action}`;
  const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (permissions.includes('*') || permissions.includes(perm) || permissions.includes('purchases.*')) {
    return { ok: true, mode: 'explicit_permission', permission: perm };
  }
  if (isAdminRole(actor.role)) {
    return { ok: true, mode: 'role_admin', permission: perm };
  }
  const roleKey = normalizeRole(actor.role);
  const allowed = ROLE_ACTIONS[roleKey] || ROLE_ACTIONS[String(actor.role || '').trim()] || [];
  if (allowed.includes('*') || allowed.includes(action)) {
    return { ok: true, mode: 'role_map', permission: perm };
  }
  // Arabic role labels commonly used in this ERP
  if (actor.role === 'محاسب' && ['view', 'create', 'update', 'invoice', 'pay', 'vendors', 'quotes', 'delete_draft'].includes(action)) {
    return { ok: true, mode: 'role_ar_accountant', permission: perm };
  }
  if (actor.role === 'مدير' && action !== 'unknown') {
    const managerActions = ROLE_ACTIONS.manager;
    if (managerActions.includes(action)) return { ok: true, mode: 'role_ar_manager', permission: perm };
  }
  if ((actor.role === 'أمين مستودع' || actor.role === 'مخازن') && (action === 'view' || action === 'receive')) {
    return { ok: true, mode: 'role_ar_warehouse', permission: perm };
  }
  if ((actor.role === 'مشاهد' || actor.role === 'عرض') && action === 'view') {
    return { ok: true, mode: 'role_ar_viewer', permission: perm };
  }
  return {
    ok: false,
    status: 403,
    code: 'PERMISSION_DENIED',
    message: `غير مصرح — مطلوب صلاحية ${perm}`,
    permission: perm,
    role: actor.role || null
  };
}

function assertPurchasesAction(reqOrCtx, action) {
  const actor = reqOrCtx.actor && reqOrCtx.trustedTestActor
    ? resolveActor(reqOrCtx)
    : resolveActor({ req: reqOrCtx.req || reqOrCtx });
  const decision = actorAllows(actor, action);
  return { actor, ...decision };
}

function denyUnless(req, res, action) {
  const result = assertPurchasesAction(req, action);
  if (result.ok) {
    req.purchasesActor = result.actor;
    req.purchasesAuthz = result;
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

function gate(action) {
  return function purchasesGate(req, res, next) {
    if (denyUnless(req, res, action)) return;
    return next();
  };
}

module.exports = {
  ACTION_PERMISSION,
  ROLE_ACTIONS,
  assertPurchasesAction,
  actorAllows,
  denyUnless,
  gate,
  resolveActor
};
