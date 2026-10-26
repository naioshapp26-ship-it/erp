'use strict';

/**
 * Server-side authorization for sales e-invoice queue APIs.
 * Client headers (x-user-role / x-finance-permissions) are NEVER trusted alone —
 * only req.authUser from session (resolveActor) or trustedTestActor in unit tests.
 */

const { resolveActor } = require('./finance-posting-service');

const ACTION_PERMISSION = {
  view: 'sales.einvoice.view',
  enqueue: 'sales.einvoice.enqueue',
  update: 'sales.einvoice.update',
  transition: 'sales.einvoice.transition',
  archive: 'sales.einvoice.archive',
  cancel: 'sales.einvoice.cancel',
  delete_draft: 'sales.einvoice.delete_draft',
  gov_send: 'sales.einvoice.gov_send'
};

const ROLE_ACTIONS = {
  admin: ['*'],
  administrator: ['*'],
  super_admin: ['*'],
  company_admin: ['*'],
  system_admin: ['*'],
  'مسؤول النظام': ['*'],
  manager: ['view', 'enqueue', 'update', 'transition', 'archive', 'cancel', 'delete_draft'],
  hr_manager: ['view'],
  accountant: ['view', 'enqueue', 'update', 'transition', 'archive', 'delete_draft'],
  finance: ['view', 'enqueue', 'update', 'transition', 'archive', 'delete_draft'],
  sales: ['view', 'enqueue', 'update'],
  viewer: ['view'],
  employee: ['view'],
  user: ['view'],
  warehouse: ['view'],
  storekeeper: ['view']
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
      message: 'يجب تسجيل الدخول قبل تنفيذ عمليات الفاتورة الإلكترونية'
    };
  }
  const perm = ACTION_PERMISSION[action] || `sales.einvoice.${action}`;
  const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (
    permissions.includes('*') ||
    permissions.includes(perm) ||
    permissions.includes('sales.einvoice.*') ||
    permissions.includes('sales.*')
  ) {
    return { ok: true, mode: 'explicit_permission', permission: perm };
  }
  if (isAdminRole(actor.role)) {
    return { ok: true, mode: 'role_admin', permission: perm };
  }
  const roleKey = normalizeRole(actor.role);
  const allowed = ROLE_ACTIONS[roleKey] || [];
  if (allowed.includes('*') || allowed.includes(action)) {
    return { ok: true, mode: 'role_map', permission: perm };
  }
  if (actor.role === 'محاسب' && ['view', 'enqueue', 'update', 'transition', 'archive', 'delete_draft'].includes(action)) {
    return { ok: true, mode: 'role_ar_accountant', permission: perm };
  }
  if (actor.role === 'مدير' && action !== 'gov_send') {
    if ((ROLE_ACTIONS.manager || []).includes(action) || action === 'view') {
      return { ok: true, mode: 'role_ar_manager', permission: perm };
    }
  }
  if ((actor.role === 'مشاهد' || actor.role === 'عرض') && action === 'view') {
    return { ok: true, mode: 'role_ar_viewer', permission: perm };
  }
  if ((actor.role === 'مبيعات' || actor.role === 'sales') && ['view', 'enqueue', 'update'].includes(action)) {
    return { ok: true, mode: 'role_ar_sales', permission: perm };
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

function assertEInvoiceAction(reqOrCtx, action) {
  const actor = reqOrCtx.actor && reqOrCtx.trustedTestActor
    ? resolveActor(reqOrCtx)
    : resolveActor({ req: reqOrCtx.req || reqOrCtx });
  const decision = actorAllows(actor, action);
  return { actor, ...decision };
}

function denyUnless(req, res, action) {
  const result = assertEInvoiceAction(req, action);
  if (result.ok) {
    req.einvoiceActor = result.actor;
    req.einvoiceAuthz = result;
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
  return function einvoiceGate(req, res, next) {
    if (denyUnless(req, res, action)) return;
    return next();
  };
}

module.exports = {
  ACTION_PERMISSION,
  ROLE_ACTIONS,
  assertEInvoiceAction,
  actorAllows,
  denyUnless,
  gate,
  resolveActor
};
