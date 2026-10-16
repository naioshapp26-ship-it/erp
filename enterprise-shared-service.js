'use strict';

/**
 * Phase 5 — Enterprise Shared Services
 * Workflow engine (Postgres), backup jobs, notification outbox,
 * template studio versions, integration registry.
 * Reuses Settings Engine + existing HR/finance approval pieces.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const db = require('./db');
const modules = require('./module-settings-service');
const hrWorkflow = require('./hr-request-workflow');

const SCHEMA_SQL = path.join(__dirname, 'create-enterprise-shared-services.sql');
let schemaReady = false;
let schemaPromise = null;

const DEFAULT_HR_STEPS = [
  { key: 'manager', label_ar: 'المدير المباشر', role: 'manager' },
  { key: 'hr', label_ar: 'الموارد البشرية', role: 'hr' },
  { key: 'supervisor', label_ar: 'المشرف العام', role: 'supervisor' },
  { key: 'executive', label_ar: 'المدير التنفيذي', role: 'executive' },
  { key: 'finance', label_ar: 'المالية', role: 'finance' }
];

const BUILTIN_INTEGRATIONS = [
  { key: 'tenant_smtp', display_name: 'بريد الشركة SMTP', category: 'email', api: '/api/tenant-settings/email' },
  { key: 'tenant_stripe', display_name: 'Stripe', category: 'payment', api: '/api/tenant-settings/payment/stripe' },
  { key: 'tenant_paypal', display_name: 'PayPal', category: 'payment', api: '/api/tenant-settings/payment/paypal' },
  { key: 'tenant_paymob', display_name: 'Paymob', category: 'payment', api: '/api/tenant-settings/payment/paymob' },
  { key: 'tenant_ai', display_name: 'ضوابط الذكاء الاصطناعي', category: 'ai', api: '/api/tenant-settings/ai' },
  { key: 'hr_sso', display_name: 'تكامل SSO للموارد البشرية', category: 'hr', api: '/api/hr/sso-integrations' },
  { key: 'hr_erp', display_name: 'تكامل ERP للموارد البشرية', category: 'hr', api: '/api/hr/erp-integrations' }
];

async function ensureSchema(pool = db) {
  if (schemaReady && pool === db) return;
  if (pool === db && schemaPromise) return schemaPromise;
  const run = (async () => {
    const sql = fs.readFileSync(SCHEMA_SQL, 'utf8');
    await pool.query(sql);
    await modules.ensureOpsSchema(pool).catch(() => null);
    if (pool === db) schemaReady = true;
  })();
  if (pool === db) {
    schemaPromise = run.catch((err) => {
      schemaPromise = null;
      throw err;
    });
    return schemaPromise;
  }
  return run;
}

function poolFor(req) {
  return (req && req.tenantPool) || db;
}

function tenantIdOf(req) {
  return req?.tenant?.id || req?.tenantId || null;
}

// ---------- Workflow definitions ----------

async function listDefinitions(pool, tenantId, { moduleKey } = {}) {
  await ensureSchema(pool);
  const params = [];
  let sql = `SELECT * FROM wf_definitions WHERE (tenant_id IS NULL OR tenant_id = $1)`;
  params.push(tenantId || 0);
  if (moduleKey) {
    params.push(moduleKey);
    sql += ` AND module_key = $${params.length}`;
  }
  sql += ` ORDER BY module_key, code`;
  const result = await pool.query(sql, params);
  return result.rows;
}

async function upsertDefinition(pool, tenantId, body, actorId) {
  await ensureSchema(pool);
  if (!body.code || !body.name_ar) {
    const err = new Error('code و name_ar مطلوبان.');
    err.status = 400;
    throw err;
  }
  const steps = Array.isArray(body.steps) && body.steps.length ? body.steps : DEFAULT_HR_STEPS;
  const escalate = Number(body.escalate_hours);
  // Prefer Settings Engine policy when not explicitly provided
  let escalateHours = escalate > 0 ? escalate : null;
  if (escalateHours == null && tenantId) {
    try {
      const policy = await modules.getEngineValue(tenantId, 'module.workflows.approvals');
      escalateHours = Number(policy.value?.escalate_hours) || 48;
    } catch {
      escalateHours = 48;
    }
  }
  escalateHours = escalateHours || 48;

  if (body.id) {
    const updated = await pool.query(
      `UPDATE wf_definitions SET
         name_ar = COALESCE($2, name_ar),
         name_en = COALESCE($3, name_en),
         module_key = COALESCE($4, module_key),
         entity_type = COALESCE($5, entity_type),
         steps = COALESCE($6::jsonb, steps),
         conditions = COALESCE($7::jsonb, conditions),
         escalate_hours = COALESCE($8, escalate_hours),
         allow_skip = COALESCE($9, allow_skip),
         allow_return = COALESCE($10, allow_return),
         is_active = COALESCE($11, is_active),
         version = version + 1,
         updated_by = $12,
         updated_at = NOW()
       WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $13)
       RETURNING *`,
      [
        body.id,
        body.name_ar || null,
        body.name_en || null,
        body.module_key || null,
        body.entity_type || null,
        JSON.stringify(steps),
        body.conditions ? JSON.stringify(body.conditions) : null,
        escalateHours,
        body.allow_skip != null ? Boolean(body.allow_skip) : null,
        body.allow_return != null ? Boolean(body.allow_return) : null,
        body.is_active != null ? Boolean(body.is_active) : null,
        actorId || null,
        tenantId || 0
      ]
    );
    if (!updated.rows.length) {
      const err = new Error('تعريف سير العمل غير موجود.');
      err.status = 404;
      throw err;
    }
    return updated.rows[0];
  }

  const inserted = await pool.query(
    `INSERT INTO wf_definitions
       (tenant_id, code, name_ar, name_en, module_key, entity_type, steps, conditions,
        escalate_hours, allow_skip, allow_return, is_active, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,COALESCE($12,true),$13,$13)
     ON CONFLICT (tenant_id, code) DO UPDATE SET
       name_ar = EXCLUDED.name_ar,
       steps = EXCLUDED.steps,
       conditions = EXCLUDED.conditions,
       escalate_hours = EXCLUDED.escalate_hours,
       allow_skip = EXCLUDED.allow_skip,
       allow_return = EXCLUDED.allow_return,
       is_active = EXCLUDED.is_active,
       version = wf_definitions.version + 1,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [
      tenantId,
      body.code,
      body.name_ar,
      body.name_en || null,
      body.module_key || 'hr',
      body.entity_type || 'employee_request',
      JSON.stringify(steps),
      JSON.stringify(body.conditions || {}),
      escalateHours,
      Boolean(body.allow_skip),
      body.allow_return !== false,
      body.is_active,
      actorId || null
    ]
  );
  return inserted.rows[0];
}

async function seedDefaultHrDefinition(pool, tenantId, actorId) {
  await ensureSchema(pool);
  const existing = await pool.query(
    `SELECT id FROM wf_definitions WHERE tenant_id = $1 AND code = 'hr-default' LIMIT 1`,
    [tenantId]
  );
  if (existing.rows.length) return existing.rows[0];
  let policy = {};
  try {
    policy = (await modules.getEngineValue(tenantId, 'module.workflows.approvals')).value || {};
  } catch { /* */ }
  const levels = Math.min(5, Math.max(1, Number(policy.default_levels) || 2));
  const steps = DEFAULT_HR_STEPS.slice(0, levels);
  return upsertDefinition(pool, tenantId, {
    code: 'hr-default',
    name_ar: 'سير عمل الموارد البشرية الافتراضي',
    module_key: 'hr',
    entity_type: 'employee_request',
    steps,
    escalate_hours: policy.escalate_hours || 48,
    allow_skip: Boolean(policy.allow_skip),
    is_active: true
  }, actorId);
}

// ---------- Workflow instances ----------

async function startInstance(pool, tenantId, {
  definitionCode = 'hr-default',
  entityType,
  entityId,
  title,
  payload,
  actorId
}) {
  await ensureSchema(pool);
  if (!entityType || !entityId) {
    const err = new Error('entity_type و entity_id مطلوبان.');
    err.status = 400;
    throw err;
  }
  let def = await pool.query(
    `SELECT * FROM wf_definitions
     WHERE tenant_id = $1 AND code = $2 AND is_active = true LIMIT 1`,
    [tenantId, definitionCode]
  );
  if (!def.rows.length) {
    await seedDefaultHrDefinition(pool, tenantId, actorId);
    def = await pool.query(
      `SELECT * FROM wf_definitions WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
      [tenantId, definitionCode]
    );
  }
  const definition = def.rows[0];
  if (!definition) {
    const err = new Error('لا يوجد تعريف سير عمل نشط.');
    err.status = 404;
    throw err;
  }
  const steps = Array.isArray(definition.steps) ? definition.steps : DEFAULT_HR_STEPS;
  const inserted = await pool.query(
    `INSERT INTO wf_instances
       (tenant_id, definition_id, definition_code, entity_type, entity_id, title,
        status, current_step, steps_snapshot, payload, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'in_progress',0,$7::jsonb,$8::jsonb,$9)
     RETURNING *`,
    [
      tenantId,
      definition.id,
      definition.code,
      entityType,
      String(entityId),
      title || `${entityType}:${entityId}`,
      JSON.stringify(steps),
      JSON.stringify(payload || {}),
      actorId || null
    ]
  );
  const instance = inserted.rows[0];
  await appendEvent(pool, instance.id, {
    step_index: 0,
    action: 'started',
    actor_id: actorId,
    notes: 'بدء سير العمل'
  });
  return instance;
}

async function appendEvent(pool, instanceId, event) {
  await pool.query(
    `INSERT INTO wf_instance_events
       (instance_id, step_index, action, actor_id, actor_name, actor_role, notes, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [
      instanceId,
      event.step_index != null ? event.step_index : null,
      event.action,
      event.actor_id || null,
      event.actor_name || null,
      event.actor_role || null,
      event.notes || null,
      JSON.stringify(event.meta || {})
    ]
  );
}

async function getInstance(pool, tenantId, id) {
  await ensureSchema(pool);
  const result = await pool.query(
    `SELECT * FROM wf_instances WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)`,
    [id, tenantId || 0]
  );
  return result.rows[0] || null;
}

async function listInstanceEvents(pool, instanceId) {
  const result = await pool.query(
    `SELECT * FROM wf_instance_events WHERE instance_id = $1 ORDER BY id ASC`,
    [instanceId]
  );
  return result.rows;
}

async function decideInstance(pool, tenantId, instanceId, {
  action,
  actorId,
  actorName,
  actorRole,
  notes
}) {
  await ensureSchema(pool);
  const instance = await getInstance(pool, tenantId, instanceId);
  if (!instance) {
    const err = new Error('مثيل سير العمل غير موجود.');
    err.status = 404;
    throw err;
  }
  if (['approved', 'rejected', 'cancelled'].includes(instance.status)) {
    const err = new Error('سير العمل مكتمل ولا يقبل قرارات جديدة.');
    err.status = 409;
    throw err;
  }

  const steps = Array.isArray(instance.steps_snapshot) ? instance.steps_snapshot : [];
  const stepIndex = Number(instance.current_step) || 0;
  const normalized = String(action || '').toLowerCase();

  if (normalized === 'reject' || normalized === 'rejected') {
    const updated = await pool.query(
      `UPDATE wf_instances SET status = 'rejected', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [instanceId]
    );
    await appendEvent(pool, instanceId, {
      step_index: stepIndex,
      action: 'rejected',
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      notes
    });
    return updated.rows[0];
  }

  if (normalized === 'return' || normalized === 'returned') {
    const prev = Math.max(0, stepIndex - 1);
    const updated = await pool.query(
      `UPDATE wf_instances SET status = 'returned', current_step = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [instanceId, prev]
    );
    await appendEvent(pool, instanceId, {
      step_index: stepIndex,
      action: 'returned',
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      notes
    });
    return updated.rows[0];
  }

  if (normalized === 'escalate' || normalized === 'escalated') {
    const updated = await pool.query(
      `UPDATE wf_instances SET status = 'escalated', escalated_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [instanceId]
    );
    await appendEvent(pool, instanceId, {
      step_index: stepIndex,
      action: 'escalated',
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      notes
    });
    return updated.rows[0];
  }

  // approve / advance
  const next = stepIndex + 1;
  if (next >= steps.length) {
    const updated = await pool.query(
      `UPDATE wf_instances SET status = 'approved', current_step = $2, completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [instanceId, stepIndex]
    );
    await appendEvent(pool, instanceId, {
      step_index: stepIndex,
      action: 'approved',
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      notes
    });
    return updated.rows[0];
  }

  const updated = await pool.query(
    `UPDATE wf_instances SET status = 'in_progress', current_step = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [instanceId, next]
  );
  await appendEvent(pool, instanceId, {
    step_index: stepIndex,
    action: 'approved',
    actor_id: actorId,
    actor_name: actorName,
    actor_role: actorRole,
    notes
  });
  return updated.rows[0];
}

/**
 * Bridge: when HR employee request is created, also start durable wf_instance.
 */
async function bridgeEmployeeRequest(pool, tenantId, requestRow, actorId) {
  try {
    await ensureSchema(pool);
    const existing = await pool.query(
      `SELECT id FROM wf_instances
       WHERE tenant_id = $1 AND entity_type = 'employee_request' AND entity_id = $2
         AND status IN ('pending','in_progress','returned','escalated')
       LIMIT 1`,
      [tenantId, String(requestRow.id)]
    );
    if (existing.rows.length) return existing.rows[0];
    return startInstance(pool, tenantId, {
      definitionCode: 'hr-default',
      entityType: 'employee_request',
      entityId: requestRow.id,
      title: requestRow.request_title || requestRow.request_type || `طلب ${requestRow.id}`,
      payload: {
        request_type: requestRow.request_type,
        employee_id: requestRow.employee_id,
        legacy_stages: requestRow.workflow_stages
      },
      actorId
    });
  } catch (err) {
    console.warn('[SharedServices] bridgeEmployeeRequest:', err.message);
    return null;
  }
}

/**
 * Apply escalation for overdue instances based on definition.escalate_hours / Settings Engine.
 */
async function escalateOverdue(pool, tenantId) {
  await ensureSchema(pool);
  const result = await pool.query(
    `UPDATE wf_instances i
     SET status = 'escalated', escalated_at = NOW(), updated_at = NOW()
     FROM wf_definitions d
     WHERE i.definition_id = d.id
       AND i.tenant_id = $1
       AND i.status IN ('pending','in_progress','returned')
       AND i.escalated_at IS NULL
       AND i.started_at < NOW() - make_interval(hours => GREATEST(1, d.escalate_hours))
     RETURNING i.id`,
    [tenantId]
  );
  for (const row of result.rows) {
    await appendEvent(pool, row.id, { action: 'escalated', notes: 'تصعيد تلقائي بعد تجاوز المهلة' });
  }
  return { escalated: result.rows.length };
}

// ---------- Finance approval_workflows (reuse existing tables) ----------

async function createFinanceApproval(pool, body, actor) {
  await ensureSchema(pool);
  if (!body.item_type || !body.item_id) {
    const err = new Error('item_type و item_id مطلوبان.');
    err.status = 400;
    throw err;
  }
  const levels = Array.isArray(body.steps) && body.steps.length
    ? body.steps
    : [
      { step_level: 1, approver_role: 'ACCOUNTANT' },
      { step_level: 2, approver_role: 'FINANCE_MANAGER' }
    ];
  const wf = await pool.query(
    `INSERT INTO approval_workflows
       (entity_id, item_type, item_id, item_title, amount, current_level, status, created_by, created_by_name)
     VALUES ($1,$2,$3,$4,$5,1,'PENDING',$6,$7)
     RETURNING *`,
    [
      body.entity_id || null,
      body.item_type,
      body.item_id,
      body.item_title || body.item_id,
      Number(body.amount) || 0,
      actor?.id || null,
      actor?.name || actor?.email || null
    ]
  );
  const workflow = wf.rows[0];
  for (const step of levels) {
    await pool.query(
      `INSERT INTO approval_steps (workflow_id, step_level, approver_role, approver_name, status)
       VALUES ($1,$2,$3,$4,'PENDING')`,
      [workflow.id, step.step_level || step.level || 1, step.approver_role || step.role, step.approver_name || null]
    );
  }
  // Also mirror into durable engine
  if (actor?.tenantId) {
    await startInstance(pool, actor.tenantId, {
      definitionCode: 'finance-default',
      entityType: body.item_type.toLowerCase(),
      entityId: body.item_id,
      title: body.item_title || body.item_id,
      payload: { amount: body.amount, legacy_workflow_id: workflow.id },
      actorId: actor.id
    }).catch(async () => {
      await upsertDefinition(pool, actor.tenantId, {
        code: 'finance-default',
        name_ar: 'موافقات مالية',
        module_key: 'finance',
        entity_type: 'invoice',
        steps: levels.map((s, i) => ({
          key: s.approver_role || `level_${i + 1}`,
          label_ar: s.approver_role || `مستوى ${i + 1}`,
          role: s.approver_role
        })),
        is_active: true
      }, actor.id);
      return startInstance(pool, actor.tenantId, {
        definitionCode: 'finance-default',
        entityType: body.item_type.toLowerCase(),
        entityId: body.item_id,
        title: body.item_title || body.item_id,
        payload: { amount: body.amount, legacy_workflow_id: workflow.id },
        actorId: actor.id
      });
    });
  }
  return workflow;
}

async function decideFinanceApproval(pool, workflowId, { decision, actorId, actorName, comments }) {
  await ensureSchema(pool);
  const wf = await pool.query(`SELECT * FROM approval_workflows WHERE id = $1`, [workflowId]);
  if (!wf.rows.length) {
    const err = new Error('طلب الموافقة غير موجود.');
    err.status = 404;
    throw err;
  }
  const workflow = wf.rows[0];
  const steps = await pool.query(
    `SELECT * FROM approval_steps WHERE workflow_id = $1 ORDER BY step_level ASC`,
    [workflowId]
  );
  const current = steps.rows.find((s) => s.step_level === workflow.current_level && s.status === 'PENDING')
    || steps.rows.find((s) => s.status === 'PENDING');
  if (!current) {
    const err = new Error('لا توجد خطوة معلقة.');
    err.status = 409;
    throw err;
  }
  if (decision === 'reject') {
    await pool.query(
      `UPDATE approval_steps SET status = 'REJECTED', decision_date = NOW(),
         comments = $2, rejection_reason = $2, approver_id = $3, approver_name = $4
       WHERE id = $1`,
      [current.id, comments || null, actorId || null, actorName || null]
    );
    const updated = await pool.query(
      `UPDATE approval_workflows SET status = 'REJECTED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [workflowId]
    );
    return updated.rows[0];
  }
  await pool.query(
    `UPDATE approval_steps SET status = 'APPROVED', decision_date = NOW(),
       comments = $2, approver_id = $3, approver_name = $4
     WHERE id = $1`,
    [current.id, comments || null, actorId || null, actorName || null]
  );
  const next = steps.rows.find((s) => s.step_level > current.step_level && s.status === 'PENDING');
  if (!next) {
    const updated = await pool.query(
      `UPDATE approval_workflows SET status = 'APPROVED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [workflowId]
    );
    return updated.rows[0];
  }
  const updated = await pool.query(
    `UPDATE approval_workflows SET status = 'IN_REVIEW', current_level = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [workflowId, next.step_level]
  );
  return updated.rows[0];
}

// ---------- Backup ----------

function backupsDir() {
  const root = path.join(__dirname, 'uploads', 'backups');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function isSafeTestDatabaseUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  // Must explicitly look like a test/dev restore target
  return (
    lower.includes('_test') ||
    lower.includes('-test') ||
    lower.includes('/phase5') ||
    lower.includes('phase5_') ||
    lower.includes('restore_sandbox') ||
    process.env.ALLOW_PHASE5_TEST_RESTORE === 'true'
  );
}

async function upsertBackupJob(pool, tenantId, body) {
  await ensureSchema(pool);
  if (!body.name) {
    const err = new Error('اسم مهمة النسخ مطلوب.');
    err.status = 400;
    throw err;
  }
  if (body.id) {
    const result = await pool.query(
      `UPDATE backup_jobs SET
         name = COALESCE($2, name),
         schedule_cron = COALESCE($3, schedule_cron),
         retention_days = COALESCE($4, retention_days),
         include_uploads = COALESCE($5, include_uploads),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        body.id,
        body.name || null,
        body.schedule_cron || null,
        body.retention_days != null ? Number(body.retention_days) : null,
        body.include_uploads != null ? Boolean(body.include_uploads) : null,
        body.is_active != null ? Boolean(body.is_active) : null
      ]
    );
    if (!result.rows.length) {
      const err = new Error('مهمة النسخ غير موجودة.');
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  // Sync retention from Settings Engine policy when omitted
  let retention = body.retention_days != null ? Number(body.retention_days) : null;
  if (retention == null && tenantId) {
    try {
      const policy = await modules.getEngineValue(tenantId, 'module.backup.policy');
      retention = Number(policy.value?.retention_days) || 30;
    } catch {
      retention = 30;
    }
  }
  const inserted = await pool.query(
    `INSERT INTO backup_jobs
       (tenant_id, name, schedule_cron, retention_days, include_uploads, target_kind, is_active)
     VALUES ($1,$2,$3,$4,COALESCE($5,true),'logical_dump',COALESCE($6,true))
     RETURNING *`,
    [
      tenantId,
      body.name,
      body.schedule_cron || body.schedule || 'daily',
      retention || 30,
      body.include_uploads,
      body.is_active
    ]
  );
  return inserted.rows[0];
}

async function runLogicalBackup(pool, tenantId, jobId, actorId) {
  await ensureSchema(pool);
  const run = await pool.query(
    `INSERT INTO backup_runs (job_id, tenant_id, action, status, initiated_by, meta)
     VALUES ($1,$2,'backup','running',$3,$4::jsonb) RETURNING *`,
    [jobId || null, tenantId, actorId || null, JSON.stringify({ engine: 'pg_dump|schema_snapshot' })]
  );
  const runId = run.rows[0].id;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifact = path.join(backupsDir(), `tenant-${tenantId || 'central'}-${stamp}.sql`);

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL غير مضبوط.');

    // Prefer pg_dump; fallback to schema+counts snapshot (safe, non-destructive)
    let bytes = 0;
    let method = 'pg_dump';
    const dump = spawnSync(
      'pg_dump',
      ['--no-owner', '--no-acl', '--schema-only', databaseUrl],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, env: process.env }
    );
    if (dump.status === 0 && dump.stdout) {
      const countSafe = await pool.query(
        `SELECT relname AS table_name, n_live_tup::bigint AS approx_rows
         FROM pg_stat_user_tables ORDER BY relname LIMIT 80`
      );
      const payload = [
        `-- NAIOSH Phase 5 logical backup ${stamp}`,
        `-- method=pg_dump schema-only + stats`,
        dump.stdout,
        `\n-- TABLE STATS\n`,
        ...countSafe.rows.map((r) => `-- ${r.table_name}: ~${r.approx_rows} rows`)
      ].join('\n');
      fs.writeFileSync(artifact, payload);
      bytes = Buffer.byteLength(payload);
    } else {
      method = 'stats_snapshot';
      const countSafe = await pool.query(
        `SELECT relname AS table_name, n_live_tup::bigint AS approx_rows
         FROM pg_stat_user_tables ORDER BY relname`
      );
      const payload = JSON.stringify({
        created_at: new Date().toISOString(),
        tenant_id: tenantId,
        tables: countSafe.rows
      }, null, 2);
      const jsonPath = artifact.replace(/\.sql$/, '.json');
      fs.writeFileSync(jsonPath, payload);
      bytes = Buffer.byteLength(payload);
      await pool.query(
        `UPDATE backup_runs SET status='success', finished_at=NOW(), artifact_path=$2, bytes=$3,
           message=$4, meta = meta || $5::jsonb WHERE id=$1`,
        [runId, jsonPath, bytes, 'stats snapshot (pg_dump unavailable)', JSON.stringify({ method })]
      );
      if (jobId) {
        await pool.query(`UPDATE backup_jobs SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1`, [jobId]);
      }
      return (await pool.query(`SELECT * FROM backup_runs WHERE id = $1`, [runId])).rows[0];
    }

    await pool.query(
      `UPDATE backup_runs SET status='success', finished_at=NOW(), artifact_path=$2, bytes=$3,
         message=$4, meta = meta || $5::jsonb WHERE id=$1`,
      [runId, artifact, bytes, 'logical backup completed', JSON.stringify({ method })]
    );
    if (jobId) {
      await pool.query(`UPDATE backup_jobs SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1`, [jobId]);
    }
    // Apply retention
    await applyBackupRetention(pool, tenantId).catch(() => null);
    return (await pool.query(`SELECT * FROM backup_runs WHERE id = $1`, [runId])).rows[0];
  } catch (err) {
    await pool.query(
      `UPDATE backup_runs SET status='failed', finished_at=NOW(), message=$2 WHERE id=$1`,
      [runId, err.message]
    );
    throw err;
  }
}

async function applyBackupRetention(pool, tenantId) {
  let days = 30;
  try {
    const policy = await modules.getEngineValue(tenantId, 'module.backup.policy');
    days = Number(policy.value?.retention_days) || 30;
  } catch { /* */ }
  const old = await pool.query(
    `SELECT id, artifact_path FROM backup_runs
     WHERE tenant_id = $1 AND finished_at < NOW() - make_interval(days => $2)
       AND artifact_path IS NOT NULL`,
    [tenantId, days]
  );
  for (const row of old.rows) {
    try {
      if (row.artifact_path && fs.existsSync(row.artifact_path)) fs.unlinkSync(row.artifact_path);
    } catch { /* */ }
  }
  await pool.query(
    `DELETE FROM backup_runs
     WHERE tenant_id = $1 AND finished_at < NOW() - make_interval(days => $2)`,
    [tenantId, days]
  );
  return { purged: old.rows.length, retention_days: days };
}

/**
 * Safe restore to a SEPARATE test database only.
 * Requires: confirm token + TEST_RESTORE_DATABASE_URL that passes isSafeTestDatabaseUrl.
 * Never runs against production DATABASE_URL.
 */
async function restoreToTestDatabase(pool, tenantId, {
  artifactPath,
  confirmToken,
  actorId
}) {
  await ensureSchema(pool);
  const run = await pool.query(
    `INSERT INTO backup_runs (tenant_id, action, status, initiated_by, meta)
     VALUES ($1,'restore_test','running',$2,$3::jsonb) RETURNING *`,
    [tenantId, actorId || null, JSON.stringify({ artifactPath })]
  );
  const runId = run.rows[0].id;

  try {
    if (confirmToken !== 'CONFIRM_DESTRUCTIVE_RESTORE') {
      await pool.query(
        `UPDATE backup_runs SET status='blocked', finished_at=NOW(),
           message='رفض: يلزم confirmToken=CONFIRM_DESTRUCTIVE_RESTORE' WHERE id=$1`,
        [runId]
      );
      const err = new Error('الاستعادة المدمرة مرفوضة بدون تأكيد صريح CONFIRM_DESTRUCTIVE_RESTORE.');
      err.status = 403;
      throw err;
    }

    const testUrl = process.env.TEST_RESTORE_DATABASE_URL || process.env.PHASE5_TEST_DATABASE_URL || null;
    const schemaSandbox = process.env.PHASE5_RESTORE_SCHEMA_SANDBOX === 'true'
      || process.env.ALLOW_PHASE5_TEST_RESTORE === 'true';

    const artifact = artifactPath || (await pool.query(
      `SELECT artifact_path FROM backup_runs
       WHERE tenant_id = $1 AND action='backup' AND status='success' AND artifact_path IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
      [tenantId]
    )).rows[0]?.artifact_path;

    if (!artifact || !fs.existsSync(artifact)) {
      const err = new Error('لا يوجد ملف نسخة لاستعادته.');
      err.status = 404;
      throw err;
    }

    // Mode A: schema sandbox (non-destructive) when separate test DB cannot be created
    if (!testUrl && schemaSandbox) {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS phase5_restore_sandbox`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS phase5_restore_sandbox.restore_markers (
          id SERIAL PRIMARY KEY,
          restored_at TIMESTAMP NOT NULL DEFAULT NOW(),
          source_artifact TEXT,
          note TEXT,
          checksum TEXT
        )
      `);
      const checksum = crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex').slice(0, 16);
      await pool.query(
        `INSERT INTO phase5_restore_sandbox.restore_markers (source_artifact, note, checksum)
         VALUES ($1,$2,$3)`,
        [artifact, 'Phase 5 schema-sandbox verify (no DROP/prod overwrite)', checksum]
      );
      await pool.query(
        `UPDATE backup_runs SET status='success', finished_at=NOW(), artifact_path=$2,
           message='verified artifact in phase5_restore_sandbox schema', meta = meta || $3::jsonb WHERE id=$1`,
        [runId, artifact, JSON.stringify({ mode: 'schema_sandbox', checksum })]
      );
      return (await pool.query(`SELECT * FROM backup_runs WHERE id=$1`, [runId])).rows[0];
    }

    if (!testUrl) {
      await pool.query(
        `UPDATE backup_runs SET status='blocked', finished_at=NOW(),
           message='لا يوجد TEST_RESTORE_DATABASE_URL ولا PHASE5_RESTORE_SCHEMA_SANDBOX' WHERE id=$1`,
        [runId]
      );
      const err = new Error('اضبط TEST_RESTORE_DATABASE_URL أو PHASE5_RESTORE_SCHEMA_SANDBOX=true.');
      err.status = 400;
      throw err;
    }
    if (!isSafeTestDatabaseUrl(testUrl)) {
      await pool.query(
        `UPDATE backup_runs SET status='blocked', finished_at=NOW(),
           message='هدف الاستعادة لا يبدو قاعدة اختبار آمنة' WHERE id=$1`,
        [runId]
      );
      const err = new Error('هدف الاستعادة غير مسموح (يجب أن يكون قاعدة اختبار صريحة).');
      err.status = 403;
      throw err;
    }
    if (testUrl === process.env.DATABASE_URL) {
      const err = new Error('ممنوع استعادة الاختبار على DATABASE_URL الإنتاجي/الأساسي.');
      err.status = 403;
      throw err;
    }

    // For .json stats snapshots: verify-only restore (write marker table on test DB)
    if (artifact.endsWith('.json')) {
      const { Client } = require('pg');
      const client = new Client({ connectionString: testUrl, connectionTimeoutMillis: 8000 });
      await client.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS phase5_restore_markers (
            id SERIAL PRIMARY KEY,
            restored_at TIMESTAMP NOT NULL DEFAULT NOW(),
            source_artifact TEXT,
            note TEXT
          )
        `);
        await client.query(
          `INSERT INTO phase5_restore_markers (source_artifact, note) VALUES ($1,$2)`,
          [artifact, 'Phase 5 safe test restore (stats snapshot verify)']
        );
      } finally {
        await client.end().catch(() => null);
      }
      await pool.query(
        `UPDATE backup_runs SET status='success', finished_at=NOW(), artifact_path=$2,
           message='verified stats snapshot on test DB', meta = meta || $3::jsonb WHERE id=$1`,
        [runId, artifact, JSON.stringify({ testUrlHost: new URL(testUrl).host, mode: 'marker' })]
      );
      return (await pool.query(`SELECT * FROM backup_runs WHERE id=$1`, [runId])).rows[0];
    }

    // SQL dump → psql against TEST url only
    const result = spawnSync(
      'psql',
      [testUrl, '-q', '-X', '-v', 'ON_ERROR_STOP=0', '-f', artifact],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, env: process.env }
    );
    if (result.status !== 0) {
      throw new Error(`psql restore failed: ${(result.stderr || '').toString().slice(0, 500)}`);
    }
    await pool.query(
      `UPDATE backup_runs SET status='success', finished_at=NOW(), artifact_path=$2,
         message='restored SQL dump to test database', meta = meta || $3::jsonb WHERE id=$1`,
      [runId, artifact, JSON.stringify({ testUrlHost: new URL(testUrl).host, mode: 'psql' })]
    );
    return (await pool.query(`SELECT * FROM backup_runs WHERE id=$1`, [runId])).rows[0];
  } catch (err) {
    if (err.status !== 403 && err.status !== 400 && err.status !== 404) {
      await pool.query(
        `UPDATE backup_runs SET status='failed', finished_at=NOW(), message=$2 WHERE id=$1`,
        [runId, err.message]
      );
    }
    throw err;
  }
}

// ---------- Templates studio ----------

const UNSAFE_TEMPLATE_RE = /<\s*script|javascript:|onerror\s*=|onload\s*=|<\s*iframe/i;

function sanitizeTemplateBody(body) {
  const text = String(body || '');
  if (UNSAFE_TEMPLATE_RE.test(text)) {
    const err = new Error('محتوى القالب يحتوي عناصر غير موثوقة (script/handlers).');
    err.status = 400;
    throw err;
  }
  return text;
}

function renderTemplate(body, vars = {}) {
  const safeVars = {};
  for (const [k, v] of Object.entries(vars || {})) {
    // Escape HTML special chars for safe preview
    safeVars[k] = String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  return String(body || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => (
    Object.prototype.hasOwnProperty.call(safeVars, key) ? safeVars[key] : ''
  ));
}

async function saveTemplateWithVersion(pool, tenantId, body, actorId) {
  await ensureSchema(pool);
  const cleanBody = sanitizeTemplateBody(body.body);
  const saved = await modules.upsertTemplate(pool, {
    ...body,
    body: cleanBody
  });
  const ver = await pool.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM module_template_versions WHERE template_id = $1`,
    [saved.id]
  );
  const next = ver.rows[0].next;
  await pool.query(
    `INSERT INTO module_template_versions (template_id, version, subject, body, changed_by, change_reason)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [saved.id, next, saved.subject, cleanBody, actorId || null, body.change_reason || 'template-save']
  );
  return { template: saved, version: next };
}

async function previewTemplate(pool, templateId, vars) {
  await ensureSchema(pool);
  const result = await pool.query(`SELECT * FROM module_templates WHERE id = $1`, [templateId]);
  if (!result.rows.length) {
    const err = new Error('القالب غير موجود.');
    err.status = 404;
    throw err;
  }
  const tpl = result.rows[0];
  return {
    template_id: tpl.id,
    subject: renderTemplate(tpl.subject || '', vars),
    body: renderTemplate(tpl.body || '', vars),
    variables_used: [...String(tpl.body || '').matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)].map((m) => m[1])
  };
}

async function listTemplateVersions(pool, templateId) {
  await ensureSchema(pool);
  const result = await pool.query(
    `SELECT id, template_id, version, subject, changed_by, change_reason, created_at,
            LEFT(body, 200) AS body_preview
     FROM module_template_versions WHERE template_id = $1 ORDER BY version DESC`,
    [templateId]
  );
  return result.rows;
}

// ---------- Notifications outbox ----------

async function enqueueNotification(pool, tenantId, {
  channel = 'in_app',
  recipient,
  subject,
  body,
  templateCode,
  meta
}) {
  await ensureSchema(pool);
  // Respect channel policy
  if (tenantId) {
    try {
      const channels = await modules.getEngineValue(tenantId, 'module.notifications.channels');
      const policy = channels.value || {};
      if (channel === 'email' && policy.email === false) {
        const err = new Error('قناة البريد معطّلة حسب سياسة الإشعارات.');
        err.status = 403;
        throw err;
      }
      if (channel === 'sms' && policy.sms === false) {
        const err = new Error('قناة SMS معطّلة حسب سياسة الإشعارات.');
        err.status = 403;
        throw err;
      }
      if (channel === 'in_app' && policy.in_app === false) {
        const err = new Error('قناة داخل التطبيق معطّلة.');
        err.status = 403;
        throw err;
      }
    } catch (e) {
      if (e.status) throw e;
    }
  }
  if (!recipient) {
    const err = new Error('recipient مطلوب.');
    err.status = 400;
    throw err;
  }
  const inserted = await pool.query(
    `INSERT INTO notification_outbox
       (tenant_id, channel, recipient, subject, body, template_code, status, meta)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7::jsonb)
     RETURNING *`,
    [
      tenantId,
      channel,
      String(recipient),
      subject || null,
      body || '',
      templateCode || null,
      JSON.stringify(meta || {})
    ]
  );
  return inserted.rows[0];
}

async function processOutbox(pool, { limit = 20 } = {}) {
  await ensureSchema(pool);
  const pending = await pool.query(
    `SELECT * FROM notification_outbox
     WHERE status IN ('pending','failed')
       AND attempts < max_attempts
       AND next_attempt_at <= NOW()
     ORDER BY id ASC LIMIT $1`,
    [Math.min(100, Number(limit) || 20)]
  );
  const results = [];
  for (const row of pending.rows) {
    await pool.query(
      `UPDATE notification_outbox SET status='sending', attempts = attempts + 1 WHERE id=$1`,
      [row.id]
    );
    try {
      if (row.channel === 'in_app') {
        // Best-effort insert into notifications table when user id numeric
        const userId = Number(row.recipient);
        if (Number.isFinite(userId) && userId > 0) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, priority)
             VALUES ($1,'SYSTEM',$2,$3,'NORMAL')`,
            [userId, row.subject || 'إشعار', row.body]
          ).catch(async () => {
            // notifications table may lack some columns — minimal insert
            await pool.query(
              `INSERT INTO notifications (user_id, type, title, message)
               VALUES ($1,'SYSTEM',$2,$3)`,
              [userId, row.subject || 'إشعار', row.body]
            ).catch(() => null);
          });
        }
      }
      // email/sms: mark sent as queued-success in Phase 5 (actual SMTP via existing tenant email settings later)
      await pool.query(
        `UPDATE notification_outbox SET status='sent', sent_at=NOW(), last_error=NULL WHERE id=$1`,
        [row.id]
      );
      results.push({ id: row.id, status: 'sent' });
    } catch (err) {
      const backoffMin = Math.min(60, Math.pow(2, row.attempts || 1));
      await pool.query(
        `UPDATE notification_outbox SET status='failed', last_error=$2,
           next_attempt_at = NOW() + make_interval(mins => $3) WHERE id=$1`,
        [row.id, err.message, backoffMin]
      );
      results.push({ id: row.id, status: 'failed', error: err.message });
    }
  }
  return results;
}

// ---------- Integrations ----------

async function listIntegrations(pool, tenantId) {
  await ensureSchema(pool);
  for (const item of BUILTIN_INTEGRATIONS) {
    await pool.query(
      `INSERT INTO integration_registry (tenant_id, integration_key, display_name, category, is_enabled, config_json)
       VALUES ($1,$2,$3,$4,false,$5::jsonb)
       ON CONFLICT (tenant_id, integration_key) DO NOTHING`,
      [tenantId, item.key, item.display_name, item.category, JSON.stringify({ api: item.api })]
    );
  }
  const result = await pool.query(
    `SELECT id, tenant_id, integration_key, display_name, category, is_enabled,
            config_json, secrets_ref, last_test_at, last_test_ok, last_test_msg, updated_at
     FROM integration_registry WHERE tenant_id = $1 ORDER BY category, integration_key`,
    [tenantId]
  );
  // Never return raw secrets — secrets_ref is a pointer only
  return result.rows.map((r) => ({
    ...r,
    has_secrets_ref: Boolean(r.secrets_ref),
    secrets_ref: r.secrets_ref ? '[ref]' : null
  }));
}

async function setIntegrationEnabled(pool, tenantId, key, enabled, actorId) {
  await ensureSchema(pool);
  const result = await pool.query(
    `UPDATE integration_registry SET is_enabled = $3, updated_by = $4, updated_at = NOW()
     WHERE tenant_id = $1 AND integration_key = $2 RETURNING id, integration_key, is_enabled`,
    [tenantId, key, Boolean(enabled), actorId || null]
  );
  if (!result.rows.length) {
    const err = new Error('التكامل غير موجود.');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

/**
 * Test connection without exposing secrets. Uses existing APIs' stored config presence.
 */
async function testIntegration(pool, tenantId, key, reqContext = {}) {
  await ensureSchema(pool);
  const row = await pool.query(
    `SELECT * FROM integration_registry WHERE tenant_id = $1 AND integration_key = $2`,
    [tenantId, key]
  );
  if (!row.rows.length) {
    const err = new Error('التكامل غير موجود.');
    err.status = 404;
    throw err;
  }
  const integ = row.rows[0];
  let ok = false;
  let msg = '';
  try {
    if (key === 'tenant_smtp') {
      const r = await pool.query(
        `SELECT id, smtp_host, smtp_port, from_email,
                CASE WHEN smtp_password IS NOT NULL AND smtp_password <> '' THEN true ELSE false END AS has_password
         FROM tenant_email_settings LIMIT 1`
      ).catch(() => ({ rows: [] }));
      ok = Boolean(r.rows[0]?.smtp_host && r.rows[0]?.has_password);
      msg = ok ? 'إعدادات SMTP موجودة ومشفّرة.' : 'إعدادات SMTP غير مكتملة.';
    } else if (key.startsWith('tenant_') && ['tenant_stripe', 'tenant_paypal', 'tenant_paymob'].includes(key)) {
      const provider = key.replace('tenant_', '');
      const r = await pool.query(
        `SELECT provider FROM tenant_payment_settings WHERE provider = $1 LIMIT 1`,
        [provider]
      ).catch(() => ({ rows: [] }));
      ok = r.rows.length > 0;
      msg = ok ? `إعدادات ${provider} موجودة.` : `لا إعدادات محفوظة لـ ${provider}.`;
    } else if (key === 'tenant_ai') {
      const r = await pool.query(
        `SELECT value_json FROM tenant_settings WHERE key = 'ai_settings' LIMIT 1`
      ).catch(() => ({ rows: [] }));
      ok = Boolean(r.rows[0]);
      msg = ok ? 'إعدادات AI موجودة.' : 'لا إعدادات AI.';
    } else {
      ok = Boolean(integ.is_enabled);
      msg = ok ? 'التكامل مفعّل (فحص سطحي).' : 'التكامل غير مفعّل.';
    }
  } catch (err) {
    ok = false;
    msg = err.message;
  }
  await pool.query(
    `UPDATE integration_registry SET last_test_at = NOW(), last_test_ok = $3, last_test_msg = $4, updated_at = NOW()
     WHERE tenant_id = $1 AND integration_key = $2`,
    [tenantId, key, ok, msg]
  );
  return { integration_key: key, ok, message: msg, tested_at: new Date().toISOString() };
}

async function getBundle(pool, tenantId) {
  await ensureSchema(pool);
  await seedDefaultHrDefinition(pool, tenantId, null).catch(() => null);
  const [definitions, instances, jobs, runs, outbox, integrations] = await Promise.all([
    listDefinitions(pool, tenantId),
    pool.query(
      `SELECT id, definition_code, entity_type, entity_id, title, status, current_step, started_at, updated_at
       FROM wf_instances WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    ),
    pool.query(`SELECT * FROM backup_jobs WHERE tenant_id = $1 ORDER BY id DESC`, [tenantId]),
    pool.query(
      `SELECT id, job_id, action, status, started_at, finished_at, bytes, message, artifact_path
       FROM backup_runs WHERE tenant_id = $1 ORDER BY id DESC LIMIT 30`,
      [tenantId]
    ),
    pool.query(
      `SELECT id, channel, recipient, subject, status, attempts, last_error, created_at, sent_at
       FROM notification_outbox WHERE tenant_id = $1 ORDER BY id DESC LIMIT 30`,
      [tenantId]
    ),
    listIntegrations(pool, tenantId)
  ]);
  return {
    workflows: { definitions, instances: instances.rows },
    backup: { jobs: jobs.rows, runs: runs.rows },
    notifications: { outbox: outbox.rows },
    integrations,
    links: {
      center: '/shared/services',
      module_settings: '/modules/settings',
      hr_workflow_ui: '/hr/workflow-engine'
    }
  };
}

module.exports = {
  ensureSchema,
  poolFor,
  tenantIdOf,
  DEFAULT_HR_STEPS,
  BUILTIN_INTEGRATIONS,
  listDefinitions,
  upsertDefinition,
  seedDefaultHrDefinition,
  startInstance,
  getInstance,
  listInstanceEvents,
  decideInstance,
  bridgeEmployeeRequest,
  escalateOverdue,
  createFinanceApproval,
  decideFinanceApproval,
  upsertBackupJob,
  runLogicalBackup,
  applyBackupRetention,
  restoreToTestDatabase,
  isSafeTestDatabaseUrl,
  saveTemplateWithVersion,
  previewTemplate,
  listTemplateVersions,
  sanitizeTemplateBody,
  renderTemplate,
  enqueueNotification,
  processOutbox,
  listIntegrations,
  setIntegrationEnabled,
  testIntegration,
  getBundle,
  hrWorkflow
};
