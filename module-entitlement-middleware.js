'use strict';

/**
 * Enforce plan/tenant module entitlements on tenant-scoped API traffic.
 * Phase 3: expanded prefix coverage for existing ERP module routes.
 */

const owner = require('./platform-owner-service');

/** Map URL prefixes → module keys (existing ERP modules only). Longer prefixes first. */
const MODULE_API_PREFIXES = [
  { prefix: '/api/hr/', module: 'hr' },
  { prefix: '/api/hr', module: 'hr' },
  { prefix: '/api/finance/', module: 'finance' },
  { prefix: '/api/finance', module: 'finance' },
  { prefix: '/api/facilities/', module: 'facilities' },
  { prefix: '/api/facilities', module: 'facilities' },
  { prefix: '/api/tasks-management', module: 'tasks-management' },
  { prefix: '/api/tasks/', module: 'tasks-management' },
  { prefix: '/api/tasks', module: 'tasks-management' },
  { prefix: '/api/ads/', module: 'ads' },
  { prefix: '/api/ads', module: 'ads' },
  { prefix: '/api/audit-logs', module: 'audit-logs' },
  { prefix: '/api/audit/', module: 'audit-logs' },
  { prefix: '/api/audit', module: 'audit-logs' },
  { prefix: '/api/inventory', module: 'inventory' },
  { prefix: '/api/purchases', module: 'purchases' },
  { prefix: '/api/suppliers', module: 'suppliers' },
  { prefix: '/api/supply-chain', module: 'inventory' },
  { prefix: '/api/crm', module: 'crm' },
  { prefix: '/api/sales', module: 'crm' },
  { prefix: '/api/pos', module: 'pos' },
  { prefix: '/api/payroll', module: 'hr' },
  { prefix: '/api/attendance', module: 'hr' },
  { prefix: '/api/leave-requests', module: 'hr' },
  { prefix: '/api/leave-balances', module: 'hr' },
  { prefix: '/api/tax-settings', module: 'finance' },
  { prefix: '/api/invoices', module: 'finance' },
  { prefix: '/finance/', module: 'finance' },
  { prefix: '/hr/', module: 'hr' },
  { prefix: '/facilities/', module: 'facilities' },
  { prefix: '/facilities', module: 'facilities' },
  { prefix: '/sales/', module: 'crm' },
  { prefix: '/supply-chain/', module: 'inventory' },
  { prefix: '/tasks', module: 'tasks-management' }
];

const ALWAYS_ALLOW_PREFIXES = [
  '/api/tenant-auth',
  '/api/auth',
  '/api/health',
  '/api/tenant-settings',
  '/api/company-settings',
  '/api/module-settings',
  '/api/shared-services',
  '/api/enterprise-settings',
  '/api/platform-owner',
  '/api/tenant-users',
  '/api/tenant-public',
  '/api/menu',
  '/company/settings',
  '/modules/settings',
  '/shared/services',
  '/invite'
];

function resolveModuleForPath(pathname) {
  const path = String(pathname || '').split('?')[0];
  for (const entry of MODULE_API_PREFIXES) {
    if (path === entry.prefix || path.startsWith(entry.prefix)) {
      return entry.module;
    }
  }
  return null;
}

function createModuleEntitlementMiddleware() {
  return async function moduleEntitlementMiddleware(req, res, next) {
    try {
      if (!req.tenant || !req.tenant.id) return next();

      const p = (req.originalUrl || req.path || '').split('?')[0];
      if (ALWAYS_ALLOW_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix))) {
        return next();
      }

      const moduleKey = resolveModuleForPath(p);
      if (!moduleKey) return next();

      await owner.ensureSchema();
      if (!(await owner.isFlagEnabled('module_enforcement.enabled'))) {
        return next();
      }

      const enabled = await owner.isModuleEnabledForTenant(req.tenant.id, moduleKey);
      if (!enabled) {
        return res.status(403).json({
          success: false,
          code: 'MODULE_NOT_ENTITLED',
          module: moduleKey,
          message: `الوحدة «${moduleKey}» غير مفعّلة لهذه الشركة حسب الباقة أو إعدادات مالك المنصة.`
        });
      }
      return next();
    } catch (err) {
      console.warn('[ModuleEntitlement]', err.message);
      return next();
    }
  };
}

async function assertSeatAvailable(req, res, next) {
  try {
    if (!req.tenant?.id) return next();
    await owner.ensureSchema();
    const check = await owner.checkSeatAllowance(req.tenant.id);
    if (!check.allowed) {
      return res.status(403).json({
        success: false,
        code: 'SEAT_LIMIT',
        data: check,
        message: 'تم بلوغ حد مقاعد الترخيص لهذه الشركة.'
      });
    }
    req.seatCheck = check;
    return next();
  } catch (err) {
    console.warn('[SeatEnforcement]', err.message);
    return next();
  }
}

module.exports = {
  MODULE_API_PREFIXES,
  ALWAYS_ALLOW_PREFIXES,
  resolveModuleForPath,
  createModuleEntitlementMiddleware,
  assertSeatAvailable
};
