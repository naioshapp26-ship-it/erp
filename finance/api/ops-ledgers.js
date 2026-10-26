'use strict';

/**
 * Operational ledgers for Finance Leadership pages that were still placeholders.
 * Records live in Postgres. Government connectors are not invented.
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');

const KINDS = new Set([
  'cost-centers',
  'checks',
  'deposits',
  'price-lists',
  'asset-moves',
  'purchase-requests',
  'projects',
  'tasks',
  'project-costs',
  'loyalty',
  'subscriptions',
  'insurance',
  'sales-targets',
  'commissions',
  'auto-rules',
  'auto-runs',
  'pos-tickets',
  'e-invoice-queue',
  'gov-integrations',
  'work-orders',
  'workflows',
  'bookings',
  'rentals',
  'leases',
  'time-entries',
  'bom'
]);

const LOCKED = new Set(['POSTED', 'APPLIED', 'CLEARED', 'CONVERTED', 'DISPOSED', 'SOLD', 'CANCELLED', 'VALIDATED', 'ARCHIVED', 'QUEUED']);
let ready = false;

async function ensureOpsTables() {
  if (ready) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_ops_records (
      record_id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      record_number TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      amount NUMERIC NOT NULL DEFAULT 0,
      party_name TEXT,
      customer_id INTEGER,
      asset_id INTEGER,
      project_id INTEGER,
      invoice_id INTEGER,
      reference_type TEXT,
      reference_id TEXT,
      payload JSONB NOT NULL DEFAULT '{}',
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      cancelled_at TIMESTAMP,
      cancel_reason TEXT,
      UNIQUE (entity_id, kind, record_number)
    );
    CREATE INDEX IF NOT EXISTS idx_fin_ops_kind ON finance_ops_records(entity_id, kind, record_id DESC);
    CREATE TABLE IF NOT EXISTS finance_purchase_orders (
      po_id SERIAL PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER,
      vendor_name TEXT,
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expected_date DATE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  ready = true;
}

function scope(req) {
  const entityId = resolveScopedEntityId(req, (req.query && req.query.entity_id) || (req.body && req.body.entity_id));
  const entityType = resolveScopedEntityType(req, (req.query && req.query.entity_type) || (req.body && req.body.entity_type)) || 'HQ';
  return { entityId, entityType };
}

function text(value) {
  if (value == null) return '';
  return String(value).trim();
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || 'ERROR';
  return err;
}

function kindOf(req, res) {
  const kind = text(req.params.kind);
  if (!KINDS.has(kind)) {
    res.status(404).json({ success: false, error: 'نوع السجل غير معروف', code: 'UNKNOWN_KIND' });
    return null;
  }
  return kind;
}

function nextNumber(kind) {
  const prefix = {
    'cost-centers': 'CC',
    checks: 'CHK',
    deposits: 'DEP',
    'price-lists': 'PL',
    'asset-moves': 'AMV',
    'purchase-requests': 'PR',
    projects: 'PRJ',
    tasks: 'TSK',
    'project-costs': 'PC',
    loyalty: 'LOY',
    subscriptions: 'SUB',
    insurance: 'INS',
    'sales-targets': 'TGT',
    commissions: 'COM',
    'auto-rules': 'AJR',
    'auto-runs': 'AJX',
    'pos-tickets': 'POS',
    'e-invoice-queue': 'EINV',
    'gov-integrations': 'GOV',
    'work-orders': 'WO',
    workflows: 'WF',
    bookings: 'BKG',
    rentals: 'RNT',
    leases: 'LSE',
    'time-entries': 'TIM',
    bom: 'BOM'
  }[kind] || 'OPS';
  return `${prefix}-${Date.now()}`;
}

function payloadOf(body) {
  const payload = body && body.payload && typeof body.payload === 'object' ? { ...body.payload } : {};
  ['move_type', 'to_location', 'lines', 'period_start', 'period_end', 'percent', 'debit_account_id', 'credit_account_id', 'hours', 'steps', 'sku', 'unit_price'].forEach((key) => {
    if (body[key] !== undefined && payload[key] === undefined) payload[key] = body[key];
  });
  return payload;
}

async function enrich(entityId, rows) {
  const targets = rows.filter((row) => row.kind === 'sales-targets');
  if (!targets.length) return rows;
  for (const row of targets) {
    const start = row.payload && row.payload.period_start;
    const end = row.payload && row.payload.period_end;
    if (!start || !end) {
      row.actual_amount = null;
      continue;
    }
    const sum = await db.query(
      `SELECT COALESCE(SUM(total_amount),0)::float AS actual
       FROM finance_invoices
       WHERE entity_id = $1
         AND invoice_date BETWEEN $2 AND $3
         AND UPPER(COALESCE(status,'')) <> 'CANCELLED'`,
      [entityId, start, end]
    );
    row.actual_amount = sum.rows[0].actual;
    row.variance_amount = num(row.actual_amount) - num(row.amount);
  }
  return rows;
}

router.get('/loyalty/balances', async (req, res) => {
  try {
    await ensureOpsTables();
    const { entityId } = scope(req);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id مطلوب' });
    const r = await db.query(
      `SELECT customer_id, party_name,
              COALESCE(SUM(amount),0)::float AS points
       FROM finance_ops_records
       WHERE entity_id = $1 AND kind = 'loyalty' AND UPPER(status) <> 'CANCELLED'
       GROUP BY customer_id, party_name
       ORDER BY points DESC`,
      [entityId]
    );
    res.json({ success: true, balances: r.rows, count: r.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/:name', async (req, res) => {
  try {
    const { entityId } = scope(req);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id مطلوب' });
    const name = text(req.params.name);
    const queries = {
      invoices: `SELECT invoice_number, invoice_date, customer_name, total_amount, paid_amount, remaining_amount, status
                 FROM finance_invoices WHERE entity_id = $1 ORDER BY invoice_id DESC LIMIT 1000`,
      expenses: `SELECT expense_number, expense_date, expense_category, total_amount, status
                 FROM finance_expenses WHERE entity_id = $1 ORDER BY expense_id DESC LIMIT 1000`,
      customers: `SELECT customer_code, customer_name_ar, mobile, email, city
                  FROM finance_customers WHERE entity_id = $1 ORDER BY customer_id DESC LIMIT 1000`
    };
    if (!queries[name]) return res.status(404).json({ success: false, error: 'تقرير غير معروف' });
    let rows;
    try {
      rows = (await db.query(queries[name], [entityId])).rows;
    } catch (error) {
      if (error.code === '42703') {
        const fallback = {
          expenses: `SELECT expense_number, expense_date, expense_category, amount AS total_amount, status
                     FROM finance_expenses WHERE entity_id = $1 ORDER BY expense_id DESC LIMIT 1000`
        }[name];
        if (!fallback) throw error;
        rows = (await db.query(fallback, [entityId])).rows;
      } else throw error;
    }
    const header = rows[0] ? Object.keys(rows[0]) : ['empty'];
    const csv = [header.join(',')]
      .concat(rows.map((row) => header.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(',')))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:kind', async (req, res) => {
  try {
    await ensureOpsTables();
    const kind = kindOf(req, res);
    if (!kind) return;
    const { entityId } = scope(req);
    if (!entityId) return res.status(400).json({ success: false, error: 'entity_id مطلوب' });
    const params = [entityId, kind];
    let sql = `SELECT * FROM finance_ops_records WHERE entity_id = $1 AND kind = $2`;
    const q = text(req.query.q).toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (
        LOWER(record_number) LIKE $3 OR LOWER(COALESCE(title,'')) LIKE $3
        OR LOWER(COALESCE(party_name,'')) LIKE $3 OR LOWER(COALESCE(notes,'')) LIKE $3
        OR LOWER(COALESCE(status,'')) LIKE $3
      )`;
    }
    if (req.query.status) {
      params.push(text(req.query.status).toUpperCase());
      sql += ` AND UPPER(status) = $${params.length}`;
    }
    sql += ` ORDER BY record_id DESC LIMIT 400`;
    const r = await db.query(sql, params);
    const records = await enrich(entityId, r.rows);
    res.json({ success: true, records, count: records.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:kind/:id', async (req, res) => {
  try {
    await ensureOpsTables();
    const kind = kindOf(req, res);
    if (!kind) return;
    const { entityId } = scope(req);
    const r = await db.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = $2 AND entity_id = $3`,
      [req.params.id, kind, entityId]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    const [record] = await enrich(entityId, r.rows);
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function insertRecord(client, kind, body, scopeInfo) {
  const payload = payloadOf(body);
  const title = text(body.title);
  const party = text(body.party_name);
  const amount = num(body.amount);
  if (['cost-centers', 'projects', 'tasks', 'price-lists', 'subscriptions', 'insurance', 'auto-rules', 'work-orders', 'workflows', 'bookings', 'rentals', 'leases', 'bom', 'gov-integrations'].includes(kind) && !title) {
    throw httpError(400, 'العنوان إلزامي', 'TITLE_REQUIRED');
  }
  if (['checks', 'deposits', 'project-costs', 'loyalty', 'sales-targets', 'commissions', 'pos-tickets', 'time-entries'].includes(kind) && !(Math.abs(amount) > 0)) {
    throw httpError(400, 'القيمة يجب أن تكون أكبر من صفر', 'AMOUNT_REQUIRED');
  }
  if (kind === 'gov-integrations' && text(body.status).toUpperCase() === 'CONNECTED') {
    throw httpError(409, 'لا يوجد موصل حكومي مفعّل. السجل يبقى غير متصل.', 'CONNECTOR_ABSENT');
  }
  if (kind === 'e-invoice-queue') {
    if (!body.invoice_id) throw httpError(400, 'الفاتورة المحلية مطلوبة', 'INVOICE_REQUIRED');
    const invoice = await client.query(
      `SELECT invoice_id, invoice_number, customer_id, customer_name, total_amount, tax_amount,
              status, payment_status, journal_entry_id, currency_code, entity_id
       FROM finance_invoices WHERE invoice_id = $1 FOR UPDATE`,
      [body.invoice_id]
    );
    if (!invoice.rows[0]) throw httpError(404, 'الفاتورة المحلية غير موجودة', 'INVOICE_NOT_FOUND');
    const inv = invoice.rows[0];
    if (String(inv.entity_id) !== String(scopeInfo.entityId)) {
      throw httpError(403, 'الفاتورة خارج نطاق الكيان', 'ENTITY_SCOPE');
    }
    if (!inv.customer_id) throw httpError(422, 'الفاتورة بلا عميل — أكمل البيانات الإلزامية أولًا', 'CUSTOMER_REQUIRED');
    if (['CANCELLED', 'DRAFT'].includes(String(inv.status || '').toUpperCase())) {
      throw httpError(409, 'لا تُدرج فاتورة ملغاة أو مسودة في طابور الفاتورة الإلكترونية', 'INVOICE_STATUS');
    }
    const dup = await client.query(
      `SELECT record_id FROM finance_ops_records
       WHERE entity_id = $1 AND kind = 'e-invoice-queue' AND invoice_id = $2
         AND UPPER(status) NOT IN ('CANCELLED','REJECTED','ARCHIVED')
       LIMIT 1`,
      [scopeInfo.entityId, inv.invoice_id]
    );
    if (dup.rows[0]) {
      throw httpError(409, 'الفاتورة موجودة مسبقًا في الطابور', 'ALREADY_QUEUED');
    }
    payload.connector = 'ABSENT';
    payload.government_send = false;
    payload.note = 'دورة محلية فقط. لا إرسال لهيئة ضريبية قبل تهيئة الاعتمادات الرسمية.';
    payload.invoice_snapshot = {
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      total_amount: inv.total_amount,
      tax_amount: inv.tax_amount,
      journal_entry_id: inv.journal_entry_id,
      currency_code: inv.currency_code || null,
      status: inv.status
    };
    body.title = body.title || `فاتورة إلكترونية ${inv.invoice_number}`;
    body.party_name = body.party_name || inv.customer_name;
    body.amount = body.amount != null ? body.amount : inv.total_amount;
    body.reference_type = 'INVOICE';
    body.reference_id = String(inv.invoice_id);
    body.status = text(body.status).toUpperCase() || 'READY';
  }
  if (kind === 'asset-moves') {
    return insertAssetMove(client, body, payload, scopeInfo);
  }
  const status = text(body.status).toUpperCase() || defaultStatus(kind);
  const number = text(body.record_number) || nextNumber(kind);
  const r = await client.query(
    `INSERT INTO finance_ops_records (
      kind, record_number, title, status, amount, party_name, customer_id, asset_id, project_id, invoice_id,
      reference_type, reference_id, payload, entity_id, entity_type, notes, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17)
    RETURNING *`,
    [
      kind,
      number,
      title || null,
      status,
      amount,
      party || null,
      body.customer_id || null,
      body.asset_id || null,
      body.project_id || null,
      body.invoice_id || null,
      text(body.reference_type) || null,
      body.reference_id != null ? String(body.reference_id) : null,
      JSON.stringify(payload),
      scopeInfo.entityId,
      scopeInfo.entityType,
      text(body.notes) || null,
      text(body.created_by) || 'ui'
    ]
  );
  return r.rows[0];
}

function defaultStatus(kind) {
  if (kind === 'checks') return 'RECEIVED';
  if (kind === 'purchase-requests') return 'DRAFT';
  if (kind === 'gov-integrations') return 'DISCONNECTED';
  if (kind === 'e-invoice-queue') return 'READY';
  if (kind === 'loyalty' || kind === 'auto-runs') return 'POSTED';
  if (['cost-centers', 'price-lists', 'subscriptions', 'insurance', 'auto-rules', 'workflows', 'bom'].includes(kind)) return 'ACTIVE';
  if (kind === 'bookings') return 'CONFIRMED';
  return 'OPEN';
}

async function insertAssetMove(client, body, payload, scopeInfo) {
  const assetId = Number(body.asset_id);
  if (!Number.isInteger(assetId)) throw httpError(400, 'الأصل مطلوب', 'ASSET_REQUIRED');
  const moveType = text(payload.move_type || body.move_type).toUpperCase();
  if (!['TRANSFER', 'DISPOSAL', 'SALE'].includes(moveType)) {
    throw httpError(400, 'نوع الحركة: TRANSFER أو DISPOSAL أو SALE', 'MOVE_TYPE');
  }
  const asset = await client.query(
    `SELECT * FROM finance_fixed_assets WHERE asset_id = $1 AND entity_id = $2 FOR UPDATE`,
    [assetId, scopeInfo.entityId]
  );
  if (!asset.rows[0]) throw httpError(404, 'الأصل غير موجود في هذا الكيان', 'ASSET_NOT_FOUND');
  const current = asset.rows[0];
  if (['DISPOSED', 'SOLD', 'RETIRED'].includes(String(current.status || '').toUpperCase())) {
    throw httpError(409, 'الأصل مستبعد مسبقًا', 'ASSET_CLOSED');
  }
  const toLocation = text(payload.to_location);
  if (moveType === 'TRANSFER' && !toLocation) throw httpError(400, 'موقع الوصول إلزامي', 'LOCATION_REQUIRED');
  payload.before = {
    location: current.location,
    status: current.status,
    disposal_date: current.disposal_date,
    disposal_value: current.disposal_value
  };
  payload.move_type = moveType;
  if (moveType === 'TRANSFER') {
    await client.query(
      `UPDATE finance_fixed_assets SET location = $2, updated_at = NOW() WHERE asset_id = $1`,
      [assetId, toLocation]
    );
  } else {
    const nextStatus = moveType === 'SALE' ? 'SOLD' : 'DISPOSED';
    await client.query(
      `UPDATE finance_fixed_assets
       SET status = $2, disposal_date = CURRENT_DATE, disposal_value = $3, updated_at = NOW()
       WHERE asset_id = $1`,
      [assetId, nextStatus, num(body.amount)]
    );
  }
  const r = await client.query(
    `INSERT INTO finance_ops_records (
      kind, record_number, title, status, amount, asset_id, payload, entity_id, entity_type, notes, created_by
    ) VALUES ('asset-moves',$1,$2,'POSTED',$3,$4,$5::jsonb,$6,$7,$8,$9) RETURNING *`,
    [
      text(body.record_number) || nextNumber('asset-moves'),
      `${moveType} ${current.asset_code || assetId}`,
      num(body.amount),
      assetId,
      JSON.stringify(payload),
      scopeInfo.entityId,
      scopeInfo.entityType,
      text(body.notes) || null,
      text(body.created_by) || 'ui'
    ]
  );
  return r.rows[0];
}

router.post('/:kind', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureOpsTables();
    const kind = kindOf(req, res);
    if (!kind) return;
    const scopeInfo = scope(req);
    if (!scopeInfo.entityId) return res.status(400).json({ success: false, error: 'entity_id مطلوب' });
    await client.query('BEGIN');
    const record = await insertRecord(client, kind, req.body || {}, scopeInfo);
    await client.query('COMMIT');
    res.status(201).json({ success: true, record });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(error.status || (error.code === '23505' ? 409 : 500)).json({
      success: false,
      error: error.code === '23505' ? 'رقم السجل مكرر' : error.message,
      code: error.code || 'ERROR'
    });
  } finally {
    client.release();
  }
});

router.put('/:kind/:id', async (req, res) => {
  try {
    await ensureOpsTables();
    const kind = kindOf(req, res);
    if (!kind) return;
    const { entityId } = scope(req);
    const existing = await db.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = $2 AND entity_id = $3`,
      [req.params.id, kind, entityId]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    if (LOCKED.has(String(existing.rows[0].status || '').toUpperCase())) {
      const b = req.body || {};
      const same = (left, right) => String(left == null ? '' : left) === String(right == null ? '' : right);
      const financialChange = (b.amount != null && !same(num(b.amount), num(existing.rows[0].amount)))
        || (b.status && text(b.status).toUpperCase() !== String(existing.rows[0].status || '').toUpperCase())
        || (b.customer_id != null && !same(b.customer_id, existing.rows[0].customer_id))
        || (b.asset_id != null && !same(b.asset_id, existing.rows[0].asset_id))
        || (b.invoice_id != null && !same(b.invoice_id, existing.rows[0].invoice_id));
      if (financialChange) {
        return res.status(409).json({
          success: false,
          error: 'السجل المرحّل لا يُعدَّل ماليًا. استخدم الإلغاء إن كان متاحًا.',
          code: 'LOCKED'
        });
      }
    }
    const b = req.body || {};
    const payload = b.payload ? payloadOf(b) : null;
    const r = await db.query(
      `UPDATE finance_ops_records SET
        record_number = COALESCE($4, record_number),
        title = COALESCE($5, title),
        party_name = COALESCE($6, party_name),
        amount = COALESCE($7, amount),
        notes = COALESCE($8, notes),
        payload = COALESCE($9::jsonb, payload),
        status = COALESCE($10, status),
        customer_id = COALESCE($11, customer_id),
        asset_id = COALESCE($12, asset_id),
        project_id = COALESCE($13, project_id),
        invoice_id = COALESCE($14, invoice_id),
        updated_at = NOW()
       WHERE record_id = $1 AND kind = $2 AND entity_id = $3
       RETURNING *`,
      [
        req.params.id,
        kind,
        entityId,
        b.record_number != null ? text(b.record_number) : null,
        b.title != null ? text(b.title) : null,
        b.party_name != null ? text(b.party_name) : null,
        b.amount != null ? num(b.amount) : null,
        b.notes != null ? text(b.notes) : null,
        payload ? JSON.stringify(payload) : null,
        b.status ? text(b.status).toUpperCase() : null,
        b.customer_id != null ? b.customer_id : null,
        b.asset_id != null ? b.asset_id : null,
        b.project_id != null ? b.project_id : null,
        b.invoice_id != null ? b.invoice_id : null
      ]
    );
    res.json({ success: true, record: r.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:kind/:id', async (req, res) => {
  try {
    await ensureOpsTables();
    const kind = kindOf(req, res);
    if (!kind) return;
    const { entityId } = scope(req);
    const existing = await db.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = $2 AND entity_id = $3`,
      [req.params.id, kind, entityId]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    const status = String(existing.rows[0].status || '').toUpperCase();
    if (LOCKED.has(status) || ['RECEIVED', 'DEPOSITED', 'CONFIRMED', 'ACTIVE'].includes(status) && ['checks', 'deposits', 'asset-moves', 'loyalty', 'pos-tickets'].includes(kind)) {
      return res.status(409).json({
        success: false,
        error: 'لا يُحذف سجل تشغيلي. ألغِه مع سبب إن كانت السياسة تسمح.',
        code: 'NO_HARD_DELETE'
      });
    }
    await db.query(
      `DELETE FROM finance_ops_records WHERE record_id = $1 AND kind = $2 AND entity_id = $3`,
      [req.params.id, kind, entityId]
    );
    res.json({ success: true, deleted: Number(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const E_INVOICE_TRANSITIONS = {
  READY: ['QUEUED', 'CANCELLED'],
  QUEUED: ['VALIDATED', 'FAILED', 'REJECTED', 'CANCELLED'],
  VALIDATED: ['ARCHIVED'],
  FAILED: ['QUEUED', 'ARCHIVED', 'CANCELLED'],
  REJECTED: ['QUEUED', 'ARCHIVED', 'CANCELLED'],
  ARCHIVED: [],
  CANCELLED: []
};

router.post('/e-invoice-queue/:id/transition', async (req, res) => {
  try {
    await ensureOpsTables();
    const { entityId } = scope(req);
    const next = text((req.body || {}).status).toUpperCase();
    const note = text((req.body || {}).note || (req.body || {}).reason);
    if (!next) return res.status(400).json({ success: false, error: 'الحالة التالية مطلوبة' });
    if (next === 'SENT' || next === 'SENT_GOV' || next === 'SUBMITTED') {
      return res.status(409).json({
        success: false,
        error: 'الإرسال الحكومي غير مفعّل. لا اعتمادات رسمية في هذه البيئة.',
        code: 'CONNECTOR_ABSENT'
      });
    }
    const existing = await db.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = 'e-invoice-queue' AND entity_id = $2`,
      [req.params.id, entityId]
    );
    if (!existing.rows[0]) return res.status(404).json({ success: false, error: 'سجل الطابور غير موجود' });
    const current = String(existing.rows[0].status || '').toUpperCase();
    const allowed = E_INVOICE_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      return res.status(409).json({
        success: false,
        error: `لا يمكن الانتقال من ${current} إلى ${next}`,
        code: 'INVALID_TRANSITION',
        allowed
      });
    }
    const payload = {
      ...(existing.rows[0].payload || {}),
      last_transition: { from: current, to: next, at: new Date().toISOString(), note: note || null },
      history: [((existing.rows[0].payload || {}).history || []), { from: current, to: next, at: new Date().toISOString(), note: note || null }].flat().slice(-20)
    };
    if (next === 'VALIDATED' && !payload.invoice_snapshot?.journal_entry_id) {
      payload.validation_warning = 'الفاتورة بلا قيد محاسبي مرتبط في اللقطة المحفوظة';
    }
    const r = await db.query(
      `UPDATE finance_ops_records
       SET status = $3, payload = $4::jsonb, notes = COALESCE($5, notes), updated_at = NOW()
       WHERE record_id = $1 AND entity_id = $2
       RETURNING *`,
      [req.params.id, entityId, next, JSON.stringify(payload), note || null]
    );
    res.json({
      success: true,
      record: r.rows[0],
      message: next === 'VALIDATED'
        ? 'اعتماد محلي ناجح. الإرسال الحكومي ما زال غير موصول.'
        : 'تم تحديث حالة الطابور'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/deposits/:id/apply', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureOpsTables();
    const { entityId } = scope(req);
    const invoiceId = Number((req.body || {}).invoice_id);
    if (!Number.isInteger(invoiceId)) {
      return res.status(400).json({ success: false, error: 'فاتورة التطبيق مطلوبة' });
    }
    await client.query('BEGIN');
    const dep = await client.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = 'deposits' AND entity_id = $2 FOR UPDATE`,
      [req.params.id, entityId]
    );
    if (!dep.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'العربون غير موجود' });
    }
    if (String(dep.rows[0].status).toUpperCase() !== 'OPEN') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'العربون غير مفتوح للتطبيق', code: 'NOT_OPEN' });
    }
    const inv = await client.query(
      `SELECT * FROM finance_invoices WHERE invoice_id = $1 AND entity_id = $2 FOR UPDATE`,
      [invoiceId, entityId]
    );
    if (!inv.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الفاتورة غير موجودة' });
    }
    const amount = num(dep.rows[0].amount);
    const remaining = num(inv.rows[0].remaining_amount);
    if (amount - remaining > 0.001) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'قيمة العربون أكبر من المتبقي على الفاتورة', code: 'EXCEEDS_REMAINING' });
    }
    const paid = num(inv.rows[0].paid_amount) + amount;
    const nextRemaining = remaining - amount;
    const paymentStatus = nextRemaining <= 0.001 ? 'PAID' : 'PARTIAL';
    let status = String(inv.rows[0].status || 'OPEN').toUpperCase();
    if (status !== 'CANCELLED') status = nextRemaining <= 0.001 ? 'PAID' : 'PARTIAL';
    await client.query(
      `UPDATE finance_invoices
       SET paid_amount = $2, remaining_amount = $3, payment_status = $4, status = $5, updated_at = NOW()
       WHERE invoice_id = $1`,
      [invoiceId, paid, nextRemaining, paymentStatus, status]
    );
    const payload = { ...(dep.rows[0].payload || {}), invoice_id: invoiceId, applied_remaining_before: remaining };
    const updated = await client.query(
      `UPDATE finance_ops_records
       SET status = 'APPLIED', invoice_id = $2, payload = $3::jsonb, updated_at = NOW()
       WHERE record_id = $1 RETURNING *`,
      [dep.rows[0].record_id, invoiceId, JSON.stringify(payload)]
    );
    await client.query('COMMIT');
    res.json({ success: true, record: updated.rows[0], message: 'طُبّق العربون على الفاتورة' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(error.status || 500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.post('/purchase-requests/:id/convert', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureOpsTables();
    const { entityId, entityType } = scope(req);
    await client.query('BEGIN');
    const pr = await client.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = 'purchase-requests' AND entity_id = $2 FOR UPDATE`,
      [req.params.id, entityId]
    );
    if (!pr.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'طلب الشراء غير موجود' });
    }
    if (String(pr.rows[0].status).toUpperCase() === 'CONVERTED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'الطلب محوّل مسبقًا', code: 'ALREADY_CONVERTED' });
    }
    const vendor = text((req.body || {}).vendor_name) || pr.rows[0].party_name;
    if (!vendor) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'اسم المورد مطلوب للتحويل' });
    }
    const po = await client.query(
      `INSERT INTO finance_purchase_orders
        (po_number, vendor_name, status, total_amount, notes, entity_id, entity_type, created_by)
       VALUES ($1,$2,'OPEN',$3,$4,$5,$6,$7) RETURNING *`,
      [
        `PO-${Date.now()}`,
        vendor,
        num(pr.rows[0].amount),
        `من طلب شراء ${pr.rows[0].record_number}`,
        entityId,
        entityType,
        'ops-convert'
      ]
    );
    const payload = { ...(pr.rows[0].payload || {}), po_id: po.rows[0].po_id, po_number: po.rows[0].po_number };
    const updated = await client.query(
      `UPDATE finance_ops_records
       SET status = 'CONVERTED', party_name = $2, reference_type = 'PURCHASE_ORDER', reference_id = $3, payload = $4::jsonb, updated_at = NOW()
       WHERE record_id = $1 RETURNING *`,
      [pr.rows[0].record_id, vendor, String(po.rows[0].po_id), JSON.stringify(payload)]
    );
    await client.query('COMMIT');
    res.json({ success: true, record: updated.rows[0], order: po.rows[0] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.post('/auto-rules/:id/run', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureOpsTables();
    const { entityId, entityType } = scope(req);
    const amount = num((req.body || {}).amount);
    if (!(amount > 0)) return res.status(400).json({ success: false, error: 'المبلغ مطلوب' });
    await client.query('BEGIN');
    const rule = await client.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = 'auto-rules' AND entity_id = $2 FOR UPDATE`,
      [req.params.id, entityId]
    );
    if (!rule.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'القاعدة غير موجودة' });
    }
    if (String(rule.rows[0].status).toUpperCase() !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'القاعدة غير نشطة' });
    }
    const debitId = Number(rule.rows[0].payload && rule.rows[0].payload.debit_account_id);
    const creditId = Number(rule.rows[0].payload && rule.rows[0].payload.credit_account_id);
    if (!debitId || !creditId || debitId === creditId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'حدّد حساب مدين وحساب دائن مختلفين', code: 'ACCOUNTS_REQUIRED' });
    }
    const accounts = await client.query(
      `SELECT account_id, account_code FROM finance_accounts WHERE account_id = ANY($1::int[]) AND entity_id = $2`,
      [[debitId, creditId], entityId]
    );
    if (accounts.rows.length !== 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'أحد الحسابات غير موجود في هذا الكيان' });
    }
    const codeOf = (id) => accounts.rows.find((row) => Number(row.account_id) === id).account_code;
    const entryNumber = `JE-AJR-${rule.rows[0].record_id}-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const description = text((req.body || {}).description) || `تنفيذ قاعدة ${rule.rows[0].title || rule.rows[0].record_number}`;
    const entry = await client.query(
      `INSERT INTO finance_journal_entries
        (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
         status, is_posted, posted_at, posted_by, entity_type, entity_id, fiscal_year, fiscal_period, created_by)
       VALUES ($1,$2,'AUTO',$3,$4,'AUTO_RULE',$5,'POSTED',true,NOW(),'ops',$6,$7,$8,$9,'ops')
       RETURNING *`,
      [entryNumber, today, description, rule.rows[0].record_number, rule.rows[0].record_id, entityType, entityId, Number(today.slice(0, 4)), Number(today.slice(5, 7))]
    );
    await client.query(
      `INSERT INTO finance_journal_lines
        (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description, entity_type, entity_id)
       VALUES ($1,1,$2,$3,$4,0,$5,$6,$7), ($1,2,$8,$9,0,$4,$5,$6,$7)`,
      [entry.rows[0].entry_id, debitId, codeOf(debitId), amount, description, entityType, entityId, creditId, codeOf(creditId)]
    );
    const run = await client.query(
      `INSERT INTO finance_ops_records
        (kind, record_number, title, status, amount, reference_type, reference_id, payload, entity_id, entity_type, notes, created_by)
       VALUES ('auto-runs',$1,$2,'POSTED',$3,'JOURNAL_ENTRY',$4,$5::jsonb,$6,$7,$8,'ops')
       RETURNING *`,
      [
        nextNumber('auto-runs'),
        rule.rows[0].title,
        amount,
        String(entry.rows[0].entry_id),
        JSON.stringify({ rule_id: rule.rows[0].record_id, entry_number: entryNumber, debit_account_id: debitId, credit_account_id: creditId }),
        entityId,
        entityType,
        description
      ]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, run: run.rows[0], journal_entry_id: entry.rows[0].entry_id, entry_number: entryNumber });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(error.status || 500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.post('/:kind/:id/cancel', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureOpsTables();
    const kind = kindOf(req, res);
    if (!kind) return;
    const reason = text((req.body || {}).reason);
    if (!reason) return res.status(400).json({ success: false, error: 'سبب الإلغاء إلزامي', code: 'REASON_REQUIRED' });
    const { entityId } = scope(req);
    await client.query('BEGIN');
    const row = await client.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = $2 AND entity_id = $3 FOR UPDATE`,
      [req.params.id, kind, entityId]
    );
    if (!row.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    const record = row.rows[0];
    if (String(record.status).toUpperCase() === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'السجل ملغى مسبقًا' });
    }
    if (kind === 'deposits' && String(record.status).toUpperCase() === 'APPLIED' && record.invoice_id) {
      const inv = await client.query(
        `SELECT * FROM finance_invoices WHERE invoice_id = $1 AND entity_id = $2 FOR UPDATE`,
        [record.invoice_id, entityId]
      );
      if (inv.rows[0]) {
        const paid = Math.max(num(inv.rows[0].paid_amount) - num(record.amount), 0);
        const remaining = num(inv.rows[0].remaining_amount) + num(record.amount);
        const paymentStatus = paid <= 0.001 ? 'UNPAID' : 'PARTIAL';
        await client.query(
          `UPDATE finance_invoices
           SET paid_amount = $2, remaining_amount = $3, payment_status = $4, status = 'PARTIAL', updated_at = NOW()
           WHERE invoice_id = $1`,
          [record.invoice_id, paid, remaining, paymentStatus]
        );
      }
    }
    if (kind === 'asset-moves' && record.asset_id && record.payload && record.payload.before) {
      const later = await client.query(
        `SELECT COUNT(*)::int AS n FROM finance_ops_records
         WHERE kind = 'asset-moves' AND asset_id = $1 AND entity_id = $2 AND record_id > $3 AND UPPER(status) <> 'CANCELLED'`,
        [record.asset_id, entityId, record.record_id]
      );
      if (later.rows[0].n > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: 'توجد حركة أحدث على الأصل. ألغِها أولًا.', code: 'LATER_MOVE' });
      }
      const before = record.payload.before;
      await client.query(
        `UPDATE finance_fixed_assets
         SET location = $2, status = $3, disposal_date = $4, disposal_value = $5, updated_at = NOW()
         WHERE asset_id = $1`,
        [record.asset_id, before.location, before.status, before.disposal_date, before.disposal_value]
      );
    }
    const updated = await client.query(
      `UPDATE finance_ops_records
       SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = $2, updated_at = NOW()
       WHERE record_id = $1 RETURNING *`,
      [record.record_id, reason]
    );
    await client.query('COMMIT');
    res.json({ success: true, record: updated.rows[0] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(error.status || 500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
