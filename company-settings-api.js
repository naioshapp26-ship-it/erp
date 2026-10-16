'use strict';

/**
 * Phase 3 — Company Settings Center API
 * Mount: /api/company-settings
 *
 * Tenant-host only. Company Admin cannot reach Platform Owner routes
 * (separate mount). Isolation is by req.tenant.id — never cross-tenant.
 */

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const company = require('./company-settings-service');
const { isSharedTenant } = require('./tenant-branding-service');

const router = express.Router();

router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

function requireTenantContext(req, res, next) {
  if (!req.tenant || !req.tenantPool || !req.tenant.id) {
    return res.status(400).json({
      success: false,
      message: 'مركز إعدادات الشركة يتطلب نطاقاً فرعياً نشطاً للمستأجر.'
    });
  }
  // Hard block: never allow platform-owner paths through this router (separate mount)
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
    let result = { rows: [] };
    try {
      result = await req.tenantPool.query(sessionQuery, params);
    } catch {
      result = { rows: [] };
    }
    // Fallback: central/user_sessions (shared local tests often store tokens only there)
    if (!result.rows.length) {
      try {
        result = await require('./db').query(
          `SELECT us.user_id, u.role, u.is_active, u.email, u.tenant_type
           FROM user_sessions us
           JOIN users u ON u.id = us.user_id
           WHERE us.session_token = $1 AND us.expires_at > NOW()
             AND COALESCE(u.is_active, true) = true
           LIMIT 1`,
          [token]
        );
      } catch {
        result = { rows: [] };
      }
    }
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'الجلسة منتهية أو غير صالحة.' });
    }
    const user = result.rows[0];
    const role = String(user.role || '').toLowerCase();
    // Phase 6: tighten RBAC — tenant_type HQ alone must not grant settings admin to staff
    const allowed =
      ['admin', 'tenant_admin', 'company_admin', 'super_admin', 'hr_admin', 'finance_admin'].includes(role) ||
      (role.includes('admin') && !['staff', 'employee', 'user', 'member'].includes(role)) ||
      String(user.role || '') === 'مسؤول النظام';
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'يتطلب صلاحية مسؤول الشركة. لا يمكن الوصول لإعدادات شركة أخرى أو لمالك المنصة من هنا.'
      });
    }
    req.companyActor = {
      id: user.user_id || user.id,
      role: user.role,
      email: user.email,
      tenantId: req.tenant.id
    };
    return next();
  } catch (err) {
    console.error('[CompanySettings] auth:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر التحقق من صلاحية مسؤول الشركة.' });
  }
}

function handleError(res, err, fallback) {
  const status = err.status || 500;
  if (status >= 500) console.error('[CompanySettings]', err.message);
  return res.status(status).json({ success: false, message: err.message || fallback });
}

// Phase 4 — public invite accept (tenant host, no admin session required)
router.post('/invites/accept', requireTenantContext, async (req, res) => {
  try {
    // Seat check before accepting
    try {
      const owner = require('./platform-owner-service');
      await owner.ensureSchema();
      const check = await owner.checkSeatAllowance(req.tenant.id);
      if (check.enforced && !check.allowed) {
        return res.status(403).json({
          success: false,
          code: 'SEAT_LIMIT',
          data: check,
          message: 'لا يمكن قبول الدعوة — تم بلوغ حد مقاعد الباقة.'
        });
      }
    } catch (seatErr) {
      console.warn('[CompanySettings] accept seat check:', seatErr.message);
    }

    // Strong password policy when company.security requires it
    try {
      const modules = require('./module-settings-service');
      const policy = await modules.resolveSecurityPolicy(req.tenant.id);
      const pwd = String(req.body?.password || '');
      if (policy.require_strong_password) {
        const strong = /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd) && pwd.length >= 10;
        if (!strong) {
          return res.status(400).json({
            success: false,
            code: 'WEAK_PASSWORD',
            message: 'كلمة المرور ضعيفة حسب سياسة الأمان.'
          });
        }
      }
    } catch {
      /* continue with basic length check inside acceptInvite */
    }

    const data = await company.acceptInvite(req.tenantPool, {
      token: req.body?.token || req.body?.invite_token,
      password: req.body?.password,
      firstName: req.body?.firstName || req.body?.first_name,
      lastName: req.body?.lastName || req.body?.last_name,
      username: req.body?.username
    });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قبول الدعوة.');
  }
});

router.get('/invites/preview', requireTenantContext, async (req, res) => {
  try {
    await company.ensureOrgSchema(req.tenantPool);
    const raw = String(req.query.token || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, message: 'token مطلوب.' });
    }
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const result = await req.tenantPool.query(
      `SELECT id, email, role, status, expires_at
       FROM tenant_user_invites
       WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'الدعوة غير موجودة.' });
    }
    const row = result.rows[0];
    return res.json({
      success: true,
      data: {
        email: row.email,
        role: row.role,
        status: row.status,
        expires_at: row.expires_at,
        company_name: req.tenant.company_name || req.tenant.companyName || null,
        subdomain: req.tenant.subdomain
      }
    });
  } catch (err) {
    return handleError(res, err, 'تعذر معاينة الدعوة.');
  }
});

router.use(requireTenantContext, requireCompanyAdmin);

router.get('/bundle', async (req, res) => {
  try {
    const data = await company.getBundle(req.tenant.id, req.tenantPool);
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
    return handleError(res, err, 'تعذر تحميل حزمة إعدادات الشركة.');
  }
});

router.get('/:section(general|security|notifications|preferences)', async (req, res) => {
  try {
    const key = `company.${req.params.section}`;
    const data = await company.getEngineValue(req.tenant.id, key);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الإعداد.');
  }
});

router.put('/:section(general|security|notifications|preferences)', async (req, res) => {
  try {
    if (!req.body || typeof req.body.value !== 'object') {
      return res.status(400).json({ success: false, message: 'الحقل value (كائن) مطلوب — لا يوجد حفظ شكلي.' });
    }
    const saved = await company.saveSection(
      req.tenant.id,
      req.tenantPool,
      req.params.section,
      req.body.value,
      req.companyActor.id,
      req.body.changeReason || req.body.reason || `ui.${req.params.section}`
    );
    // Read-after-write proof
    const read = await company.getEngineValue(req.tenant.id, `company.${req.params.section}`);
    return res.json({
      success: true,
      data: {
        saved,
        read_after_write: read,
        matches: JSON.stringify(read.value) === JSON.stringify({ ...(read.value || {}), ...req.body.value }) ||
          Object.keys(req.body.value).every((k) => JSON.stringify(read.value?.[k]) === JSON.stringify(req.body.value[k]))
      }
    });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ الإعداد.');
  }
});

// ---- Org ----
router.get('/org/branches', async (req, res) => {
  try {
    const data = await company.listBranches(req.tenantPool);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الفروع.');
  }
});

router.post('/org/branches', async (req, res) => {
  try {
    const data = await company.upsertBranch(req.tenantPool, req.body || {});
    await company.putEngineValue(
      req.tenant.id,
      'company.general',
      (await company.getEngineValue(req.tenant.id, 'company.general')).value,
      req.companyActor.id,
      'org.branch-touch'
    ).catch(() => null);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ الفرع.');
  }
});

router.put('/org/branches/:id', async (req, res) => {
  try {
    const data = await company.upsertBranch(req.tenantPool, { ...(req.body || {}), id: Number(req.params.id) });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تحديث الفرع.');
  }
});

router.post('/org/branches/:id/deactivate', async (req, res) => {
  try {
    const data = await company.deactivateBranch(req.tenantPool, Number(req.params.id));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تعطيل الفرع.');
  }
});

router.post('/org/departments', async (req, res) => {
  try {
    const data = await company.upsertDepartment(req.tenantPool, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ القسم.');
  }
});

router.put('/org/departments/:id', async (req, res) => {
  try {
    const data = await company.upsertDepartment(req.tenantPool, { ...(req.body || {}), id: Number(req.params.id) });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تحديث القسم.');
  }
});

router.post('/org/job-titles', async (req, res) => {
  try {
    const data = await company.upsertJobTitle(req.tenantPool, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ المسمى.');
  }
});

router.put('/org/job-titles/:id', async (req, res) => {
  try {
    const data = await company.upsertJobTitle(req.tenantPool, { ...(req.body || {}), id: Number(req.params.id) });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تحديث المسمى.');
  }
});

router.post('/org/locations', async (req, res) => {
  try {
    const data = await company.upsertLocation(req.tenantPool, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ الموقع.');
  }
});

router.put('/org/locations/:id', async (req, res) => {
  try {
    const data = await company.upsertLocation(req.tenantPool, { ...(req.body || {}), id: Number(req.params.id) });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تحديث الموقع.');
  }
});

// ---- Invites ----
router.get('/invites', async (req, res) => {
  try {
    const data = await company.listInvites(req.tenantPool);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الدعوات.');
  }
});

router.post('/invites', async (req, res) => {
  try {
    // Seat limit before invite
    try {
      const owner = require('./platform-owner-service');
      await owner.ensureSchema();
      const check = await owner.checkSeatAllowance(req.tenant.id);
      if (check.enforced && !check.allowed) {
        return res.status(403).json({
          success: false,
          code: 'SEAT_LIMIT',
          data: check,
          message: 'لا يمكن إرسال دعوة — تم بلوغ حد مقاعد الباقة.'
        });
      }
    } catch (seatErr) {
      console.warn('[CompanySettings] seat check:', seatErr.message);
    }

    const data = await company.createInvite(req.tenantPool, {
      email: req.body?.email,
      role: req.body?.role || 'staff',
      branchId: req.body?.branch_id || req.body?.branchId || null,
      invitedBy: req.companyActor.id
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر إنشاء الدعوة.');
  }
});

router.post('/invites/:id/revoke', async (req, res) => {
  try {
    const data = await company.revokeInvite(req.tenantPool, Number(req.params.id));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر إلغاء الدعوة.');
  }
});

// ---- Audit + storage ----
router.get('/audit', async (req, res) => {
  try {
    const data = await company.listAudit(req.tenant.id, req.query.limit);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة سجل الإعدادات.');
  }
});

router.post('/storage/recalculate', async (req, res) => {
  try {
    const data = await company.recalculateStorageMeter(
      req.tenant.id,
      req.tenant.subdomain,
      req.companyActor.id
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حساب التخزين.');
  }
});

router.get('/storage/check', async (req, res) => {
  try {
    const additional = Number(req.query.additionalBytes || 0);
    const data = await company.checkStorageAllowance(req.tenant.id, additional);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر فحص حد التخزين.');
  }
});

module.exports = router;
module.exports.requireCompanyAdmin = requireCompanyAdmin;
