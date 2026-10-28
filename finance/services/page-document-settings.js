'use strict';

/**
 * Finance page-document settings — persisted in enterprise setting_values.
 * Keys: finance.page.<docId>
 * No new migration files; reuses CREATE IF NOT EXISTS settings engine schema.
 */

const fs = require('fs');
const path = require('path');
const db = require('../../db');
const { fieldMeta, validateField } = require('../finance-field-labels');

const DOC_DEFS = {
  print: {
    label_ar: 'إعدادات الطباعة',
    default_value: {
      paper_size: 'A4',
      show_logo: true,
      show_company_name: true,
      show_tax_number: true,
      footer_text: '',
      margin_mm: 12
    }
  },
  quotes: {
    label_ar: 'إعدادات عروض الأسعار',
    default_value: {
      number_prefix: 'QOT',
      validity_days: 15,
      default_tax_pct: 15,
      require_customer: true,
      footer_text: '',
      auto_convert_to_invoice: false
    }
  },
  'sales-invoices': {
    label_ar: 'إعدادات فواتير المبيعات',
    default_value: {
      number_prefix: 'INV',
      due_days: 30,
      default_tax_pct: 15,
      require_customer: true,
      allow_partial_payment_default: true,
      allow_installments_default: false,
      footer_text: '',
      default_currency: 'SAR'
    }
  },
  'purchase-orders': {
    label_ar: 'إعدادات أوامر الشراء',
    default_value: {
      number_prefix: 'PO',
      require_vendor: true,
      default_currency: 'SAR',
      default_tax_pct: 15,
      approval_required: true
    }
  },
  'purchase-invoices': {
    label_ar: 'إعدادات فواتير المشتريات',
    default_value: {
      number_prefix: 'PINV',
      due_days: 30,
      default_tax_pct: 15,
      require_vendor: true,
      require_po_link: false
    }
  },
  'simple-invoices': {
    label_ar: 'إعدادات الفواتير البسيطة',
    default_value: {
      number_prefix: 'SINV',
      default_tax_pct: 15,
      require_customer: false,
      default_currency: 'SAR'
    }
  },
  vouchers: {
    label_ar: 'إعدادات السندات',
    default_value: {
      number_prefix: 'VCH',
      require_account: true,
      require_description: true,
      default_currency: 'SAR'
    }
  },
  'credit-notes': {
    label_ar: 'إعدادات الإشعارات الدائنة',
    default_value: {
      number_prefix: 'CN',
      require_original_invoice: true,
      default_tax_pct: 15,
      auto_journal: true
    }
  },
  'debit-notes': {
    label_ar: 'إعدادات الإشعارات المدينة',
    default_value: {
      number_prefix: 'DN',
      require_original_invoice: true,
      default_tax_pct: 15,
      auto_journal: true
    }
  },
  'journal-entries': {
    label_ar: 'إعدادات القيود المحاسبية',
    default_value: {
      number_prefix: 'JE',
      require_balanced: true,
      require_description: true,
      allow_future_dates: false
    }
  },
  overtime: {
    label_ar: 'إعدادات ساعات العمل الإضافي',
    default_value: {
      page_title: 'ساعات العمل الإضافي',
      page_subtitle: 'طلبات إضافية تشغيلية مع اعتماد وترحيل لكشف الرواتب مرة واحدة.',
      custom_section_title: 'ملاحظات تشغيلية',
      custom_section_text: '',
      number_prefix: 'OT',
      require_reason: true,
      allow_overlap: false,
      show_department: true,
      show_day_type: true,
      show_rate_column: true,
      show_reason_column: false,
      show_btn_policy: true,
      show_btn_excel: true,
      show_btn_csv: true,
      show_btn_print: true,
      export_excel: true,
      export_pdf: true,
      default_day_type: 'NORMAL',
      print_footer: ''
    }
  },
  'payroll-runs': {
    label_ar: 'إعدادات كشوف الرواتب',
    default_value: {
      page_title: 'كشوف الرواتب',
      page_subtitle: 'نظام رواتب تشغيلي: إنشاء مسير → إضافة/تعديل رواتب الموظفين → احتساب → اعتماد → تصدير.',
      custom_section_title: 'تنبيه صرف',
      custom_section_text: 'التحويل البنكي ومتطلبات الملفات البنكية قابلة للضبط حسب الدولة — تصدير Excel لا يثبت الامتثال وحده.',
      number_prefix: 'PR',
      payroll_country: 'SA',
      currency: 'SAR',
      tax_pct: 0,
      insurance_pct: 9.75,
      insurance_sign: 'negative',
      insurance_base: 'base_salary',
      bank_file_format: 'SA_WPS',
      bank_file_note: 'ملف بنكي قابل للضبط حسب الدولة/البنك.',
      default_allowances: 0,
      ot_fold_into: 'other_allowances',
      run_type_label: 'المسير العام',
      payroll_title_template: 'مسير الرواتب لـ {date} - {run_type}',
      excluded_title_template: 'الموظفين المستبعدين لـ {date} - {run_type}',
      print_orientation: 'landscape',
      print_header: '',
      expense_account_code: '5100',
      payable_account_code: '2150',
      deductions_account_code: '',
      require_approval_before_post: true,
      show_col_employee_code: true,
      show_col_name: true,
      show_col_department: true,
      show_col_nationality: true,
      show_col_base: true,
      show_col_housing: true,
      show_col_nature: true,
      show_col_transport: true,
      show_col_other: true,
      show_col_gross: true,
      show_col_insurance: true,
      show_col_advance: true,
      show_col_net: true,
      show_col_allowances: true,
      show_col_incentives: false,
      show_col_overtime: false,
      show_col_deductions: true,
      show_btn_excel: true,
      show_btn_csv: true,
      show_btn_print: true,
      show_btn_add_employee: true,
      show_btn_import: true,
      export_excel: true,
      export_csv: true,
      export_pdf: true,
      bank_transfer_enabled: false,
      print_footer: ''
    }
  },
  'coa-tree': {
    label_ar: 'إعدادات شجرة الحسابات',
    default_value: {
      page_title: 'شجرة الحسابات',
      page_subtitle: 'شجرة هرمية من الحسابات الفعلية مع أرصدة القيود.',
      custom_section_title: 'ملاحظة دليل',
      custom_section_text: '',
      show_english_name: true,
      show_balances: true,
      show_inactive: false,
      show_btn_excel: true,
      show_btn_csv: true,
      show_btn_print: true,
      show_btn_expand: true,
      expand_levels: 2,
      require_approval_for_edit: false,
      default_currency: 'SAR',
      export_excel: true,
      print_footer: ''
    }
  },
  products: {
    label_ar: 'إعدادات المنتجات',
    default_value: {
      require_sku: true,
      track_inventory: false,
      default_tax_pct: 15,
      default_currency: 'SAR',
      allow_negative_stock: false
    }
  },
  customers: {
    label_ar: 'إعدادات العملاء',
    default_value: {
      require_tax_number: false,
      require_phone: false,
      require_email: false,
      default_payment_terms_days: 30,
      default_credit_limit: 0,
      default_currency: 'SAR'
    }
  },
  suppliers: {
    label_ar: 'إعدادات الموردين',
    default_value: {
      require_tax_number: false,
      require_phone: false,
      default_payment_terms_days: 30,
      default_currency: 'SAR'
    }
  }
};

const DOC_IDS = Object.keys(DOC_DEFS);

function definitionKey(docId) {
  return `finance.page.${docId}`;
}

let schemaReady = false;
let schemaPromise = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const sqlPath = path.join(__dirname, '../../create-enterprise-settings-engine.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await db.query(sql);
    for (const docId of DOC_IDS) {
      const def = DOC_DEFS[docId];
      const key = definitionKey(docId);
      await db.query(
        `INSERT INTO setting_definitions
           (key, scope, module_key, data_type, default_value, label_ar, label_en, is_sensitive, is_active)
         VALUES ($1,'module','finance','json',$2::jsonb,$3,$4,false,true)
         ON CONFLICT (key) DO UPDATE SET
           default_value = EXCLUDED.default_value,
           label_ar = EXCLUDED.label_ar,
           updated_at = NOW()`,
        [key, JSON.stringify(def.default_value), def.label_ar, `Finance page settings: ${docId}`]
      );
    }
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

function resolveTenantId(req) {
  if (req.tenant && req.tenant.id != null) return Number(req.tenant.id);
  const header = req.headers['x-tenant-id'];
  if (header != null && String(header).trim() !== '') {
    const n = Number(header);
    if (Number.isFinite(n)) return n;
  }
  // Central HQ finance: tenant_id 0 scope bucket
  return 0;
}

async function getDocSettings(docId, tenantId = 0) {
  await ensureSchema();
  if (!DOC_DEFS[docId]) {
    const err = new Error('إعدادات هذا المستند غير معروفة.');
    err.status = 404;
    throw err;
  }
  const key = definitionKey(docId);
  const result = await db.query(
    `SELECT value, version, updated_at, updated_by
     FROM setting_values
     WHERE definition_key = $1
       AND COALESCE(tenant_id, 0) = $2
       AND COALESCE(branch_id, 0) = 0
       AND COALESCE(module_key, '') = 'finance'
     LIMIT 1`,
    [key, tenantId]
  );
  const defaults = DOC_DEFS[docId].default_value;
  if (!result.rows.length) {
    return {
      docId,
      key,
      label_ar: DOC_DEFS[docId].label_ar,
      value: { ...defaults },
      isDefault: true,
      version: 0,
      updated_at: null
    };
  }
  const row = result.rows[0];
  return {
    docId,
    key,
    label_ar: DOC_DEFS[docId].label_ar,
    value: { ...defaults, ...(row.value || {}) },
    isDefault: false,
    version: row.version,
    updated_at: row.updated_at,
    updated_by: row.updated_by
  };
}

async function putDocSettings(docId, tenantId, value, actorId = null, reason = null) {
  await ensureSchema();
  if (!DOC_DEFS[docId]) {
    const err = new Error('إعدادات هذا المستند غير معروفة.');
    err.status = 404;
    throw err;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const err = new Error('أرسل الإعدادات في شكل بيانات منظمة.');
    err.status = 400;
    throw err;
  }
  const key = definitionKey(docId);
  const defaults = DOC_DEFS[docId].default_value;
  const merged = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    let next = value[key];
    const meta = fieldMeta(key, defaults[key]);
    if (meta.widget === 'currency' && next != null) next = String(next).trim().toUpperCase();
    if (meta.widget === 'number' && next != null && next !== '') next = Number(next);
    if (meta.widget === 'boolean') next = !!next;
    const problem = validateField(key, next, defaults[key]);
    if (problem) {
      const err = new Error(problem);
      err.status = 400;
      throw err;
    }
    merged[key] = next;
  }
  const existing = await db.query(
    `SELECT id, value, version
     FROM setting_values
     WHERE definition_key = $1
       AND COALESCE(tenant_id, 0) = $2
       AND COALESCE(branch_id, 0) = 0
       AND COALESCE(module_key, '') = 'finance'
     LIMIT 1`,
    [key, tenantId]
  );

  let row;
  if (!existing.rows.length) {
    const inserted = await db.query(
      `INSERT INTO setting_values
         (definition_key, tenant_id, branch_id, module_key, value, version, updated_by, updated_at)
       VALUES ($1, $2, NULL, 'finance', $3::jsonb, 1, $4, NOW())
       RETURNING id, value, version, updated_at, updated_by`,
      [key, tenantId, JSON.stringify(merged), actorId]
    );
    row = inserted.rows[0];
    await db.query(
      `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
       VALUES ($1, 1, $2::jsonb, $3, $4)`,
      [row.id, JSON.stringify(merged), actorId, reason || 'create']
    );
  } else {
    const prev = existing.rows[0];
    const nextVersion = Number(prev.version || 0) + 1;
    const updated = await db.query(
      `UPDATE setting_values
       SET value = $1::jsonb, version = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, value, version, updated_at, updated_by`,
      [JSON.stringify(merged), nextVersion, actorId, prev.id]
    );
    row = updated.rows[0];
    await db.query(
      `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [row.id, nextVersion, JSON.stringify(merged), actorId, reason || 'update']
    );
  }

  await db.query(
    `INSERT INTO setting_audit_events
       (definition_key, tenant_id, actor_id, action, old_value, new_value, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [
      key,
      tenantId,
      actorId,
      existing.rows.length ? 'update' : 'create',
      existing.rows.length ? JSON.stringify(existing.rows[0].value) : null,
      JSON.stringify(merged),
      JSON.stringify({ docId, source: 'finance.page-document-settings' })
    ]
  );

  return {
    docId,
    key,
    label_ar: DOC_DEFS[docId].label_ar,
    value: merged,
    isDefault: false,
    version: row.version,
    updated_at: row.updated_at,
    updated_by: row.updated_by
  };
}

async function listDocSettings(tenantId = 0) {
  await ensureSchema();
  const items = [];
  for (const docId of DOC_IDS) {
    items.push(await getDocSettings(docId, tenantId));
  }
  return items;
}

function getFieldSchema(docId) {
  const def = DOC_DEFS[docId];
  if (!def) return null;
  const fields = Object.entries(def.default_value).map(([name, sample]) => {
    const meta = fieldMeta(name, sample);
    const type = meta.widget === 'boolean' ? 'boolean' : meta.widget === 'number' ? 'number' : 'string';
    return {
      name,
      type,
      default: sample,
      label_ar: meta.label_ar,
      hint_ar: meta.hint_ar,
      group_ar: meta.group_ar,
      widget: meta.widget,
      options: meta.options
    };
  });
  const groups = [];
  fields.forEach((field) => {
    let group = groups.find((item) => item.label_ar === field.group_ar);
    if (!group) {
      group = { label_ar: field.group_ar, fields: [] };
      groups.push(group);
    }
    group.fields.push(field);
  });
  return { docId, label_ar: def.label_ar, fields, groups };
}

module.exports = {
  DOC_DEFS,
  DOC_IDS,
  definitionKey,
  ensureSchema,
  resolveTenantId,
  getDocSettings,
  putDocSettings,
  listDocSettings,
  getFieldSchema
};
