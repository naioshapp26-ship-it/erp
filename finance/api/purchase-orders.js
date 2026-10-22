'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');

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
      total_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_vendor_invoices (
      vendor_invoice_id SERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER,
      vendor_name TEXT,
      po_id INTEGER,
      invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'OPEN',
      total_amount NUMERIC NOT NULL DEFAULT 0,
      paid_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      entity_id TEXT DEFAULT 'HQ001',
      entity_type TEXT DEFAULT 'HQ',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_po_entity ON finance_purchase_orders(entity_id);
    CREATE INDEX IF NOT EXISTS idx_vi_entity ON finance_vendor_invoices(entity_id);
  `);
}

function entityId(req, body) {
  return (body && body.entity_id) || req.query.entity_id || req.headers['x-entity-id'] || 'HQ001';
}

router.get('/orders', async (req, res) => {
  try {
    await ensureTables();
    const r = await db.query(
      `SELECT * FROM finance_purchase_orders WHERE entity_id = $1 ORDER BY po_id DESC`,
      [entityId(req)]
    );
    res.json({ success: true, orders: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/orders', async (req, res) => {
  try {
    await ensureTables();
    const b = req.body || {};
    const eid = entityId(req, b);
    const poNumber = b.po_number || `PO-${Date.now()}`;
    const r = await db.query(
      `INSERT INTO finance_purchase_orders
        (po_number, vendor_id, vendor_name, order_date, expected_date, status, total_amount, notes, entity_id, entity_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        poNumber,
        b.vendor_id || null,
        b.vendor_name || null,
        b.order_date || new Date().toISOString().slice(0, 10),
        b.expected_date || null,
        b.status || 'DRAFT',
        Number(b.total_amount || 0),
        b.notes || null,
        eid,
        b.entity_type || 'HQ',
        b.created_by || 'ui'
      ]
    );
    res.status(201).json({ success: true, order: r.rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({ success: false, error: e.message });
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    await ensureTables();
    const b = req.body || {};
    const r = await db.query(
      `UPDATE finance_purchase_orders SET
        vendor_id = COALESCE($2, vendor_id),
        vendor_name = COALESCE($3, vendor_name),
        order_date = COALESCE($4, order_date),
        expected_date = COALESCE($5, expected_date),
        status = COALESCE($6, status),
        total_amount = COALESCE($7, total_amount),
        notes = COALESCE($8, notes),
        updated_at = NOW()
       WHERE po_id = $1 RETURNING *`,
      [
        req.params.id,
        b.vendor_id || null,
        b.vendor_name || null,
        b.order_date || null,
        b.expected_date || null,
        b.status || null,
        b.total_amount != null ? Number(b.total_amount) : null,
        b.notes || null
      ]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, order: r.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    await ensureTables();
    const r = await db.query(
      `DELETE FROM finance_purchase_orders WHERE po_id = $1 RETURNING po_id`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, deleted: r.rows[0].po_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/vendor-invoices', async (req, res) => {
  try {
    await ensureTables();
    const r = await db.query(
      `SELECT * FROM finance_vendor_invoices WHERE entity_id = $1 ORDER BY vendor_invoice_id DESC`,
      [entityId(req)]
    );
    res.json({ success: true, invoices: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/vendor-invoices', async (req, res) => {
  try {
    await ensureTables();
    const b = req.body || {};
    const eid = entityId(req, b);
    const invNo = b.invoice_number || `VI-${Date.now()}`;
    const r = await db.query(
      `INSERT INTO finance_vendor_invoices
        (invoice_number, vendor_id, vendor_name, po_id, invoice_date, due_date, status, total_amount, paid_amount, notes, entity_id, entity_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        invNo,
        b.vendor_id || null,
        b.vendor_name || null,
        b.po_id || null,
        b.invoice_date || new Date().toISOString().slice(0, 10),
        b.due_date || null,
        b.status || 'OPEN',
        Number(b.total_amount || 0),
        Number(b.paid_amount || 0),
        b.notes || null,
        eid,
        b.entity_type || 'HQ',
        b.created_by || 'ui'
      ]
    );
    res.status(201).json({ success: true, invoice: r.rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({ success: false, error: e.message });
  }
});

router.delete('/vendor-invoices/:id', async (req, res) => {
  try {
    await ensureTables();
    const r = await db.query(
      `DELETE FROM finance_vendor_invoices WHERE vendor_invoice_id = $1 RETURNING vendor_invoice_id`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, deleted: r.rows[0].vendor_invoice_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
