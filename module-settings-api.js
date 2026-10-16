'use strict';

/**
 * Phase 4 — Module Settings Center API
 * Mount: /api/module-settings
 *
 * Tenant-host only. Reuses company-admin auth helper pattern.
 */

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const modules = require('./module-settings-service');
const { isSharedTenant } = require('./tenant-branding-service');

const router = express.Router();

router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
}));

function requireTenantContext(req, res, next) {
  if (!req.tenant || !req.tenantPool || !req.tenant.id) {
    return res.status(400).json({
      success: false,
      message: 'مركز إعدادات الوحدات يتطلب نطاقاً فرعياً نشطاً للمستأجر.'
    });
  }
  return next();
}

async function requireCompanyAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  let token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (!token) {
    const cookies = String(req.headers.cookie || '').split(';').reduce((acc, part) => {
      const [k, ...v] = part.trim().split('=');
      if (k) acc[k.trim()] = decodeURIComponent(v.join('=') || '');
      return acc;
    }, {});
    token = cookies.authToken || cookies.tenant_session || '';
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'يتطلب تسجيل دخول مسؤول الشركة.' });
  }

  try {
    const sharedDb = isSharedTenant(req.tenant);
    const sessionQuery = sharedDb
      ? `SELECT s.user_id, u.role, u.is_active, u.email
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.session_token = $1 AND s.tenant_id = $2
           AND s.expires_at > NOW() AND COALESCE(u.is_active, true) = true
         LIMIT 1`
      : `SELECT s.user_id, u.role, u.is_active, u.email
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.session_token = $1
           AND s.expires_at > NOW() AND COALESCE(u.is_active, true) = true
         LIMIT 1`;
    const params = sharedDb ? [token, req.tenant.id] : [token];
    let result;
    try {
      result = await req.tenantPool.query(sessionQuery, params);
    } catch {
      result = await require('./db').query(
        `SELECT us.user_id, u.role, u.is_active, u.email, u.tenant_type
         FROM user_sessions us
         JOIN users u ON u.id = us.user_id
         WHERE us.session_token = $1 AND us.expires_at > NOW()
           AND COALESCE(u.is_active, true) = true
         LIMIT 1`,
        [token]
      );
    }
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'الجلسة منتهية أو غير صالحة.' });
    }
    const user = result.rows[0];
    const role = String(user.role || '').toLowerCase();
    const allowed =
      ['admin', 'tenant_admin', 'company_admin', 'super_admin', 'hr_admin', 'finance_admin'].includes(role) ||
      role.includes('admin') ||
      String(user.role || '') === 'مسؤول النظام' ||
      user.tenant_type === 'HQ';
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'يتطلب صلاحية مسؤول الشركة/الوحدة.'
      });
    }
    req.moduleActor = {
      id: user.user_id || user.id,
      role: user.role,
      email: user.email,
      tenantId: req.tenant.id
    };
    return next();
  } catch (err) {
    console.error('[ModuleSettings] auth:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر التحقق من الصلاحية.' });
  }
}

router.use(requireTenantContext, requireCompanyAdmin);

function handleError(res, err, fallback) {
  const status = err.status || 500;
  if (status >= 500) console.error('[ModuleSettings]', err.message);
  return res.status(status).json({ success: false, message: err.message || fallback });
}

router.get('/bundle', async (req, res) => {
  try {
    const data = await modules.getBundle(req.tenant.id, req.tenantPool);
    return res.json({
      success: true,
      data: {
        tenant: {
          id: req.tenant.id,
          subdomain: req.tenant.subdomain,
          company_name: req.tenant.company_name || req.tenant.companyName || null
        },
        ...data
      }
    });
  } catch (err) {
    return handleError(res, err, 'تعذر تحميل حزمة إعدادات الوحدات.');
  }
});

router.get('/definitions', async (req, res) => {
  try {
    await modules.ensureEngine();
    return res.json({ success: true, data: modules.MODULE_DEFINITIONS });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة التعريفات.');
  }
});

router.get('/values/:key(*)', async (req, res) => {
  try {
    const key = req.params.key.startsWith('module.') ? req.params.key : `module.${req.params.key}`;
    if (!modules.MODULE_DEFINITIONS.some((d) => d.key === key)) {
      return res.status(404).json({ success: false, message: 'مفتاح غير معروف.' });
    }
    const data = await modules.getEngineValue(req.tenant.id, key);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة القيمة.');
  }
});

router.put('/values/:key(*)', async (req, res) => {
  try {
    if (!req.body || typeof req.body.value !== 'object' || Array.isArray(req.body.value)) {
      return res.status(400).json({
        success: false,
        message: 'الحقل value (كائن) مطلوب — لا يوجد حفظ شكلي.'
      });
    }
    const key = req.params.key.startsWith('module.') ? req.params.key : `module.${req.params.key}`;
    if (!modules.MODULE_DEFINITIONS.some((d) => d.key === key)) {
      return res.status(404).json({ success: false, message: 'مفتاح غير معروف.' });
    }
    const current = await modules.getEngineValue(req.tenant.id, key);
    const merged = { ...(current.value || {}), ...req.body.value };
    const saved = await modules.putEngineValue(
      req.tenant.id,
      key,
      merged,
      req.moduleActor.id,
      req.body.changeReason || req.body.reason || 'ui.module'
    );
    const read = await modules.getEngineValue(req.tenant.id, key);
    return res.json({
      success: true,
      data: {
        saved,
        read_after_write: read,
        matches: Object.keys(req.body.value).every(
          (k) => JSON.stringify(read.value?.[k]) === JSON.stringify(req.body.value[k])
        )
      }
    });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ إعداد الوحدة.');
  }
});

// Shorthand section save: PUT /hr/leave  → module.hr.leave
router.put('/section/:module/:name', async (req, res) => {
  try {
    if (!req.body || typeof req.body.value !== 'object') {
      return res.status(400).json({ success: false, message: 'الحقل value (كائن) مطلوب.' });
    }
    const section = `${req.params.module}/${req.params.name}`;
    const result = await modules.saveSection(
      req.tenant.id,
      section,
      req.body.value,
      req.moduleActor.id,
      req.body.changeReason || `ui.${section}`
    );
    const read = await modules.getEngineValue(req.tenant.id, result.key);
    return res.json({
      success: true,
      data: {
        ...result,
        read_after_write: read,
        matches: Object.keys(req.body.value).every(
          (k) => JSON.stringify(read.value?.[k]) === JSON.stringify(req.body.value[k])
        )
      }
    });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ القسم.');
  }
});

// ---- Fiscal ----
router.get('/fiscal/years', async (req, res) => {
  try {
    await modules.ensureOpsSchema(req.tenantPool);
    const result = await req.tenantPool.query(`SELECT * FROM fiscal_years ORDER BY start_date DESC`);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة السنوات المالية.');
  }
});

router.post('/fiscal/years', async (req, res) => {
  try {
    const year = await modules.upsertFiscalYear(req.tenantPool, req.body || {});
    let periods = [];
    if (req.body?.generate_periods !== false) {
      const fiscal = await modules.getEngineValue(req.tenant.id, 'module.finance.fiscal');
      periods = await modules.ensurePeriodsForYear(
        req.tenantPool,
        year.id,
        fiscal.value?.periods_per_year || 12
      );
    }
    return res.status(201).json({ success: true, data: { year, periods } });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ السنة المالية.');
  }
});

router.put('/fiscal/years/:id', async (req, res) => {
  try {
    const year = await modules.upsertFiscalYear(req.tenantPool, {
      ...(req.body || {}),
      id: Number(req.params.id)
    });
    return res.json({ success: true, data: year });
  } catch (err) {
    return handleError(res, err, 'تعذر تحديث السنة المالية.');
  }
});

router.post('/fiscal/years/:id/generate-periods', async (req, res) => {
  try {
    const fiscal = await modules.getEngineValue(req.tenant.id, 'module.finance.fiscal');
    const periods = await modules.ensurePeriodsForYear(
      req.tenantPool,
      Number(req.params.id),
      req.body?.periods_per_year || fiscal.value?.periods_per_year || 12
    );
    return res.json({ success: true, data: periods });
  } catch (err) {
    return handleError(res, err, 'تعذر توليد الفترات.');
  }
});

router.post('/fiscal/periods/:id/status', async (req, res) => {
  try {
    const data = await modules.setPeriodStatus(
      req.tenantPool,
      Number(req.params.id),
      req.body?.status,
      req.moduleActor.id
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تغيير حالة الفترة.');
  }
});

router.post('/fiscal/assert-posting', async (req, res) => {
  try {
    const data = await modules.assertFiscalPostingAllowed(
      req.tenant.id,
      req.tenantPool,
      req.body?.date || req.query.date
    );
    return res.status(data.allowed ? 200 : 409).json({ success: data.allowed, data });
  } catch (err) {
    return handleError(res, err, 'تعذر فحص الإقفال.');
  }
});

// ---- Operational evaluators (prove settings change behavior) ----
router.post('/ops/validate-leave', async (req, res) => {
  try {
    const data = await modules.validateLeaveRequest(req.tenant.id, req.body || {});
    return res.status(data.ok ? 200 : 422).json({ success: data.ok, data });
  } catch (err) {
    return handleError(res, err, 'تعذر التحقق من سياسة الإجازة.');
  }
});

router.post('/ops/compute-tax', async (req, res) => {
  try {
    const data = await modules.computeInvoiceTax(req.tenant.id, req.body?.subtotal);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حساب الضريبة.');
  }
});

router.post('/ops/evaluate-stock', async (req, res) => {
  try {
    const data = await modules.evaluateStockLevel(req.tenant.id, req.body?.quantity);
    return res.status(data.blocked ? 409 : 200).json({ success: !data.blocked, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تقييم المخزون.');
  }
});

router.post('/ops/evaluate-pos', async (req, res) => {
  try {
    const data = await modules.evaluatePosSale(req.tenant.id, req.body?.stock_qty);
    return res.status(data.allowed ? 200 : 409).json({ success: data.allowed, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تقييم نقطة البيع.');
  }
});

router.post('/ops/evaluate-task', async (req, res) => {
  try {
    const data = await modules.evaluateTaskCreate(req.tenant.id, req.body || {});
    return res.status(data.ok ? 200 : 422).json({ success: data.ok, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تقييم المهمة.');
  }
});

router.post('/ops/evaluate-purchase', async (req, res) => {
  try {
    const data = await modules.evaluatePurchaseApproval(req.tenant.id, req.body?.amount);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تقييم المشتريات.');
  }
});

router.post('/ops/next-number', async (req, res) => {
  try {
    const series = req.body?.series_key || req.body?.series || 'invoice';
    const data = await modules.nextNumber(req.tenantPool, req.tenant.id, series);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر توليد الرقم.');
  }
});

// ---- Templates ----
router.get('/templates', async (req, res) => {
  try {
    await modules.ensureOpsSchema(req.tenantPool);
    const type = req.query.type;
    const result = type
      ? await req.tenantPool.query(
        `SELECT * FROM module_templates WHERE template_type = $1 ORDER BY code`,
        [type]
      )
      : await req.tenantPool.query(`SELECT * FROM module_templates ORDER BY template_type, code`);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة القوالب.');
  }
});

router.post('/templates', async (req, res) => {
  try {
    const data = await modules.upsertTemplate(req.tenantPool, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ القالب.');
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const data = await modules.upsertTemplate(req.tenantPool, {
      ...(req.body || {}),
      id: Number(req.params.id)
    });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تحديث القالب.');
  }
});

router.get('/audit', async (req, res) => {
  try {
    const data = await modules.listAudit(req.tenant.id, req.query.limit);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة سجل الوحدات.');
  }
});

module.exports = router;
module.exports.requireCompanyAdmin = requireCompanyAdmin;
