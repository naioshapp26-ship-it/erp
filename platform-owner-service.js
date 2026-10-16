'use strict';

/**
 * Platform Owner Console — shared domain service (Phase 2).
 * Extends existing tenants / subscriptions / page-access; does not replace them.
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');
const {
  TENANT_SAFE_PAGES_BY_PLAN,
  resolveTenantSafePagesForPlan,
  reseedTenantPageAccessForTenant,
  sanitizeTenantAllowedPages
} = require('./tenant-page-access-policy');
const { getTenantPermissionBundle } = require('./tenant-page-permissions');
const { PRIMARY_TENANT_SYSTEM_KEYS } = require('./page-permissions-registry');

let schemaReady = false;
let schemaPromise = null;

const DEFAULT_PLANS = [
  {
    code: 'basic',
    name_ar: 'أساسية',
    name_en: 'Basic',
    price: 29,
    currency: 'USD',
    billing_cycle: 'monthly',
    trial_days: 7,
    grace_days: 3,
    max_users: 5,
    max_storage_mb: 1024,
    is_custom: false,
    sort_order: 10,
    modules: TENANT_SAFE_PAGES_BY_PLAN.basic
  },
  {
    code: 'pro',
    name_ar: 'احترافية',
    name_en: 'Pro',
    price: 79,
    currency: 'USD',
    billing_cycle: 'monthly',
    trial_days: 14,
    grace_days: 5,
    max_users: 25,
    max_storage_mb: 10240,
    is_custom: false,
    sort_order: 20,
    modules: TENANT_SAFE_PAGES_BY_PLAN.pro
  },
  {
    code: 'enterprise',
    name_ar: 'مؤسسية',
    name_en: 'Enterprise',
    price: 199,
    currency: 'USD',
    billing_cycle: 'monthly',
    trial_days: 30,
    grace_days: 7,
    max_users: 200,
    max_storage_mb: 102400,
    is_custom: false,
    sort_order: 30,
    modules: TENANT_SAFE_PAGES_BY_PLAN.enterprise
  }
];

const MODULE_CATALOG = [
  { key: 'dashboard', labelAr: 'لوحة التحكم', independent: false },
  { key: 'hr', labelAr: 'الموارد البشرية', independent: true },
  { key: 'finance', labelAr: 'المالية', independent: true },
  { key: 'tasks-management', labelAr: 'المهام', independent: false },
  { key: 'requests', labelAr: 'الطلبات', independent: false },
  { key: 'employees', labelAr: 'الموظفون', independent: false },
  { key: 'records-archive-home', labelAr: 'الأرشيف', independent: false },
  { key: 'facilities', labelAr: 'المرافق', independent: false },
  { key: 'ads', labelAr: 'الإعلانات', independent: false },
  { key: 'audit-logs', labelAr: 'سجل التدقيق', independent: false },
  { key: 'incubator', labelAr: 'الحاضنة', independent: false },
  { key: 'events-studio-main', labelAr: 'استوديو الفعاليات', independent: false },
  { key: 'marketing-campaigns-studio', labelAr: 'الحملات التسويقية', independent: false },
  { key: 'operational-policies', labelAr: 'السياسات التشغيلية', independent: false },
  { key: 'tenant-branding', labelAr: 'هوية الشركة', independent: false }
];

async function ensureCentralTenantTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      subdomain VARCHAR(63) NOT NULL UNIQUE,
      company_name VARCHAR(255) NOT NULL,
      subscription_plan VARCHAR(100) NOT NULL DEFAULT 'basic',
      status VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
      encrypted_db_url TEXT,
      db_name VARCHAR(100),
      settings JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
      plan VARCHAR(100) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      trial_ends_at TIMESTAMP,
      current_period_start TIMESTAMP,
      current_period_end TIMESTAMP,
      provider VARCHAR(50),
      provider_subscription_id VARCHAR(255),
      settings JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id)
    );
  `);
}

async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await ensureCentralTenantTables();
    const sqlPath = path.join(__dirname, 'create-platform-owner-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await db.query(sql);
    await seedDefaultPlans();
    await seedDefaultFlags();
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

async function seedDefaultPlans() {
  for (const plan of DEFAULT_PLANS) {
    await db.query(
      `INSERT INTO saas_plans
         (code, name_ar, name_en, price, currency, billing_cycle, trial_days, grace_days,
          max_users, max_storage_mb, is_custom, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,true,$11)
       ON CONFLICT (code) DO UPDATE SET
         name_ar = EXCLUDED.name_ar,
         name_en = EXCLUDED.name_en,
         updated_at = NOW()`,
      [
        plan.code,
        plan.name_ar,
        plan.name_en,
        plan.price,
        plan.currency,
        plan.billing_cycle,
        plan.trial_days,
        plan.grace_days,
        plan.max_users,
        plan.max_storage_mb,
        plan.sort_order
      ]
    );
    for (const moduleKey of plan.modules) {
      await db.query(
        `INSERT INTO saas_plan_modules (plan_code, module_key, enabled)
         VALUES ($1, $2, true)
         ON CONFLICT (plan_code, module_key) DO NOTHING`,
        [plan.code, moduleKey]
      );
    }
  }
}

async function seedDefaultFlags() {
  const flags = [
    { key: 'signup.enabled', enabled: true, description_ar: 'تفعيل التسجيل الذاتي SaaS' },
    { key: 'maintenance.mode', enabled: false, description_ar: 'وضع الصيانة للمنصة' },
    { key: 'module_enforcement.enabled', enabled: true, description_ar: 'فرض وحدات الباقة على واجهات API' },
    { key: 'seat_enforcement.enabled', enabled: true, description_ar: 'فرض حدود المقاعد' },
    { key: 'ops.error_capture', enabled: true, description_ar: 'تسجيل أخطاء API للمنصة' }
  ];
  for (const flag of flags) {
    await db.query(
      `INSERT INTO platform_feature_flags (key, enabled, description_ar, audience)
       VALUES ($1, $2, $3, 'platform')
       ON CONFLICT (key) DO NOTHING`,
      [flag.key, flag.enabled, flag.description_ar]
    );
  }
}

async function writeAudit({ actorId, action, entityType, entityId, tenantId, oldValue, newValue, meta, ip }) {
  await db.query(
    `INSERT INTO platform_owner_audit
       (actor_id, action, entity_type, entity_id, tenant_id, old_value, new_value, meta, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)`,
    [
      actorId || null,
      action,
      entityType || null,
      entityId != null ? String(entityId) : null,
      tenantId || null,
      oldValue != null ? JSON.stringify(oldValue) : null,
      newValue != null ? JSON.stringify(newValue) : null,
      JSON.stringify(meta || {}),
      ip || null
    ]
  );
}

async function listPlans({ includeInactive = false } = {}) {
  const result = await db.query(
    `SELECT * FROM saas_plans
     WHERE ($1::boolean = true OR is_active = true)
     ORDER BY sort_order ASC, code ASC`,
    [includeInactive]
  );
  const modules = await db.query(
    `SELECT plan_code, module_key, enabled FROM saas_plan_modules ORDER BY plan_code, module_key`
  );
  const byPlan = {};
  for (const row of modules.rows) {
    if (!byPlan[row.plan_code]) byPlan[row.plan_code] = [];
    byPlan[row.plan_code].push(row);
  }
  return result.rows.map((plan) => ({
    ...plan,
    modules: byPlan[plan.code] || [],
    module_keys: (byPlan[plan.code] || []).filter((m) => m.enabled).map((m) => m.module_key)
  }));
}

async function getPlan(code) {
  const result = await db.query(`SELECT * FROM saas_plans WHERE code = $1 LIMIT 1`, [code]);
  if (!result.rows.length) return null;
  const modules = await db.query(
    `SELECT module_key, enabled FROM saas_plan_modules WHERE plan_code = $1 ORDER BY module_key`,
    [code]
  );
  return {
    ...result.rows[0],
    modules: modules.rows,
    module_keys: modules.rows.filter((m) => m.enabled).map((m) => m.module_key)
  };
}

async function upsertPlan(input, actorId) {
  const code = String(input.code || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!code || code.length < 2) {
    const err = new Error('رمز الباقة غير صالح.');
    err.status = 400;
    throw err;
  }
  const existing = await getPlan(code);
  await db.query(
    `INSERT INTO saas_plans
       (code, name_ar, name_en, description_ar, description_en, price, currency, billing_cycle,
        trial_days, grace_days, max_users, max_storage_mb, is_custom, is_active, sort_order, limits, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb)
     ON CONFLICT (code) DO UPDATE SET
       name_ar = EXCLUDED.name_ar,
       name_en = EXCLUDED.name_en,
       description_ar = EXCLUDED.description_ar,
       description_en = EXCLUDED.description_en,
       price = EXCLUDED.price,
       currency = EXCLUDED.currency,
       billing_cycle = EXCLUDED.billing_cycle,
       trial_days = EXCLUDED.trial_days,
       grace_days = EXCLUDED.grace_days,
       max_users = EXCLUDED.max_users,
       max_storage_mb = EXCLUDED.max_storage_mb,
       is_custom = EXCLUDED.is_custom,
       is_active = EXCLUDED.is_active,
       sort_order = EXCLUDED.sort_order,
       limits = EXCLUDED.limits,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()`,
    [
      code,
      String(input.name_ar || input.nameAr || code).slice(0, 255),
      input.name_en || input.nameEn || null,
      input.description_ar || input.descriptionAr || null,
      input.description_en || input.descriptionEn || null,
      Number(input.price) || 0,
      String(input.currency || 'USD').slice(0, 10),
      ['monthly', 'yearly', 'custom'].includes(input.billing_cycle) ? input.billing_cycle : 'monthly',
      Math.max(0, Number(input.trial_days) || 0),
      Math.max(0, Number(input.grace_days) || 0),
      Math.max(1, Number(input.max_users) || 5),
      Math.max(1, Number(input.max_storage_mb) || 1024),
      Boolean(input.is_custom || !['basic', 'pro', 'enterprise'].includes(code)),
      input.is_active !== false,
      Number(input.sort_order) || 100,
      JSON.stringify(input.limits || {}),
      JSON.stringify(input.metadata || {})
    ]
  );

  if (Array.isArray(input.module_keys || input.modules)) {
    const keys = sanitizeTenantAllowedPages(input.module_keys || input.modules);
    await db.query(`DELETE FROM saas_plan_modules WHERE plan_code = $1`, [code]);
    for (const moduleKey of keys) {
      await db.query(
        `INSERT INTO saas_plan_modules (plan_code, module_key, enabled) VALUES ($1, $2, true)`,
        [code, moduleKey]
      );
    }
  }

  const saved = await getPlan(code);
  await writeAudit({
    actorId,
    action: existing ? 'plan.update' : 'plan.create',
    entityType: 'saas_plan',
    entityId: code,
    oldValue: existing,
    newValue: saved
  });
  return saved;
}

async function setPlanModules(planCode, moduleKeys, actorId) {
  const plan = await getPlan(planCode);
  if (!plan) {
    const err = new Error('الباقة غير موجودة.');
    err.status = 404;
    throw err;
  }
  const keys = sanitizeTenantAllowedPages(moduleKeys);
  await db.query(`DELETE FROM saas_plan_modules WHERE plan_code = $1`, [planCode]);
  for (const moduleKey of keys) {
    await db.query(
      `INSERT INTO saas_plan_modules (plan_code, module_key, enabled) VALUES ($1, $2, true)`,
      [planCode, moduleKey]
    );
  }
  const saved = await getPlan(planCode);
  await writeAudit({
    actorId,
    action: 'plan.modules',
    entityType: 'saas_plan',
    entityId: planCode,
    oldValue: { module_keys: plan.module_keys },
    newValue: { module_keys: saved.module_keys }
  });
  return saved;
}

async function listCompanies({ search = '', status = '', plan = '', page = 1, limit = 20 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  const conditions = ["t.status != 'deleted'"];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(t.subdomain ILIKE $${params.length} OR t.company_name ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (plan) {
    params.push(plan);
    conditions.push(`t.subscription_plan = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM tenants t WHERE ${where}`, params);
  params.push(limitNum, offset);
  const rows = await db.query(
    `SELECT t.id, t.subdomain, t.company_name, t.subscription_plan, t.status, t.db_name,
            t.settings, t.created_at, t.updated_at,
            s.status AS subscription_status, s.trial_ends_at, s.current_period_start,
            s.current_period_end, s.settings AS subscription_settings,
            l.seats, l.seats_used, l.storage_mb_limit, l.storage_mb_used, l.status AS license_status,
            l.ends_at AS license_ends_at
     FROM tenants t
     LEFT JOIN subscriptions s ON s.tenant_id = t.id
     LEFT JOIN tenant_licenses l ON l.tenant_id = t.id
     WHERE ${where}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    total: countRes.rows[0].total,
    page: pageNum,
    limit: limitNum,
    items: rows.rows
  };
}

async function getCompany(tenantId) {
  const result = await db.query(
    `SELECT t.*, s.status AS subscription_status, s.plan AS subscription_plan_row,
            s.trial_ends_at, s.current_period_start, s.current_period_end,
            s.provider, s.settings AS subscription_settings,
            l.seats, l.seats_used, l.storage_mb_limit, l.storage_mb_used,
            l.status AS license_status, l.starts_at AS license_starts_at, l.ends_at AS license_ends_at
     FROM tenants t
     LEFT JOIN subscriptions s ON s.tenant_id = t.id
     LEFT JOIN tenant_licenses l ON l.tenant_id = t.id
     WHERE t.id = $1
     LIMIT 1`,
    [tenantId]
  );
  if (!result.rows.length) return null;
  const company = result.rows[0];
  const modules = await resolveTenantModules(tenantId);
  const overrides = await db.query(
    `SELECT module_key, enabled, reason, updated_at FROM tenant_module_overrides WHERE tenant_id = $1`,
    [tenantId]
  );
  return { ...company, modules, module_overrides: overrides.rows };
}

async function ensureLicenseForTenant(tenantId, planCode, actorId) {
  const plan = (await getPlan(planCode)) || {
    code: planCode,
    max_users: 5,
    max_storage_mb: 1024,
    grace_days: 3
  };
  await db.query(
    `INSERT INTO tenant_licenses
       (tenant_id, plan_code, seats, storage_mb_limit, status, source)
     VALUES ($1, $2, $3, $4, 'active', 'plan_sync')
     ON CONFLICT (tenant_id) DO UPDATE SET
       plan_code = EXCLUDED.plan_code,
       seats = EXCLUDED.seats,
       storage_mb_limit = EXCLUDED.storage_mb_limit,
       status = 'active',
       updated_at = NOW()`,
    [tenantId, plan.code, plan.max_users, plan.max_storage_mb]
  );
  await writeAudit({
    actorId,
    action: 'license.sync',
    entityType: 'tenant_license',
    entityId: tenantId,
    tenantId,
    newValue: { plan_code: plan.code, seats: plan.max_users, storage_mb_limit: plan.max_storage_mb }
  });
}

async function syncSubscriptionRow(tenantId, { plan, status, trialEndsAt, periodStart, periodEnd, settings }, actorId) {
  const existing = await db.query(`SELECT * FROM subscriptions WHERE tenant_id = $1`, [tenantId]);
  const nextSettings = {
    ...(existing.rows[0]?.settings || {}),
    ...(settings || {})
  };
  await db.query(
    `INSERT INTO subscriptions
       (tenant_id, plan, status, trial_ends_at, current_period_start, current_period_end, settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (tenant_id) DO UPDATE SET
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       trial_ends_at = COALESCE(EXCLUDED.trial_ends_at, subscriptions.trial_ends_at),
       current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
       current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
       settings = EXCLUDED.settings,
       updated_at = NOW()`,
    [
      tenantId,
      plan,
      status || 'active',
      trialEndsAt || null,
      periodStart || null,
      periodEnd || null,
      JSON.stringify(nextSettings)
    ]
  );
  await writeAudit({
    actorId,
    action: 'subscription.sync',
    entityType: 'subscription',
    entityId: tenantId,
    tenantId,
    oldValue: existing.rows[0] || null,
    newValue: { plan, status: status || 'active' }
  });
}

async function updateCompanyLifecycle(tenantId, body, actorId) {
  const company = await getCompany(tenantId);
  if (!company) {
    const err = new Error('الشركة غير موجودة.');
    err.status = 404;
    throw err;
  }

  const updates = [];
  const params = [];
  let planChanged = false;
  let nextPlan = company.subscription_plan;

  if (body.companyName != null || body.company_name != null) {
    const name = String(body.companyName || body.company_name || '').trim();
    if (!name) {
      const err = new Error('اسم الشركة مطلوب.');
      err.status = 400;
      throw err;
    }
    params.push(name);
    updates.push(`company_name = $${params.length}`);
  }

  if (body.status != null) {
    const allowed = new Set(['active', 'suspended', 'pending_payment']);
    if (!allowed.has(body.status)) {
      const err = new Error('حالة الحساب غير صالحة (لا حذف تلقائي من هذه الواجهة).');
      err.status = 400;
      throw err;
    }
    params.push(body.status);
    updates.push(`status = $${params.length}`);
  }

  if (body.plan != null || body.subscription_plan != null) {
    nextPlan = String(body.plan || body.subscription_plan).trim().toLowerCase();
    const plan = await getPlan(nextPlan);
    if (!plan || !plan.is_active) {
      const err = new Error('الباقة غير موجودة أو غير مفعّلة.');
      err.status = 400;
      throw err;
    }
    params.push(nextPlan);
    updates.push(`subscription_plan = $${params.length}`);
    planChanged = true;
  }

  if (updates.length) {
    params.push(tenantId);
    await db.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params
    );
  }

  const subStatus = body.subscription_status || body.subscriptionStatus;
  if (planChanged || subStatus || body.trial_ends_at || body.current_period_end || body.grace_days != null) {
    const planRow = await getPlan(nextPlan);
    const trialDays = Number(body.trial_days != null ? body.trial_days : planRow?.trial_days) || 0;
    let trialEndsAt = body.trial_ends_at || null;
    if (subStatus === 'trialing' && !trialEndsAt && trialDays > 0) {
      trialEndsAt = new Date(Date.now() + trialDays * 86400000).toISOString();
    }
    const periodStart = body.current_period_start || new Date().toISOString();
    const periodEnd = body.current_period_end || null;
    const settings = {};
    if (body.grace_days != null) settings.grace_days = Number(body.grace_days);
    else if (planRow) settings.grace_days = planRow.grace_days;
    if (body.billing_cycle) settings.billing_cycle = body.billing_cycle;

    await syncSubscriptionRow(
      tenantId,
      {
        plan: nextPlan,
        status: subStatus || (company.subscription_status || 'active'),
        trialEndsAt,
        periodStart,
        periodEnd,
        settings
      },
      actorId
    );
  }

  if (planChanged || body.sync_license !== false) {
    await ensureLicenseForTenant(tenantId, nextPlan, actorId);
  }

  if (planChanged && body.reseed_modules !== false) {
    const tenant = await db.query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    const existingBundle = await getTenantPermissionBundle(db, {
      id: tenantId,
      subdomain: tenant.rows[0].subdomain
    }).catch(() => null);
    await reseedTenantPageAccessForTenant(db, tenant.rows[0], {
      existingBundle,
      forcePlanDefaults: true,
      preserveExisting: false
    });
  }

  const updated = await getCompany(tenantId);
  await writeAudit({
    actorId,
    action: 'company.update',
    entityType: 'tenant',
    entityId: tenantId,
    tenantId,
    oldValue: {
      company_name: company.company_name,
      status: company.status,
      subscription_plan: company.subscription_plan
    },
    newValue: {
      company_name: updated.company_name,
      status: updated.status,
      subscription_plan: updated.subscription_plan
    }
  });
  return updated;
}

async function resolvePlanModuleKeys(planCode) {
  const plan = await getPlan(planCode);
  if (plan?.module_keys?.length) return plan.module_keys;
  return resolveTenantSafePagesForPlan(planCode);
}

async function resolveTenantModules(tenantId) {
  const tenant = await db.query(
    `SELECT id, subscription_plan, status FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (!tenant.rows.length) return { enabled: [], locked: [], overrides: [] };

  const planKeys = await resolvePlanModuleKeys(tenant.rows[0].subscription_plan);
  const overrides = await db.query(
    `SELECT module_key, enabled FROM tenant_module_overrides WHERE tenant_id = $1`,
    [tenantId]
  );
  const overrideMap = new Map(overrides.rows.map((r) => [r.module_key, r.enabled]));
  const catalogKeys = [...new Set([
    ...MODULE_CATALOG.map((m) => m.key),
    ...planKeys,
    ...overrides.rows.map((r) => r.module_key)
  ])];

  const enabled = [];
  const locked = [];
  for (const key of catalogKeys) {
    let isEnabled = planKeys.includes(key);
    if (overrideMap.has(key)) isEnabled = Boolean(overrideMap.get(key));
    const meta = MODULE_CATALOG.find((m) => m.key === key) || { key, labelAr: key, independent: false };
    const item = { ...meta, enabled: isEnabled, from_plan: planKeys.includes(key), overridden: overrideMap.has(key) };
    if (isEnabled) enabled.push(item);
    else locked.push(item);
  }

  return { enabled, locked, overrides: overrides.rows, plan_keys: planKeys };
}

async function setTenantModuleOverride(tenantId, moduleKey, enabled, reason, actorId) {
  const key = String(moduleKey || '').trim();
  if (!key) {
    const err = new Error('معرف الوحدة مطلوب.');
    err.status = 400;
    throw err;
  }
  await db.query(
    `INSERT INTO tenant_module_overrides (tenant_id, module_key, enabled, reason, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (tenant_id, module_key) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       reason = EXCLUDED.reason,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [tenantId, key, Boolean(enabled), reason || null, actorId || null]
  );

  // Sync into tenant_page_access allowed pages when the table/helpers are available
  const tenant = await db.query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  if (tenant.rows.length) {
    try {
      const bundle = await getTenantPermissionBundle(db, tenant.rows[0]).catch(() => ({ allowed_pages: [] }));
      let pages = sanitizeTenantAllowedPages(bundle.allowed_pages || []);
      if (enabled && !pages.includes(key)) pages.push(key);
      if (!enabled) pages = pages.filter((p) => p !== key);
      const { saveTenantPermissionBundle } = require('./tenant-page-permissions');
      await saveTenantPermissionBundle(db, tenant.rows[0], {
        pages,
        page_restrictions: bundle.page_restrictions || {}
      });
    } catch (syncErr) {
      console.warn('[PlatformOwner] page-access sync skipped:', syncErr.message);
    }
  }

  await writeAudit({
    actorId,
    action: enabled ? 'module.enable' : 'module.disable',
    entityType: 'tenant_module',
    entityId: `${tenantId}:${key}`,
    tenantId,
    newValue: { module_key: key, enabled: Boolean(enabled), reason }
  });
  return resolveTenantModules(tenantId);
}

async function updateLicense(tenantId, body, actorId) {
  const seats = Math.max(1, Number(body.seats) || 1);
  const storage = Math.max(1, Number(body.storage_mb_limit || body.storageMbLimit) || 1024);
  const status = body.status || 'active';
  const endsAt = body.ends_at || body.endsAt || null;
  await db.query(
    `INSERT INTO tenant_licenses
       (tenant_id, plan_code, seats, storage_mb_limit, status, ends_at, source, notes)
     VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7)
     ON CONFLICT (tenant_id) DO UPDATE SET
       seats = EXCLUDED.seats,
       storage_mb_limit = EXCLUDED.storage_mb_limit,
       status = EXCLUDED.status,
       ends_at = EXCLUDED.ends_at,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [
      tenantId,
      body.plan_code || body.planCode || null,
      seats,
      storage,
      status,
      endsAt,
      body.notes || null
    ]
  );
  const row = await db.query(`SELECT * FROM tenant_licenses WHERE tenant_id = $1`, [tenantId]);
  await writeAudit({
    actorId,
    action: 'license.update',
    entityType: 'tenant_license',
    entityId: tenantId,
    tenantId,
    newValue: row.rows[0]
  });
  return row.rows[0];
}

async function checkSeatAllowance(tenantId) {
  await ensureSchema();
  const flag = await isFlagEnabled('seat_enforcement.enabled');
  if (!flag) return { allowed: true, enforced: false };

  const lic = await db.query(`SELECT * FROM tenant_licenses WHERE tenant_id = $1`, [tenantId]);
  if (!lic.rows.length) return { allowed: true, enforced: true, reason: 'no_license_row' };
  const row = lic.rows[0];
  if (row.status === 'suspended' || row.status === 'expired') {
    return { allowed: false, enforced: true, seats: row.seats, seats_used: row.seats_used, status: row.status };
  }
  if (Number(row.seats_used) >= Number(row.seats)) {
    return {
      allowed: false,
      enforced: true,
      seats: row.seats,
      seats_used: row.seats_used,
      reason: 'seat_limit'
    };
  }
  return { allowed: true, enforced: true, seats: row.seats, seats_used: row.seats_used };
}

async function incrementSeatUsage(tenantId, delta = 1) {
  await db.query(
    `UPDATE tenant_licenses
     SET seats_used = GREATEST(0, seats_used + $2), updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId, delta]
  );
}

async function isModuleEnabledForTenant(tenantId, moduleKey) {
  const modules = await resolveTenantModules(tenantId);
  return modules.enabled.some((m) => m.key === moduleKey);
}

async function listFlags() {
  const result = await db.query(
    `SELECT key, enabled, description_ar, description_en, audience, metadata, updated_at
     FROM platform_feature_flags ORDER BY key`
  );
  return result.rows;
}

async function setFlag(key, enabled, actorId, descriptionAr) {
  await db.query(
    `INSERT INTO platform_feature_flags (key, enabled, description_ar, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (key) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       description_ar = COALESCE(EXCLUDED.description_ar, platform_feature_flags.description_ar),
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, Boolean(enabled), descriptionAr || null, actorId || null]
  );
  await writeAudit({
    actorId,
    action: 'flag.set',
    entityType: 'feature_flag',
    entityId: key,
    newValue: { key, enabled: Boolean(enabled) }
  });
  return listFlags();
}

async function isFlagEnabled(key) {
  const result = await db.query(
    `SELECT enabled FROM platform_feature_flags WHERE key = $1 LIMIT 1`,
    [key]
  );
  if (!result.rows.length) return false;
  return Boolean(result.rows[0].enabled);
}

async function recordApiError({ pathName, method, statusCode, errorMessage, tenantId, meta }) {
  try {
    if (!(await isFlagEnabled('ops.error_capture'))) return;
    await db.query(
      `INSERT INTO platform_api_error_events (path, method, status_code, error_message, tenant_id, meta)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        pathName || null,
        method || null,
        statusCode || null,
        String(errorMessage || '').slice(0, 2000),
        tenantId || null,
        JSON.stringify(meta || {})
      ]
    );
  } catch {
    /* never break request path */
  }
}

async function getOpsSnapshot() {
  const started = Date.now();
  let dbOk = false;
  let dbTime = null;
  try {
    const ping = await db.query('SELECT NOW() AS now');
    dbOk = true;
    dbTime = ping.rows[0].now;
  } catch (err) {
    dbOk = false;
  }

  const tenants = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'active')::int AS active,
       COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended,
       COUNT(*) FILTER (WHERE status = 'pending_payment')::int AS pending_payment,
       COUNT(*) FILTER (WHERE status != 'deleted')::int AS total
     FROM tenants`
  );
  const subs = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'active')::int AS active,
       COUNT(*) FILTER (WHERE status = 'trialing')::int AS trialing,
       COUNT(*) FILTER (WHERE status = 'past_due')::int AS past_due,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
     FROM subscriptions`
  );
  const errors = await db.query(
    `SELECT id, path, method, status_code, error_message, created_at
     FROM platform_api_error_events
     ORDER BY created_at DESC LIMIT 25`
  );
  const flags = await listFlags();
  const audit = await db.query(
    `SELECT id, actor_id, action, entity_type, entity_id, tenant_id, created_at
     FROM platform_owner_audit ORDER BY created_at DESC LIMIT 25`
  );

  let sessionsActive = 0;
  try {
    const sess = await db.query(
      `SELECT COUNT(*)::int AS c FROM user_sessions WHERE expires_at > NOW()`
    );
    sessionsActive = sess.rows[0].c;
  } catch {
    sessionsActive = 0;
  }

  return {
    version: {
      phase: 'phase2-platform-owner',
      app: process.env.npm_package_version || 'erp',
      node: process.version,
      env: process.env.NODE_ENV || 'development'
    },
    services: {
      api: { status: 'ok', latency_ms: Date.now() - started },
      database: { status: dbOk ? 'ok' : 'error', time: dbTime }
    },
    usage: {
      tenants: tenants.rows[0],
      subscriptions: subs.rows[0],
      active_sessions: sessionsActive
    },
    feature_flags: flags,
    recent_errors: errors.rows,
    recent_audit: audit.rows,
    background_jobs: {
      note: 'No dedicated job runner wired; provisioning is request-driven.',
      status: 'idle'
    }
  };
}

async function listAudit({ tenantId = null, limit = 50 } = {}) {
  const result = await db.query(
    `SELECT * FROM platform_owner_audit
     WHERE ($1::int IS NULL OR tenant_id = $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenantId, Math.min(200, Number(limit) || 50)]
  );
  return result.rows;
}

async function listSecuritySessions() {
  try {
    const result = await db.query(
      `SELECT us.id, us.user_id, u.email, u.role, u.tenant_type, us.expires_at, us.created_at
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       WHERE us.expires_at > NOW()
       ORDER BY us.created_at DESC
       LIMIT 100`
    );
    return result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      email: row.email,
      role: row.role,
      tenant_type: row.tenant_type,
      expires_at: row.expires_at,
      created_at: row.created_at,
      ip_address: null,
      user_agent: null
    }));
  } catch (err) {
    throw err;
  }
}

async function revokeSession(sessionId, actorId) {
  const result = await db.query(
    `DELETE FROM user_sessions WHERE id = $1 RETURNING id, user_id`,
    [sessionId]
  );
  if (!result.rows.length) {
    const err = new Error('الجلسة غير موجودة.');
    err.status = 404;
    throw err;
  }
  await writeAudit({
    actorId,
    action: 'session.revoke',
    entityType: 'user_session',
    entityId: sessionId,
    newValue: result.rows[0]
  });
  return result.rows[0];
}

function getModuleCatalog() {
  const extras = PRIMARY_TENANT_SYSTEM_KEYS
    .filter((key) => !MODULE_CATALOG.some((m) => m.key === key))
    .map((key) => ({ key, labelAr: key, independent: false }));
  return [...MODULE_CATALOG, ...extras];
}

module.exports = {
  ensureSchema,
  DEFAULT_PLANS,
  MODULE_CATALOG,
  getModuleCatalog,
  writeAudit,
  listPlans,
  getPlan,
  upsertPlan,
  setPlanModules,
  listCompanies,
  getCompany,
  updateCompanyLifecycle,
  ensureLicenseForTenant,
  syncSubscriptionRow,
  resolveTenantModules,
  setTenantModuleOverride,
  updateLicense,
  checkSeatAllowance,
  incrementSeatUsage,
  isModuleEnabledForTenant,
  listFlags,
  setFlag,
  isFlagEnabled,
  recordApiError,
  getOpsSnapshot,
  listAudit,
  listSecuritySessions,
  revokeSession,
  resolvePlanModuleKeys
};
