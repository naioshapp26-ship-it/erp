'use strict';

/**
 * Vendor quotation module — independent of purchase orders.
 * Quote draft → send → accept/reject → convert to PO draft.
 * Schema: CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS only (no destructive DDL).
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { denyUnless } = require('../services/purchases-authz');

function entityId(req, body) {
  return (body && body.entity_id) || req.query.entity_id || req.headers['x-entity-id']
    || req.authenticatedEntityContext?.id || req.userEntity?.id || 'HQ001';
}

function actor(req, body) {
  return req.purchasesActor?.userName
    || req.purchasesActor?.userId
    || (body && (body.created_by || body.actor))
    || req.authUser?.email
    || req.authUser?.name
    || req.headers['x-user-email']
    || 'ui';
}

async function ensureQuoteTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_vendor_quotes (
      quote_id SERIAL PRIMARY KEY,
      quote_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER,
      vendor_name TEXT NOT NULL,
      quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
      valid_until DATE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      currency_code TEXT DEFAULT 'SAR',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_amount NUMERIC NOT NULL DEFAULT 0,
      total_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      converted_po_id INTEGER,
      audit_log JSONB DEFAULT '[]'::jsonb,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_vendor_quote_lines (
      line_id SERIAL PRIMARY KEY,
      quote_id INTEGER NOT NULL REFERENCES finance_vendor_quotes(quote_id) ON DELETE CASCADE,
      line_number INTEGER NOT NULL DEFAULT 1,
      item_code TEXT,
      item_name TEXT NOT NULL,
      quantity NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      tax_pct NUMERIC NOT NULL DEFAULT 15,
      line_subtotal NUMERIC NOT NULL DEFAULT 0,
      line_tax NUMERIC NOT NULL DEFAULT 0,
      line_total NUMERIC NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_vq_entity ON finance_vendor_quotes(entity_id);
    CREATE INDEX IF NOT EXISTS idx_vq_status ON finance_vendor_quotes(status);
  `);
}

function normalizeLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line, idx) => {
      const quantity = Math.max(0, Number(line.quantity || 0));
      const unit_price = Math.max(0, Number(line.unit_price || 0));
      const tax_pct = Number(line.tax_pct != null ? line.tax_pct : 15);
      const line_subtotal = quantity * unit_price;
      const line_tax = line_subtotal * (Number.isFinite(tax_pct) ? tax_pct : 0) / 100;
      return {
        line_number: idx + 1,
        item_code: line.item_code || null,
        item_name: String(line.item_name || '').trim() || `بند ${idx + 1}`,
        quantity,
        unit_price,
        tax_pct: Number.isFinite(tax_pct) ? tax_pct : 15,
        line_subtotal,
        line_tax,
        line_total: line_subtotal + line_tax
      };
    })
    .filter((l) => l.quantity > 0);
}

function totals(lines) {
  return lines.reduce((a, l) => {
    a.subtotal += Number(l.line_subtotal || 0);
    a.tax_amount += Number(l.line_tax || 0);
    a.total_amount += Number(l.line_total || 0);
    return a;
  }, { subtotal: 0, tax_amount: 0, total_amount: 0 });
}

async function appendAudit(client, quoteId, entry) {
  await client.query(
    `UPDATE finance_vendor_quotes
     SET audit_log = COALESCE(audit_log, '[]'::jsonb) || $2::jsonb, updated_at = NOW()
     WHERE quote_id = $1`,
    [quoteId, JSON.stringify([entry])]
  );
}

async function replaceLines(client, quoteId, lines) {
  await client.query(`DELETE FROM finance_vendor_quote_lines WHERE quote_id = $1`, [quoteId]);
  for (const line of lines) {
    await client.query(
      `INSERT INTO finance_vendor_quote_lines
        (quote_id, line_number, item_code, item_name, quantity, unit_price, tax_pct, line_subtotal, line_tax, line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [quoteId, line.line_number, line.item_code, line.item_name, line.quantity, line.unit_price,
        line.tax_pct, line.line_subtotal, line.line_tax, line.line_total]
    );
  }
}

async function loadDetail(quoteId, eid) {
  const q = await db.query(
    `SELECT * FROM finance_vendor_quotes WHERE quote_id = $1 AND entity_id = $2`,
    [quoteId, eid]
  );
  if (!q.rows[0]) return null;
  const lines = await db.query(
    `SELECT * FROM finance_vendor_quote_lines WHERE quote_id = $1 ORDER BY line_number, line_id`,
    [quoteId]
  );
  return { quote: q.rows[0], lines: lines.rows };
}

function gateQuotes(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  const action = method === 'GET' ? 'view' : 'quotes';
  if (denyUnless(req, res, action)) return;
  return next();
}

router.use('/quotes', gateQuotes);

router.get('/quotes', async (req, res) => {
  try {
    await ensureQuoteTables();
    const eid = entityId(req);
    const r = await db.query(
      `SELECT q.*,
              (SELECT COUNT(*)::int FROM finance_vendor_quote_lines l WHERE l.quote_id = q.quote_id) AS line_count
       FROM finance_vendor_quotes q
       WHERE q.entity_id = $1
       ORDER BY q.quote_id DESC`,
      [eid]
    );
    res.json({ success: true, quotes: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/quotes/:id', async (req, res) => {
  try {
    await ensureQuoteTables();
    const detail = await loadDetail(Number(req.params.id), entityId(req));
    if (!detail) return res.status(404).json({ success: false, error: 'عرض السعر غير موجود' });
    res.json({ success: true, ...detail });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/quotes', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureQuoteTables();
    const b = req.body || {};
    const eid = entityId(req, b);
    const who = actor(req, b);
    const lines = normalizeLines(b.lines);
    if (!lines.length) {
      return res.status(400).json({ success: false, error: 'يلزم بند واحد على الأقل', code: 'LINES_REQUIRED' });
    }
    if (!String(b.vendor_name || '').trim()) {
      return res.status(400).json({ success: false, error: 'المورد مطلوب' });
    }
    const t = totals(lines);
    const quoteNumber = b.quote_number || `VQ-${Date.now()}`;
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO finance_vendor_quotes
        (quote_number, vendor_id, vendor_name, quote_date, valid_until, status, currency_code,
         subtotal, tax_amount, total_amount, notes, entity_id, entity_type, created_by, audit_log)
       VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) RETURNING *`,
      [
        quoteNumber,
        b.vendor_id || null,
        b.vendor_name.trim(),
        b.quote_date || new Date().toISOString().slice(0, 10),
        b.valid_until || null,
        b.currency_code || 'SAR',
        t.subtotal,
        t.tax_amount,
        t.total_amount,
        b.notes || null,
        eid,
        b.entity_type || 'HQ',
        who,
        JSON.stringify([{ action: 'create', by: who, at: new Date().toISOString() }])
      ]
    );
    await replaceLines(client, r.rows[0].quote_id, lines);
    await client.query('COMMIT');
    res.status(201).json({ success: true, ...(await loadDetail(r.rows[0].quote_id, eid)) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(e.code === '23505' ? 409 : 500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.put('/quotes/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureQuoteTables();
    const eid = entityId(req, req.body);
    const who = actor(req, req.body);
    const quoteId = Number(req.params.id);
    const cur = await client.query(
      `SELECT * FROM finance_vendor_quotes WHERE quote_id = $1 AND entity_id = $2 FOR UPDATE`,
      [quoteId, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    if (String(cur.rows[0].status).toUpperCase() !== 'DRAFT') {
      return res.status(409).json({ success: false, error: 'لا يُعدَّل إلا عرض مسودة', code: 'NOT_DRAFT' });
    }
    const lines = normalizeLines((req.body || {}).lines);
    if (!lines.length) return res.status(400).json({ success: false, error: 'يلزم بند واحد' });
    const t = totals(lines);
    const b = req.body || {};
    await client.query('BEGIN');
    await client.query(
      `UPDATE finance_vendor_quotes SET
        vendor_id = COALESCE($2, vendor_id),
        vendor_name = COALESCE($3, vendor_name),
        quote_date = COALESCE($4, quote_date),
        valid_until = COALESCE($5, valid_until),
        currency_code = COALESCE($6, currency_code),
        subtotal = $7, tax_amount = $8, total_amount = $9,
        notes = COALESCE($10, notes), updated_at = NOW()
       WHERE quote_id = $1`,
      [quoteId, b.vendor_id || null, b.vendor_name || null, b.quote_date || null,
        b.valid_until || null, b.currency_code || null, t.subtotal, t.tax_amount, t.total_amount,
        b.notes != null ? b.notes : null]
    );
    await replaceLines(client, quoteId, lines);
    await appendAudit(client, quoteId, { action: 'update', by: who, at: new Date().toISOString() });
    await client.query('COMMIT');
    res.json({ success: true, ...(await loadDetail(quoteId, eid)) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

async function setStatus(req, res, nextStatus, allowedFrom) {
  try {
    await ensureQuoteTables();
    const eid = entityId(req, req.body);
    const who = actor(req, req.body);
    const quoteId = Number(req.params.id);
    const cur = await db.query(
      `SELECT * FROM finance_vendor_quotes WHERE quote_id = $1 AND entity_id = $2`,
      [quoteId, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    const st = String(cur.rows[0].status).toUpperCase();
    if (!allowedFrom.includes(st)) {
      return res.status(409).json({ success: false, error: `الحالة ${st} لا تسمح بالانتقال إلى ${nextStatus}`, code: 'BAD_STATE' });
    }
    await db.query(
      `UPDATE finance_vendor_quotes SET
        status = $2,
        audit_log = COALESCE(audit_log, '[]'::jsonb) || $3::jsonb,
        updated_at = NOW()
       WHERE quote_id = $1`,
      [quoteId, nextStatus, JSON.stringify([{ action: nextStatus.toLowerCase(), by: who, at: new Date().toISOString() }])]
    );
    res.json({ success: true, ...(await loadDetail(quoteId, eid)) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

router.post('/quotes/:id/send', (req, res) => setStatus(req, res, 'SENT', ['DRAFT']));
router.post('/quotes/:id/accept', (req, res) => setStatus(req, res, 'ACCEPTED', ['SENT', 'DRAFT']));
router.post('/quotes/:id/reject', (req, res) => setStatus(req, res, 'REJECTED', ['SENT', 'DRAFT']));

router.post('/quotes/:id/convert', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureQuoteTables();
    const eid = entityId(req, req.body);
    const who = actor(req, req.body);
    const quoteId = Number(req.params.id);
    const detail = await loadDetail(quoteId, eid);
    if (!detail) return res.status(404).json({ success: false, error: 'not found' });
    const st = String(detail.quote.status).toUpperCase();
    if (!['ACCEPTED', 'SENT'].includes(st)) {
      return res.status(409).json({
        success: false,
        error: 'التحويل إلى أمر شراء يتطلب عرضًا مرسلاً أو مقبولاً',
        code: 'BAD_STATE'
      });
    }
    if (detail.quote.converted_po_id) {
      return res.status(409).json({
        success: false,
        error: 'تم تحويل هذا العرض مسبقًا',
        code: 'ALREADY_CONVERTED',
        po_id: detail.quote.converted_po_id
      });
    }
    // Ensure PO tables exist via purchases ensure path (columns already additive)
    await db.query(`SELECT 1 FROM finance_purchase_orders LIMIT 1`).catch(async () => {
      /* purchase-orders ensureTables will create on first PO use */
    });
    await client.query('BEGIN');
    const poNumber = `PO-VQ-${Date.now()}`;
    const po = await client.query(
      `INSERT INTO finance_purchase_orders
        (po_number, vendor_id, vendor_name, order_date, expected_date, status, currency_code,
         subtotal, tax_amount, total_amount, notes, entity_id, entity_type, created_by, audit_log)
       VALUES ($1,$2,$3,CURRENT_DATE,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) RETURNING *`,
      [
        poNumber,
        detail.quote.vendor_id,
        detail.quote.vendor_name,
        detail.quote.valid_until || null,
        detail.quote.currency_code || 'SAR',
        detail.quote.subtotal,
        detail.quote.tax_amount,
        detail.quote.total_amount,
        `محوّل من عرض سعر ${detail.quote.quote_number}`,
        eid,
        detail.quote.entity_type || 'HQ',
        who,
        JSON.stringify([{ action: 'create_from_quote', by: who, at: new Date().toISOString(), quote_id: quoteId }])
      ]
    );
    const poId = po.rows[0].po_id;
    for (const line of detail.lines) {
      await client.query(
        `INSERT INTO finance_purchase_order_lines
          (po_id, line_number, item_code, item_name, quantity, unit_price, tax_pct, line_subtotal, line_tax, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [poId, line.line_number, line.item_code, line.item_name, line.quantity, line.unit_price,
          line.tax_pct, line.line_subtotal, line.line_tax, line.line_total]
      );
    }
    await client.query(
      `UPDATE finance_vendor_quotes SET
        status = 'CONVERTED',
        converted_po_id = $2,
        audit_log = COALESCE(audit_log, '[]'::jsonb) || $3::jsonb,
        updated_at = NOW()
       WHERE quote_id = $1`,
      [quoteId, poId, JSON.stringify([{ action: 'convert', by: who, at: new Date().toISOString(), po_id: poId }])]
    );
    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      quote: (await loadDetail(quoteId, eid)).quote,
      order: po.rows[0],
      message: `تم إنشاء أمر الشراء ${poNumber} من العرض`
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/quotes/:id', async (req, res) => {
  try {
    await ensureQuoteTables();
    const eid = entityId(req);
    const cur = await db.query(
      `SELECT status FROM finance_vendor_quotes WHERE quote_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    if (String(cur.rows[0].status).toUpperCase() !== 'DRAFT') {
      return res.status(409).json({ success: false, error: 'الحذف للمسودات فقط', code: 'NOT_DRAFT' });
    }
    await db.query(`DELETE FROM finance_vendor_quotes WHERE quote_id = $1 AND entity_id = $2`, [req.params.id, eid]);
    res.json({ success: true, deleted: Number(req.params.id) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
