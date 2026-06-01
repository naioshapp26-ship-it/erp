'use strict';

/**
 * tenant-management-api.js
 * المرحلة 1 — واجهة برمجية لإدارة المستأجرين (Super Admin)
 *
 * جميع المسارات مقيدة بدور super_admin.
 *
 * المسارات:
 *  GET    /api/tenants                     — قائمة المستأجرين (بحث/تصفية)
 *  POST   /api/tenants                     — إنشاء مستأجر يدوياً (بتخطي الدفع)
 *  GET    /api/tenants/:id                 — تفاصيل المستأجر
 *  PATCH  /api/tenants/:id                 — تحديث الحالة/الخطة/اسم الشركة
 *  DELETE /api/tenants/:id                 — حذف المستأجر
 *  GET    /api/tenants/:id/provisioning-logs — سجلات التجهيز
 *  GET    /api/tenants/:id/payments        — سجل الدفعات
 *  POST   /api/tenants/:id/run-migrations  — إعادة تشغيل الهجرات
 */

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { provisionTenant, rerunMigrations } = require('./tenant-provisioner');
const { releaseTenantPool } = require('./tenant-connection-manager');

const router = express.Router();

const VALID_STATUSES = new Set(['active', 'suspended', 'deleted', 'pending_payment']);
const VALID_PLANS = new Set(['basic', 'pro', 'enterprise']);

const managementLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(managementLimiter);

// ================================================================
// وسيط التحقق من صلاحية super_admin
// ================================================================
async function requireSuperAdmin(req, res, next) {
  // يتوقع token في Authorization: Bearer <token> أو cookie authToken
  let token = '';
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = (req.headers.cookie || '').split(';').reduce((acc, part) => {
      const [k, ...v] = part.trim().split('=');
      if (k) acc[k.trim()] = decodeURIComponent(v.join('=') || '');
      return acc;
    }, {});
    token = cookies.authToken || '';
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'غير مصادَق.' });
  }

  try {
    const result = await db.query(
      `SELECT u.id, u.role, u.tenant_type
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
    if (user.role !== 'super_admin' && user.tenant_type !== 'HQ') {
      return res.status(403).json({ success: false, message: 'مقيد بالمشرف الأعلى فقط.' });
    }
    req.adminUser = user;
    return next();
  } catch (err) {
    console.error('[TenantMgmt] requireSuperAdmin error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
}

router.use(requireSuperAdmin);

// ================================================================
// GET /api/tenants  — قائمة المستأجرين
// ================================================================
router.get('/', async (req, res) => {
  const {
    search = '',
    status = '',
    plan = '',
    page = 1,
    limit = 20
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['status != \'deleted\''];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(subdomain ILIKE $${params.length} OR company_name ILIKE $${params.length})`);
  }
  if (status && VALID_STATUSES.has(status)) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (plan && VALID_PLANS.has(plan)) {
    params.push(plan);
    conditions.push(`subscription_plan = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countRes = await db.query(
      `SELECT COUNT(*) FROM tenants ${where}`,
      params
    );
    params.push(limitNum, offset);
    const dataRes = await db.query(
      `SELECT id, subdomain, company_name, subscription_plan, status,
              db_name, settings, created_at, updated_at
       FROM tenants ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json({
      success: true,
      total: parseInt(countRes.rows[0].count, 10),
      page: pageNum,
      limit: limitNum,
      tenants: dataRes.rows
    });
  } catch (err) {
    console.error('[TenantMgmt] list error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// POST /api/tenants  — إنشاء مستأجر يدوياً
// ================================================================
router.post('/', async (req, res) => {
  const {
    subdomain, companyName, plan = 'basic',
    adminName, adminEmail, adminPhone, adminPassword
  } = req.body || {};

  if (!subdomain || !companyName || !adminName || !adminPassword) {
    return res.status(400).json({
      success: false,
      message: 'الحقول المطلوبة: subdomain, companyName, adminName, adminPassword'
    });
  }
  if (!adminEmail && !adminPhone) {
    return res.status(400).json({
      success: false,
      message: 'يجب توفير البريد الإلكتروني أو رقم الجوال للأدمن.'
    });
  }
  if (!VALID_PLANS.has(plan)) {
    return res.status(400).json({ success: false, message: 'خطة الاشتراك غير صالحة.' });
  }

  const normalizedSubdomain = String(subdomain).toLowerCase().trim();

  // تحقق من تفرد النطاق الفرعي
  try {
    const existing = await db.query(
      `SELECT 1 FROM tenants WHERE subdomain = $1 AND status != 'deleted' LIMIT 1`,
      [normalizedSubdomain]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'النطاق الفرعي مستخدم بالفعل.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }

  try {
    const result = await provisionTenant({
      subdomain: normalizedSubdomain, companyName, plan,
      adminName, adminEmail, adminPhone, adminPassword
    });
    return res.status(201).json({
      success: true,
      tenantId: result.tenantId,
      subdomain: result.subdomain,
      loginUrl: result.loginUrl,
      message: 'تم إنشاء المستأجر وتجهيزه بنجاح.'
    });
  } catch (err) {
    console.error('[TenantMgmt] create error:', err.message);
    return res.status(500).json({ success: false, message: `فشل التجهيز: ${err.message}` });
  }
});

// ================================================================
// POST /api/tenants/run-all-migrations  — تشغيل الهجرات على جميع المستأجرين النشطين
// ملاحظة: يجب أن يسبق مسارات /:id لمنع Express من معاملة "run-all-migrations" كمعرّف
// ================================================================
router.post('/run-all-migrations', async (req, res) => {
  try {
    const tenantsRes = await db.query(
      `SELECT id FROM tenants WHERE status = 'active' ORDER BY id`
    );
    const results = [];
    for (const row of tenantsRes.rows) {
      try {
        const r = await rerunMigrations(row.id);
        results.push({ tenantId: row.id, success: true, applied: r.applied });
      } catch (err) {
        results.push({ tenantId: row.id, success: false, error: err.message });
      }
    }
    const successCount = results.filter(r => r.success).length;
    return res.json({
      success: true,
      results,
      message: `اكتمل التشغيل لـ ${tenantsRes.rows.length} مستأجر (${successCount} ناجح).`
    });
  } catch (err) {
    console.error('[TenantMgmt] run-all-migrations error:', err.message);
    return res.status(500).json({ success: false, message: `فشل: ${err.message}` });
  }
});

// ================================================================
// GET /api/tenants/:id  — تفاصيل المستأجر
// ================================================================
router.get('/:id', async (req, res) => {
  const tenantId = parseInt(req.params.id, 10);
  if (!tenantId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  try {
    const res2 = await db.query(
      `SELECT id, subdomain, company_name, subscription_plan, status,
              db_name, settings, created_at, updated_at
       FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );
    if (!res2.rows.length) {
      return res.status(404).json({ success: false, message: 'المستأجر غير موجود.' });
    }
    return res.json({ success: true, tenant: res2.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// PATCH /api/tenants/:id  — تحديث الحالة/الخطة/اسم الشركة
// ================================================================
router.patch('/:id', async (req, res) => {
  const tenantId = parseInt(req.params.id, 10);
  if (!tenantId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  const { status, plan, companyName } = req.body || {};
  const updates = [];
  const params = [];

  if (status !== undefined) {
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'الحالة غير صالحة.' });
    }
    params.push(status);
    updates.push(`status = $${params.length}`);
  }
  if (plan !== undefined) {
    if (!VALID_PLANS.has(plan)) {
      return res.status(400).json({ success: false, message: 'الخطة غير صالحة.' });
    }
    params.push(plan);
    updates.push(`subscription_plan = $${params.length}`);
  }
  if (companyName !== undefined) {
    if (!companyName.trim()) {
      return res.status(400).json({ success: false, message: 'اسم الشركة لا يمكن أن يكون فارغاً.' });
    }
    params.push(companyName.trim());
    updates.push(`company_name = $${params.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'لا توجد حقول للتحديث.' });
  }

  params.push(tenantId);
  try {
    const result = await db.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length} RETURNING id, subdomain, company_name, subscription_plan, status`,
      params
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'المستأجر غير موجود.' });
    }
    // تحرير حمام الاتصال من الذاكرة إذا تغيرت الحالة
    if (status) await releaseTenantPool(result.rows[0].subdomain).catch(() => {});
    return res.json({ success: true, tenant: result.rows[0] });
  } catch (err) {
    console.error('[TenantMgmt] update error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// DELETE /api/tenants/:id  — حذف المستأجر (تغيير الحالة إلى deleted)
// ================================================================
router.delete('/:id', async (req, res) => {
  const tenantId = parseInt(req.params.id, 10);
  if (!tenantId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  const { dropDatabase = false } = req.body || {};

  try {
    const tenantRes = await db.query(
      `UPDATE tenants SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING id, subdomain, db_name`,
      [tenantId]
    );
    if (!tenantRes.rows.length) {
      return res.status(404).json({ success: false, message: 'المستأجر غير موجود.' });
    }
    const { subdomain, db_name } = tenantRes.rows[0];

    // تحرير حمام الاتصال من الذاكرة
    await releaseTenantPool(subdomain).catch(() => {});

    // حذف قاعدة البيانات إذا طُلب ذلك صراحةً
    if (dropDatabase && db_name) {
      // التحقق الأمني من اسم قاعدة البيانات قبل تنفيذ DROP DATABASE
      if (!/^tenant_[a-z0-9_]{1,55}$/.test(db_name)) {
        console.error(`[TenantMgmt] Refused to drop database with unsafe name: ${db_name}`);
      } else {
        try {
          const { Pool } = require('pg');
          const provPool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.PROVISION_DB_URL,
            ssl: false,
            max: 1
          });
          const client = await provPool.connect();
          try {
            // إنهاء الاتصالات النشطة
            await client.query(
              `SELECT pg_terminate_backend(pid)
               FROM pg_stat_activity
               WHERE datname = $1 AND pid <> pg_backend_pid()`,
              [db_name]
            );
            // db_name تم التحقق منه بالنمط ^tenant_[a-z0-9_]+$ أعلاه
            await client.query(`DROP DATABASE IF EXISTS "${db_name}"`);
          } finally {
            client.release();
            await provPool.end().catch(() => {});
          }
        } catch (dbErr) {
          console.error('[TenantMgmt] Failed to drop database:', db_name, '-', dbErr.message);
        }
      }
    }

    return res.json({ success: true, message: 'تم حذف المستأجر.' });
  } catch (err) {
    console.error('[TenantMgmt] delete error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// GET /api/tenants/:id/provisioning-logs
// ================================================================
router.get('/:id/provisioning-logs', async (req, res) => {
  const tenantId = parseInt(req.params.id, 10);
  if (!tenantId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  try {
    const result = await db.query(
      `SELECT id, step, status, message, details, created_at
       FROM provisioning_logs
       WHERE tenant_id = $1
       ORDER BY created_at ASC`,
      [tenantId]
    );
    return res.json({ success: true, logs: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// GET /api/tenants/:id/payments  — سجل الدفعات
// ================================================================
router.get('/:id/payments', async (req, res) => {
  const tenantId = parseInt(req.params.id, 10);
  if (!tenantId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  try {
    const result = await db.query(
      `SELECT id, provider, provider_transaction_id, amount, currency,
              status, type, metadata, created_at
       FROM platform_payment_transactions
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.json({ success: true, payments: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// POST /api/tenants/:id/run-migrations  — إعادة تشغيل الهجرات
// ================================================================
router.post('/:id/run-migrations', async (req, res) => {
  const tenantId = parseInt(req.params.id, 10);
  if (!tenantId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  try {
    const result = await rerunMigrations(tenantId);
    return res.json({
      success: true,
      applied: result.applied,
      message: `تم تطبيق ${result.applied.length} هجرة جديدة.`
    });
  } catch (err) {
    console.error('[TenantMgmt] run-migrations error:', err.message);
    return res.status(500).json({ success: false, message: `فشل: ${err.message}` });
  }
});

// ================================================================
// POST /api/tenants/:id/refund  — استرداد دفعة SaaS
// يُنفِّذ استرداد المبلغ لمعاملة دفع منصة مرتبطة بالمستأجر.
// ================================================================
router.post('/:id/refund', async (req, res) => {
  const tenantId = parseInt(req.params.id, 10);
  if (!tenantId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  const { transactionId, reason = '' } = req.body || {};
  if (!transactionId) {
    return res.status(400).json({ success: false, message: 'transactionId مطلوب.' });
  }

  try {
    // التحقق من وجود المعاملة وانتمائها للمستأجر
    const txnRes = await db.query(
      `SELECT id, provider, provider_transaction_id, amount, currency, status
       FROM platform_payment_transactions
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1`,
      [transactionId, tenantId]
    );
    if (!txnRes.rows.length) {
      return res.status(404).json({ success: false, message: 'المعاملة غير موجودة أو لا تنتمي لهذا المستأجر.' });
    }
    const txn = txnRes.rows[0];

    if (txn.status === 'refunded') {
      return res.status(409).json({ success: false, message: 'المعاملة مُستردَّة بالفعل.' });
    }
    if (txn.status !== 'succeeded') {
      return res.status(400).json({ success: false, message: 'لا يمكن استرداد معاملة غير ناجحة.' });
    }

    // استرداد عبر مزود الدفع المناسب
    let providerRefundId = null;
    const provider = txn.provider;

    if (provider === 'stripe' && txn.provider_transaction_id) {
      try {
        const settingsRes = await db.query(
          `SELECT stripe_secret_key FROM platform_payment_settings WHERE provider = 'stripe' LIMIT 1`
        );
        if (settingsRes.rows.length && settingsRes.rows[0].stripe_secret_key) {
          const { decryptDbUrl } = require('./tenant-connection-manager');
          const secretKey = decryptDbUrl(settingsRes.rows[0].stripe_secret_key);
          const https = require('https');
          const body = `payment_intent=${encodeURIComponent(txn.provider_transaction_id)}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`;
          const refundResult = await new Promise((resolve) => {
            const options = {
              hostname: 'api.stripe.com',
              path: '/v1/refunds',
              method: 'POST',
              headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
              }
            };
            const req2 = https.request(options, (resp) => {
              let data = '';
              resp.on('data', c => { data += c; });
              resp.on('end', () => {
                try { resolve({ ok: resp.statusCode === 200, data: JSON.parse(data) }); }
                catch { resolve({ ok: resp.statusCode === 200, data: {} }); }
              });
            });
            req2.on('error', e => resolve({ ok: false, error: e.message }));
            req2.write(body);
            req2.end();
          });
          if (!refundResult.ok) {
            return res.status(502).json({
              success: false,
              message: `فشل الاسترداد عبر Stripe: ${refundResult.data?.error?.message || 'خطأ غير معروف'}`
            });
          }
          providerRefundId = refundResult.data?.id || null;
        }
      } catch (stripeErr) {
        console.error('[TenantMgmt] Stripe refund error:', stripeErr.message);
      }
    }

    // تحديث حالة المعاملة إلى refunded
    await db.query(
      `UPDATE platform_payment_transactions
       SET status = 'refunded', updated_at = CURRENT_TIMESTAMP,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'),
             '{refund}',
             $1::jsonb
           )
       WHERE id = $2`,
      [JSON.stringify({ refunded_at: new Date().toISOString(), reason, provider_refund_id: providerRefundId }), transactionId]
    );

    return res.json({
      success: true,
      message: 'تم تسجيل الاسترداد بنجاح.',
      providerRefundId
    });
  } catch (err) {
    console.error('[TenantMgmt] refund error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

module.exports = router;
