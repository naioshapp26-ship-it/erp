'use strict';

/**
 * Enforce plan/tenant module entitlements on tenant-scoped API traffic.
 * Central/platform hosts are not gated by tenant module keys.
 */

const owner = require('./platform-owner-service');

/** Map URL prefixes → module keys (existing ERP modules only). */
const MODULE_API_PREFIXES = [
  { prefix: '/api/hr', module: 'hr' },
  { prefix: '/api/finance', module: 'finance' },
  { prefix: '/api/facilities', module: 'facilities' },
  { prefix: '/api/tasks', module: 'tasks-management' },
  { prefix: '/api/ads', module: 'ads' },
  { prefix: '/api/audit', module: 'audit-logs' },
  { prefix: '/finance/', module: 'finance' },
  { prefix: '/hr/', module: 'hr' },
  { prefix: '/facilities', module: 'facilities' }
];

function resolveModuleForPath(pathname) {
  const path = String(pathname || '');
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

      // Always allow auth / health / tenant settings / branding
      const p = req.path || req.originalUrl || '';
      if (
        p.startsWith('/api/tenant-auth') ||
        p.startsWith('/api/auth') ||
        p.startsWith('/api/health') ||
        p.startsWith('/api/tenant-settings') ||
        p.startsWith('/api/enterprise-settings') ||
        p.startsWith('/api/platform-owner')
      ) {
        return next();
      }

      const moduleKey = resolveModuleForPath(p) || resolveModuleForPath(req.originalUrl || '');
      if (!moduleKey) return next();

      await owner.ensureSchema();
      if (!(await owner.isFlagEnabled('module_enforcement.enabled'))) {
        return next();
      }

      // Suspended tenants already blocked by tenantResolver; still deny modules if disabled
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

/**
 * Seat enforcement helper for tenant user creation routes.
 */
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
  resolveModuleForPath,
  createModuleEntitlementMiddleware,
  assertSeatAvailable
};
