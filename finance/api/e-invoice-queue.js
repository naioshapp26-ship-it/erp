'use strict';

/**
 * Sales e-invoice local queue — operational cycle (no government connector).
 * READY → QUEUED → VALIDATED|FAILED|REJECTED → ARCHIVED
 * Government send always returns CONNECTOR_ABSENT (credentials not present).
 *
 * Schema: additive only — CREATE IF NOT EXISTS for ops table (shared) +
 * ALTER TABLE ... ADD COLUMN IF NOT EXISTS audit_log.
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { denyUnless } = require('../services/sales-einvoice-authz');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');

const KIND = 'e-invoice-queue';

const TRANSITIONS = {
  READY: ['QUEUED', 'CANCELLED'],
  QUEUED: ['VALIDATED', 'FAILED', 'REJECTED', 'CANCELLED'],
  VALIDATED: ['ARCHIVED'],
  FAILED: ['QUEUED', 'ARCHIVED', 'CANCELLED'],
  REJECTED: ['QUEUED', 'ARCHIVED', 'CANCELLED'],
  ARCHIVED: [],
  CANCELLED: []
};

const STATUS_AR = {
  READY: 'جاهز',
  QUEUED: 'في الطابور',
  VALIDATED: 'مُتحقق محليًا',
  FAILED: 'فشل تحقق',
  REJECTED: 'مرفوض',
  ARCHIVED: 'مؤرشف',
  CANCELLED: 'ملغى'
};

let ready = false;

async function ensureTables() {
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
  `);
  await db.query(
    `ALTER TABLE finance_ops_records ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`
  );
  ready = true;
}

function entityId(req, body) {
  return resolveScopedEntityId(
    req,
    (body && body.entity_id) || req.query.entity_id || req.headers['x-entity-id']
  ) || 'HQ001';
}

function entityType(req, body) {
  return resolveScopedEntityType(
    req,
    (body && body.entity_type) || req.query.entity_type || req.headers['x-entity-type']
  ) || 'HQ';
}

function actorLabel(req, body) {
  return (
    req.einvoiceActor?.userName ||
    req.einvoiceActor?.userId ||
    (body && (body.created_by || body.actor)) ||
    req.authUser?.email ||
    req.authUser?.name ||
    req.headers['x-user-email'] ||
    'ui'
  );
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function auditEntry(action, by, extra = {}) {
  return {
    action,
    by: by || 'ui',
    at: new Date().toISOString(),
    ...extra
  };
}

async function appendAudit(client, recordId, entry) {
  await client.query(
    `UPDATE finance_ops_records
     SET audit_log = COALESCE(audit_log, '[]'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE record_id = $1`,
    [recordId, JSON.stringify([entry])]
  );
}

function nextNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `EINV-${stamp}`;
}

async function loadRecord(recordId, eid) {
  const r = await db.query(
    `SELECT * FROM finance_ops_records
     WHERE record_id = $1 AND kind = $2 AND entity_id = $3`,
    [recordId, KIND, eid]
  );
  return r.rows[0] || null;
}

async function enrich(row) {
  if (!row) return null;
  let invoice = null;
  if (row.invoice_id) {
    const inv = await db.query(
      `SELECT invoice_id, invoice_number, customer_id, customer_name, total_amount, tax_amount,
              status, payment_status, journal_entry_id, currency_code, invoice_date
       FROM finance_invoices WHERE invoice_id = $1`,
      [row.invoice_id]
    );
    invoice = inv.rows[0] || null;
  }
  return {
    ...row,
    status_ar: STATUS_AR[String(row.status || '').toUpperCase()] || row.status,
    invoice,
    government_send_enabled: false,
    connector: 'ABSENT'
  };
}

router.get('/queue', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureTables();
    const eid = entityId(req);
    const status = text(req.query.status).toUpperCase();
    const q = text(req.query.q).toLowerCase();
    const params = [eid, KIND];
    let sql = `SELECT * FROM finance_ops_records WHERE entity_id = $1 AND kind = $2`;
    if (status) {
      params.push(status);
      sql += ` AND UPPER(status) = $${params.length}`;
    }
    sql += ` ORDER BY record_id DESC LIMIT 500`;
    const r = await db.query(sql, params);
    let rows = r.rows;
    if (q) {
      rows = rows.filter((row) => {
        const hay = `${row.record_number} ${row.title || ''} ${row.party_name || ''} ${row.invoice_id || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const enriched = await Promise.all(rows.map(enrich));
    const counts = enriched.reduce((acc, row) => {
      const st = String(row.status || '').toUpperCase();
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});
    res.json({
      success: true,
      records: enriched,
      count: enriched.length,
      counts,
      connector: 'ABSENT',
      note: 'دورة محلية فقط. الإرسال للجهة الضريبية غير موصول — بلا اعتمادات رسمية.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/queue/:id', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureTables();
    const row = await loadRecord(Number(req.params.id), entityId(req));
    if (!row) return res.status(404).json({ success: false, error: 'سجل الطابور غير موجود', code: 'NOT_FOUND' });
    res.json({ success: true, record: await enrich(row) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/eligible-invoices', async (req, res) => {
  try {
    if (denyUnless(req, res, 'view')) return;
    await ensureTables();
    const eid = entityId(req);
    const r = await db.query(
      `SELECT i.invoice_id, i.invoice_number, i.customer_id, i.customer_name,
              i.total_amount, i.tax_amount, i.status, i.payment_status,
              i.journal_entry_id, i.currency_code, i.invoice_date
       FROM finance_invoices i
       WHERE i.entity_id = $1
         AND UPPER(COALESCE(i.status,'')) NOT IN ('CANCELLED','DRAFT')
         AND i.customer_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM finance_ops_records o
           WHERE o.entity_id = i.entity_id
             AND o.kind = $2
             AND o.invoice_id = i.invoice_id
             AND UPPER(o.status) NOT IN ('CANCELLED','REJECTED','ARCHIVED')
         )
       ORDER BY i.invoice_id DESC
       LIMIT 200`,
      [eid, KIND]
    );
    res.json({ success: true, invoices: r.rows, count: r.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/queue', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'enqueue')) return;
    await ensureTables();
    const body = req.body || {};
    const eid = entityId(req, body);
    const etype = entityType(req, body);
    const invoiceId = Number(body.invoice_id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ success: false, error: 'الفاتورة المحلية مطلوبة', code: 'INVOICE_REQUIRED' });
    }
    await client.query('BEGIN');
    const invoice = await client.query(
      `SELECT invoice_id, invoice_number, customer_id, customer_name, total_amount, tax_amount,
              status, payment_status, journal_entry_id, currency_code, entity_id
       FROM finance_invoices WHERE invoice_id = $1 FOR UPDATE`,
      [invoiceId]
    );
    if (!invoice.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الفاتورة المحلية غير موجودة', code: 'INVOICE_NOT_FOUND' });
    }
    const inv = invoice.rows[0];
    if (String(inv.entity_id) !== String(eid)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'الفاتورة خارج نطاق الكيان', code: 'ENTITY_SCOPE' });
    }
    if (!inv.customer_id) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        success: false,
        error: 'الفاتورة بلا عميل — أكمل البيانات الإلزامية أولًا',
        code: 'CUSTOMER_REQUIRED'
      });
    }
    if (['CANCELLED', 'DRAFT'].includes(String(inv.status || '').toUpperCase())) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'لا تُدرج فاتورة ملغاة أو مسودة في طابور الفاتورة الإلكترونية',
        code: 'INVOICE_STATUS'
      });
    }
    const dup = await client.query(
      `SELECT record_id FROM finance_ops_records
       WHERE entity_id = $1 AND kind = $2 AND invoice_id = $3
         AND UPPER(status) NOT IN ('CANCELLED','REJECTED','ARCHIVED')
       LIMIT 1`,
      [eid, KIND, inv.invoice_id]
    );
    if (dup.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'الفاتورة موجودة مسبقًا في الطابور',
        code: 'ALREADY_QUEUED',
        record_id: dup.rows[0].record_id
      });
    }

    const by = actorLabel(req, body);
    const payload = {
      connector: 'ABSENT',
      government_send: false,
      note: 'دورة محلية فقط. لا إرسال لهيئة ضريبية قبل تهيئة الاعتمادات الرسمية.',
      invoice_snapshot: {
        invoice_number: inv.invoice_number,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        total_amount: inv.total_amount,
        tax_amount: inv.tax_amount,
        journal_entry_id: inv.journal_entry_id,
        currency_code: inv.currency_code || null,
        status: inv.status
      },
      history: [{ from: null, to: 'READY', at: new Date().toISOString(), note: text(body.notes) || null }]
    };
    const title = text(body.title) || `فاتورة إلكترونية ${inv.invoice_number}`;
    const audit = [auditEntry('enqueue', by, { invoice_id: inv.invoice_id, status: 'READY' })];
    const inserted = await client.query(
      `INSERT INTO finance_ops_records (
        kind, record_number, title, status, amount, party_name, customer_id, invoice_id,
        reference_type, reference_id, payload, entity_id, entity_type, notes, created_by, audit_log
      ) VALUES ($1,$2,$3,'READY',$4,$5,$6,$7,'INVOICE',$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb)
      RETURNING *`,
      [
        KIND,
        nextNumber(),
        title,
        inv.total_amount || 0,
        inv.customer_name || null,
        inv.customer_id,
        inv.invoice_id,
        String(inv.invoice_id),
        JSON.stringify(payload),
        eid,
        etype,
        text(body.notes) || null,
        by,
        JSON.stringify(audit)
      ]
    );
    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      record: await enrich(inserted.rows[0]),
      message: 'أُدرجت الفاتورة في الطابور المحلي (جاهز)'
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.put('/queue/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'update')) return;
    await ensureTables();
    const eid = entityId(req, req.body);
    const existing = await client.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = $2 AND entity_id = $3 FOR UPDATE`,
      [Number(req.params.id), KIND, eid]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ success: false, error: 'سجل الطابور غير موجود', code: 'NOT_FOUND' });
    }
    const st = String(existing.rows[0].status || '').toUpperCase();
    if (!['READY', 'FAILED', 'REJECTED'].includes(st)) {
      return res.status(409).json({
        success: false,
        error: 'التعديل مسموح فقط للحالات جاهز/فشل/مرفوض',
        code: 'NOT_EDITABLE',
        status: st
      });
    }
    const body = req.body || {};
    const by = actorLabel(req, body);
    const title = text(body.title) || existing.rows[0].title;
    const notes = body.notes != null ? text(body.notes) : existing.rows[0].notes;
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE finance_ops_records
       SET title = $3, notes = $4, updated_at = NOW(),
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $5::jsonb
       WHERE record_id = $1 AND entity_id = $2
       RETURNING *`,
      [
        Number(req.params.id),
        eid,
        title,
        notes || null,
        JSON.stringify([auditEntry('update', by, { fields: ['title', 'notes'] })])
      ]
    );
    await client.query('COMMIT');
    res.json({ success: true, record: await enrich(updated.rows[0]) });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

async function handleTransition(req, res) {
  const client = await db.pool.connect();
  try {
    const body = req.body || {};
    const next = text(body.status || body.next).toUpperCase();
    if (next === 'SENT' || next === 'SENT_GOV' || next === 'SUBMITTED') {
      if (denyUnless(req, res, 'gov_send')) return;
      return res.status(409).json({
        success: false,
        error: 'الإرسال الحكومي غير مفعّل. لا اعتمادات رسمية في هذه البيئة.',
        code: 'CONNECTOR_ABSENT'
      });
    }
    const action = next === 'ARCHIVED' ? 'archive' : next === 'CANCELLED' ? 'cancel' : 'transition';
    if (denyUnless(req, res, action)) return;
    await ensureTables();
    if (!next) {
      return res.status(400).json({ success: false, error: 'الحالة التالية مطلوبة', code: 'STATUS_REQUIRED' });
    }
    const eid = entityId(req, body);
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = $2 AND entity_id = $3 FOR UPDATE`,
      [Number(req.params.id), KIND, eid]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'سجل الطابور غير موجود', code: 'NOT_FOUND' });
    }
    const current = String(existing.rows[0].status || '').toUpperCase();
    const allowed = TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `لا يمكن الانتقال من ${current} إلى ${next}`,
        code: 'INVALID_TRANSITION',
        allowed
      });
    }
    const note = text(body.note || body.reason);
    if (next === 'CANCELLED' && !note) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'سبب الإلغاء إلزامي', code: 'REASON_REQUIRED' });
    }
    const by = actorLabel(req, body);
    const prevPayload = existing.rows[0].payload || {};
    const payload = {
      ...prevPayload,
      connector: 'ABSENT',
      government_send: false,
      last_transition: { from: current, to: next, at: new Date().toISOString(), note: note || null, by },
      history: [
        ...(Array.isArray(prevPayload.history) ? prevPayload.history : []),
        { from: current, to: next, at: new Date().toISOString(), note: note || null, by }
      ].slice(-30)
    };
    if (next === 'VALIDATED' && !payload.invoice_snapshot?.journal_entry_id) {
      payload.validation_warning = 'الفاتورة بلا قيد محاسبي مرتبط في اللقطة المحفوظة';
    }
    const updated = await client.query(
      `UPDATE finance_ops_records
       SET status = $3,
           payload = $4::jsonb,
           notes = COALESCE($5, notes),
           cancelled_at = CASE WHEN $3 = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
           cancel_reason = CASE WHEN $3 = 'CANCELLED' THEN $5 ELSE cancel_reason END,
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $6::jsonb,
           updated_at = NOW()
       WHERE record_id = $1 AND entity_id = $2
       RETURNING *`,
      [
        Number(req.params.id),
        eid,
        next,
        JSON.stringify(payload),
        note || null,
        JSON.stringify([auditEntry('transition', by, { from: current, to: next, note: note || null })])
      ]
    );
    await client.query('COMMIT');
    const messages = {
      QUEUED: 'أُدخلت الفاتورة إلى الطابور المحلي',
      VALIDATED: 'اعتماد محلي ناجح. الإرسال الحكومي ما زال غير موصول.',
      FAILED: 'وُسِم التحقق بالفشل (محلي)',
      REJECTED: 'رُفضت الفاتورة محليًا',
      ARCHIVED: 'أُرشفت الفاتورة الإلكترونية',
      CANCELLED: 'أُلغي سجل الطابور'
    };
    res.json({
      success: true,
      record: await enrich(updated.rows[0]),
      message: messages[next] || `تم التحديث إلى ${next}`
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
}

router.post('/queue/:id/transition', handleTransition);

router.post('/queue/:id/cancel', async (req, res) => {
  req.body = {
    ...(req.body || {}),
    status: 'CANCELLED',
    note: (req.body && (req.body.reason || req.body.note)) || ''
  };
  return handleTransition(req, res);
});

router.delete('/queue/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'delete_draft')) return;
    await ensureTables();
    const eid = entityId(req);
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT * FROM finance_ops_records WHERE record_id = $1 AND kind = $2 AND entity_id = $3 FOR UPDATE`,
      [Number(req.params.id), KIND, eid]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'سجل الطابور غير موجود', code: 'NOT_FOUND' });
    }
    const st = String(existing.rows[0].status || '').toUpperCase();
    if (st !== 'READY') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'الحذف النهائي مسموح فقط لحالة جاهز — استخدم الإلغاء للحالات الأخرى',
        code: 'NOT_DELETABLE',
        status: st
      });
    }
    const by = actorLabel(req);
    await appendAudit(client, existing.rows[0].record_id, auditEntry('delete', by, { status: st }));
    await client.query(
      `DELETE FROM finance_ops_records WHERE record_id = $1 AND entity_id = $2`,
      [existing.rows[0].record_id, eid]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'حُذف سجل الجاهزية' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.post('/queue/:id/gov-send', async (req, res) => {
  if (denyUnless(req, res, 'gov_send')) return;
  return res.status(409).json({
    success: false,
    error: 'الإرسال الحكومي غير مفعّل. لا اعتمادات رسمية ولا موصل ضريبي في هذه البيئة.',
    code: 'CONNECTOR_ABSENT'
  });
});

module.exports = router;
module.exports.ensureTables = ensureTables;
module.exports.TRANSITIONS = TRANSITIONS;
module.exports.STATUS_AR = STATUS_AR;
