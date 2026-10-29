'use strict';

/**
 * Finance 360 operational payroll + overtime cycle.
 * Additive schema only. Links: approved overtime → payroll run → balanced JE.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../../db');
const { denyUnless } = require('../services/hr-finance-authz');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');
const { getDocSettings } = require('../services/page-document-settings');
const malika = require('../services/malika-payroll');

const uploadMalika = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || (file.mimetype || '').includes('sheet')) {
      cb(null, true);
    } else {
      cb(new Error('ملف Excel فقط (.xlsx)'));
    }
  }
});

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
    CREATE TABLE IF NOT EXISTS finance_payroll_excluded (
      excluded_id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL REFERENCES finance_payroll_runs(run_id) ON DELETE CASCADE,
      employee_id INTEGER,
      employee_code TEXT NOT NULL,
      full_name_ar TEXT,
      reason TEXT,
      added_by TEXT,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      restored_at TIMESTAMPTZ,
      restored_by TEXT,
      is_active BOOLEAN DEFAULT true,
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
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS nationality TEXT`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS housing_allowance NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS nature_allowance NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS other_allowances NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS default_insurance_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS default_advance_deduction NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS default_other_deductions NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE finance_payroll_employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS base_salary NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS allowances NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS incentives NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS advances NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS nationality TEXT`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS housing_allowance NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS nature_allowance NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS other_allowances NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS advance_deduction NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE finance_payroll_items ADD COLUMN IF NOT EXISTS department_snapshot TEXT`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS payroll_country TEXT`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS currency TEXT`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS reverse_journal_entry_id INTEGER`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS run_type_label TEXT`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS title_override TEXT`,
    `ALTER TABLE finance_payroll_runs ADD COLUMN IF NOT EXISTS source_import TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_finance_payroll_excluded_run ON finance_payroll_excluded(run_id) WHERE COALESCE(is_active,true)=true`
  ];
  for (const sql of alters) {
    await db.query(sql);
  }
  ready = true;
}

function payrollSettingsResolved(raw) {
  const s = raw || {};
  const country = String(s.payroll_country || 'CUSTOM').toUpperCase();
  const preset = malika.countryPreset(country);
  return {
    ...s,
    payroll_country: country,
    currency: s.currency || preset.currency,
    insurance_pct: s.insurance_pct != null ? Number(s.insurance_pct) : preset.insurance_pct,
    tax_pct: s.tax_pct != null ? Number(s.tax_pct) : preset.tax_pct,
    insurance_sign: s.insurance_sign || preset.insurance_sign,
    insurance_base: s.insurance_base || preset.insurance_base,
    bank_file_format: s.bank_file_format || preset.bank_file_format,
    bank_file_note: s.bank_file_note || preset.bank_file_note,
    ot_fold_into: s.ot_fold_into || 'other_allowances',
    run_type_label: s.run_type_label || 'المسير العام',
    payroll_title_template: s.payroll_title_template || 'مسير الرواتب لـ {date} - {run_type}',
    excluded_title_template: s.excluded_title_template || 'الموظفين المستبعدين لـ {date} - {run_type}',
    print_orientation: s.print_orientation || 'landscape',
    country_preset: preset
  };
}

async function refreshRunTotals(clientOrDb, runId, by, extraAudit) {
  const q = clientOrDb.query.bind(clientOrDb);
  const sums = await q(
    `SELECT COALESCE(SUM(gross_amount),0) AS g,
            COALESCE(SUM(deductions_amount),0) AS d,
            COALESCE(SUM(net_amount),0) AS n
     FROM finance_payroll_items WHERE run_id=$1`,
    [runId]
  );
  const auditPayload = extraAudit ? [extraAudit] : [];
  await q(
    `UPDATE finance_payroll_runs
     SET total_gross=$2, total_deductions=$3, total_net=$4, updated_at=NOW()
         ${auditPayload.length ? `, audit_log = COALESCE(audit_log, '[]'::jsonb) || $5::jsonb` : ''}
     WHERE run_id=$1`,
    auditPayload.length
      ? [runId, sums.rows[0].g, sums.rows[0].d, sums.rows[0].n, JSON.stringify(auditPayload)]
      : [runId, sums.rows[0].g, sums.rows[0].d, sums.rows[0].n]
  );
  return sums.rows[0];
}

function mapItemRow(row) {
  return {
    ...row,
    employee_code: malika.cellCode(row.employee_code),
    housing_allowance: malika.n(row.housing_allowance),
    nature_allowance: malika.n(row.nature_allowance),
    transport_allowance: malika.n(row.transport_allowance),
    other_allowances: malika.n(row.other_allowances),
    insurance_amount: malika.n(row.insurance_amount),
    advance_deduction: malika.n(
      row.advance_deduction != null ? row.advance_deduction : (row.advances != null ? -Math.abs(row.advances) : 0)
    ),
    other_deductions: malika.n(row.other_deductions),
    department: row.department_snapshot || row.department || null
  };
}

function salaryFieldsFromBody(b, existing = {}) {
  const pick = (key, fallback = 0) => (b[key] != null ? malika.n(b[key]) : malika.n(existing[key] != null ? existing[key] : fallback));
  let insurance = b.insurance_amount != null ? malika.n(b.insurance_amount)
    : (b.default_insurance_amount != null ? malika.n(b.default_insurance_amount) : malika.n(existing.insurance_amount || existing.default_insurance_amount || 0));
  let advance = b.advance_deduction != null ? malika.n(b.advance_deduction)
    : (b.default_advance_deduction != null ? malika.n(b.default_advance_deduction) : malika.n(existing.advance_deduction || existing.default_advance_deduction || 0));
  let otherDed = b.other_deductions != null ? malika.n(b.other_deductions)
    : (b.default_other_deductions != null ? malika.n(b.default_other_deductions) : malika.n(existing.other_deductions || existing.default_other_deductions || 0));
  if (b.advances != null && b.advance_deduction == null) advance = -Math.abs(malika.n(b.advances));
  return malika.recomputeRow({
    base_salary: pick('base_salary'),
    housing_allowance: pick('housing_allowance'),
    nature_allowance: pick('nature_allowance'),
    transport_allowance: pick('transport_allowance'),
    other_allowances: pick('other_allowances'),
    insurance_amount: insurance,
    advance_deduction: advance,
    other_deductions: otherDed
  }, { forceSignDeductions: true, ot_fold_into: 'detail_only' });
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
    const q = String(req.query.q || '').trim();
    let sql = `
      SELECT employee_id, employee_code, full_name_ar, full_name_en, base_salary, department, nationality,
             housing_allowance, nature_allowance, transport_allowance, other_allowances,
             default_insurance_amount, default_advance_deduction, default_other_deductions, is_active
      FROM finance_payroll_employees
      WHERE (entity_id = $1 OR entity_id IS NULL) AND COALESCE(is_active, true) = true`;
    const params = [eid];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (employee_code ILIKE $2 OR full_name_ar ILIKE $2 OR department ILIKE $2)`;
    }
    sql += ` ORDER BY full_name_ar NULLS LAST, employee_id`;
    const r = await db.query(sql, params);
    res.json({
      success: true,
      employees: r.rows.map((e) => ({ ...e, employee_code: malika.cellCode(e.employee_code) })),
      columns: malika.MALIKA_COLUMNS
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/employees/:id', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const r = await db.query(
      `SELECT * FROM finance_payroll_employees
       WHERE employee_id = $1 AND (entity_id = $2 OR entity_id IS NULL)`,
      [req.params.id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    const emp = r.rows[0];
    const computed = salaryFieldsFromBody({
      base_salary: emp.base_salary,
      housing_allowance: emp.housing_allowance,
      nature_allowance: emp.nature_allowance,
      transport_allowance: emp.transport_allowance,
      other_allowances: emp.other_allowances,
      insurance_amount: emp.default_insurance_amount,
      advance_deduction: emp.default_advance_deduction,
      other_deductions: emp.default_other_deductions
    });
    res.json({
      success: true,
      employee: { ...emp, employee_code: malika.cellCode(emp.employee_code) },
      computed
    });
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
    const by = actorLabel(req);
    if (!String(b.full_name_ar || '').trim()) {
      return res.status(400).json({ success: false, error: 'اسم الموظف إلزامي' });
    }
    if (!String(b.employee_code || '').trim()) {
      return res.status(400).json({ success: false, error: 'الرقم الوظيفي إلزامي' });
    }
    const code = malika.cellCode(b.employee_code).trim();
    const dup = await db.query(
      `SELECT employee_id FROM finance_payroll_employees
       WHERE employee_code = $1 AND (entity_id = $2 OR entity_id IS NULL) LIMIT 1`,
      [code, eid]
    );
    if (dup.rows[0]) {
      return res.status(409).json({ success: false, error: 'الرقم الوظيفي مكرر', code: 'DUPLICATE_CODE', employee_id: dup.rows[0].employee_id });
    }
    const computed = salaryFieldsFromBody(b);
    const ins = await db.query(
      `INSERT INTO finance_payroll_employees (
         employee_code, full_name_ar, full_name_en, base_salary, department, nationality,
         housing_allowance, nature_allowance, transport_allowance, other_allowances,
         default_insurance_amount, default_advance_deduction, default_other_deductions,
         entity_id, entity_type, is_active, audit_log
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,$16::jsonb)
       RETURNING *`,
      [
        code,
        String(b.full_name_ar).trim(),
        b.full_name_en || null,
        computed.base_salary,
        b.department || null,
        b.nationality || null,
        computed.housing_allowance,
        computed.nature_allowance,
        computed.transport_allowance,
        computed.other_allowances,
        computed.insurance_amount,
        computed.advance_deduction,
        computed.other_deductions,
        eid,
        etype,
        JSON.stringify([audit('employee_create', by)])
      ]
    );
    res.status(201).json({ success: true, employee: ins.rows[0], computed });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/employees/:id', async (req, res) => {
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    const b = req.body || {};
    const eid = entityOf(req, b);
    const by = actorLabel(req);
    const existing = await db.query(
      `SELECT * FROM finance_payroll_employees
       WHERE employee_id = $1 AND (entity_id = $2 OR entity_id IS NULL)`,
      [req.params.id, eid]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    const ex = existing.rows[0];
    let code = malika.cellCode(b.employee_code != null ? b.employee_code : ex.employee_code).trim();
    if (code !== malika.cellCode(ex.employee_code)) {
      const dup = await db.query(
        `SELECT employee_id FROM finance_payroll_employees
         WHERE employee_code = $1 AND (entity_id = $2 OR entity_id IS NULL) AND employee_id <> $3 LIMIT 1`,
        [code, eid, req.params.id]
      );
      if (dup.rows[0]) {
        return res.status(409).json({ success: false, error: 'الرقم الوظيفي مكرر', code: 'DUPLICATE_CODE' });
      }
    }
    const computed = salaryFieldsFromBody(b, {
      base_salary: ex.base_salary,
      housing_allowance: ex.housing_allowance,
      nature_allowance: ex.nature_allowance,
      transport_allowance: ex.transport_allowance,
      other_allowances: ex.other_allowances,
      default_insurance_amount: ex.default_insurance_amount,
      default_advance_deduction: ex.default_advance_deduction,
      default_other_deductions: ex.default_other_deductions
    });
    const updated = await db.query(
      `UPDATE finance_payroll_employees SET
         employee_code=$3, full_name_ar=COALESCE($4, full_name_ar), full_name_en=COALESCE($5, full_name_en),
         base_salary=$6, department=COALESCE($7, department), nationality=COALESCE($8, nationality),
         housing_allowance=$9, nature_allowance=$10, transport_allowance=$11, other_allowances=$12,
         default_insurance_amount=$13, default_advance_deduction=$14, default_other_deductions=$15,
         updated_at=NOW(),
         audit_log = COALESCE(audit_log, '[]'::jsonb) || $16::jsonb
       WHERE employee_id=$1 AND (entity_id = $2 OR entity_id IS NULL)
       RETURNING *`,
      [
        req.params.id, eid, code,
        b.full_name_ar != null ? String(b.full_name_ar).trim() : null,
        b.full_name_en != null ? b.full_name_en : null,
        computed.base_salary,
        b.department != null ? b.department : null,
        b.nationality != null ? b.nationality : null,
        computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
        computed.insurance_amount, computed.advance_deduction, computed.other_deductions,
        JSON.stringify([audit('employee_update', by, { computed })])
      ]
    );
    res.json({ success: true, employee: updated.rows[0], computed });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/malika/columns', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    res.json({
      success: true,
      columns: malika.MALIKA_COLUMNS,
      excluded_columns: malika.EXCLUDED_COLUMNS,
      country_presets: malika.COUNTRY_PRESETS,
      settings
    });
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
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    if (settings.export_excel === false || settings.show_btn_excel === false) {
      return res.status(403).json({ success: false, error: 'تصدير Excel معطّل من إعدادات الصفحة' });
    }
    const eid = entityOf(req);
    const run = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    const items = await db.query(
      `SELECT i.*, e.employee_code, e.full_name_ar,
              COALESCE(i.department_snapshot, e.department) AS department,
              COALESCE(i.nationality, e.nationality) AS nationality
       FROM finance_payroll_items i
       JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
       WHERE i.run_id = $1
       ORDER BY e.full_name_ar`,
      [req.params.id]
    );
    const excluded = await db.query(
      `SELECT employee_code, full_name_ar, reason, added_by
       FROM finance_payroll_excluded
       WHERE run_id = $1 AND COALESCE(is_active, true) = true
       ORDER BY excluded_id`,
      [req.params.id]
    );
    const title = run.rows[0].title_override || malika.formatRunTitle(settings, run.rows[0]);
    const excludedTitle = malika.formatExcludedTitle(settings, run.rows[0]);
    const buf = await malika.buildMalikaWorkbook({
      title,
      excludedTitle,
      items: items.rows.map((row) => malika.toMalikaExportRow(mapItemRow(row))),
      excluded: excluded.rows,
      settings
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${req.params.id}.xlsx"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/runs/:id/export.pdf', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const viewAll = require('../services/hr-finance-authz').assertAction(req, 'payroll_view_all');
    if (!viewAll.ok) return res.status(403).json({ success: false, error: 'غير مصرح بتصدير كامل المسير' });
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    if (settings.export_pdf === false) {
      return res.status(403).json({ success: false, error: 'تصدير PDF معطّل من إعدادات الصفحة' });
    }
    const eid = entityOf(req);
    const run = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    const items = await db.query(
      `SELECT i.*, e.employee_code, e.full_name_ar,
              COALESCE(i.department_snapshot, e.department) AS department,
              COALESCE(i.nationality, e.nationality) AS nationality
       FROM finance_payroll_items i
       JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
       WHERE i.run_id = $1
       ORDER BY e.full_name_ar`,
      [req.params.id]
    );
    const excluded = await db.query(
      `SELECT employee_code, full_name_ar, reason, added_by
       FROM finance_payroll_excluded WHERE run_id = $1 AND COALESCE(is_active,true)=true ORDER BY excluded_id`,
      [req.params.id]
    );
    const title = run.rows[0].title_override || malika.formatRunTitle(settings, run.rows[0]);
    const pdf = await malika.buildLandscapePayrollPdf({
      title,
      items: items.rows.map((row) => malika.toMalikaExportRow(mapItemRow(row))),
      excluded: excluded.rows,
      footer: settings.print_footer || ''
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${req.params.id}.pdf"`);
    res.send(pdf);
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
      columns: malika.MALIKA_COLUMNS,
      settings: payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || null)
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
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    const runType = b.run_type_label || settings.run_type_label || 'المسير العام';
    const prefix = settings.number_prefix || 'PR';
    const runNumber = `${prefix}-${year}${String(month).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
    const runIns = await client.query(
      `INSERT INTO finance_payroll_runs (
         run_number, period_year, period_month, run_date, status, entity_id, entity_type, department,
         created_by, audit_log, run_type_label, title_override, payroll_country, currency, source_import
       ) VALUES ($1,$2,$3,COALESCE($9::date, CURRENT_DATE),'DRAFT',$4,$5,$6,$7,$8::jsonb,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        runNumber, year, month, eid, etype, b.department || null, by,
        JSON.stringify([audit('generate', by, { model: 'native', seed_empty: !!b.seed_empty })]),
        b.run_date || null, runType, b.title_override || null,
        b.payroll_country || settings.payroll_country || 'SA',
        b.currency || settings.currency || 'SAR',
        b.seed_empty ? 'native-empty' : 'native'
      ]
    );
    const run = runIns.rows[0];

    let emps = { rows: [] };
    if (!b.seed_empty) {
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
      emps = await client.query(empSql, empParams);
    }

    const linkedOt = [];
    const applyInsPct = b.skip_auto_insurance ? 0 : settings.insurance_pct;

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
      const housing = malika.n(emp.housing_allowance);
      const nature = malika.n(emp.nature_allowance);
      const transport = malika.n(
        emp.transport_allowance != null && emp.transport_allowance !== ''
          ? emp.transport_allowance
          : (b.default_allowances || settings.default_allowances || 0)
      );
      let other = malika.n(emp.other_allowances) + malika.n(b.default_incentives || 0);
      const baseRow = {
        base_salary: malika.n(emp.base_salary),
        housing_allowance: housing,
        nature_allowance: nature,
        transport_allowance: transport,
        other_allowances: other,
        insurance_amount: emp.default_insurance_amount != null ? malika.n(emp.default_insurance_amount) : null,
        advance_deduction: emp.default_advance_deduction != null
          ? malika.n(emp.default_advance_deduction)
          : (b.default_advances ? -Math.abs(malika.n(b.default_advances)) : 0),
        other_deductions: malika.n(emp.default_other_deductions)
      };
      const computed = malika.recomputeRow(baseRow, {
        overtime_amount: overtimeAmount,
        ot_fold_into: settings.ot_fold_into,
        applyInsurancePct: baseRow.insurance_amount == null || baseRow.insurance_amount === 0 ? applyInsPct : 0,
        forceInsurance: false,
        forceSignDeductions: true,
        insurance_sign: settings.insurance_sign,
        insurance_base: settings.insurance_base
      });

      await client.query(
        `INSERT INTO finance_payroll_items (
           run_id, employee_id, gross_amount, deductions_amount, net_amount, status, notes,
           base_salary, allowances, incentives, overtime_amount, advances, tax_amount, insurance_amount,
           housing_allowance, nature_allowance, transport_allowance, other_allowances, advance_deduction,
           other_deductions, nationality, department_snapshot, audit_log
         ) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb)`,
        [
          run.run_id, emp.employee_id, computed.gross_amount, computed.deductions_amount, computed.net_amount,
          `OT:${ot.rows.map((x) => x.overtime_id).join(',') || 'none'}`,
          computed.base_salary, computed.allowances, malika.n(b.default_incentives || 0), overtimeAmount,
          computed.advances, 0, computed.insurance_amount,
          computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
          computed.advance_deduction, computed.other_deductions, emp.nationality || null, emp.department || null,
          JSON.stringify([audit('item_create', by, { model: 'native' })])
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

    await refreshRunTotals(client, run.run_id, by);
    const updated = await client.query(`SELECT * FROM finance_payroll_runs WHERE run_id = $1`, [run.run_id]);
    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      run: updated.rows[0],
      employees: emps.rows.length,
      overtime_linked: linkedOt.length,
      title: updated.rows[0].title_override || malika.formatRunTitle(settings, updated.rows[0]),
      message: b.seed_empty
        ? 'أُنشئ مسير فارغ — أضف الموظفين من النموذج'
        : 'أُنشئ مسير الرواتب وربط الساعات المعتمدة مرة واحدة'
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

/** Add / upsert a salary line into a DRAFT run (native ERP flow). */
router.post('/runs/:id/items', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    const b = req.body || {};
    const eid = entityOf(req, b);
    const etype = entityTypeOf(req, b);
    const by = actorLabel(req);
    await client.query('BEGIN');
    const run = await client.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    }
    if (String(run.rows[0].status).toUpperCase() !== 'DRAFT') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'إضافة البنود للمسودة فقط', code: 'LOCKED' });
    }

    let empId = b.employee_id ? Number(b.employee_id) : null;
    if (!empId && b.employee_code) {
      const found = await client.query(
        `SELECT * FROM finance_payroll_employees
         WHERE employee_code = $1 AND (entity_id = $2 OR entity_id IS NULL) LIMIT 1`,
        [malika.cellCode(b.employee_code), eid]
      );
      if (found.rows[0]) empId = found.rows[0].employee_id;
    }
    if (!empId) {
      if (!String(b.full_name_ar || '').trim() || !String(b.employee_code || '').trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'الرقم الوظيفي واسم الموظف إلزاميان لموظف جديد' });
      }
      const code = malika.cellCode(b.employee_code).trim();
      const dup = await client.query(
        `SELECT employee_id FROM finance_payroll_employees
         WHERE employee_code = $1 AND (entity_id = $2 OR entity_id IS NULL) LIMIT 1`,
        [code, eid]
      );
      if (dup.rows[0]) {
        empId = dup.rows[0].employee_id;
      } else {
        const computedEmp = salaryFieldsFromBody(b);
        const created = await client.query(
          `INSERT INTO finance_payroll_employees (
             employee_code, full_name_ar, base_salary, department, nationality,
             housing_allowance, nature_allowance, transport_allowance, other_allowances,
             default_insurance_amount, default_advance_deduction, default_other_deductions,
             entity_id, entity_type, is_active, audit_log
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,$15::jsonb)
           RETURNING employee_id`,
          [
            code, String(b.full_name_ar).trim(), computedEmp.base_salary, b.department || null, b.nationality || null,
            computedEmp.housing_allowance, computedEmp.nature_allowance, computedEmp.transport_allowance, computedEmp.other_allowances,
            computedEmp.insurance_amount, computedEmp.advance_deduction, computedEmp.other_deductions,
            eid, etype, JSON.stringify([audit('employee_create_via_run', by)])
          ]
        );
        empId = created.rows[0].employee_id;
      }
    }

    const emp = await client.query(`SELECT * FROM finance_payroll_employees WHERE employee_id = $1`, [empId]);
    if (!emp.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الموظف غير موجود' });
    }

    const existingItem = await client.query(
      `SELECT item_id FROM finance_payroll_items WHERE run_id = $1 AND employee_id = $2`,
      [req.params.id, empId]
    );
    if (existingItem.rows[0] && !b.replace) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'الموظف موجود بالفعل في المسير',
        code: 'DUPLICATE_ITEM',
        item_id: existingItem.rows[0].item_id
      });
    }

    const computed = salaryFieldsFromBody(b, {
      base_salary: emp.rows[0].base_salary,
      housing_allowance: emp.rows[0].housing_allowance,
      nature_allowance: emp.rows[0].nature_allowance,
      transport_allowance: emp.rows[0].transport_allowance,
      other_allowances: emp.rows[0].other_allowances,
      default_insurance_amount: emp.rows[0].default_insurance_amount,
      default_advance_deduction: emp.rows[0].default_advance_deduction,
      default_other_deductions: emp.rows[0].default_other_deductions
    });

    // Sync master salary card when provided from form
    if (b.sync_employee !== false) {
      await client.query(
        `UPDATE finance_payroll_employees SET
           full_name_ar = COALESCE($2, full_name_ar),
           base_salary=$3, department=COALESCE($4, department), nationality=COALESCE($5, nationality),
           housing_allowance=$6, nature_allowance=$7, transport_allowance=$8, other_allowances=$9,
           default_insurance_amount=$10, default_advance_deduction=$11, default_other_deductions=$12,
           updated_at=NOW()
         WHERE employee_id=$1`,
        [
          empId,
          b.full_name_ar != null ? String(b.full_name_ar).trim() : null,
          computed.base_salary, b.department != null ? b.department : null, b.nationality != null ? b.nationality : null,
          computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
          computed.insurance_amount, computed.advance_deduction, computed.other_deductions
        ]
      );
    }

    let item;
    if (existingItem.rows[0] && b.replace) {
      item = await client.query(
        `UPDATE finance_payroll_items SET
           gross_amount=$3, deductions_amount=$4, net_amount=$5, status='DRAFT',
           base_salary=$6, allowances=$7, advances=$8, insurance_amount=$9,
           housing_allowance=$10, nature_allowance=$11, transport_allowance=$12, other_allowances=$13,
           advance_deduction=$14, other_deductions=$15,
           nationality=COALESCE($16, nationality), department_snapshot=COALESCE($17, department_snapshot),
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $18::jsonb
         WHERE item_id=$1 AND run_id=$2 RETURNING *`,
        [
          existingItem.rows[0].item_id, req.params.id,
          computed.gross_amount, computed.deductions_amount, computed.net_amount,
          computed.base_salary, computed.allowances, computed.advances, computed.insurance_amount,
          computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
          computed.advance_deduction, computed.other_deductions,
          b.nationality || emp.rows[0].nationality, b.department || emp.rows[0].department,
          JSON.stringify([audit('item_replace', by)])
        ]
      );
    } else {
      item = await client.query(
        `INSERT INTO finance_payroll_items (
           run_id, employee_id, gross_amount, deductions_amount, net_amount, status, notes,
           base_salary, allowances, overtime_amount, advances, insurance_amount,
           housing_allowance, nature_allowance, transport_allowance, other_allowances,
           advance_deduction, other_deductions, nationality, department_snapshot, audit_log
         ) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,0,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)
         RETURNING *`,
        [
          req.params.id, empId, computed.gross_amount, computed.deductions_amount, computed.net_amount,
          'native_form',
          computed.base_salary, computed.allowances, computed.advances, computed.insurance_amount,
          computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
          computed.advance_deduction, computed.other_deductions,
          b.nationality || emp.rows[0].nationality, b.department || emp.rows[0].department,
          JSON.stringify([audit('item_add', by)])
        ]
      );
    }

    await refreshRunTotals(client, req.params.id, by, audit('recalc_after_item_add', by, { employee_id: empId }));
    await client.query('COMMIT');
    const withCode = await db.query(
      `SELECT i.*, e.employee_code, e.full_name_ar,
              COALESCE(i.department_snapshot, e.department) AS department,
              COALESCE(i.nationality, e.nationality) AS nationality
       FROM finance_payroll_items i
       JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
       WHERE i.item_id = $1`,
      [item.rows[0].item_id]
    );
    res.status(201).json({ success: true, item: mapItemRow(withCode.rows[0]), computed });
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
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    const run = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    const viewAll = require('../services/hr-finance-authz').assertAction(req, 'payroll_view_all');
    let itemsSql = `
      SELECT i.*, e.employee_code, e.full_name_ar, e.full_name_en,
             COALESCE(i.department_snapshot, e.department) AS department,
             COALESCE(i.nationality, e.nationality) AS nationality
      FROM finance_payroll_items i
      JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
      WHERE i.run_id = $1`;
    const params = [req.params.id];
    if (!viewAll.ok && req.authUser?.email) {
      itemsSql += ` AND 1=0`;
    }
    const items = await db.query(itemsSql + ` ORDER BY e.full_name_ar`, params);
    let rows = items.rows;
    if (!viewAll.ok) {
      const code = req.headers['x-employee-code'] || req.authUser?.employee_code;
      if (code) {
        const all = await db.query(
          `SELECT i.*, e.employee_code, e.full_name_ar, e.full_name_en,
                  COALESCE(i.department_snapshot, e.department) AS department,
                  COALESCE(i.nationality, e.nationality) AS nationality
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
    const excluded = viewAll.ok
      ? await db.query(
        `SELECT * FROM finance_payroll_excluded
         WHERE run_id = $1 AND COALESCE(is_active,true)=true
         ORDER BY excluded_id`,
        [req.params.id]
      )
      : { rows: [] };
    const mapped = rows.map(mapItemRow);
    const totals = {
      base_salary: malika.round2(mapped.reduce((s, r) => s + malika.n(r.base_salary), 0)),
      housing_allowance: malika.round2(mapped.reduce((s, r) => s + malika.n(r.housing_allowance), 0)),
      nature_allowance: malika.round2(mapped.reduce((s, r) => s + malika.n(r.nature_allowance), 0)),
      transport_allowance: malika.round2(mapped.reduce((s, r) => s + malika.n(r.transport_allowance), 0)),
      other_allowances: malika.round2(mapped.reduce((s, r) => s + malika.n(r.other_allowances), 0)),
      gross_amount: malika.round2(mapped.reduce((s, r) => s + malika.n(r.gross_amount), 0)),
      insurance_amount: malika.round2(mapped.reduce((s, r) => s + malika.n(r.insurance_amount), 0)),
      advance_deduction: malika.round2(mapped.reduce((s, r) => s + malika.n(r.advance_deduction), 0)),
      other_deductions: malika.round2(mapped.reduce((s, r) => s + malika.n(r.other_deductions), 0)),
      net_amount: malika.round2(mapped.reduce((s, r) => s + malika.n(r.net_amount), 0))
    };
    res.json({
      success: true,
      run: run.rows[0],
      items: mapped,
      excluded: excluded.rows.map((ex) => ({ ...ex, employee_code: malika.cellCode(ex.employee_code) })),
      columns: malika.MALIKA_COLUMNS,
      excluded_columns: malika.EXCLUDED_COLUMNS,
      totals,
      title: run.rows[0].title_override || malika.formatRunTitle(settings, run.rows[0]),
      excluded_title: malika.formatExcludedTitle(settings, run.rows[0]),
      settings,
      can_view_all: viewAll.ok
    });
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

router.delete('/runs/:id/items/:itemId', async (req, res) => {
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body || {});
    const by = actorLabel(req);
    const run = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    if (String(run.rows[0].status).toUpperCase() !== 'DRAFT') {
      return res.status(409).json({
        success: false,
        error: 'حذف البنود مسموح للمسودة فقط',
        code: 'LOCKED'
      });
    }
    const deleted = await db.query(
      `DELETE FROM finance_payroll_items WHERE item_id = $1 AND run_id = $2 RETURNING item_id, employee_id`,
      [req.params.itemId, req.params.id]
    );
    if (!deleted.rows[0]) return res.status(404).json({ success: false, error: 'البند غير موجود' });
    await db.query(
      `UPDATE finance_payroll_runs SET audit_log = COALESCE(audit_log,'[]'::jsonb) || $2::jsonb, updated_at=NOW()
       WHERE run_id=$1`,
      [req.params.id, JSON.stringify([audit('item_delete', by, { item_id: Number(req.params.itemId) })])]
    );
    await refreshRunTotals(db, req.params.id, by, audit('recalc_after_item_delete', by, { item_id: Number(req.params.itemId) }));
    res.json({ success: true, deleted: deleted.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/runs/:id/items/:itemId', async (req, res) => {
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const by = actorLabel(req);
    const b = req.body || {};
    const run = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    if (String(run.rows[0].status).toUpperCase() !== 'DRAFT') {
      return res.status(409).json({
        success: false,
        error: 'تعديل البنود مسموح للمسودة فقط — بعد الاعتماد يلزم إجراء تصحيحي موثق',
        code: 'LOCKED'
      });
    }
    const existing = await db.query(
      `SELECT * FROM finance_payroll_items WHERE item_id = $1 AND run_id = $2`,
      [req.params.itemId, req.params.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'البند غير موجود' });
    const ex = existing.rows[0];
    const overtimeAmount = b.overtime_amount != null ? malika.n(b.overtime_amount) : malika.n(ex.overtime_amount);
    const computed = salaryFieldsFromBody(b, ex);
    computed.overtime_amount = overtimeAmount;
    const nationality = b.nationality != null ? String(b.nationality) : ex.nationality;
    const departmentSnapshot = b.department != null ? String(b.department) : ex.department_snapshot;
    const updated = await db.query(
      `UPDATE finance_payroll_items SET
         base_salary=$3, allowances=$4, incentives=COALESCE($5, incentives), overtime_amount=$6, advances=$7,
         tax_amount=COALESCE($8, tax_amount), insurance_amount=$9, gross_amount=$10, deductions_amount=$11, net_amount=$12,
         housing_allowance=$13, nature_allowance=$14, transport_allowance=$15, other_allowances=$16,
         advance_deduction=$17, other_deductions=$18,
         nationality=COALESCE($19, nationality), department_snapshot=COALESCE($20, department_snapshot),
         notes=COALESCE($21, notes),
         audit_log = COALESCE(audit_log, '[]'::jsonb) || $22::jsonb
       WHERE item_id=$1 AND run_id=$2 RETURNING *`,
      [
        req.params.itemId, req.params.id,
        computed.base_salary, computed.allowances, b.incentives != null ? malika.n(b.incentives) : null,
        overtimeAmount, computed.advances,
        b.tax_amount != null ? malika.n(b.tax_amount) : null,
        computed.insurance_amount, computed.gross_amount, computed.deductions_amount, computed.net_amount,
        computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
        computed.advance_deduction, computed.other_deductions, nationality, departmentSnapshot,
        b.notes != null ? String(b.notes) : null,
        JSON.stringify([audit('item_update', by, { model: 'native' })])
      ]
    );
    if (b.sync_employee !== false && ex.employee_id) {
      await db.query(
        `UPDATE finance_payroll_employees SET
           base_salary=$2, housing_allowance=$3, nature_allowance=$4, transport_allowance=$5, other_allowances=$6,
           default_insurance_amount=$7, default_advance_deduction=$8, default_other_deductions=$9,
           department=COALESCE($10, department), nationality=COALESCE($11, nationality), updated_at=NOW()
         WHERE employee_id=$1`,
        [
          ex.employee_id, computed.base_salary, computed.housing_allowance, computed.nature_allowance,
          computed.transport_allowance, computed.other_allowances, computed.insurance_amount,
          computed.advance_deduction, computed.other_deductions, departmentSnapshot, nationality
        ]
      );
    }
    await refreshRunTotals(db, req.params.id, by, audit('recalc_after_item_edit', by, { item_id: Number(req.params.itemId) }));
    res.json({ success: true, item: mapItemRow(updated.rows[0]), computed });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/runs/:id/payslip/:itemId.pdf', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const viewAll = require('../services/hr-finance-authz').assertAction(req, 'payroll_view_all');
    const settings = (await getDocSettings('payroll-runs').catch(() => null))?.value || {};
    if (settings.export_pdf === false) {
      return res.status(403).json({ success: false, error: 'تصدير PDF معطّل من إعدادات الصفحة' });
    }
    const item = await db.query(
      `SELECT i.*, e.employee_code, e.full_name_ar, r.run_number, r.period_year, r.period_month, r.entity_id
       FROM finance_payroll_items i
       JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
       JOIN finance_payroll_runs r ON r.run_id = i.run_id
       WHERE i.item_id = $1 AND i.run_id = $2 AND r.entity_id = $3`,
      [req.params.itemId, req.params.id, eid]
    );
    if (!item.rows[0]) return res.status(404).json({ success: false, error: 'القسيمة غير موجودة' });
    if (!viewAll.ok) {
      const code = req.headers['x-employee-code'] || req.authUser?.employee_code;
      if (!code || String(code) !== String(item.rows[0].employee_code)) {
        return res.status(403).json({ success: false, error: 'غير مصرح بعرض قسيمة موظف آخر' });
      }
    }
    const row = mapItemRow(item.rows[0]);
    const pdf = await malika.buildLandscapePayrollPdf({
      title: `قسيمة راتب — ${row.employee_code} ${row.full_name_ar} — ${row.run_number || ''}`,
      items: [malika.toMalikaExportRow(row)],
      excluded: [],
      footer: settings.print_footer || ''
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${row.employee_code}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

function buildSimplePdf(lines) {
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const contentLines = ['BT', '/F1 11 Tf', '50 780 Td'];
  lines.forEach((line, idx) => {
    if (idx === 0) contentLines.push(`(${esc(line)}) Tj`);
    else contentLines.push(`0 -16 Td (${esc(line)}) Tj`);
  });
  contentLines.push('ET');
  const stream = contentLines.join('\n');
  const objs = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objs.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n');
  objs.push(`4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`);
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((o) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += o;
  });
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

router.get('/overtime/export.pdf', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureSchema();
    const settings = (await getDocSettings('overtime').catch(() => null))?.value || {};
    if (settings.export_pdf === false) {
      return res.status(403).json({ success: false, error: 'تصدير PDF معطّل من إعدادات الصفحة' });
    }
    const eid = entityOf(req);
    const r = await db.query(
      `SELECT o.request_number, e.employee_code, e.full_name_ar, o.work_date, o.hours, o.amount, o.status
       FROM finance_payroll_overtime o
       JOIN finance_payroll_employees e ON e.employee_id = o.employee_id
       WHERE o.entity_id = $1 ORDER BY o.overtime_id DESC LIMIT 200`,
      [eid]
    );
    const lines = [
      settings.page_title || 'Overtime Report',
      `Generated: ${new Date().toISOString()}`,
      ...r.rows.map((row) => `${row.request_number} | ${row.employee_code} | ${row.full_name_ar} | ${row.work_date} | ${row.hours}h | ${row.amount} | ${row.status}`),
      settings.print_footer || ''
    ].filter(Boolean);
    const pdf = buildSimplePdf(lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="overtime.pdf"');
    res.send(pdf);
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
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    if (settings.export_csv === false) {
      return res.status(403).json({ success: false, error: 'تصدير CSV معطّل من إعدادات الصفحة' });
    }
    const items = await db.query(
      `SELECT e.employee_code, e.full_name_ar,
              COALESCE(i.department_snapshot, e.department) AS department,
              COALESCE(i.nationality, e.nationality) AS nationality,
              i.base_salary, i.housing_allowance, i.nature_allowance, i.transport_allowance, i.other_allowances,
              i.gross_amount, i.insurance_amount, i.advance_deduction, i.net_amount, i.status, i.overtime_amount
       FROM finance_payroll_items i
       JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
       JOIN finance_payroll_runs r ON r.run_id = i.run_id
       WHERE i.run_id = $1 AND r.entity_id = $2
       ORDER BY e.full_name_ar`,
      [req.params.id, eid]
    );
    const header = malika.MALIKA_COLUMNS.map((c) => c.header.trim()).join(',') + ',overtime_detail,status\n';
    const body = items.rows.map((r) => {
      const mapped = mapItemRow(r);
      return [
        ...malika.MALIKA_COLUMNS.map((c) => mapped[c.key]),
        r.overtime_amount,
        r.status
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    }).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-run-${req.params.id}.csv"`);
    res.send('\uFEFF' + header + body);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/runs/:id/exclude', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const by = actorLabel(req);
    const b = req.body || {};
    const reason = String(b.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, error: 'سبب الاستبعاد إلزامي' });
    await client.query('BEGIN');
    const run = await client.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    }
    if (String(run.rows[0].status).toUpperCase() !== 'DRAFT') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'الاستبعاد للمسودة فقط', code: 'LOCKED' });
    }
    let item;
    if (b.item_id) {
      item = await client.query(
        `SELECT i.*, e.employee_code, e.full_name_ar
         FROM finance_payroll_items i
         JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
         WHERE i.item_id = $1 AND i.run_id = $2`,
        [b.item_id, req.params.id]
      );
    } else if (b.employee_code) {
      item = await client.query(
        `SELECT i.*, e.employee_code, e.full_name_ar
         FROM finance_payroll_items i
         JOIN finance_payroll_employees e ON e.employee_id = i.employee_id
         WHERE i.run_id = $1 AND e.employee_code = $2`,
        [req.params.id, malika.cellCode(b.employee_code)]
      );
    }
    if (!item?.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'بند الموظف غير موجود في المسير' });
    }
    const row = item.rows[0];
    const ins = await client.query(
      `INSERT INTO finance_payroll_excluded (
         run_id, employee_id, employee_code, full_name_ar, reason, added_by, audit_log
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
      [
        req.params.id, row.employee_id, malika.cellCode(row.employee_code), row.full_name_ar, reason, by,
        JSON.stringify([audit('exclude', by, { reason, item_id: row.item_id })])
      ]
    );
    await client.query(`DELETE FROM finance_payroll_items WHERE item_id = $1`, [row.item_id]);
    await refreshRunTotals(client, req.params.id, by, audit('exclude_recalc', by, { excluded_id: ins.rows[0].excluded_id }));
    await client.query(
      `UPDATE finance_payroll_runs
       SET audit_log = COALESCE(audit_log, '[]'::jsonb) || $2::jsonb
       WHERE run_id = $1`,
      [req.params.id, JSON.stringify([audit('exclude_employee', by, { employee_code: row.employee_code, reason })])]
    );
    await client.query('COMMIT');
    res.json({ success: true, excluded: ins.rows[0], message: 'استُبعد الموظف من المسير' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.put('/runs/:id/excluded/:excludedId', async (req, res) => {
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const by = actorLabel(req);
    const b = req.body || {};
    const run = await db.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    if (String(run.rows[0].status).toUpperCase() !== 'DRAFT') {
      return res.status(409).json({ success: false, error: 'تعديل المستبعدين للمسودة فقط', code: 'LOCKED' });
    }
    const reason = b.reason != null ? String(b.reason).trim() : null;
    if (reason != null && !reason) return res.status(400).json({ success: false, error: 'سبب الاستبعاد لا يكون فارغًا' });
    const updated = await db.query(
      `UPDATE finance_payroll_excluded
       SET reason = COALESCE($3, reason),
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $4::jsonb
       WHERE excluded_id = $1 AND run_id = $2 AND COALESCE(is_active,true)=true
       RETURNING *`,
      [req.params.excludedId, req.params.id, reason, JSON.stringify([audit('excluded_reason_update', by, { reason })])]
    );
    if (!updated.rows[0]) return res.status(404).json({ success: false, error: 'سجل الاستبعاد غير موجود' });
    res.json({ success: true, excluded: updated.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/runs/:id/excluded/:excludedId/restore', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'payroll_approve')) return;
    await ensureSchema();
    const eid = entityOf(req, req.body);
    const by = actorLabel(req);
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    await client.query('BEGIN');
    const run = await client.query(
      `SELECT * FROM finance_payroll_runs WHERE run_id = $1 AND entity_id = $2 FOR UPDATE`,
      [req.params.id, eid]
    );
    if (!run.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'المسير غير موجود' });
    }
    if (String(run.rows[0].status).toUpperCase() !== 'DRAFT') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'إعادة الإدراج للمسودة فقط', code: 'LOCKED' });
    }
    const ex = await client.query(
      `SELECT * FROM finance_payroll_excluded
       WHERE excluded_id = $1 AND run_id = $2 AND COALESCE(is_active,true)=true FOR UPDATE`,
      [req.params.excludedId, req.params.id]
    );
    if (!ex.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'سجل الاستبعاد غير موجود' });
    }
    const emp = await client.query(
      `SELECT * FROM finance_payroll_employees
       WHERE (employee_id = $1 OR employee_code = $2)
         AND (entity_id = $3 OR entity_id IS NULL)
       ORDER BY CASE WHEN employee_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [ex.rows[0].employee_id, ex.rows[0].employee_code, eid]
    );
    if (!emp.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الموظف غير موجود لإعادته' });
    }
    const e = emp.rows[0];
    const computed = malika.recomputeRow({
      base_salary: e.base_salary,
      housing_allowance: e.housing_allowance,
      nature_allowance: e.nature_allowance,
      transport_allowance: e.transport_allowance,
      other_allowances: e.other_allowances,
      insurance_amount: e.default_insurance_amount,
      advance_deduction: e.default_advance_deduction
    }, {
      applyInsurancePct: !e.default_insurance_amount ? settings.insurance_pct : 0,
      insurance_sign: settings.insurance_sign,
      insurance_base: settings.insurance_base,
      ot_fold_into: 'detail_only'
    });
    const item = await client.query(
      `INSERT INTO finance_payroll_items (
         run_id, employee_id, gross_amount, deductions_amount, net_amount, status, notes,
         base_salary, allowances, overtime_amount, advances, insurance_amount,
         housing_allowance, nature_allowance, transport_allowance, other_allowances, advance_deduction,
         nationality, department_snapshot, audit_log
       ) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,0,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
       RETURNING *`,
      [
        req.params.id, e.employee_id, computed.gross_amount, computed.deductions_amount, computed.net_amount,
        'restored_from_excluded',
        computed.base_salary, computed.allowances, computed.advances, computed.insurance_amount,
        computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
        computed.advance_deduction, e.nationality, e.department,
        JSON.stringify([audit('restore_to_run', by, { excluded_id: Number(req.params.excludedId) })])
      ]
    );
    await client.query(
      `UPDATE finance_payroll_excluded
       SET is_active = false, restored_at = NOW(), restored_by = $3,
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $4::jsonb
       WHERE excluded_id = $1 AND run_id = $2`,
      [req.params.excludedId, req.params.id, by, JSON.stringify([audit('restore', by)])]
    );
    await refreshRunTotals(client, req.params.id, by, audit('restore_recalc', by));
    await client.query('COMMIT');
    res.json({ success: true, item: mapItemRow(item.rows[0]), message: 'أُعيد الموظف للمسير' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

/** Isolated demo payroll — fake employees only. Blocked unless allow_demo / isolated DB. */
const DEMO_PAYROLL_EMPLOYEES = [
  { employee_code: '00029', full_name_ar: 'تجريبي — سارة العتيبي', department: 'الموارد البشرية', nationality: 'المملكة العربية السعودية', base_salary: 8000, housing_allowance: 2000, nature_allowance: 500, transport_allowance: 800, other_allowances: 200, insurance_amount: -780, advance_deduction: -500, other_deductions: -100 },
  { employee_code: '00033', full_name_ar: 'تجريبي — أحمد محمود', department: 'المالية', nationality: 'مصر', base_salary: 6500, housing_allowance: 1500, nature_allowance: 0, transport_allowance: 650, other_allowances: 0, insurance_amount: -634, advance_deduction: 0, other_deductions: 0 },
  { employee_code: '00027', full_name_ar: 'تجريبي — فهد القحطاني', department: 'تقنية المعلومات', nationality: 'المملكة العربية السعودية', base_salary: 12000, housing_allowance: 3000, nature_allowance: 1000, transport_allowance: 1000, other_allowances: 500, insurance_amount: -1170, advance_deduction: -2000, other_deductions: 0 },
  { employee_code: '00028', full_name_ar: 'تجريبي — نورة الشمري', department: 'التسويق', nationality: 'المملكة العربية السعودية', base_salary: 5500, housing_allowance: 1375, nature_allowance: 300, transport_allowance: 550, other_allowances: 0, insurance_amount: -536, advance_deduction: -250, other_deductions: -50 },
  { employee_code: 'D-041', full_name_ar: 'تجريبي — رامي الحسن', department: 'إدارة الشؤون الأكاديمية', nationality: 'الأردن', base_salary: 7200, housing_allowance: 1800, nature_allowance: 400, transport_allowance: 720, other_allowances: 150, insurance_amount: -702, advance_deduction: 0, other_deductions: -200 },
  { employee_code: 'D-055', full_name_ar: 'تجريبي — لينا يوسف', department: 'الجودة', nationality: 'فلسطين', base_salary: 4800, housing_allowance: 1200, nature_allowance: 0, transport_allowance: 480, other_allowances: 0, insurance_amount: 0, advance_deduction: -300, other_deductions: 0 },
  { employee_code: '00061', full_name_ar: 'تجريبي — خالد عبدالله', department: 'إدارة شؤون الطلاب', nationality: 'اليمن', base_salary: 9000, housing_allowance: 2250, nature_allowance: 750, transport_allowance: 900, other_allowances: 300, insurance_amount: -878, advance_deduction: -1000, other_deductions: -150 },
  { employee_code: '00072', full_name_ar: 'تجريبي — مريم صالح', department: 'المالية', nationality: 'السودان', base_salary: 5100, housing_allowance: 1275, nature_allowance: 200, transport_allowance: 510, other_allowances: 100, insurance_amount: -497, advance_deduction: 0, other_deductions: 0 }
];

function demoSeedAllowed() {
  const dbUrl = String(process.env.DATABASE_URL || '');
  const isolated = /finance_pages_isolated|isolated|test/i.test(dbUrl) || process.env.PAYROLL_ALLOW_DEMO === '1';
  return isolated;
}

router.post('/runs/demo-seed', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    if (!demoSeedAllowed()) {
      return res.status(403).json({
        success: false,
        error: 'إنشاء المسير التجريبي مسموح فقط في بيئة الاختبار المعزولة',
        code: 'DEMO_BLOCKED'
      });
    }
    await ensureSchema();
    const b = req.body || {};
    const eid = entityOf(req, b);
    const etype = entityTypeOf(req, b);
    const year = Number(b.period_year) || 2099;
    const month = Number(b.period_month) || 10;
    const by = actorLabel(req);
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    const runType = b.run_type_label || settings.run_type_label || 'المسير العام';

    await client.query('BEGIN');
    // Cancel any prior demo draft for same period to keep UAT idempotent
    await client.query(
      `UPDATE finance_payroll_runs SET status='CANCELLED', updated_at=NOW(),
         audit_log = COALESCE(audit_log,'[]'::jsonb) || $4::jsonb
       WHERE entity_id=$1 AND period_year=$2 AND period_month=$3
         AND source_import='demo-seed' AND UPPER(status)='DRAFT'`,
      [eid, year, month, JSON.stringify([audit('demo_cancel_prior', by)])]
    );

    const prefix = settings.number_prefix || 'PR';
    const runNumber = `${prefix}-DEMO-${year}${String(month).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
    const titleOverride = b.title_override || `مسير الرواتب لـ ${String(month).padStart(2, '0')}-${year} - ${runType} (تجريبي)`;
    const runIns = await client.query(
      `INSERT INTO finance_payroll_runs (
         run_number, period_year, period_month, run_date, status, entity_id, entity_type, department,
         created_by, audit_log, run_type_label, title_override, source_import, payroll_country, currency
       ) VALUES ($1,$2,$3,CURRENT_DATE,'DRAFT',$4,$5,NULL,$6,$7::jsonb,$8,$9,'demo-seed',$10,$11)
       RETURNING *`,
      [
        runNumber, year, month, eid, etype, by,
        JSON.stringify([audit('demo_seed', by, { employees: DEMO_PAYROLL_EMPLOYEES.length })]),
        runType, titleOverride,
        b.payroll_country || settings.payroll_country || 'SA',
        b.currency || settings.currency || 'SAR'
      ]
    );
    const run = runIns.rows[0];

    for (const row of DEMO_PAYROLL_EMPLOYEES) {
      let emp = await client.query(
        `SELECT * FROM finance_payroll_employees
         WHERE employee_code = $1 AND (entity_id = $2 OR entity_id IS NULL) LIMIT 1`,
        [malika.cellCode(row.employee_code), eid]
      );
      if (!emp.rows[0]) {
        emp = await client.query(
          `INSERT INTO finance_payroll_employees (
             employee_code, full_name_ar, base_salary, department, nationality,
             housing_allowance, nature_allowance, transport_allowance, other_allowances,
             default_insurance_amount, default_advance_deduction, default_other_deductions,
             entity_id, entity_type, is_active, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,NOW(),NOW())
           RETURNING *`,
          [
            malika.cellCode(row.employee_code), row.full_name_ar, row.base_salary, row.department, row.nationality,
            row.housing_allowance, row.nature_allowance, row.transport_allowance, row.other_allowances,
            row.insurance_amount, row.advance_deduction, row.other_deductions,
            eid, etype
          ]
        );
      } else {
        await client.query(
          `UPDATE finance_payroll_employees SET
             full_name_ar=$2, base_salary=$3, department=$4, nationality=$5,
             housing_allowance=$6, nature_allowance=$7, transport_allowance=$8, other_allowances=$9,
             default_insurance_amount=$10, default_advance_deduction=$11, default_other_deductions=$12,
             updated_at=NOW()
           WHERE employee_id=$1`,
          [
            emp.rows[0].employee_id, row.full_name_ar, row.base_salary, row.department, row.nationality,
            row.housing_allowance, row.nature_allowance, row.transport_allowance, row.other_allowances,
            row.insurance_amount, row.advance_deduction, row.other_deductions
          ]
        );
        emp = await client.query(`SELECT * FROM finance_payroll_employees WHERE employee_id=$1`, [emp.rows[0].employee_id]);
      }
      const computed = malika.recomputeRow({
        ...row,
        overtime_amount: 0
      }, { forceSignDeductions: true });
      await client.query(
        `INSERT INTO finance_payroll_items (
           run_id, employee_id, base_salary, allowances, incentives, overtime_amount, advances,
           tax_amount, insurance_amount, gross_amount, deductions_amount, net_amount, status, notes,
           housing_allowance, nature_allowance, transport_allowance, other_allowances,
           advance_deduction, other_deductions, nationality, department_snapshot, audit_log
         ) VALUES (
           $1,$2,$3,$4,0,0,$5,0,$6,$7,$8,$9,'DRAFT','demo_seed',
           $10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb
         )`,
        [
          run.run_id, emp.rows[0].employee_id,
          computed.base_salary, computed.allowances, computed.advances,
          computed.insurance_amount, computed.gross_amount, computed.deductions_amount, computed.net_amount,
          computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
          computed.advance_deduction, computed.other_deductions, row.nationality, row.department,
          JSON.stringify([audit('demo_item', by)])
        ]
      );
    }

    await refreshRunTotals(client, run.run_id, by, audit('demo_recalc', by));
    const updated = await client.query(`SELECT * FROM finance_payroll_runs WHERE run_id=$1`, [run.run_id]);
    await client.query('COMMIT');
    res.json({
      success: true,
      run: updated.rows[0],
      message: `مسير تجريبي بـ ${DEMO_PAYROLL_EMPLOYEES.length} موظفين وهميين — بدون بيانات إنتاج`,
      demo: true
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.post('/runs/import-malika', uploadMalika.single('file'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'payroll_create')) return;
    await ensureSchema();
    if (!req.file?.buffer) return res.status(400).json({ success: false, error: 'ارفع ملف Excel النموذجي' });
    const b = req.body || {};
    const eid = entityOf(req, b);
    const etype = entityTypeOf(req, b);
    const settings = payrollSettingsResolved((await getDocSettings('payroll-runs').catch(() => null))?.value || {});
    const parsed = malika.parseMalikaWorkbook(req.file.buffer);
    const year = Number(b.period_year) || new Date().getFullYear();
    const month = Number(b.period_month) || (new Date().getMonth() + 1);
    const by = actorLabel(req);
    const runType = b.run_type_label || settings.run_type_label || 'المسير العام';

    await client.query('BEGIN');
    const prefix = settings.number_prefix || 'PR';
    const runNumber = `${prefix}-IMP-${year}${String(month).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
    const titleOverride = b.title_override || parsed.title || null;
    const runIns = await client.query(
      `INSERT INTO finance_payroll_runs (
         run_number, period_year, period_month, run_date, status, entity_id, entity_type, department,
         created_by, audit_log, run_type_label, title_override, source_import
       ) VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),'DRAFT',$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
       RETURNING *`,
      [
        runNumber, year, month, b.run_date || null, eid, etype, b.department || null, by,
        JSON.stringify([audit('import_malika', by, { rows: parsed.payrollRows.length, file: req.file.originalname })]),
        runType, titleOverride, req.file.originalname || 'malika.xlsx'
      ]
    );
    const run = runIns.rows[0];

    for (const row of parsed.payrollRows) {
      let emp = await client.query(
        `SELECT * FROM finance_payroll_employees
         WHERE employee_code = $1 AND (entity_id = $2 OR entity_id IS NULL) LIMIT 1`,
        [malika.cellCode(row.employee_code), eid]
      );
      if (!emp.rows[0]) {
        emp = await client.query(
          `INSERT INTO finance_payroll_employees (
             employee_code, full_name_ar, base_salary, department, nationality,
             housing_allowance, nature_allowance, transport_allowance, other_allowances,
             default_insurance_amount, default_advance_deduction, entity_id, entity_type, is_active
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
           RETURNING *`,
          [
            malika.cellCode(row.employee_code), row.full_name_ar, row.base_salary, row.department, row.nationality,
            row.housing_allowance, row.nature_allowance, row.transport_allowance, row.other_allowances,
            row.insurance_amount, row.advance_deduction, eid, etype
          ]
        );
      } else {
        await client.query(
          `UPDATE finance_payroll_employees SET
             full_name_ar = COALESCE($2, full_name_ar),
             base_salary = $3, department = COALESCE($4, department), nationality = COALESCE($5, nationality),
             housing_allowance = $6, nature_allowance = $7, transport_allowance = $8, other_allowances = $9,
             default_insurance_amount = $10, default_advance_deduction = $11
           WHERE employee_id = $1`,
          [
            emp.rows[0].employee_id, row.full_name_ar, row.base_salary, row.department, row.nationality,
            row.housing_allowance, row.nature_allowance, row.transport_allowance, row.other_allowances,
            row.insurance_amount, row.advance_deduction
          ]
        );
        emp = await client.query(`SELECT * FROM finance_payroll_employees WHERE employee_id = $1`, [emp.rows[0].employee_id]);
      }
      const computed = malika.recomputeRow(row, { ot_fold_into: 'detail_only' });
      // Prefer signed sheet values; recompute gross/net for consistency if sheet empty
      if (!row.gross_amount) computed.gross_amount = malika.calcGross(computed);
      if (!row.net_amount) computed.net_amount = malika.calcNet(computed);
      computed.deductions_amount = malika.calcDeductionsPositive(computed);
      await client.query(
        `INSERT INTO finance_payroll_items (
           run_id, employee_id, gross_amount, deductions_amount, net_amount, status, notes,
           base_salary, allowances, overtime_amount, advances, insurance_amount,
           housing_allowance, nature_allowance, transport_allowance, other_allowances, advance_deduction,
           nationality, department_snapshot, audit_log
         ) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,0,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)`,
        [
          run.run_id, emp.rows[0].employee_id, computed.gross_amount, computed.deductions_amount, computed.net_amount,
          'imported_malika',
          computed.base_salary, computed.allowances, computed.advances, computed.insurance_amount,
          computed.housing_allowance, computed.nature_allowance, computed.transport_allowance, computed.other_allowances,
          computed.advance_deduction, computed.nationality || row.nationality, computed.department || row.department,
          JSON.stringify([audit('import_item', by)])
        ]
      );
    }

    for (const ex of parsed.excludedRows) {
      let empId = null;
      const found = await client.query(
        `SELECT employee_id FROM finance_payroll_employees
         WHERE employee_code = $1 AND (entity_id = $2 OR entity_id IS NULL) LIMIT 1`,
        [malika.cellCode(ex.employee_code), eid]
      );
      if (found.rows[0]) empId = found.rows[0].employee_id;
      else {
        const created = await client.query(
          `INSERT INTO finance_payroll_employees (employee_code, full_name_ar, entity_id, entity_type, is_active)
           VALUES ($1,$2,$3,$4,true) RETURNING employee_id`,
          [malika.cellCode(ex.employee_code), ex.full_name_ar || ex.employee_code, eid, etype]
        );
        empId = created.rows[0].employee_id;
      }
      await client.query(
        `INSERT INTO finance_payroll_excluded (
           run_id, employee_id, employee_code, full_name_ar, reason, added_by, audit_log
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [
          run.run_id, empId, malika.cellCode(ex.employee_code), ex.full_name_ar, ex.reason || 'مستورد من Excluded',
          ex.added_by || by, JSON.stringify([audit('import_excluded', by)])
        ]
      );
    }

    await refreshRunTotals(client, run.run_id, by);
    const updated = await client.query(`SELECT * FROM finance_payroll_runs WHERE run_id = $1`, [run.run_id]);
    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      run: updated.rows[0],
      imported: parsed.payrollRows.length,
      excluded: parsed.excludedRows.length,
      title: titleOverride || malika.formatRunTitle(settings, updated.rows[0]),
      message: 'تم استيراد كشوف الرواتب إلى مسير معزول'
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports.ensureSchema = ensureSchema;
module.exports.malika = malika;
