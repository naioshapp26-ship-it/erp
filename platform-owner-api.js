'use strict';

/**
 * Platform Owner Console API — Phase 2
 * Mount: /api/platform-owner
 *
 * Extends existing tenants/subscriptions/page-access; platform-admin only.
 * Tenant hosts are rejected even if a central cookie is present.
 */

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const owner = require('./platform-owner-service');
const { provisionTenant } = require('./tenant-provisioner');
const { releaseTenantPool } = require('./tenant-connection-manager');

const router = express.Router();

router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

function parseToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) acc[k.trim()] = decodeURIComponent(v.join('=') || '');
    return acc;
  }, {});
  return cookies.authToken || '';
}

async function requirePlatformOwner(req, res, next) {
  try {
    await owner.ensureSchema();

    // Never expose owner APIs on tenant hosts
    if (req.tenant || req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'مركز مالك المنصة متاح على النطاق المركزي فقط.'
      });
    }

    const token = parseToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'يتطلب تسجيل دخول مالك المنصة.' });
    }

    const result = await db.query(
      `SELECT u.id, u.role, u.tenant_type, u.email
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.session_token = $1 AND us.expires_at > NOW()
         AND COALESCE(u.is_active, true) = true
       LIMIT 1`,
      [token]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'الجلسة منتهية أو غير صالحة.' });
    }
    const user = result.rows[0];
    const role = String(user.role || '').toLowerCase();
    const isOwner =
      role === 'super_admin' ||
      user.tenant_type === 'HQ' ||
      role.includes('مسؤول النظام') ||
      String(user.role || '') === 'مسؤول النظام';

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'مقيد بمالك المنصة / المشرف الأعلى. صلاحيات Company Admin غير كافية.'
      });
    }

    req.platformOwner = user;
    return next();
  } catch (err) {
    console.error('[PlatformOwner] auth:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر التحقق من صلاحية مالك المنصة.' });
  }
}

router.use(requirePlatformOwner);

function actorId(req) {
  return req.platformOwner?.id || null;
}

function handleError(res, err, fallback) {
  const status = err.status || 500;
  if (status >= 500) console.error('[PlatformOwner]', err.message);
  return res.status(status).json({ success: false, message: err.message || fallback });
}

// -------- Overview --------
router.get('/overview', async (req, res) => {
  try {
    const ops = await owner.getOpsSnapshot();
    const plans = await owner.listPlans({ includeInactive: false });
    return res.json({
      success: true,
      data: {
        ops,
        plans_count: plans.length,
        module_catalog: owner.getModuleCatalog()
      }
    });
  } catch (err) {
    return handleError(res, err, 'تعذر تحميل نظرة مالك المنصة.');
  }
});

// -------- Companies --------
router.get('/companies', async (req, res) => {
  try {
    const data = await owner.listCompanies(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الشركات.');
  }
});

router.get('/companies/:id', async (req, res) => {
  try {
    const company = await owner.getCompany(Number(req.params.id));
    if (!company) return res.status(404).json({ success: false, message: 'الشركة غير موجودة.' });
    // Never return encrypted_db_url
    const { encrypted_db_url, ...safe } = company;
    return res.json({ success: true, data: safe });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الشركة.');
  }
});

router.post('/companies', async (req, res) => {
  try {
    const body = req.body || {};
    const subdomain = String(body.subdomain || '').trim().toLowerCase();
    const companyName = String(body.companyName || body.company_name || '').trim();
    const plan = String(body.plan || body.subscription_plan || 'basic').trim().toLowerCase();
    const adminEmail = String(body.adminEmail || body.admin_email || '').trim();
    const adminPassword = String(body.adminPassword || body.admin_password || '');
    const adminName = String(body.adminName || body.admin_name || 'Company Admin').trim();

    if (!subdomain || !companyName) {
      return res.status(400).json({ success: false, message: 'النطاق الفرعي واسم الشركة مطلوبان.' });
    }
    if (!adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'بريد وكلمة مرور مسؤول الشركة مطلوبان (تُمرَّر عند الإنشاء فقط ولا تُخزَّن في الكود).'
      });
    }

    const planRow = await owner.getPlan(plan);
    if (!planRow || !planRow.is_active) {
      return res.status(400).json({ success: false, message: 'الباقة غير صالحة.' });
    }

    const provisioned = await provisionTenant({
      subdomain,
      companyName,
      plan,
      adminEmail,
      adminPassword,
      adminName
    });

    const tenantId = provisioned?.tenantId || provisioned?.tenant?.id || provisioned?.id;
    if (tenantId) {
      await owner.syncSubscriptionRow(
        tenantId,
        {
          plan,
          status: body.subscription_status === 'trialing' ? 'trialing' : 'active',
          trialEndsAt: body.trial_ends_at || null,
          periodStart: new Date().toISOString(),
          settings: { grace_days: planRow.grace_days, billing_cycle: planRow.billing_cycle }
        },
        actorId(req)
      );
      await owner.ensureLicenseForTenant(tenantId, plan, actorId(req));
      await owner.writeAudit({
        actorId: actorId(req),
        action: 'company.create',
        entityType: 'tenant',
        entityId: tenantId,
        tenantId,
        newValue: { subdomain, companyName, plan }
      });
    }

    const company = tenantId ? await owner.getCompany(tenantId) : null;
    if (company?.encrypted_db_url) delete company.encrypted_db_url;
    return res.status(201).json({
      success: true,
      data: company || provisioned,
      message: 'تم إنشاء الشركة وتجهيزها.'
    });
  } catch (err) {
    return handleError(res, err, 'فشل إنشاء الشركة.');
  }
});

router.patch('/companies/:id', async (req, res) => {
  try {
    const updated = await owner.updateCompanyLifecycle(Number(req.params.id), req.body || {}, actorId(req));
    if (req.body?.status) {
      await releaseTenantPool(updated.subdomain).catch(() => {});
    }
    const { encrypted_db_url, ...safe } = updated;
    return res.json({ success: true, data: safe });
  } catch (err) {
    return handleError(res, err, 'فشل تحديث الشركة.');
  }
});

router.post('/companies/:id/suspend', async (req, res) => {
  try {
    const updated = await owner.updateCompanyLifecycle(
      Number(req.params.id),
      { status: 'suspended', reseed_modules: false },
      actorId(req)
    );
    await releaseTenantPool(updated.subdomain).catch(() => {});
    const { encrypted_db_url, ...safe } = updated;
    return res.json({ success: true, data: safe, message: 'تم تعليق الشركة دون حذف بياناتها.' });
  } catch (err) {
    return handleError(res, err, 'فشل التعليق.');
  }
});

router.post('/companies/:id/activate', async (req, res) => {
  try {
    const updated = await owner.updateCompanyLifecycle(
      Number(req.params.id),
      { status: 'active', subscription_status: 'active', reseed_modules: false },
      actorId(req)
    );
    const { encrypted_db_url, ...safe } = updated;
    return res.json({ success: true, data: safe, message: 'تم تفعيل الشركة.' });
  } catch (err) {
    return handleError(res, err, 'فشل التفعيل.');
  }
});

// -------- Plans --------
router.get('/plans', async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '') === 'true';
    const data = await owner.listPlans({ includeInactive });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الباقات.');
  }
});

router.get('/plans/:code', async (req, res) => {
  try {
    const plan = await owner.getPlan(req.params.code);
    if (!plan) return res.status(404).json({ success: false, message: 'الباقة غير موجودة.' });
    return res.json({ success: true, data: plan });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الباقة.');
  }
});

router.put('/plans/:code', async (req, res) => {
  try {
    const payload = { ...(req.body || {}), code: req.params.code };
    const saved = await owner.upsertPlan(payload, actorId(req));
    return res.json({ success: true, data: saved });
  } catch (err) {
    return handleError(res, err, 'فشل حفظ الباقة.');
  }
});

router.post('/plans', async (req, res) => {
  try {
    const saved = await owner.upsertPlan(req.body || {}, actorId(req));
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    return handleError(res, err, 'فشل إنشاء الباقة.');
  }
});

router.put('/plans/:code/modules', async (req, res) => {
  try {
    const keys = req.body?.module_keys || req.body?.modules || [];
    const saved = await owner.setPlanModules(req.params.code, keys, actorId(req));
    return res.json({ success: true, data: saved });
  } catch (err) {
    return handleError(res, err, 'فشل تحديث وحدات الباقة.');
  }
});

// -------- Subscriptions --------
router.get('/subscriptions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, t.company_name, t.subdomain, t.status AS tenant_status
       FROM subscriptions s
       JOIN tenants t ON t.id = s.tenant_id
       WHERE t.status != 'deleted'
       ORDER BY s.updated_at DESC NULLS LAST, s.id DESC
       LIMIT 200`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الاشتراكات.');
  }
});

router.patch('/subscriptions/:tenantId', async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId);
    const body = req.body || {};
    const company = await owner.getCompany(tenantId);
    if (!company) return res.status(404).json({ success: false, message: 'الشركة غير موجودة.' });

    const plan = body.plan || company.subscription_plan;
    await owner.syncSubscriptionRow(
      tenantId,
      {
        plan,
        status: body.status || company.subscription_status || 'active',
        trialEndsAt: body.trial_ends_at || body.trialEndsAt || null,
        periodStart: body.current_period_start || body.currentPeriodStart || null,
        periodEnd: body.current_period_end || body.currentPeriodEnd || null,
        settings: {
          grace_days: body.grace_days != null ? Number(body.grace_days) : undefined,
          billing_cycle: body.billing_cycle || undefined,
          renewal_mode: body.renewal_mode || undefined
        }
      },
      actorId(req)
    );

    if (body.plan && body.plan !== company.subscription_plan) {
      await owner.updateCompanyLifecycle(
        tenantId,
        { plan: body.plan, reseed_modules: body.reseed_modules !== false },
        actorId(req)
      );
    }

    if (body.status === 'cancelled' || body.status === 'past_due') {
      // Soft account impact optional: do not auto-delete; may suspend if requested
      if (body.suspend_tenant) {
        await owner.updateCompanyLifecycle(tenantId, { status: 'suspended', reseed_modules: false }, actorId(req));
      }
    }

    const updated = await owner.getCompany(tenantId);
    const { encrypted_db_url, ...safe } = updated;
    return res.json({ success: true, data: safe });
  } catch (err) {
    return handleError(res, err, 'فشل تحديث الاشتراك.');
  }
});

// -------- Licenses --------
router.get('/licenses/:tenantId', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM tenant_licenses WHERE tenant_id = $1`, [
      Number(req.params.tenantId)
    ]);
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الترخيص.');
  }
});

router.put('/licenses/:tenantId', async (req, res) => {
  try {
    const saved = await owner.updateLicense(Number(req.params.tenantId), req.body || {}, actorId(req));
    return res.json({ success: true, data: saved });
  } catch (err) {
    return handleError(res, err, 'فشل تحديث الترخيص.');
  }
});

router.get('/licenses/:tenantId/seat-check', async (req, res) => {
  try {
    const check = await owner.checkSeatAllowance(Number(req.params.tenantId));
    return res.json({ success: true, data: check });
  } catch (err) {
    return handleError(res, err, 'فشل فحص المقاعد.');
  }
});

// -------- Modules --------
router.get('/modules/catalog', async (req, res) => {
  return res.json({ success: true, data: owner.getModuleCatalog() });
});

router.get('/modules/tenant/:tenantId', async (req, res) => {
  try {
    const data = await owner.resolveTenantModules(Number(req.params.tenantId));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة وحدات الشركة.');
  }
});

router.put('/modules/tenant/:tenantId/:moduleKey', async (req, res) => {
  try {
    const enabled = req.body?.enabled !== false && req.body?.enabled !== 'false';
    const data = await owner.setTenantModuleOverride(
      Number(req.params.tenantId),
      req.params.moduleKey,
      enabled,
      req.body?.reason || '',
      actorId(req)
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'فشل تحديث الوحدة.');
  }
});

// -------- Security --------
router.get('/security/sessions', async (req, res) => {
  try {
    const data = await owner.listSecuritySessions();
    return res.json({ success: true, data });
  } catch (err) {
    // columns may differ across bootstrap versions
    return res.json({ success: true, data: [], warning: err.message });
  }
});

router.delete('/security/sessions/:id', async (req, res) => {
  try {
    const data = await owner.revokeSession(Number(req.params.id), actorId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'فشل إلغاء الجلسة.');
  }
});

router.get('/security/audit', async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : null;
    const data = await owner.listAudit({ tenantId, limit: req.query.limit });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة سجل مالك المنصة.');
  }
});

// -------- Ops --------
router.get('/ops/health', async (req, res) => {
  try {
    const data = await owner.getOpsSnapshot();
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة حالة التشغيل.');
  }
});

router.get('/ops/flags', async (req, res) => {
  try {
    const data = await owner.listFlags();
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الأعلام.');
  }
});

router.put('/ops/flags/:key', async (req, res) => {
  try {
    const data = await owner.setFlag(
      req.params.key,
      req.body?.enabled !== false && req.body?.enabled !== 'false',
      actorId(req),
      req.body?.description_ar || req.body?.descriptionAr
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'فشل تحديث العلم.');
  }
});

module.exports = router;
module.exports.requirePlatformOwner = requirePlatformOwner;
module.exports.ensureSchema = owner.ensureSchema;
