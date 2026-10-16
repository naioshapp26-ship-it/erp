'use strict';

/**
 * Phase 4 — ERP Module Settings service.
 * Uses Phase 1 Settings Engine for versioned module.* keys (tenant-scoped).
 * Does not duplicate HR's 91-tile catalog — bridges operational policy keys instead.
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');
const settingsApi = require('./enterprise-settings-engine-api');

const MODULE_DEFINITIONS = [
  // ---- HR ----
  {
    key: 'module.hr.leave',
    scope: 'module',
    module_key: 'hr',
    data_type: 'json',
    default_value: {
      max_days_per_request: 30,
      require_reason: true,
      allowed_types: ['annual', 'sick', 'unpaid', 'emergency', 'سنوية', 'مرضية', 'بدون راتب', 'طارئة'],
      min_notice_days: 0,
      block_overlapping: false,
      auto_deduct_balance: true
    },
    label_ar: 'سياسات الإجازات',
    label_en: 'Leave policies'
  },
  {
    key: 'module.hr.attendance',
    scope: 'module',
    module_key: 'hr',
    data_type: 'json',
    default_value: {
      grace_minutes: 15,
      late_deduction_enabled: true,
      require_checkout: true,
      shift_required: false,
      weekend_days: [5, 6]
    },
    label_ar: 'سياسات الحضور',
    label_en: 'Attendance policies'
  },
  {
    key: 'module.hr.payroll',
    scope: 'module',
    module_key: 'hr',
    data_type: 'json',
    default_value: {
      pay_day: 27,
      currency: 'SAR',
      overtime_multiplier: 1.5,
      include_allowances: true,
      gosi_employee_rate: 9.75,
      gosi_employer_rate: 11.75
    },
    label_ar: 'سياسات الرواتب',
    label_en: 'Payroll policies'
  },
  {
    key: 'module.hr.contracts',
    scope: 'module',
    module_key: 'hr',
    data_type: 'json',
    default_value: {
      default_probation_days: 90,
      auto_renew: false,
      require_signed_copy: true,
      notice_period_days: 30
    },
    label_ar: 'سياسات العقود',
    label_en: 'Contract policies'
  },
  {
    key: 'module.hr.recruitment',
    scope: 'module',
    module_key: 'hr',
    data_type: 'json',
    default_value: {
      require_approval: true,
      default_pipeline: ['screening', 'interview', 'offer', 'hired'],
      max_open_requisitions: 50
    },
    label_ar: 'سياسات التوظيف',
    label_en: 'Recruitment policies'
  },
  {
    key: 'module.hr.performance',
    scope: 'module',
    module_key: 'hr',
    data_type: 'json',
    default_value: {
      review_cycle_months: 12,
      min_rating: 1,
      max_rating: 5,
      require_manager_signoff: true
    },
    label_ar: 'سياسات التقييم',
    label_en: 'Performance policies'
  },
  {
    key: 'module.hr.training',
    scope: 'module',
    module_key: 'hr',
    data_type: 'json',
    default_value: {
      budget_required: false,
      certificate_required: false,
      default_hours: 8
    },
    label_ar: 'سياسات التدريب',
    label_en: 'Training policies'
  },
  {
    key: 'module.hr.offboarding',
    scope: 'module',
    module_key: 'hr',
    data_type: 'json',
    default_value: {
      clearance_required: true,
      exit_interview_required: true,
      revoke_access_on_terminate: true
    },
    label_ar: 'سياسات إنهاء الخدمة',
    label_en: 'Offboarding policies'
  },

  // ---- Finance ----
  {
    key: 'module.finance.tax',
    scope: 'module',
    module_key: 'finance',
    data_type: 'json',
    default_value: {
      default_vat_rate: 15,
      inclusive_pricing: false,
      tax_number_required: true,
      apply_on_invoices: true
    },
    label_ar: 'سياسات الضرائب',
    label_en: 'Tax policies'
  },
  {
    key: 'module.finance.fiscal',
    scope: 'module',
    module_key: 'finance',
    data_type: 'json',
    default_value: {
      allow_posting_closed: false,
      auto_period_lock: false,
      fiscal_year_start_month: 1,
      periods_per_year: 12
    },
    label_ar: 'سياسات الفترات المالية',
    label_en: 'Fiscal period policies'
  },
  {
    key: 'module.finance.invoicing',
    scope: 'module',
    module_key: 'finance',
    data_type: 'json',
    default_value: {
      number_prefix: 'INV',
      due_days: 30,
      require_customer: true,
      default_currency: 'SAR'
    },
    label_ar: 'سياسات الفواتير',
    label_en: 'Invoicing policies'
  },
  {
    key: 'module.finance.treasury',
    scope: 'module',
    module_key: 'finance',
    data_type: 'json',
    default_value: {
      multicurrency: false,
      default_cash_account: null,
      require_receipt_ref: true
    },
    label_ar: 'سياسات الخزائن والبنوك',
    label_en: 'Treasury policies'
  },
  {
    key: 'module.finance.cost_centers',
    scope: 'module',
    module_key: 'finance',
    data_type: 'json',
    default_value: {
      required_on_entries: false,
      allow_cross_branch: true
    },
    label_ar: 'مراكز التكلفة',
    label_en: 'Cost centers'
  },
  {
    key: 'module.finance.approvals',
    scope: 'module',
    module_key: 'finance',
    data_type: 'json',
    default_value: {
      amount_threshold: 10000,
      dual_approval: false,
      require_attachment_above: 50000
    },
    label_ar: 'موافقات مالية',
    label_en: 'Finance approvals'
  },
  {
    key: 'module.finance.assets',
    scope: 'module',
    module_key: 'finance',
    data_type: 'json',
    default_value: {
      depreciation_method: 'straight_line',
      default_useful_life_years: 5,
      capitalize_threshold: 1000
    },
    label_ar: 'سياسات الأصول الثابتة',
    label_en: 'Fixed asset policies'
  },

  // ---- Sales / CRM / POS ----
  {
    key: 'module.sales.crm',
    scope: 'module',
    module_key: 'sales',
    data_type: 'json',
    default_value: {
      pipeline_stages: ['lead', 'qualified', 'proposal', 'won', 'lost'],
      default_stage: 'lead',
      require_contact: true,
      auto_assign: false
    },
    label_ar: 'إعدادات CRM',
    label_en: 'CRM settings'
  },
  {
    key: 'module.sales.pos',
    scope: 'module',
    module_key: 'sales',
    data_type: 'json',
    default_value: {
      receipt_footer: 'شكراً لتعاملكم معنا',
      allow_negative_stock: false,
      default_warehouse: null,
      round_cash_to: 0.05
    },
    label_ar: 'إعدادات نقاط البيع',
    label_en: 'POS settings'
  },
  {
    key: 'module.sales.customers',
    scope: 'module',
    module_key: 'sales',
    data_type: 'json',
    default_value: {
      credit_limit_default: 0,
      require_tax_id: false,
      default_payment_terms_days: 30
    },
    label_ar: 'سياسات العملاء',
    label_en: 'Customer policies'
  },

  // ---- Supply chain ----
  {
    key: 'module.inventory.stock',
    scope: 'module',
    module_key: 'supply-chain',
    data_type: 'json',
    default_value: {
      low_stock_threshold: 10,
      valuation_method: 'average',
      allow_negative: false,
      require_warehouse: true
    },
    label_ar: 'سياسات المخزون',
    label_en: 'Inventory policies'
  },
  {
    key: 'module.purchases.orders',
    scope: 'module',
    module_key: 'supply-chain',
    data_type: 'json',
    default_value: {
      require_po_approval: true,
      default_payment_terms: 'Net 30',
      approval_amount_threshold: 5000
    },
    label_ar: 'سياسات المشتريات',
    label_en: 'Purchase policies'
  },
  {
    key: 'module.suppliers.policies',
    scope: 'module',
    module_key: 'supply-chain',
    data_type: 'json',
    default_value: {
      require_contract: false,
      rating_required: false,
      min_rating: 1,
      max_rating: 5
    },
    label_ar: 'سياسات الموردين',
    label_en: 'Supplier policies'
  },

  // ---- Tasks / Facilities / Workflows / Templates ----
  {
    key: 'module.tasks.projects',
    scope: 'module',
    module_key: 'tasks-management',
    data_type: 'json',
    default_value: {
      default_status: 'open',
      require_assignee: true,
      wip_limit: 20,
      allow_self_assign: true
    },
    label_ar: 'إعدادات المهام والمشروعات',
    label_en: 'Tasks & projects'
  },
  {
    key: 'module.facilities.assets',
    scope: 'module',
    module_key: 'facilities',
    data_type: 'json',
    default_value: {
      maintenance_interval_days: 90,
      require_location: true,
      checkout_enabled: true
    },
    label_ar: 'إعدادات المرافق',
    label_en: 'Facilities settings'
  },
  {
    key: 'module.workflows.approvals',
    scope: 'module',
    module_key: 'workflows',
    data_type: 'json',
    default_value: {
      default_levels: 2,
      escalate_hours: 48,
      allow_skip: false
    },
    label_ar: 'محرك الموافقات',
    label_en: 'Approval workflows'
  },
  {
    key: 'module.templates.numbering',
    scope: 'module',
    module_key: 'templates',
    data_type: 'json',
    default_value: {
      invoice_prefix: 'INV-',
      po_prefix: 'PO-',
      employee_prefix: 'EMP-',
      leave_prefix: 'LR-',
      pad_width: 5
    },
    label_ar: 'أنظمة الترقيم',
    label_en: 'Numbering systems'
  },
  {
    key: 'module.notifications.channels',
    scope: 'module',
    module_key: 'notifications',
    data_type: 'json',
    default_value: {
      email: true,
      sms: false,
      in_app: true,
      digest: 'daily'
    },
    label_ar: 'قنوات إشعارات الوحدات',
    label_en: 'Module notification channels'
  },
  {
    key: 'module.backup.policy',
    scope: 'module',
    module_key: 'backup',
    data_type: 'json',
    default_value: {
      retention_days: 30,
      schedule: 'daily',
      include_uploads: true,
      note: 'Operational restore remains via scripts; policy stored for governance.'
    },
    label_ar: 'سياسة النسخ الاحتياطي',
    label_en: 'Backup policy'
  },
  {
    key: 'module.audit.retention',
    scope: 'module',
    module_key: 'security',
    data_type: 'json',
    default_value: {
      retention_days: 365,
      capture_reads: false,
      capture_settings: true
    },
    label_ar: 'احتفاظ سجل التدقيق',
    label_en: 'Audit retention'
  }
];

const SECTION_KEY_MAP = Object.fromEntries(
  MODULE_DEFINITIONS.map((d) => {
    // module.hr.leave → hr/leave
    const parts = d.key.replace(/^module\./, '').split('.');
    const section = `${parts[0]}/${parts.slice(1).join('.')}`;
    return [section, d.key];
  })
);

let definitionsSeeded = false;

async function ensureEngine() {
  await settingsApi.ensureSchema();
  if (definitionsSeeded) return;
  for (const def of MODULE_DEFINITIONS) {
    await db.query(
      `INSERT INTO setting_definitions
         (key, scope, module_key, data_type, default_value, label_ar, label_en, is_sensitive, is_active)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,false,true)
       ON CONFLICT (key) DO UPDATE SET
         default_value = EXCLUDED.default_value,
         label_ar = EXCLUDED.label_ar,
         label_en = EXCLUDED.label_en,
         module_key = EXCLUDED.module_key,
         updated_at = NOW()`,
      [
        def.key,
        def.scope,
        def.module_key,
        def.data_type,
        JSON.stringify(def.default_value),
        def.label_ar,
        def.label_en
      ]
    );
  }
  definitionsSeeded = true;
}

async function ensureOpsSchema(pool) {
  const sql = fs.readFileSync(path.join(__dirname, 'create-module-settings-ops.sql'), 'utf8');
  await pool.query(sql);
}

async function getEngineValue(tenantId, key) {
  await ensureEngine();
  const def = MODULE_DEFINITIONS.find((d) => d.key === key);
  const value = await db.query(
    `SELECT * FROM setting_values
     WHERE definition_key = $1 AND tenant_id = $2
     ORDER BY id DESC LIMIT 1`,
    [key, tenantId]
  );
  if (!value.rows.length) {
    return {
      key,
      version: 0,
      value: def ? { ...def.default_value } : {},
      source: 'default'
    };
  }
  return {
    key,
    version: value.rows[0].version,
    value: value.rows[0].value,
    updated_at: value.rows[0].updated_at,
    source: 'db'
  };
}

async function putEngineValue(tenantId, key, newValue, actorId, reason) {
  await ensureEngine();
  const defRes = await db.query(
    `SELECT * FROM setting_definitions WHERE key = $1 AND is_active = true LIMIT 1`,
    [key]
  );
  if (!defRes.rows.length) {
    const err = new Error(`تعريف الإعداد غير موجود: ${key}`);
    err.status = 404;
    throw err;
  }

  const existing = await db.query(
    `SELECT * FROM setting_values WHERE definition_key = $1 AND tenant_id = $2 LIMIT 1`,
    [key, tenantId]
  );

  let saved;
  if (existing.rows.length) {
    const prev = existing.rows[0];
    const nextVersion = Number(prev.version || 1) + 1;
    await db.query(
      `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (setting_value_id, version) DO NOTHING`,
      [prev.id, prev.version, JSON.stringify(prev.value), actorId || null, reason || 'module-update']
    );
    const updated = await db.query(
      `UPDATE setting_values
       SET value = $1::jsonb, version = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [JSON.stringify(newValue), nextVersion, actorId || null, prev.id]
    );
    saved = updated.rows[0];
    await db.query(
      `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (setting_value_id, version) DO UPDATE SET value = EXCLUDED.value`,
      [prev.id, nextVersion, JSON.stringify(newValue), actorId || null, reason || 'module-update']
    );
    await db.query(
      `INSERT INTO setting_audit_events
         (definition_key, tenant_id, actor_id, action, old_value, new_value, meta)
       VALUES ($1, $2, $3, 'update', $4::jsonb, $5::jsonb, $6::jsonb)`,
      [
        key,
        tenantId,
        actorId || null,
        JSON.stringify(prev.value),
        JSON.stringify(newValue),
        JSON.stringify({ version: nextVersion, reason: reason || 'module-update', phase: 4 })
      ]
    );
  } else {
    const inserted = await db.query(
      `INSERT INTO setting_values
         (definition_key, tenant_id, branch_id, module_key, value, version, updated_by)
       VALUES ($1, $2, NULL, $3, $4::jsonb, 1, $5)
       RETURNING *`,
      [key, tenantId, defRes.rows[0].module_key || null, JSON.stringify(newValue), actorId || null]
    );
    saved = inserted.rows[0];
    await db.query(
      `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
       VALUES ($1, 1, $2::jsonb, $3, $4)`,
      [saved.id, JSON.stringify(newValue), actorId || null, reason || 'module-create']
    );
    await db.query(
      `INSERT INTO setting_audit_events
         (definition_key, tenant_id, actor_id, action, old_value, new_value, meta)
       VALUES ($1, $2, $3, 'create', NULL, $4::jsonb, $5::jsonb)`,
      [
        key,
        tenantId,
        actorId || null,
        JSON.stringify(newValue),
        JSON.stringify({ version: 1, reason: reason || 'module-create', phase: 4 })
      ]
    );
  }
  return saved;
}

async function saveSection(tenantId, section, value, actorId, reason) {
  const key = SECTION_KEY_MAP[section] || (section.startsWith('module.') ? section : null);
  if (!key || !MODULE_DEFINITIONS.some((d) => d.key === key)) {
    const err = new Error(`قسم إعدادات وحدة غير معروف: ${section}`);
    err.status = 400;
    throw err;
  }
  const current = await getEngineValue(tenantId, key);
  const merged = { ...(current.value || {}), ...(value || {}) };
  const saved = await putEngineValue(tenantId, key, merged, actorId, reason || `module.${section}`);
  return { key, saved, value: merged };
}

async function getBundle(tenantId, pool) {
  await ensureOpsSchema(pool);
  const settings = {};
  for (const def of MODULE_DEFINITIONS) {
    settings[def.key] = await getEngineValue(tenantId, def.key);
  }
  const years = await pool.query(`SELECT * FROM fiscal_years ORDER BY start_date DESC`);
  const periods = await pool.query(
    `SELECT p.*, y.code AS year_code
     FROM fiscal_periods p
     JOIN fiscal_years y ON y.id = p.fiscal_year_id
     ORDER BY y.start_date DESC, p.period_no ASC`
  );
  const templates = await pool.query(
    `SELECT id, template_type, code, name_ar, subject, is_active, updated_at
     FROM module_templates ORDER BY template_type, code LIMIT 200`
  );
  const numbering = await pool.query(
    `SELECT * FROM module_numbering_counters ORDER BY series_key`
  );

  const byModule = {};
  for (const def of MODULE_DEFINITIONS) {
    if (!byModule[def.module_key]) byModule[def.module_key] = [];
    byModule[def.module_key].push({
      key: def.key,
      label_ar: def.label_ar,
      label_en: def.label_en,
      ...settings[def.key]
    });
  }

  return {
    definitions: MODULE_DEFINITIONS.map((d) => ({
      key: d.key,
      module_key: d.module_key,
      label_ar: d.label_ar,
      label_en: d.label_en,
      default_value: d.default_value
    })),
    settings,
    byModule,
    fiscal: { years: years.rows, periods: periods.rows },
    templates: templates.rows,
    numbering: numbering.rows,
    links: {
      hr_hub: '/hr/system-settings',
      finance_coa: '/finance/chart-of-accounts.html',
      tax: '/manage-tax-settings.html',
      company: '/company/settings',
      center: '/modules/settings'
    }
  };
}

async function listAudit(tenantId, limit = 50) {
  await ensureEngine();
  const result = await db.query(
    `SELECT id, definition_key, tenant_id, actor_id, action, old_value, new_value, meta, created_at
     FROM setting_audit_events
     WHERE tenant_id = $1
       AND definition_key LIKE 'module.%'
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenantId, Math.min(200, Number(limit) || 50)]
  );
  return result.rows;
}

// ---- Fiscal CRUD ----
async function upsertFiscalYear(pool, body) {
  await ensureOpsSchema(pool);
  if (!body.code || !body.name_ar || !body.start_date || !body.end_date) {
    const err = new Error('الحقول المطلوبة: code, name_ar, start_date, end_date');
    err.status = 400;
    throw err;
  }
  if (body.is_current) {
    await pool.query(`UPDATE fiscal_years SET is_current = false WHERE is_current = true`);
  }
  if (body.id) {
    const result = await pool.query(
      `UPDATE fiscal_years SET
         code = COALESCE($2, code),
         name_ar = COALESCE($3, name_ar),
         name_en = COALESCE($4, name_en),
         start_date = COALESCE($5, start_date),
         end_date = COALESCE($6, end_date),
         status = COALESCE($7, status),
         is_current = COALESCE($8, is_current),
         notes = COALESCE($9, notes),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        body.id,
        body.code || null,
        body.name_ar || null,
        body.name_en || null,
        body.start_date || null,
        body.end_date || null,
        body.status || null,
        body.is_current != null ? Boolean(body.is_current) : null,
        body.notes || null
      ]
    );
    if (!result.rows.length) {
      const err = new Error('السنة المالية غير موجودة.');
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  const inserted = await pool.query(
    `INSERT INTO fiscal_years (code, name_ar, name_en, start_date, end_date, status, is_current, notes)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,'open'),COALESCE($7,false),$8)
     RETURNING *`,
    [
      body.code,
      body.name_ar,
      body.name_en || null,
      body.start_date,
      body.end_date,
      body.status || 'open',
      Boolean(body.is_current),
      body.notes || null
    ]
  );
  return inserted.rows[0];
}

async function ensurePeriodsForYear(pool, yearId, periodsPerYear = 12) {
  await ensureOpsSchema(pool);
  const year = await pool.query(`SELECT * FROM fiscal_years WHERE id = $1`, [yearId]);
  if (!year.rows.length) {
    const err = new Error('السنة المالية غير موجودة.');
    err.status = 404;
    throw err;
  }
  const y = year.rows[0];
  const start = new Date(y.start_date);
  const count = Math.min(24, Math.max(1, Number(periodsPerYear) || 12));
  const created = [];
  for (let i = 0; i < count; i++) {
    const pStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const pEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, 0);
    const nameAr = `فترة ${i + 1}`;
    const result = await pool.query(
      `INSERT INTO fiscal_periods (fiscal_year_id, period_no, name_ar, name_en, start_date, end_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,'open')
       ON CONFLICT (fiscal_year_id, period_no) DO UPDATE SET
         name_ar = EXCLUDED.name_ar,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         updated_at = NOW()
       RETURNING *`,
      [yearId, i + 1, nameAr, `Period ${i + 1}`, pStart.toISOString().slice(0, 10), pEnd.toISOString().slice(0, 10)]
    );
    created.push(result.rows[0]);
  }
  return created;
}

async function setPeriodStatus(pool, periodId, status, actorId) {
  await ensureOpsSchema(pool);
  if (!['open', 'closed', 'locked'].includes(status)) {
    const err = new Error('حالة الفترة غير صالحة.');
    err.status = 400;
    throw err;
  }
  const result = await pool.query(
    `UPDATE fiscal_periods SET
       status = $2,
       closed_at = CASE WHEN $2 IN ('closed','locked') THEN NOW() ELSE NULL END,
       closed_by = CASE WHEN $2 IN ('closed','locked') THEN $3 ELSE NULL END,
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [periodId, status, actorId || null]
  );
  if (!result.rows.length) {
    const err = new Error('الفترة غير موجودة.');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

/**
 * Operational: can we post a journal/invoice on this date?
 */
async function assertFiscalPostingAllowed(tenantId, pool, postingDate) {
  const policy = await getEngineValue(tenantId, 'module.finance.fiscal');
  if (policy.value?.allow_posting_closed) {
    return { allowed: true, reason: 'policy_allows_closed' };
  }
  await ensureOpsSchema(pool);
  const date = postingDate ? new Date(postingDate) : new Date();
  const iso = date.toISOString().slice(0, 10);
  const period = await pool.query(
    `SELECT * FROM fiscal_periods
     WHERE start_date <= $1::date AND end_date >= $1::date
     ORDER BY id DESC LIMIT 1`,
    [iso]
  );
  if (!period.rows.length) {
    // No periods configured → allow (not yet enforced)
    return { allowed: true, reason: 'no_period_configured' };
  }
  const p = period.rows[0];
  if (p.status === 'closed' || p.status === 'locked') {
    return {
      allowed: false,
      reason: 'period_closed',
      period: { id: p.id, period_no: p.period_no, status: p.status }
    };
  }
  return { allowed: true, reason: 'period_open', period: { id: p.id, period_no: p.period_no } };
}

/**
 * Operational: validate leave request against module.hr.leave
 */
async function validateLeaveRequest(tenantId, payload) {
  const setting = await getEngineValue(tenantId, 'module.hr.leave');
  const policy = setting.value || {};
  const errors = [];
  const days = Number(payload.days_count) || 0;
  if (policy.max_days_per_request != null && days > Number(policy.max_days_per_request)) {
    errors.push(`تجاوز الحد الأقصى لأيام الطلب (${policy.max_days_per_request}).`);
  }
  if (policy.require_reason && !String(payload.reason || '').trim()) {
    errors.push('سبب الإجازة مطلوب حسب سياسة الموارد البشرية.');
  }
  const allowed = Array.isArray(policy.allowed_types) ? policy.allowed_types : [];
  if (allowed.length && payload.leave_type) {
    const type = String(payload.leave_type).trim();
    const ok = allowed.some((t) => String(t).toLowerCase() === type.toLowerCase());
    if (!ok) errors.push(`نوع الإجازة «${type}» غير مسموح حسب السياسة.`);
  }
  if (policy.min_notice_days > 0 && payload.start_date) {
    const start = new Date(payload.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((start - today) / 86400000);
    if (diff < Number(policy.min_notice_days)) {
      errors.push(`يجب تقديم الطلب قبل ${policy.min_notice_days} يوم على الأقل.`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    policy,
    source: setting.source
  };
}

/**
 * Operational: compute invoice tax from module.finance.tax
 */
async function computeInvoiceTax(tenantId, subtotal) {
  const setting = await getEngineValue(tenantId, 'module.finance.tax');
  const policy = setting.value || {};
  const amount = Number(subtotal) || 0;
  if (!policy.apply_on_invoices) {
    return { subtotal: amount, tax_rate: 0, tax_amount: 0, total: amount, policy };
  }
  const rate = Number(policy.default_vat_rate) || 0;
  if (policy.inclusive_pricing) {
    const taxAmount = Math.round(((amount * rate) / (100 + rate)) * 100) / 100;
    return {
      subtotal: Math.round((amount - taxAmount) * 100) / 100,
      tax_rate: rate,
      tax_amount: taxAmount,
      total: amount,
      inclusive: true,
      policy
    };
  }
  const taxAmount = Math.round((amount * rate) / 100 * 100) / 100;
  return {
    subtotal: amount,
    tax_rate: rate,
    tax_amount: taxAmount,
    total: Math.round((amount + taxAmount) * 100) / 100,
    inclusive: false,
    policy
  };
}

/**
 * Operational: inventory low-stock / negative stock checks
 */
async function evaluateStockLevel(tenantId, quantity) {
  const setting = await getEngineValue(tenantId, 'module.inventory.stock');
  const policy = setting.value || {};
  const qty = Number(quantity);
  const threshold = Number(policy.low_stock_threshold) || 0;
  const allowNegative = Boolean(policy.allow_negative);
  return {
    quantity: qty,
    is_low: qty <= threshold,
    is_negative: qty < 0,
    blocked: qty < 0 && !allowNegative,
    threshold,
    allow_negative: allowNegative,
    policy
  };
}

/**
 * Operational: POS sale stock gate
 */
async function evaluatePosSale(tenantId, stockQty) {
  const setting = await getEngineValue(tenantId, 'module.sales.pos');
  const policy = setting.value || {};
  const qty = Number(stockQty);
  const allowNeg = Boolean(policy.allow_negative_stock);
  return {
    allowed: qty > 0 || allowNeg,
    allow_negative_stock: allowNeg,
    receipt_footer: policy.receipt_footer || '',
    policy
  };
}

/**
 * Operational: task create gate
 */
async function evaluateTaskCreate(tenantId, payload) {
  const setting = await getEngineValue(tenantId, 'module.tasks.projects');
  const policy = setting.value || {};
  const errors = [];
  if (policy.require_assignee && !payload.assignee_id && !payload.assignee && !payload.assigned_to) {
    errors.push('تعيين مسؤول المهمة مطلوب حسب إعدادات المهام.');
  }
  return { ok: errors.length === 0, errors, policy, default_status: policy.default_status || 'open' };
}

/**
 * Operational: purchase approval need
 */
async function evaluatePurchaseApproval(tenantId, amount) {
  const setting = await getEngineValue(tenantId, 'module.purchases.orders');
  const policy = setting.value || {};
  const amt = Number(amount) || 0;
  const needs =
    Boolean(policy.require_po_approval) &&
    amt >= Number(policy.approval_amount_threshold || 0);
  return { needs_approval: needs, amount: amt, policy };
}

async function upsertTemplate(pool, body) {
  await ensureOpsSchema(pool);
  const type = body.template_type || body.type;
  if (!['email', 'sms', 'print'].includes(type)) {
    const err = new Error('template_type يجب أن يكون email|sms|print');
    err.status = 400;
    throw err;
  }
  if (!body.code || !body.name_ar) {
    const err = new Error('code و name_ar مطلوبان.');
    err.status = 400;
    throw err;
  }
  if (body.id) {
    const result = await pool.query(
      `UPDATE module_templates SET
         name_ar = COALESCE($2, name_ar),
         subject = COALESCE($3, subject),
         body = COALESCE($4, body),
         is_active = COALESCE($5, is_active),
         metadata = COALESCE($6::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        body.id,
        body.name_ar || null,
        body.subject || null,
        body.body != null ? body.body : null,
        body.is_active != null ? Boolean(body.is_active) : null,
        body.metadata ? JSON.stringify(body.metadata) : null
      ]
    );
    if (!result.rows.length) {
      const err = new Error('القالب غير موجود.');
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  const inserted = await pool.query(
    `INSERT INTO module_templates (template_type, code, name_ar, subject, body, is_active, metadata)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,true),COALESCE($7::jsonb,'{}'))
     ON CONFLICT (template_type, code) DO UPDATE SET
       name_ar = EXCLUDED.name_ar,
       subject = EXCLUDED.subject,
       body = EXCLUDED.body,
       is_active = EXCLUDED.is_active,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING *`,
    [
      type,
      body.code,
      body.name_ar,
      body.subject || null,
      body.body || '',
      body.is_active != null ? Boolean(body.is_active) : true,
      JSON.stringify(body.metadata || {})
    ]
  );
  return inserted.rows[0];
}

async function nextNumber(pool, tenantId, seriesKey) {
  await ensureOpsSchema(pool);
  const numbering = await getEngineValue(tenantId, 'module.templates.numbering');
  const map = {
    invoice: numbering.value?.invoice_prefix || 'INV-',
    po: numbering.value?.po_prefix || 'PO-',
    employee: numbering.value?.employee_prefix || 'EMP-',
    leave: numbering.value?.leave_prefix || 'LR-'
  };
  const prefix = map[seriesKey] || `${seriesKey.toUpperCase()}-`;
  const pad = Number(numbering.value?.pad_width) || 5;
  const result = await pool.query(
    `INSERT INTO module_numbering_counters (series_key, prefix, next_number, pad_width)
     VALUES ($1, $2, 2, $3)
     ON CONFLICT (series_key) DO UPDATE SET
       next_number = module_numbering_counters.next_number + 1,
       prefix = EXCLUDED.prefix,
       pad_width = EXCLUDED.pad_width,
       updated_at = NOW()
     RETURNING *`,
    [seriesKey, prefix, pad]
  );
  const row = result.rows[0];
  const num = Number(row.next_number) - 1;
  const formatted = `${row.prefix}${String(num).padStart(row.pad_width, '0')}`;
  return { series_key: seriesKey, number: num, formatted, prefix: row.prefix };
}

/**
 * Resolve company.security session TTL for auth paths.
 */
async function resolveSessionTtlMs(tenantId) {
  try {
    const company = require('./company-settings-service');
    const security = await company.getEngineValue(tenantId, 'company.security');
    const hours = Number(security.value?.session_ttl_hours);
    if (hours > 0 && hours <= 720) {
      return Math.round(hours * 60 * 60 * 1000);
    }
  } catch {
    /* fall through */
  }
  return 24 * 60 * 60 * 1000;
}

async function resolveSecurityPolicy(tenantId) {
  try {
    const company = require('./company-settings-service');
    return (await company.getEngineValue(tenantId, 'company.security')).value || {};
  } catch {
    return {
      session_ttl_hours: 24,
      require_strong_password: true,
      max_failed_logins: 5,
      lockout_minutes: 15
    };
  }
}

module.exports = {
  MODULE_DEFINITIONS,
  SECTION_KEY_MAP,
  ensureEngine,
  ensureOpsSchema,
  getEngineValue,
  putEngineValue,
  saveSection,
  getBundle,
  listAudit,
  upsertFiscalYear,
  ensurePeriodsForYear,
  setPeriodStatus,
  assertFiscalPostingAllowed,
  validateLeaveRequest,
  computeInvoiceTax,
  evaluateStockLevel,
  evaluatePosSale,
  evaluateTaskCreate,
  evaluatePurchaseApproval,
  upsertTemplate,
  nextNumber,
  resolveSessionTtlMs,
  resolveSecurityPolicy
};
