'use strict';

/**
 * Finance 360 operational payroll + overtime cycle.
 * Additive schema only. Links: approved overtime → payroll run → balanced JE.
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { denyUnless } = require('../services/hr-finance-authz');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');
const { getDocSettings } = require('../services/page-document-settings');

let ready = false;

async function ensureSchema() {
  if (ready) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_payroll_employees (
      employee_id SERIAL PRIMARY KEY,
      employee_code TEXT,
      full_name_ar TEXT,
      full_name_en TEXT,
      base_salary NUMERIC(14,2) DEFAULT 0,
      entity_id TEXT,
      entity_type TEXT DEFAULT 'HQ',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_payroll_overtime (
      overtime_id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES finance_payroll_employees(employee_id),
      work_date DATE,
      hours NUMERIC(10,2) DEFAULT 0,
      rate NUMERIC(14,4) DEFAULT 0,
      multiplier NUMERIC(8,4) DEFAULT 1,
      amount NUMERIC(14,2) DEFAULT 0,
      status TEXT DEFAULT 'DRAFT',
      payroll_run_id INTEGER,
      entity_type TEXT DEFAULT 'HQ',
      entity_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_payroll_runs (
      run_id SERIAL PRIMARY KEY,
      run_number TEXT,
      period_year INTEGER,
      period_month INTEGER,
      run_date DATE,
      status TEXT DEFAULT 'DRAFT',
      total_gross NUMERIC(14,2) DEFAULT 0,
      total_deductions NUMERIC(14,2) DEFAULT 0,
      total_net NUMERIC(14,2) DEFAULT 0,
      journal_entry_id INTEGER,
      entity_type TEXT DEFAULT 'HQ',
      entity_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_by TEXT,
      approved_by TEXT,
      approved_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS finance_payroll_items (
      item_id SERIAL PRIMARY KEY,
      run_id INTEGER REFERENCES finance_payroll_runs(run_id),
      employee_id INTEGER,
      gross_amount NUMERIC(14,2) DEFAULT 0,
      deductions_amount NUMERIC(14,2) DEFAULT 0,
      net_amount NUMERIC(14,2) DEFAULT 0,
      status TEXT DEFAULT 'DRAFT',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_overtime_policy (
      entity_id TEXT PRIMARY KEY,
      normal_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1.5,
      weekend_multiplier NUMERIC(8,4) NOT NULL DEFAULT 2.0,
      holiday_multiplier NUMERIC(8,4) NOT NULL DEFAULT 2.5,
      default_hourly_from_salary BOOLEAN NOT NULL DEFAULT true,
      monthly_hours_divisor NUMERIC(10,2) NOT NULL DEFAULT 30,
      allow_overlap BOOLEAN NOT NULL DEFAULT false,
      require_reason BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by TEXT,
      audit_log JSONB DEFAULT '[]'::jsonb
    );
  `);
  const alters = [
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS request_number TEXT`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS start_time TIME`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS end_time TIME`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS reason TEXT`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'NORMAL'`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS posted_to_payroll_at TIMESTAMPTZ`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS rejected_reason TEXT`,
    `ALTER TABLE finance_payroll_overtime ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS base_salary NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS allowances NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS incentives NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS advances NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS reverse_journal_entry_id INTEGER`
  ];
  for (const sql of alters) {
    await db.query(sql);
  }
  ready = true;
}

function entityOf(req, body) {
  return resolveScopedEntityId(req, (body && body.entity_id) || req.query.entity_id || req.headers['x-entity-id']) || 'HQ001';
}

function entityTypeOf(req, body) {
  return resolveScopedEntityType(req, (body && body.entity_type) || req.query.entity_type) || 'HQ';
}

function actorLabel(req) {
  return req.hrFinanceActor?.userName || req.hrFinanceActor?.userId || req.authUser?.email || req.authUser?.name || 'ui';
}

function audit(action, by, extra = {}) {
  return { action, by: by || 'ui', at: new Date().toISOString(), ...extra };
}

function hoursFromRange(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = String(start).split(':').map(Number);
  const [eh, em] = String(end).split(':').map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

async function loadPolicy(entityId) {
  const r = await db.query(`SELECT * FROM finance_overtime_policy WHERE entity_id = $1`, [entityId]);
  if (r.rows[0]) return r.rows[0];
  const ins = await db.query(
    `INSERT INTO finance_overtime_policy (entity_id) VALUES ($1)
     ON CONFLICT (entity_id) DO NOTHING RETURNING *`,
    [entityId]
  );
  if (ins.rows[0]) return ins.rows[0];
  const again = await db.query(`SELECT * FROM finance_overtime_policy WHERE entity_id = $1`, [entityId]);
  return again.rows[0];
}

function multiplierFor(policy, dayType) {
  const dt = String(dayType || 'NORMAL').toUpperCase();
  if (dt === 'WEEKEND') return Number(policy.weekend_multiplier || 2);
  if (dt === 'HOLIDAY') return Number(policy.holiday_multiplier || 2.5);
  return Number(policy.normal_multiplier || 1.5);
}

async function nextOtNumber(entityId) {
  const r = await db.query(
    `SELECT COUNT(*)::int AS c FROM finance_payroll_overtime WHERE entity_id = $1`,
    [entityId]
  );
  return `OT-${String((r.rows[0]?.c || 0) + 1).padStart(5, '0')}`;
}

router.get('/overtime/policy', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    res.json({ success: true, policy: await loadPolicy(eid) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/overtime/policy', async (req, res) => {
  try {
    if (denyUnless(req, res, 'overtime_approve')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const b = req.body || {};
    const by = actorLabel(req);
    const updated = await db.query(
      `INSERT INTO finance_overtime_policy (
         entity_id, normal_multiplier, weekend_multiplier, holiday_multiplier,
         default_hourly_from_salary, monthly_hours_divisor, allow_overlap, require_reason, updated_by, audit_log
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (entity_id) DO UPDATE SET
         normal_multiplier = EXCLUDED.normal_multiplier,
         weekend_multiplier = EXCLUDED.weekend_multiplier,
         holiday_multiplier = EXCLUDED.holiday_multiplier,
         default_hourly_from_salary = EXCLUDED.default_hourly_from_salary,
         monthly_hours_divisor = EXCLUDED.monthly_hours_divisor,
         allow_overlap = EXCLUDED.allow_overlap,
         require_reason = EXCLUDED.require_reason,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW(),
         audit_log = COALESCE(finance_overtime_policy.audit_log, '[]'::jsonb) || EXCLUDED.audit_log
       RETURNING *`,
      [
        eid,
        Number(b.normal_multiplier != null ? b.normal_multiplier : 1.5),
        Number(b.weekend_multiplier != null ? b.weekend_multiplier : 2),
        Number(b.holiday_multiplier != null ? b.holiday_multiplier : 2.5),
        b.default_hourly_from_salary !== false,
        Number(b.monthly_hours_divisor || 30),
        b.allow_overlap === true,
        b.require_reason !== false,
        by,
        JSON.stringify([audit('policy_update', by)])
      ]
    );
    res.json({ success: true, policy: updated.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/overtime', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const params = [eid];
    let sql = `
      SELECT o.*, e.employee_code, e.full_name_ar, e.full_name_en, e.base_salary, e.department AS emp_department
      FROM finance_payroll_overtime o
      JOIN finance_payroll_employees e ON e.employee_id = o.employee_id
      WHERE o.entity_id = $1`;
    if (req.query.status) {
      params.push(String(req.query.status).toUpperCase());
      sql += ` AND UPPER(o.status) = $${params.length}`;
    }
    if (req.query.employee_id) {
      params.push(Number(req.query.employee_id));
      sql += ` AND o.employee_id = $${params.length}`;
    }
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`);
      sql += ` AND (o.request_number ILIKE $${params.length} OR e.full_name_ar ILIKE $${params.length} OR e.employee_code ILIKE $${params.length})`;
    }
    sql += ` ORDER BY o.overtime_id DESC LIMIT 500`;
    const r = await db.query(sql, params);
    const settings = await getDocSettings('overtime').catch(() => null);
    res.json({ success: true, overtime: r.rows, count: r.rows.length, settings: settings?.value || null });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/overtime', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'overtime_create')) return;
    await ensureSchema();
    const b = req.body || {};
    const eid = entityOf(req, b);
    const etype = entityTypeOf(req, b);
    const policy = await loadPolicy(eid);
    if (!b.employee_id || !b.work_date) {
      return res.status(400).json({ success: false, error: 'الموظف والتاريخ إلزاميان', code: 'REQUIRED' });
    }
    if (policy.require_reason && !String(b.reason || '').trim()) {
      return res.status(400).json({ success: false, error: 'السبب إلزامي حسب السياسة', code: 'REASON_REQUIRED' });
    }
    const emp = await client.query(
      `SELECT * FROM finance_payroll_employees WHERE employee_id = $1 AND (entity_id = $2 OR entity_id IS NULL)`,
      [b.employee_id, eid]
    );
    if (!emp.rows[0]) return res.status(404).json({ success: false, error: 'الموظف غير موجود' });

    let hours = Number(b.hours);
    if (!(hours > 0)) {
      const computed = hoursFromRange(b.start_time, b.end_time);
      hours = computed;
    }
    if (!(hours > 0)) return res.status(400).json({ success: false, error: 'عدد الساعات يجب أن يكون أكبر من صفر' });

    if (!policy.allow_overlap && b.start_time && b.end_time) {
      const overlap = await client.query(
        `SELECT overtime_id FROM finance_payroll_overtime
         WHERE entity_id = $1 AND employee_id = $2 AND work_date = $3
           AND UPPER(status) NOT IN ('CANCELLED','REJECTED')
           AND start_time IS NOT NULL AND end_time IS NOT NULL
           AND start_time < $5::time AND end_time > $4::time
         LIMIT 1`,
        [eid, b.employee_id, b.work_date, b.start_time, b.end_time]
      );
      if (overlap.rows[0]) {
        return res.status(409).json({ success: false, error: 'تداخل مع سجل إضافي آخر لنفس اليوم', code: 'OVERLAP' });
      }
    }

    const dayType = String(b.day_type || 'NORMAL').toUpperCase();
    const mult = b.multiplier != null ? Number(b.multiplier) : multiplierFor(policy, dayType);
    let rate = Number(b.rate || b.hourly_rate || 0);
    if (!(rate > 0) && policy.default_hourly_from_salary) {
      const base = Number(emp.rows[0].base_salary || 0);
      const div = Number(policy.monthly_hours_divisor || 30) || 30;
      rate = div > 0 ? Math.round((base / div) * 10000) / 10000 : 0;
    }
    const amount = Math.round(hours * rate * mult * 100) / 100;
    const by = actorLabel(req);
    const num = b.request_number || await nextOtNumber(eid);
    const ins = await client.query(
      `INSERT INTO finance_payroll_overtime (
         employee_id, work_date, hours, rate, multiplier, amount, status, entity_id, entity_type,
         request_number, department, start_time, end_time, reason, day_type, audit_log
       ) VALUES ($1,$2,$3,$4,$5,$6,'DRAFT',$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
       RETURNING *`,
      [
        b.employee_id, b.work_date, hours, rate, mult, amount, eid, etype,
        num,
        b.department || emp.rows[0].department || null,
        b.start_time || null, b.end_time || null,
        String(b.reason || '').trim() || null,
        dayType,
        JSON.stringify([audit('create', by)])
      ]
    );
    res.status(201).json({ success: true, overtime: ins.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

async function transitionOt(req, res, nextStatus, actionName, requireAction) {
  if (denyUnless(req, res, requireAction)) return;
  const client = await db.pool.connect();
  try {
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const by = actorLabel(req);
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT * FROM finance_payroll_overtime WHERE overtime_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, eid]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    const cur = String(existing.rows[0].status || '').toUpperCase();
    const allowed = {
      SUBMITTED: ['DRAFT'],
      APPROVED: ['SUBMITTED', 'DRAFT'],
      REJECTED: ['SUBMITTED', 'DRAFT'],
      CANCELLED: ['DRAFT', 'SUBMITTED', 'REJECTED'],
      POSTED: ['APPROVED']
    };
    if (!(allowed[nextStatus] || []).includes(cur)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `لا يمكن الانتقال من ${cur} إلى ${nextStatus}`,
        code: 'INVALID_TRANSITION'
      });
    }
    if (nextStatus === 'REJECTED' && !String((req.body || {}).reason || '').trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'سبب الرفض إلزامي', code: 'REASON_REQUIRED' });
    }
    if (nextStatus === 'POSTED') {
      if (existing.rows[0].payroll_run_id || existing.rows[0].posted_to_payroll_at) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: 'مُرحّل للرواتب مسبقًا', code: 'ALREADY_POSTED' });
      }
    }
    const rejectReason = nextStatus === 'REJECTED'
      ? (String((req.body || {}).reason || '').trim() || null)
      : null;
    const payrollRunId = (req.body || {}).payroll_run_id != null
      ? Number((req.body || {}).payroll_run_id)
      : null;
    const updated = await client.query(
      `UPDATE finance_payroll_overtime
       SET status = $3::text,
           rejected_reason = CASE WHEN $3::text = 'REJECTED' THEN $4::text ELSE rejected_reason END,
           posted_to_payroll_at = CASE WHEN $3::text = 'POSTED' THEN NOW() ELSE posted_to_payroll_at END,
           payroll_run_id = COALESCE($5::int, payroll_run_id),
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $6::jsonb,
           updated_at = NOW()
       WHERE overtime_id = $1 AND entity_id = $2
       RETURNING *`,
      [
        req.params.id, eid, nextStatus,
        rejectReason,
        payrollRunId,
        JSON.stringify([audit(actionName, by, { from: cur, to: nextStatus })])
      ]
    );
    await client.query('COMMIT');
    res.json({ success: true, overtime: updated.rows[0] });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
}

router.post('/overtime/:id/submit', (req, res) => transitionOt(req, res, 'SUBMITTED', 'submit', 'overtime_create'));
router.post('/overtime/:id/approve', (req, res) => transitionOt(req, res, 'APPROVED', 'approve', 'overtime_approve'));
router.post('/overtime/:id/reject', (req, res) => transitionOt(req, res, 'REJECTED', 'reject', 'overtime_approve'));
router.post('/overtime/:id/cancel', (req, res) => transitionOt(req, res, 'CANCELLED', 'cancel', 'overtime_create'));

router.put('/overtime/:id', async (req, res) => {
  try {
    if (denyUnless(req, res, 'overtime_create')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const b = req.body || {};
    const existing = await db.query(
      `SELECT * FROM finance_payroll_overtime WHERE overtime_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'غير موجود' });
    const st = String(existing.rows[0].status || '').toUpperCase();
    if (!['DRAFT', 'REJECTED'].includes(st)) {
      return res.status(409).json({ success: false, error: 'التعديل مسموح للمسودة/المرفوض فقط', code: 'LOCKED' });
    }
    const policy = await loadPolicy(eid);
    let hours = b.hours != null ? Number(b.hours) : Number(existing.rows[0].hours);
    if (b.start_time && b.end_time) {
      const c = hoursFromRange(b.start_time, b.end_time);
      if (c != null) hours = c;
    }
    const dayType = String(b.day_type || existing.rows[0].day_type || 'NORMAL').toUpperCase();
    const mult = b.multiplier != null ? Number(b.multiplier) : multiplierFor(policy, dayType);
    const rate = b.rate != null ? Number(b.rate) : Number(existing.rows[0].rate);
    const amount = Math.round(hours * rate * mult * 100) / 100;
    const by = actorLabel(req);
    const updated = await db.query(
      `UPDATE finance_payroll_overtime SET
         work_date = COALESCE($3, work_date),
         hours = $4, rate = $5, multiplier = $6, amount = $7,
         department = COALESCE($8, department),
         start_time = COALESCE($9, start_time),
         end_time = COALESCE($10, end_time),
         reason = COALESCE($11, reason),
         day_type = $12,
         status = 'DRAFT',
         audit_log = COALESCE(audit_log, '[]'::jsonb) || $13::jsonb,
         updated_at = NOW()
       WHERE overtime_id = $1 AND entity_id = $2
       RETURNING *`,
      [
        req.params.id, eid,
        b.work_date || null, hours, rate, mult, amount,
        b.department || null, b.start_time || null, b.end_time || null,
        b.reason != null ? String(b.reason).trim() : null,
        dayType,
        JSON.stringify([audit('update', by)])
      ]
    );
    res.json({ success: true, overtime: updated.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/overtime/summary', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const byEmp = await db.query(
      `SELECT e.employee_id, e.employee_code, e.full_name_ar, e.department,
              COUNT(*)::int AS entries,
              COALESCE(SUM(o.hours),0) AS hours,
              COALESCE(SUM(o.amount),0) AS amount
       FROM finance_payroll_overtime o
       JOIN finance_payroll_employees e ON e.employee_id = o.employee_id
       WHERE o.entity_id = $1 AND UPPER(o.status) NOT IN ('CANCELLED','REJECTED')
       GROUP BY e.employee_id, e.employee_code, e.full_name_ar, e.department
       ORDER BY amount DESC`,
      [eid]
    );
    const byDept = await db.query(
      `SELECT COALESCE(o.department, e.department, '—') AS department,
              COUNT(*)::int AS entries,
              COALESCE(SUM(o.hours),0) AS hours,
              COALESCE(SUM(o.amount),0) AS amount
       FROM finance_payroll_overtime o
       JOIN finance_payroll_employees e ON e.employee_id = o.employee_id
       WHERE o.entity_id = $1 AND UPPER(o.status) NOT IN ('CANCELLED','REJECTED')
       GROUP BY 1 ORDER BY amount DESC`,
      [eid]
    );
    res.json({ success: true, by_employee: byEmp.rows, by_department: byDept.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/employees', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const r = await db.query(
      `SELECT employee_id, employee_code, full_name_ar, full_name_en, base_salary, department, is_active
       FROM finance_payroll_employees
       WHERE (entity_id = $1 OR entity_id IS NULL) AND COALESCE(is_active, true) = true
       ORDER BY full_name_ar NULLS LAST, employee_id`,
      [eid]
    );
    res.json({ success: true, employees: r.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/employees', async (req, res) => {
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    const b = req.body || {};
    const eid = entityOf(req, b);
    const etype = entityTypeOf(req, b);
    if (!b.full_name_ar && !b.employee_code) {
      return res.status(400).json({ success: false, error: 'اسم الموظف أو الرقم الوظيفي إلزامي' });
    }
    const code = String(b.employee_code || `EMP-${Date.now().toString(36).toUpperCase()}`).trim();
    const dup = await db.query(
      `SELECT employee_id FROM finance_payroll_employees
       WHERE employee_code = $1 AND (entity_id = $2 OR entity_id IS NULL) LIMIT 1`,
      [code, eid]
    );
    if (dup.rows[0]) {
      return res.status(409).json({ success: false, error: 'الرقم الوظيفي مكرر', code: 'DUPLICATE_CODE', employee_id: dup.rows[0].employee_id });
    }
    const ins = await db.query(
      `INSERT INTO finance_payroll_employees (
         employee_code, full_name_ar, full_name_en, base_salary, department, entity_id, entity_type, is_active
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING *`,
      [
        code,
        String(b.full_name_ar || code).trim(),
        b.full_name_en || null,
        Number(b.base_salary || 0),
        b.department || null,
        eid,
        etype
      ]
    );
    res.status(201).json({ success: true, employee: ins.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/overtime/export.csv', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const r = await db.query(
      `SELECT o.request_number, e.employee_code, e.full_name_ar, o.department, o.work_date,
              o.start_time, o.end_time, o.hours, o.day_type, o.rate, o.multiplier, o.amount, o.status, o.reason
       FROM finance_payroll_overtime o
       JOIN finance_payroll_employees e ON e.employee_id = o.employee_id
       WHERE o.entity_id = $1
       ORDER BY o.overtime_id DESC`,
      [eid]
    );
    const header = 'request,code,name,department,date,start,end,hours,day_type,rate,multiplier,amount,status,reason\n';
    const body = r.rows.map((row) =>
      [row.request_number, row.employee_code, row.full_name_ar, row.department, row.work_date, row.start_time, row.end_time, row.hours, row.day_type, row.rate, row.multiplier, row.amount, row.status, row.reason]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="overtime.csv"');
    res.send('\uFEFF' + header + body);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/overtime/export.xlsx', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const XLSX = require('xlsx');
    const eid = entityOf(req);
    const r = await db.query(
      `SELECT o.request_number AS "رقم الطلب", e.employee_code AS "الرقم الوظيفي", e.full_name_ar AS "الموظف",
              o.department AS "القسم", o.work_date AS "التاريخ", o.start_time AS "البداية", o.end_time AS "النهاية",
              o.hours AS "الساعات", o.day_type AS "نوع اليوم", o.rate AS "سعر الساعة", o.multiplier AS "المعامل",
              o.amount AS "الاستحقاق", o.status AS "الحالة", o.reason AS "السبب"
       FROM finance_payroll_overtime o
       JOIN finance_payroll_employees e ON e.employee_id = o.employee_id
       WHERE o.entity_id = $1
       ORDER BY o.overtime_id DESC`,
      [eid]
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(r.rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Overtime');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="overtime.xlsx"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/runs/:id/close', async (req, res) => {
  try {
    if (denyUnless(req, res, 'payroll_approve')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const by = actorLabel(req);
    const existing = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'غير موجود' });
    const st = String(existing.rows[0].status || '').toUpperCase();
    if (!['APPROVED', 'POSTED'].includes(st)) {
      return res.status(409).json({ success: false, error: 'الإقفال بعد الاعتماد أو الترحيل فقط', code: 'NOT_READY' });
    }
    if (st === 'CLOSED' || existing.rows[0].closed_at) {
      return res.status(409).json({ success: false, error: 'المسير مقفل مسبقًا', code: 'ALREADY_CLOSED' });
    }
    const updated = await db.query(
      `UPDATE finance_payroll_runs
       SET status = 'CLOSED', closed_at = NOW(), updated_at = NOW(),
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $3::jsonb
       WHERE run_id = $1 AND entity_id = $2 RETURNING *`,
      [req.params.id, eid, JSON.stringify([audit('close', by)])]
    );
    res.json({ success: true, run: updated.rows[0], message: 'أُقفل المسير — التعديل يتطلب إجراءً تصحيحيًا موثقًا' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/runs/:id/export.xlsx', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const viewAll = require('../services/hr-finance-authz').assertAction(req, 'payroll_view_all');
    if (!viewAll.ok) return res.status(403).json({ success: false, error: 'غير مصرح بتصدير كامل المسير' });
    const XLSX = require('xlsx');
    const eid = entityOf(req);
    const items = await db.query(
      `SELECT e.employee_code AS "الرقم الوظيفي", e.full_name_ar AS "الموظف",
              i.base_salary AS "الأساسي", i.allowances AS "البدلات", i.incentives AS "الحوافز",
              i.overtime_amount AS "الإضافي", i.deductions_amount AS "الاستقطاعات",
              i.advances AS "السلف", i.tax_amount AS "الضريبة", i.insurance_amount AS "التأمينات",
              i.gross_amount AS "الإجمالي", i.net_amount AS "الصافي", i.status AS "الحالة"
       FROM finance_payroll_items i
       JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
       JOIN finance_payroll_runs r ON r.run_id = i.run_id
       WHERE i.run_id = $1 AND r.entity_id = $2
       ORDER BY e.full_name_ar`,
      [req.params.id, eid]
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(items.rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${req.params.id}.xlsx"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/runs', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const viewAll = require('../services/hr-finance-authz').assertAction(req, 'payroll_view_all');
    const r = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE entity_id = $1 ORDER BY run_id DESC LIMIT 200`,
      [eid]
    );
    res.json({
      success: true,
      runs: r.rows,
      count: r.rows.length,
      can_view_all: viewAll.ok,
      settings: (await getDocSettings('payroll-runs').catch(() => null))?.value || null
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/runs/generate', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    const b = req.body || {};
    const eid = entityOf(req, b);
    const etype = entityTypeOf(req, b);
    const year = Number(b.period_year);
    const month = Number(b.period_month);
    if (!year || !month) return res.status(400).json({ success: false, error: 'الشهر والسنة إلزاميان' });

    const dup = await client.query(
      `SELECT run_id FROM finance_payroll_runs
       WHERE entity_id = $1 AND period_year = $2 AND period_month = $3
         AND UPPER(status) NOT IN ('CANCELLED')
         AND ($4::text IS NULL OR COALESCE(department,'') = COALESCE($4,''))
       LIMIT 1`,
      [eid, year, month, b.department || null]
    );
    if (dup.rows[0]) {
      return res.status(409).json({
        success: false,
        error: 'يوجد مسير لنفس الفترة/القسم',
        code: 'DUPLICATE_PERIOD',
        run_id: dup.rows[0].run_id
      });
    }

    await client.query('BEGIN');
    const by = actorLabel(req);
    const runNumber = `PR-${year}${String(month).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
    const runIns = await client.query(
      `INSERT INTO finance_payroll_runs (
         run_number, period_year, period_month, run_date, status, entity_id, entity_type, department, created_by, audit_log
       ) VALUES ($1,$2,$3,CURRENT_DATE,'DRAFT',$4,$5,$6,$7,$8::jsonb)
       RETURNING *`,
      [runNumber, year, month, eid, etype, b.department || null, by, JSON.stringify([audit('generate', by)])]
    );
    const run = runIns.rows[0];

    let empSql = `SELECT * FROM finance_payroll_employees WHERE (entity_id = $1 OR entity_id IS NULL) AND COALESCE(is_active,true)=true`;
    const empParams = [eid];
    if (b.department) {
      empParams.push(b.department);
      empSql += ` AND department = $${empParams.length}`;
    }
    if (Array.isArray(b.employee_ids) && b.employee_ids.length) {
      empParams.push(b.employee_ids.map(Number));
      empSql += ` AND employee_id = ANY($${empParams.length}::int[])`;
    }
    const emps = await client.query(empSql, empParams);

    const settings = (await getDocSettings('payroll-runs').catch(() => null))?.value || {};
    const taxPct = Number(settings.tax_pct != null ? settings.tax_pct : 0);
    const insurancePct = Number(settings.insurance_pct != null ? settings.insurance_pct : 0);

    let totalGross = 0;
    let totalDed = 0;
    let totalNet = 0;
    const linkedOt = [];

    for (const emp of emps.rows) {
      const ot = await client.query(
        `SELECT * FROM finance_payroll_overtime
         WHERE entity_id = $1 AND employee_id = $2 AND UPPER(status) = 'APPROVED'
           AND payroll_run_id IS NULL AND posted_to_payroll_at IS NULL
           AND EXTRACT(YEAR FROM work_date) = $3 AND EXTRACT(MONTH FROM work_date) = $4
         FOR UPDATE`,
        [eid, emp.employee_id, year, month]
      );
      const overtimeAmount = ot.rows.reduce((s, row) => s + Number(row.amount || 0), 0);
      const base = Number(emp.base_salary || 0);
      const allowances = Number(b.default_allowances || settings.default_allowances || 0);
      const incentives = Number(b.default_incentives || 0);
      const advances = Number(b.default_advances || 0);
      const gross = base + allowances + incentives + overtimeAmount;
      const tax = Math.round(gross * taxPct) / 100;
      const insurance = Math.round(base * insurancePct) / 100;
      const deductions = tax + insurance + advances;
      const net = Math.round((gross - deductions) * 100) / 100;
      totalGross += gross;
      totalDed += deductions;
      totalNet += net;

      await client.query(
        `INSERT INTO finance_payroll_items (
           run_id, employee_id, gross_amount, deductions_amount, net_amount, status, notes,
           base_salary, allowances, incentives, overtime_amount, advances, tax_amount, insurance_amount, audit_log
         ) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
        [
          run.run_id, emp.employee_id, gross, deductions, net,
          `OT:${ot.rows.map((x) => x.overtime_id).join(',') || 'none'}`,
          base, allowances, incentives, overtimeAmount, advances, tax, insurance,
          JSON.stringify([audit('item_create', by)])
        ]
      );

      for (const row of ot.rows) {
        await client.query(
          `UPDATE finance_payroll_overtime
           SET status = 'POSTED', payroll_run_id = $2, posted_to_payroll_at = NOW(),
               audit_log = COALESCE(audit_log, '[]'::jsonb) || $3::jsonb, updated_at = NOW()
           WHERE overtime_id = $1`,
          [row.overtime_id, run.run_id, JSON.stringify([audit('post_to_payroll', by, { run_id: run.run_id })])]
        );
        linkedOt.push(row.overtime_id);
      }
    }

    const updated = await client.query(
      `UPDATE finance_payroll_runs
       SET total_gross = $2, total_deductions = $3, total_net = $4, updated_at = NOW()
       WHERE run_id = $1 RETURNING *`,
      [run.run_id, totalGross, totalDed, totalNet]
    );
    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      run: updated.rows[0],
      employees: emps.rows.length,
      overtime_linked: linkedOt.length,
      message: 'أُنشئ مسير الرواتب وربط الساعات المعتمدة مرة واحدة'
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.get('/runs/:id', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const run = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    const viewAll = require('../services/hr-finance-authz').assertAction(req, 'payroll_view_all');
    let itemsSql = `
      SELECT i.*, e.employee_code, e.full_name_ar, e.full_name_en, e.department
      FROM finance_payroll_items i
      JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
      WHERE i.run_id = $1`;
    const params = [req.params.id];
    if (!viewAll.ok && req.authUser?.email) {
      // employee may only see own slip — match by email not available; restrict to empty unless view_all
      itemsSql += ` AND 1=0`;
    }
    const items = await db.query(itemsSql + ` ORDER BY e.full_name_ar`, params);
    // If no view_all, still allow accountant/manager via viewAll; for employee role show own if employee_code matches header
    let rows = items.rows;
    if (!viewAll.ok) {
      const code = req.headers['x-employee-code'] || req.authUser?.employee_code;
      if (code) {
        const all = await db.query(
          `SELECT i.*, e.employee_code, e.full_name_ar, e.full_name_en, e.department
           FROM finance_payroll_items i
           JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
           WHERE i.run_id = $1 AND e.employee_code = $2`,
          [req.params.id, code]
        );
        rows = all.rows;
      } else {
        rows = [];
      }
    }
    res.json({ success: true, run: run.rows[0], items: rows, can_view_all: viewAll.ok });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/runs/:id/approve', async (req, res) => {
  try {
    if (denyUnless(req, res, 'payroll_approve')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const by = actorLabel(req);
    const existing = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'غير موجود' });
    if (String(existing.rows[0].status).toUpperCase() !== 'DRAFT') {
      return res.status(409).json({ success: false, error: 'الاعتماد من المسودة فقط', code: 'NOT_DRAFT' });
    }
    const updated = await db.query(
      `UPDATE finance_payroll_runs
       SET status = 'APPROVED', approved_by = $3, approved_at = NOW(), updated_at = NOW(),
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $4::jsonb
       WHERE run_id = $1 AND entity_id = $2 RETURNING *`,
      [req.params.id, eid, by, JSON.stringify([audit('approve', by)])]
    );
    await db.query(`UPDATE finance_payroll_items SET status = 'APPROVED' WHERE run_id = $1`, [req.params.id]);
    res.json({ success: true, run: updated.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/runs/:id/post-gl', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'payroll_post')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const by = actorLabel(req);
    const b = req.body || {};
    await client.query('BEGIN');
    const run = await client.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'غير موجود' });
    }
    const st = String(run.rows[0].status || '').toUpperCase();
    if (st === 'POSTED' && run.rows[0].journal_entry_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'مُرحّل محاسبيًا مسبقًا', code: 'ALREADY_POSTED', journal_entry_id: run.rows[0].journal_entry_id });
    }
    if (st !== 'APPROVED' && st !== 'POSTED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'الترحيل بعد الاعتماد فقط', code: 'NOT_APPROVED' });
    }
    if (!(Number(run.rows[0].total_gross) > 0)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'لا بنود للترحيل' });
    }

    const settings = (await getDocSettings('payroll-runs').catch(() => null))?.value || {};
    const expenseCode = b.expense_account_code || settings.expense_account_code || '5100';
    const payableCode = b.payable_account_code || settings.payable_account_code || '2150';
    const dedCode = b.deductions_account_code || settings.deductions_account_code || null;

    async function resolveCode(code) {
      const r = await client.query(
        `SELECT account_id, account_code, account_name_ar, is_header, is_active
         FROM finance_accounts
         WHERE account_code = $1 AND (entity_id = $2 OR entity_id IS NULL)
         ORDER BY CASE WHEN entity_id = $2 THEN 0 ELSE 1 END LIMIT 1`,
        [code, eid]
      );
      return r.rows[0] || null;
    }
    const expense = await resolveCode(expenseCode);
    const payable = await resolveCode(payableCode);
    if (!expense || !payable) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'حسابات الرواتب غير موجودة في شجرة الحسابات — اضبط الرموز في الإعدادات',
        code: 'ACCOUNTS_MISSING',
        expense_account_code: expenseCode,
        payable_account_code: payableCode
      });
    }
    if (expense.is_header || payable.is_header) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'لا ترحيل إلى حساب تجميعي', code: 'HEADER_ACCOUNT' });
    }

    const gross = Number(run.rows[0].total_gross);
    const ded = Number(run.rows[0].total_deductions);
    const net = Number(run.rows[0].total_net);
    const entryNumber = `JE-PR-${run.rows[0].run_number}`;
    const entry = await client.query(
      `INSERT INTO finance_journal_entries (
         entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
         status, is_posted, posted_at, posted_by, entity_type, entity_id, fiscal_year, fiscal_period, created_by, created_at, updated_at
       ) VALUES ($1, CURRENT_DATE, 'PAYROLL', $2, $3, 'PAYROLL', $4,
         'POSTED', true, NOW(), $5, $6, $7, $8, $9, $5, NOW(), NOW())
       RETURNING *`,
      [
        entryNumber,
        `قيد مسير رواتب ${run.rows[0].run_number}`,
        run.rows[0].run_number,
        run.rows[0].run_id,
        by,
        run.rows[0].entity_type || 'HQ',
        eid,
        run.rows[0].period_year,
        run.rows[0].period_month
      ]
    );

    const lines = [
      { n: 1, acc: expense, debit: gross, credit: 0, desc: 'مصروف رواتب' },
      { n: 2, acc: payable, debit: 0, credit: net, desc: 'رواتب مستحقة الدفع' }
    ];
    if (ded > 0.001) {
      let dedAcc = dedCode ? await resolveCode(dedCode) : payable;
      if (!dedAcc) dedAcc = payable;
      if (dedAcc.is_header) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: 'حساب الاستقطاعات تجميعي', code: 'HEADER_ACCOUNT' });
      }
      lines[1].credit = net;
      lines.push({ n: 3, acc: dedAcc, debit: 0, credit: ded, desc: 'استقطاعات رواتب' });
      // fix: expense debit = gross; credits = net + ded
      lines[1] = { n: 2, acc: payable, debit: 0, credit: net, desc: 'رواتب مستحقة الدفع' };
    }

    for (const line of lines) {
      await client.query(
        `INSERT INTO finance_journal_lines (
           entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description, entity_type, entity_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [entry.rows[0].entry_id, line.n, line.acc.account_id, line.acc.account_code, line.debit, line.credit, line.desc, 'HQ', eid]
      );
    }

    // Balances come from finance_account_balances VIEW over journal lines — no direct write.

    const updated = await client.query(
      `UPDATE finance_payroll_runs
       SET status = 'POSTED', journal_entry_id = $3, updated_at = NOW(),
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $4::jsonb
       WHERE run_id = $1 AND entity_id = $2 RETURNING *`,
      [req.params.id, eid, entry.rows[0].entry_id, JSON.stringify([audit('post_gl', by, { journal_entry_id: entry.rows[0].entry_id })])]
    );
    await client.query(`UPDATE finance_payroll_items SET status = 'POSTED' WHERE run_id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({
      success: true,
      run: updated.rows[0],
      journal_entry: entry.rows[0],
      message: 'تم إنشاء قيد محاسبي متوازن وربطه بالمسير'
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.get('/runs/:id/export.csv', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const viewAll = require('../services/hr-finance-authz').assertAction(req, 'payroll_view_all');
    if (!viewAll.ok) return res.status(403).json({ success: false, error: 'غير مصرح بتصدير كامل المسير' });
    const items = await db.query(
      `SELECT e.employee_code, e.full_name_ar, i.base_salary, i.allowances, i.incentives, i.overtime_amount,
              i.deductions_amount, i.advances, i.tax_amount, i.insurance_amount, i.gross_amount, i.net_amount, i.status
       FROM finance_payroll_items i
       JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
       JOIN finance_payroll_runs r ON r.run_id = i.run_id
       WHERE i.run_id = $1 AND r.entity_id = $2
       ORDER BY e.full_name_ar`,
      [req.params.id, eid]
    );
    const header = 'employee_code,name,base,allowances,incentives,overtime,deductions,advances,tax,insurance,gross,net,status\n';
    const body = items.rows.map((r) =>
      [r.employee_code, r.full_name_ar, r.base_salary, r.allowances, r.incentives, r.overtime_amount, r.deductions_amount, r.advances, r.tax_amount, r.insurance_amount, r.gross_amount, r.net_amount, r.status]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${req.params.id}.csv"`);
    res.send('\uFEFF' + header + body);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
module.exports.ensureSchema = ensureSchema;
