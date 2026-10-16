'use strict';

/**
 * Phase 5 — Enterprise Shared Services API
 * Mount: /api/shared-services
 */

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const shared = require('./enterprise-shared-service');
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
      message: 'الخدمات المشتركة تتطلب نطاقاً فرعياً نشطاً للمستأجر.'
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
    return res.status(401).json({ success: false, message: 'يتطلب تسجيل دخول مسؤول.' });
  }

  try {
    const sharedDb = isSharedTenant(req.tenant);
    const sessionQuery = sharedDb
      ? `SELECT s.user_id, u.role, u.is_active, u.email
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.session_token = $1 AND s.tenant_id = $2
           AND s.expires_at > NOW() AND COALESCE(u.is_active, true) = true LIMIT 1`
      : `SELECT s.user_id, u.role, u.is_active, u.email
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.session_token = $1
           AND s.expires_at > NOW() AND COALESCE(u.is_active, true) = true LIMIT 1`;
    const params = sharedDb ? [token, req.tenant.id] : [token];
    let result = { rows: [] };
    try {
      result = await req.tenantPool.query(sessionQuery, params);
    } catch {
      result = { rows: [] };
    }
    if (!result.rows.length) {
      try {
        result = await require('./db').query(
          `SELECT us.user_id, u.role, u.is_active, u.email, u.tenant_type
           FROM user_sessions us JOIN users u ON u.id = us.user_id
           WHERE us.session_token = $1 AND us.expires_at > NOW()
             AND COALESCE(u.is_active, true) = true LIMIT 1`,
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
    const allowed =
      ['admin', 'tenant_admin', 'company_admin', 'super_admin', 'hr_admin', 'finance_admin'].includes(role) ||
      role.includes('admin') ||
      user.tenant_type === 'HQ';
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'يتطلب صلاحية مسؤول الشركة/الوحدة.' });
    }
    req.sharedActor = {
      id: user.user_id || user.id,
      role: user.role,
      email: user.email,
      tenantId: req.tenant.id,
      name: user.email
    };
    return next();
  } catch (err) {
    console.error('[SharedServices] auth:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر التحقق من الصلاحية.' });
  }
}

function handleError(res, err, fallback) {
  const status = err.status || 500;
  if (status >= 500) console.error('[SharedServices]', err.message);
  return res.status(status).json({ success: false, message: err.message || fallback });
}

router.use(requireTenantContext, requireCompanyAdmin);

router.get('/bundle', async (req, res) => {
  try {
    const data = await shared.getBundle(req.tenantPool, req.tenant.id);
    return res.json({
      success: true,
      data: {
        tenant: { id: req.tenant.id, subdomain: req.tenant.subdomain },
        ...data
      }
    });
  } catch (err) {
    return handleError(res, err, 'تعذر تحميل الخدمات المشتركة.');
  }
});

// ---- Workflows ----
router.get('/workflows/definitions', async (req, res) => {
  try {
    const data = await shared.listDefinitions(req.tenantPool, req.tenant.id, {
      moduleKey: req.query.module
    });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة تعريفات سير العمل.');
  }
});

router.post('/workflows/definitions', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'جسم الطلب مطلوب — لا حفظ شكلي.' });
    }
    const data = await shared.upsertDefinition(
      req.tenantPool,
      req.tenant.id,
      req.body,
      req.sharedActor.id
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ تعريف سير العمل.');
  }
});

router.put('/workflows/definitions/:id', async (req, res) => {
  try {
    const data = await shared.upsertDefinition(
      req.tenantPool,
      req.tenant.id,
      { ...(req.body || {}), id: Number(req.params.id) },
      req.sharedActor.id
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تحديث التعريف.');
  }
});

router.post('/workflows/instances', async (req, res) => {
  try {
    const data = await shared.startInstance(req.tenantPool, req.tenant.id, {
      definitionCode: req.body?.definition_code || req.body?.definitionCode || 'hr-default',
      entityType: req.body?.entity_type || req.body?.entityType,
      entityId: req.body?.entity_id || req.body?.entityId,
      title: req.body?.title,
      payload: req.body?.payload,
      actorId: req.sharedActor.id
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر بدء مثيل سير العمل.');
  }
});

router.get('/workflows/instances/:id', async (req, res) => {
  try {
    const instance = await shared.getInstance(req.tenantPool, req.tenant.id, Number(req.params.id));
    if (!instance) return res.status(404).json({ success: false, message: 'غير موجود.' });
    const events = await shared.listInstanceEvents(req.tenantPool, instance.id);
    return res.json({ success: true, data: { instance, events } });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة المثيل.');
  }
});

router.post('/workflows/instances/:id/decide', async (req, res) => {
  try {
    if (!req.body?.action) {
      return res.status(400).json({ success: false, message: 'action مطلوب (approve|reject|return|escalate).' });
    }
    const data = await shared.decideInstance(req.tenantPool, req.tenant.id, Number(req.params.id), {
      action: req.body.action,
      actorId: req.sharedActor.id,
      actorName: req.body.actor_name || req.sharedActor.email,
      actorRole: req.body.actor_role || req.sharedActor.role,
      notes: req.body.notes
    });
    const events = await shared.listInstanceEvents(req.tenantPool, data.id);
    return res.json({ success: true, data: { instance: data, events } });
  } catch (err) {
    return handleError(res, err, 'تعذر تطبيق القرار.');
  }
});

router.post('/workflows/escalate-overdue', async (req, res) => {
  try {
    const data = await shared.escalateOverdue(req.tenantPool, req.tenant.id);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر التصعيد.');
  }
});

// Finance approvals (reuse tables)
router.post('/approvals', async (req, res) => {
  try {
    const data = await shared.createFinanceApproval(req.tenantPool, req.body || {}, {
      ...req.sharedActor,
      tenantId: req.tenant.id
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر إنشاء موافقة مالية.');
  }
});

router.post('/approvals/:id/decide', async (req, res) => {
  try {
    const data = await shared.decideFinanceApproval(req.tenantPool, Number(req.params.id), {
      decision: req.body?.decision || req.body?.action,
      actorId: req.sharedActor.id,
      actorName: req.sharedActor.email,
      comments: req.body?.comments || req.body?.notes
    });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قرار الموافقة المالية.');
  }
});

router.get('/approvals', async (req, res) => {
  try {
    await shared.ensureSchema(req.tenantPool);
    const result = await req.tenantPool.query(
      `SELECT * FROM approval_workflows ORDER BY id DESC LIMIT 100`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الموافقات.');
  }
});

// ---- Backup ----
router.get('/backup/jobs', async (req, res) => {
  try {
    await shared.ensureSchema(req.tenantPool);
    const result = await req.tenantPool.query(
      `SELECT * FROM backup_jobs WHERE tenant_id = $1 ORDER BY id DESC`,
      [req.tenant.id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة مهام النسخ.');
  }
});

router.post('/backup/jobs', async (req, res) => {
  try {
    if (!req.body?.name) {
      return res.status(400).json({ success: false, message: 'name مطلوب.' });
    }
    const data = await shared.upsertBackupJob(req.tenantPool, req.tenant.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ مهمة النسخ.');
  }
});

router.post('/backup/run', async (req, res) => {
  try {
    const jobId = req.body?.job_id || null;
    const data = await shared.runLogicalBackup(
      req.tenantPool,
      req.tenant.id,
      jobId,
      req.sharedActor.id
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تنفيذ النسخ.');
  }
});

router.get('/backup/runs', async (req, res) => {
  try {
    await shared.ensureSchema(req.tenantPool);
    const result = await req.tenantPool.query(
      `SELECT id, job_id, action, status, started_at, finished_at, bytes, message, artifact_path
       FROM backup_runs WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [req.tenant.id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة سجل النسخ.');
  }
});

router.post('/backup/restore-test', async (req, res) => {
  try {
    const data = await shared.restoreToTestDatabase(req.tenantPool, req.tenant.id, {
      artifactPath: req.body?.artifact_path,
      confirmToken: req.body?.confirmToken || req.body?.confirm_token,
      actorId: req.sharedActor.id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر استعادة الاختبار.');
  }
});

// ---- Templates studio ----
router.post('/templates', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'جسم القالب مطلوب.' });
    }
    const data = await shared.saveTemplateWithVersion(
      req.tenantPool,
      req.tenant.id,
      req.body,
      req.sharedActor.id
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر حفظ القالب.');
  }
});

router.post('/templates/:id/preview', async (req, res) => {
  try {
    const data = await shared.previewTemplate(
      req.tenantPool,
      Number(req.params.id),
      req.body?.variables || req.body?.vars || {}
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر المعاينة.');
  }
});

router.get('/templates/:id/versions', async (req, res) => {
  try {
    const data = await shared.listTemplateVersions(req.tenantPool, Number(req.params.id));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الإصدارات.');
  }
});

router.post('/templates/:id/test-send', async (req, res) => {
  try {
    const preview = await shared.previewTemplate(
      req.tenantPool,
      Number(req.params.id),
      req.body?.variables || {}
    );
    const queued = await shared.enqueueNotification(req.tenantPool, req.tenant.id, {
      channel: req.body?.channel || 'in_app',
      recipient: req.body?.recipient || String(req.sharedActor.id),
      subject: preview.subject || 'اختبار قالب',
      body: preview.body,
      templateCode: `tpl-${req.params.id}`,
      meta: { test: true }
    });
    return res.json({ success: true, data: { preview, queued } });
  } catch (err) {
    return handleError(res, err, 'تعذر اختبار الإرسال.');
  }
});

// ---- Notifications ----
router.post('/notifications/enqueue', async (req, res) => {
  try {
    const data = await shared.enqueueNotification(req.tenantPool, req.tenant.id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر وضع الإشعار في الطابور.');
  }
});

router.post('/notifications/process', async (req, res) => {
  try {
    const data = await shared.processOutbox(req.tenantPool, { limit: req.body?.limit });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر معالجة الطابور.');
  }
});

router.get('/notifications/outbox', async (req, res) => {
  try {
    await shared.ensureSchema(req.tenantPool);
    const result = await req.tenantPool.query(
      `SELECT id, channel, recipient, subject, status, attempts, last_error, created_at, sent_at
       FROM notification_outbox WHERE tenant_id = $1 ORDER BY id DESC LIMIT 100`,
      [req.tenant.id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة الطابور.');
  }
});

// ---- Integrations ----
router.get('/integrations', async (req, res) => {
  try {
    const data = await shared.listIntegrations(req.tenantPool, req.tenant.id);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر قراءة التكاملات.');
  }
});

router.post('/integrations/:key/enable', async (req, res) => {
  try {
    const data = await shared.setIntegrationEnabled(
      req.tenantPool,
      req.tenant.id,
      req.params.key,
      req.body?.enabled !== false,
      req.sharedActor.id
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تفعيل التكامل.');
  }
});

router.post('/integrations/:key/disable', async (req, res) => {
  try {
    const data = await shared.setIntegrationEnabled(
      req.tenantPool,
      req.tenant.id,
      req.params.key,
      false,
      req.sharedActor.id
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'تعذر تعطيل التكامل.');
  }
});

router.post('/integrations/:key/test', async (req, res) => {
  try {
    const data = await shared.testIntegration(req.tenantPool, req.tenant.id, req.params.key, req);
    return res.status(data.ok ? 200 : 422).json({ success: data.ok, data });
  } catch (err) {
    return handleError(res, err, 'تعذر اختبار التكامل.');
  }
});

module.exports = router;
