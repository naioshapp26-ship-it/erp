'use strict';

/**
 * Server-side authorization for inventory depth APIs.
 * Client role headers are never trusted alone — only req.authUser / trustedTestActor.
 */

const { resolveActor } = require('./finance-posting-service');

const ACTION_PERMISSION = {
  view: 'inventory.view',
  items: 'inventory.items',
  categories: 'inventory.categories',
  costs: 'inventory.costs',
  margins: 'inventory.margins',
  move: 'inventory.move',
  count: 'inventory.count',
  count_approve: 'inventory.count_approve',
  links: 'inventory.links'
};

const ROLE_ACTIONS = {
  admin: ['*'],
  administrator: ['*'],
  super_admin: ['*'],
  company_admin: ['*'],
  system_admin: ['*'],
  'مسؤول النظام': ['*'],
  manager: ['view', 'items', 'categories', 'costs', 'margins', 'move', 'count', 'count_approve', 'links'],
  accountant: ['view', 'items', 'categories', 'costs', 'margins', 'count', 'count_approve', 'links'],
  finance: ['view', 'items', 'categories', 'costs', 'margins', 'count', 'links'],
  warehouse: ['view', 'move', 'count', 'links'],
  storekeeper: ['view', 'move', 'count', 'links'],
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
  return /^(admin|administrator|super_admin|company_admin|system_admin)$/i.test(n) || r === 'مسؤول النظام' || /مسؤول/.test(r);
}

function actorAllows(actor, action) {
  if (!actor || !actor.authenticated) {
    return { ok: false, status: 401, code: 'AUTH_REQUIRED', message: 'يجب تسجيل الدخول قبل عمليات المخزون' };
  }
  const perm = ACTION_PERMISSION[action] || `inventory.${action}`;
  const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (permissions.includes('*') || permissions.includes(perm) || permissions.includes('inventory.*')) {
    return { ok: true, mode: 'explicit_permission', permission: perm };
  }
  if (isAdminRole(actor.role)) return { ok: true, mode: 'role_admin', permission: perm };
  const allowed = ROLE_ACTIONS[normalizeRole(actor.role)] || [];
  if (allowed.includes('*') || allowed.includes(action)) return { ok: true, mode: 'role_map', permission: perm };
  if (actor.role === 'محاسب' && ['view', 'items', 'categories', 'costs', 'margins', 'count', 'count_approve', 'links'].includes(action)) {
    return { ok: true, mode: 'role_ar_accountant', permission: perm };
  }
  if ((actor.role === 'أمين مستودع' || actor.role === 'مخازن') && ['view', 'move', 'count', 'links'].includes(action)) {
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

function assertInventoryAction(reqOrCtx, action) {
  const actor = reqOrCtx.actor && reqOrCtx.trustedTestActor
    ? resolveActor(reqOrCtx)
    : resolveActor({ req: reqOrCtx.req || reqOrCtx });
  const decision = actorAllows(actor, action);
  return { actor, ...decision };
}

function denyUnless(req, res, action) {
  const result = assertInventoryAction(req, action);
  if (result.ok) {
    req.inventoryActor = result.actor;
    req.inventoryAuthz = result;
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

module.exports = {
  ACTION_PERMISSION,
  ROLE_ACTIONS,
  actorAllows,
  assertInventoryAction,
  denyUnless,
  resolveActor
};
