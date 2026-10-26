'use strict';

/**
 * Purchase orders + vendor invoices — operational procurement docs.
 * Draft → approve → receive/cancel; invoices link to POs; payments update balances.
 * Does not invent parallel ledgers; posting hooks are reserved for accounting integration.
 * Mutations require session-backed purchases authz (not client role headers alone).
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { denyUnless } = require('../services/purchases-authz');

function mapPurchasesAction(req) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '');
  // Only authorize routes owned by this router; sibling mounts handle quotes/vendors/receiving.
  if (!/^\/(summary|orders|vendor-invoices)(\/|$)/i.test(path)) return null;
  if (method === 'GET') return 'view';
  if (/\/orders\/[^/]+\/approve$/i.test(path) && method === 'POST') return 'approve';
  if (/\/orders\/[^/]+\/receive$/i.test(path) && method === 'POST') return 'receive';
  if (/\/orders\/[^/]+\/cancel$/i.test(path) && method === 'POST') return 'cancel';
  if (/\/vendor-invoices\/[^/]+\/approve$/i.test(path) && method === 'POST') return 'invoice';
  if (/\/vendor-invoices\/[^/]+\/pay$/i.test(path) && method === 'POST') return 'pay';
  if (/\/vendor-invoices/i.test(path) && method === 'POST') return 'invoice';
  if (/\/vendor-invoices/i.test(path) && method === 'DELETE') return 'delete_draft';
  if (/\/orders/i.test(path) && method === 'POST') return 'create';
  if (/\/orders/i.test(path) && method === 'PUT') return 'update';
  if (/\/orders/i.test(path) && method === 'DELETE') return 'delete_draft';
  return 'view';
}

router.use((req, res, next) => {
  const action = mapPurchasesAction(req);
  if (!action) return next();
  if (denyUnless(req, res, action)) return;
  return next();
});

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS finance_purchase_orders (
      po_id SERIAL PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER,
      vendor_name TEXT,
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expected_date DATE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      currency_code TEXT DEFAULT 'SAR',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_amount NUMERIC NOT NULL DEFAULT 0,
      total_amount NUMERIC NOT NULL DEFAULT 0,
      invoiced_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      approved_by TEXT,
      approved_at TIMESTAMP,
      received_at TIMESTAMP,
      cancelled_at TIMESTAMP,
      cancel_reason TEXT,
      audit_log JSONB DEFAULT '[]'::jsonb,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_purchase_order_lines (
      line_id SERIAL PRIMARY KEY,
      po_id INTEGER NOT NULL REFERENCES finance_purchase_orders(po_id) ON DELETE CASCADE,
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
    CREATE TABLE IF NOT EXISTS finance_vendor_invoices (
      vendor_invoice_id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER,
      vendor_name TEXT,
      po_id INTEGER REFERENCES finance_purchase_orders(po_id),
      invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'OPEN',
      currency_code TEXT DEFAULT 'SAR',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_amount NUMERIC NOT NULL DEFAULT 0,
      total_amount NUMERIC NOT NULL DEFAULT 0,
      paid_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      approved_by TEXT,
      approved_at TIMESTAMP,
      audit_log JSONB DEFAULT '[]'::jsonb,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_po_entity ON finance_purchase_orders(entity_id);
    CREATE INDEX IF NOT EXISTS idx_po_status ON finance_purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_vi_entity ON finance_vendor_invoices(entity_id);
    CREATE INDEX IF NOT EXISTS idx_vi_po ON finance_vendor_invoices(po_id);
  `);

  const alters = [
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'SAR'`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS approved_by TEXT`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMP`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT`,
    `ALTER TABLE finance_purchase_orders ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE finance_vendor_invoices ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'SAR'`,
    `ALTER TABLE finance_vendor_invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE finance_vendor_invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0`,
    `ALTER TABLE finance_vendor_invoices ADD COLUMN IF NOT EXISTS approved_by TEXT`,
    `ALTER TABLE finance_vendor_invoices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
    `ALTER TABLE finance_vendor_invoices ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb`
  ];
  for (const sql of alters) {
    await db.query(sql).catch(() => {});
  }
}

function entityId(req, body) {
  return (body && body.entity_id) || req.query.entity_id || req.headers['x-entity-id'] || 'HQ001';
}

function actor(req, body) {
  return req.purchasesActor?.userName
    || req.purchasesActor?.userId
    || req.authUser?.email
    || req.authUser?.name
    || (body && (body.created_by || body.actor))
    || req.headers['x-user-email']
    || req.headers['x-user-id']
    || 'ui';
}

function normalizeLines(lines) {
  const list = Array.isArray(lines) ? lines : [];
  return list
    .map((line, idx) => {
      const quantity = Math.max(0, Number(line.quantity || 0));
      const unit_price = Math.max(0, Number(line.unit_price || 0));
      const tax_pct = Number(line.tax_pct != null ? line.tax_pct : 15);
      const line_subtotal = quantity * unit_price;
      const line_tax = line_subtotal * (Number.isFinite(tax_pct) ? tax_pct : 0) / 100;
      const line_total = line_subtotal + line_tax;
      return {
        line_number: idx + 1,
        item_code: line.item_code || null,
        item_name: String(line.item_name || '').trim() || `بند ${idx + 1}`,
        quantity,
        unit_price,
        tax_pct: Number.isFinite(tax_pct) ? tax_pct : 15,
        line_subtotal,
        line_tax,
        line_total
      };
    })
    .filter((line) => line.quantity > 0);
}

function totalsFromLines(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.subtotal += Number(line.line_subtotal || 0);
      acc.tax_amount += Number(line.line_tax || 0);
      acc.total_amount += Number(line.line_total || 0);
      return acc;
    },
    { subtotal: 0, tax_amount: 0, total_amount: 0 }
  );
}

async function appendAudit(client, table, idColumn, id, entry) {
  await client.query(
    `UPDATE ${table}
     SET audit_log = COALESCE(audit_log, '[]'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE ${idColumn} = $1`,
    [id, JSON.stringify([entry])]
  );
}

async function replacePoLines(client, poId, lines) {
  await client.query(`DELETE FROM finance_purchase_order_lines WHERE po_id = $1`, [poId]);
  for (const line of lines) {
    await client.query(
      `INSERT INTO finance_purchase_order_lines
        (po_id, line_number, item_code, item_name, quantity, unit_price, tax_pct, line_subtotal, line_tax, line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        poId,
        line.line_number,
        line.item_code,
        line.item_name,
        line.quantity,
        line.unit_price,
        line.tax_pct,
        line.line_subtotal,
        line.line_tax,
        line.line_total
      ]
    );
  }
}

async function loadPoDetail(poId, eid) {
  const po = await db.query(
    `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2`,
    [poId, eid]
  );
  if (!po.rows[0]) return null;
  const lines = await db.query(
    `SELECT * FROM finance_purchase_order_lines WHERE po_id = $1 ORDER BY line_number, line_id`,
    [poId]
  );
  const invoices = await db.query(
    `SELECT vendor_invoice_id, invoice_number, status, total_amount, paid_amount, invoice_date, due_date
     FROM finance_vendor_invoices WHERE po_id = $1 ORDER BY vendor_invoice_id DESC`,
    [poId]
  );
  const row = po.rows[0];
  const invoiced = invoices.rows.reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
  const remaining = Math.max(Number(row.total_amount || 0) - invoiced, 0);
  return {
    order: { ...row, invoiced_amount: invoiced, remaining_to_invoice: remaining },
    lines: lines.rows,
    invoices: invoices.rows
  };
}

router.get('/summary', async (req, res) => {
  try {
    await ensureTables();
    const eid = entityId(req);
    const [orders, invoices] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE UPPER(status) = 'DRAFT')::int AS draft,
                COUNT(*) FILTER (WHERE UPPER(status) = 'APPROVED')::int AS approved,
                COUNT(*) FILTER (WHERE UPPER(status) = 'RECEIVED')::int AS received,
                COUNT(*) FILTER (WHERE UPPER(status) = 'CANCELLED')::int AS cancelled,
                COALESCE(SUM(total_amount),0)::float AS amount
         FROM finance_purchase_orders WHERE entity_id = $1`,
        [eid]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE UPPER(status) IN ('OPEN','APPROVED','PARTIAL'))::int AS open,
                COUNT(*) FILTER (WHERE UPPER(status) = 'PAID')::int AS paid,
                COALESCE(SUM(total_amount),0)::float AS amount,
                COALESCE(SUM(paid_amount),0)::float AS paid_amount
         FROM finance_vendor_invoices WHERE entity_id = $1`,
        [eid]
      )
    ]);
    res.json({
      success: true,
      entity_id: eid,
      orders: orders.rows[0],
      invoices: invoices.rows[0],
      currency: 'SAR'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    await ensureTables();
    const eid = entityId(req);
    const r = await db.query(
      `SELECT o.*,
              COALESCE((
                SELECT SUM(v.total_amount) FROM finance_vendor_invoices v WHERE v.po_id = o.po_id
              ),0)::float AS invoiced_amount,
              GREATEST(o.total_amount - COALESCE((
                SELECT SUM(v.total_amount) FROM finance_vendor_invoices v WHERE v.po_id = o.po_id
              ),0), 0)::float AS remaining_to_invoice,
              (SELECT COUNT(*)::int FROM finance_purchase_order_lines l WHERE l.po_id = o.po_id) AS line_count
       FROM finance_purchase_orders o
       WHERE o.entity_id = $1
       ORDER BY o.po_id DESC`,
      [eid]
    );
    res.json({ success: true, orders: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    await ensureTables();
    const detail = await loadPoDetail(Number(req.params.id), entityId(req));
    if (!detail) return res.status(404).json({ success: false, error: 'أمر الشراء غير موجود' });
    res.json({ success: true, ...detail });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/orders', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureTables();
    const b = req.body || {};
    const eid = entityId(req, b);
    const who = actor(req, b);
    const lines = normalizeLines(b.lines);
    if (!lines.length) {
      return res.status(400).json({ success: false, error: 'يلزم بند شراء واحد على الأقل', code: 'LINES_REQUIRED' });
    }
    if (!String(b.vendor_name || '').trim() && !b.vendor_id) {
      return res.status(400).json({ success: false, error: 'المورد مطلوب', code: 'VENDOR_REQUIRED' });
    }
    const totals = totalsFromLines(lines);
    const poNumber = b.po_number || `PO-${Date.now()}`;
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO finance_purchase_orders
        (po_number, vendor_id, vendor_name, order_date, expected_date, status, currency_code,
         subtotal, tax_amount, total_amount, notes, entity_id, entity_type, created_by, audit_log)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb) RETURNING *`,
      [
        poNumber,
        b.vendor_id || null,
        b.vendor_name || null,
        b.order_date || new Date().toISOString().slice(0, 10),
        b.expected_date || null,
        'DRAFT',
        b.currency_code || 'SAR',
        totals.subtotal,
        totals.tax_amount,
        totals.total_amount,
        b.notes || null,
        eid,
        b.entity_type || 'HQ',
        who,
        JSON.stringify([{ action: 'create', by: who, at: new Date().toISOString() }])
      ]
    );
    const order = r.rows[0];
    await replacePoLines(client, order.po_id, lines);
    await client.query('COMMIT');
    const detail = await loadPoDetail(order.po_id, eid);
    res.status(201).json({ success: true, ...detail });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(e.code === '23505' ? 409 : 500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.put('/orders/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await ensureTables();
    const eid = entityId(req, req.body);
    const who = actor(req, req.body);
    const poId = Number(req.params.id);
    const existing = await client.query(
      `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2 FOR UPDATE`,
      [poId, eid]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ success: false, error: 'أمر الشراء غير موجود' });
    }
    if (String(existing.rows[0].status).toUpperCase() !== 'DRAFT') {
      return res.status(409).json({
        success: false,
        error: 'لا يُعدَّل إلا أمر شراء في حالة المسودة',
        code: 'NOT_DRAFT'
      });
    }
    const b = req.body || {};
    const lines = normalizeLines(b.lines);
    if (!lines.length) {
      return res.status(400).json({ success: false, error: 'يلزم بند شراء واحد على الأقل' });
    }
    const totals = totalsFromLines(lines);
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE finance_purchase_orders SET
        vendor_id = COALESCE($2, vendor_id),
        vendor_name = COALESCE($3, vendor_name),
        order_date = COALESCE($4, order_date),
        expected_date = COALESCE($5, expected_date),
        currency_code = COALESCE($6, currency_code),
        subtotal = $7,
        tax_amount = $8,
        total_amount = $9,
        notes = COALESCE($10, notes),
        updated_at = NOW()
       WHERE po_id = $1 RETURNING *`,
      [
        poId,
        b.vendor_id || null,
        b.vendor_name || null,
        b.order_date || null,
        b.expected_date || null,
        b.currency_code || null,
        totals.subtotal,
        totals.tax_amount,
        totals.total_amount,
        b.notes != null ? b.notes : null
      ]
    );
    await replacePoLines(client, poId, lines);
    await appendAudit(client, 'finance_purchase_orders', 'po_id', poId, {
      action: 'update',
      by: who,
      at: new Date().toISOString()
    });
    await client.query('COMMIT');
    res.json({ success: true, ...(await loadPoDetail(poId, eid)) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

async function transitionPo(req, res, nextStatus, extra = {}) {
  try {
    await ensureTables();
    const eid = entityId(req, req.body);
    const who = actor(req, req.body);
    const poId = Number(req.params.id);
    const cur = await db.query(
      `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2`,
      [poId, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'أمر الشراء غير موجود' });
    const status = String(cur.rows[0].status).toUpperCase();
    if (nextStatus === 'APPROVED' && status !== 'DRAFT') {
      return res.status(409).json({ success: false, error: 'الاعتماد متاح للمسودات فقط', code: 'BAD_STATE' });
    }
    if (nextStatus === 'RECEIVED' && !['APPROVED', 'PARTIAL', 'PARTIALLY_RECEIVED'].includes(status)) {
      return res.status(409).json({ success: false, error: 'الاستلام يتطلب أمرًا معتمدًا أو مستلمًا جزئيًا', code: 'BAD_STATE' });
    }
    if (nextStatus === 'CANCELLED') {
      if (['RECEIVED', 'CANCELLED'].includes(status)) {
        return res.status(409).json({ success: false, error: 'لا يُلغى أمر مستلَم أو ملغى مسبقًا', code: 'BAD_STATE' });
      }
      const reason = String((req.body && req.body.reason) || '').trim();
      if (!reason) return res.status(400).json({ success: false, error: 'سبب الإلغاء إلزامي', code: 'REASON_REQUIRED' });
      extra.cancel_reason = reason;
      extra.cancelled_at = new Date().toISOString();
    }
    if (nextStatus === 'APPROVED') {
      extra.approved_by = who;
      extra.approved_at = new Date().toISOString();
    }
    if (nextStatus === 'RECEIVED') {
      extra.received_at = new Date().toISOString();
    }

    const r = await db.query(
      `UPDATE finance_purchase_orders SET
        status = $2,
        approved_by = COALESCE($3, approved_by),
        approved_at = COALESCE($4::timestamptz, approved_at),
        received_at = COALESCE($5::timestamptz, received_at),
        cancelled_at = COALESCE($6::timestamptz, cancelled_at),
        cancel_reason = COALESCE($7, cancel_reason),
        audit_log = COALESCE(audit_log, '[]'::jsonb) || $8::jsonb,
        updated_at = NOW()
       WHERE po_id = $1
       RETURNING *`,
      [
        poId,
        nextStatus,
        extra.approved_by || null,
        extra.approved_at || null,
        extra.received_at || null,
        extra.cancelled_at || null,
        extra.cancel_reason || null,
        JSON.stringify([{
          action: nextStatus.toLowerCase(),
          by: who,
          at: new Date().toISOString(),
          reason: extra.cancel_reason || null
        }])
      ]
    );
    res.json({
      success: true,
      message: `تم تحديث حالة الأمر إلى ${nextStatus}`,
      ...(await loadPoDetail(poId, eid)),
      order: r.rows[0]
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

router.post('/orders/:id/approve', (req, res) => transitionPo(req, res, 'APPROVED'));
router.post('/orders/:id/receive', (req, res) => transitionPo(req, res, 'RECEIVED'));
router.post('/orders/:id/cancel', (req, res) => transitionPo(req, res, 'CANCELLED'));

router.delete('/orders/:id', async (req, res) => {
  try {
    await ensureTables();
    const eid = entityId(req);
    const cur = await db.query(
      `SELECT status FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    if (String(cur.rows[0].status).toUpperCase() !== 'DRAFT') {
      return res.status(409).json({
        success: false,
        error: 'الحذف متاح للمسودات فقط — استخدم الإلغاء للأوامر المعتمدة',
        code: 'USE_CANCEL'
      });
    }
    const r = await db.query(
      `DELETE FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2 RETURNING po_id`,
      [req.params.id, eid]
    );
    res.json({ success: true, deleted: r.rows[0].po_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/vendor-invoices', async (req, res) => {
  try {
    await ensureTables();
    const eid = entityId(req);
    const r = await db.query(
      `SELECT v.*,
              p.po_number,
              GREATEST(v.total_amount - COALESCE(v.paid_amount,0), 0)::float AS remaining_amount
       FROM finance_vendor_invoices v
       LEFT JOIN finance_purchase_orders p ON p.po_id = v.po_id
       WHERE v.entity_id = $1
       ORDER BY v.vendor_invoice_id DESC`,
      [eid]
    );
    res.json({ success: true, invoices: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/vendor-invoices/:id', async (req, res) => {
  try {
    await ensureTables();
    const eid = entityId(req);
    const r = await db.query(
      `SELECT v.*, p.po_number, p.status AS po_status,
              GREATEST(v.total_amount - COALESCE(v.paid_amount,0), 0)::float AS remaining_amount
       FROM finance_vendor_invoices v
       LEFT JOIN finance_purchase_orders p ON p.po_id = v.po_id
       WHERE v.vendor_invoice_id = $1 AND v.entity_id = $2`,
      [req.params.id, eid]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'فاتورة المورد غير موجودة' });
    res.json({ success: true, invoice: r.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/vendor-invoices', async (req, res) => {
  try {
    await ensureTables();
    const b = req.body || {};
    const eid = entityId(req, b);
    const who = actor(req, b);
    const invNo = String(b.invoice_number || '').trim() || `VI-${Date.now()}`;
    const total = Number(b.total_amount || 0);
    const tax = Number(b.tax_amount || 0);
    const subtotal = Number(b.subtotal != null ? b.subtotal : Math.max(total - tax, 0));
    if (!String(b.vendor_name || '').trim() && !b.vendor_id) {
      return res.status(400).json({ success: false, error: 'المورد مطلوب' });
    }
    if (!(total > 0)) {
      return res.status(400).json({ success: false, error: 'إجمالي الفاتورة يجب أن يكون أكبر من صفر' });
    }

    let po = null;
    if (b.po_id) {
      const poRes = await db.query(
        `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2`,
        [b.po_id, eid]
      );
      po = poRes.rows[0] || null;
      if (!po) return res.status(404).json({ success: false, error: 'أمر الشراء المرتبط غير موجود' });
      if (['CANCELLED', 'DRAFT'].includes(String(po.status).toUpperCase())) {
        return res.status(409).json({
          success: false,
          error: 'لا تُربط فاتورة بأمر ملغى أو مسودة — اعتمد الأمر أولًا',
          code: 'PO_NOT_READY'
        });
      }
      const dup = await db.query(
        `SELECT vendor_invoice_id FROM finance_vendor_invoices
         WHERE entity_id = $1 AND po_id = $2 AND UPPER(invoice_number) = UPPER($3)`,
        [eid, b.po_id, invNo]
      );
      if (dup.rows[0]) {
        return res.status(409).json({
          success: false,
          error: 'فاتورة بنفس الرقم مرتبطة بهذا الأمر مسبقًا',
          code: 'DUPLICATE_PO_INVOICE'
        });
      }
    }

    const r = await db.query(
      `INSERT INTO finance_vendor_invoices
        (invoice_number, vendor_id, vendor_name, po_id, invoice_date, due_date, status, currency_code,
         subtotal, tax_amount, total_amount, paid_amount, notes, entity_id, entity_type, created_by, audit_log)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb) RETURNING *`,
      [
        invNo,
        b.vendor_id || (po && po.vendor_id) || null,
        b.vendor_name || (po && po.vendor_name) || null,
        b.po_id || null,
        b.invoice_date || new Date().toISOString().slice(0, 10),
        b.due_date || null,
        'OPEN',
        b.currency_code || (po && po.currency_code) || 'SAR',
        subtotal,
        tax,
        total,
        0,
        b.notes || null,
        eid,
        b.entity_type || 'HQ',
        who,
        JSON.stringify([{ action: 'create', by: who, at: new Date().toISOString(), po_id: b.po_id || null }])
      ]
    );
    res.status(201).json({ success: true, invoice: r.rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({
      success: false,
      error: e.code === '23505' ? 'رقم فاتورة المورد مستخدم مسبقًا' : e.message,
      code: e.code === '23505' ? 'DUPLICATE_INVOICE_NUMBER' : undefined
    });
  }
});

router.post('/vendor-invoices/:id/approve', async (req, res) => {
  try {
    await ensureTables();
    const eid = entityId(req, req.body);
    const who = actor(req, req.body);
    const cur = await db.query(
      `SELECT * FROM finance_vendor_invoices WHERE vendor_invoice_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    if (String(cur.rows[0].status).toUpperCase() !== 'OPEN') {
      return res.status(409).json({ success: false, error: 'الاعتماد متاح للفواتير المفتوحة فقط' });
    }
    const r = await db.query(
      `UPDATE finance_vendor_invoices SET
        status = 'APPROVED',
        approved_by = $2,
        approved_at = NOW(),
        audit_log = COALESCE(audit_log, '[]'::jsonb) || $3::jsonb,
        updated_at = NOW()
       WHERE vendor_invoice_id = $1 RETURNING *`,
      [req.params.id, who, JSON.stringify([{ action: 'approve', by: who, at: new Date().toISOString() }])]
    );
    res.json({ success: true, invoice: r.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/vendor-invoices/:id/pay', async (req, res) => {
  try {
    await ensureTables();
    const eid = entityId(req, req.body);
    const who = actor(req, req.body);
    const amount = Number((req.body && req.body.amount) || 0);
    if (!(amount > 0)) {
      return res.status(400).json({ success: false, error: 'مبلغ الدفعة يجب أن يكون أكبر من صفر' });
    }
    const cur = await db.query(
      `SELECT * FROM finance_vendor_invoices WHERE vendor_invoice_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    const inv = cur.rows[0];
    const st = String(inv.status).toUpperCase();
    if (['CANCELLED', 'VOID'].includes(st)) {
      return res.status(409).json({ success: false, error: 'لا تُسدَّد فاتورة ملغاة' });
    }
    const paid = Number(inv.paid_amount || 0) + amount;
    const total = Number(inv.total_amount || 0);
    if (paid - total > 0.009) {
      return res.status(409).json({
        success: false,
        error: 'مبلغ الدفع يتجاوز المتبقي على الفاتورة',
        code: 'OVER_PAYMENT',
        remaining: Math.max(total - Number(inv.paid_amount || 0), 0)
      });
    }
    const nextStatus = paid >= total - 0.009 ? 'PAID' : 'PARTIAL';
    const r = await db.query(
      `UPDATE finance_vendor_invoices SET
        paid_amount = $2,
        status = $3,
        audit_log = COALESCE(audit_log, '[]'::jsonb) || $4::jsonb,
        updated_at = NOW()
       WHERE vendor_invoice_id = $1 RETURNING *`,
      [
        req.params.id,
        paid,
        nextStatus,
        JSON.stringify([{
          action: 'payment',
          by: who,
          at: new Date().toISOString(),
          amount,
          method: (req.body && req.body.method) || null,
          reference: (req.body && req.body.reference) || null
        }])
      ]
    );
    res.json({
      success: true,
      invoice: r.rows[0],
      remaining_amount: Math.max(Number(r.rows[0].total_amount) - Number(r.rows[0].paid_amount), 0)
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/vendor-invoices/:id', async (req, res) => {
  try {
    await ensureTables();
    const eid = entityId(req);
    const cur = await db.query(
      `SELECT status, paid_amount FROM finance_vendor_invoices WHERE vendor_invoice_id = $1 AND entity_id = $2`,
      [req.params.id, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    const st = String(cur.rows[0].status).toUpperCase();
    if (Number(cur.rows[0].paid_amount || 0) > 0 || ['PAID', 'PARTIAL', 'APPROVED'].includes(st)) {
      return res.status(409).json({
        success: false,
        error: 'لا تُحذف فاتورة معتمدة أو مسدَّدة — استخدم مسار التصحيح المحاسبي',
        code: 'NO_HARD_DELETE'
      });
    }
    const r = await db.query(
      `DELETE FROM finance_vendor_invoices WHERE vendor_invoice_id = $1 AND entity_id = $2 RETURNING vendor_invoice_id`,
      [req.params.id, eid]
    );
    res.json({ success: true, deleted: r.rows[0].vendor_invoice_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
