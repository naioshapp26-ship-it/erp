'use strict';

/**
 * Purchase vendors — same finance_vendors master with vendor_scope filter.
 * Additive schema only: vendor_scope + audit_log columns (IF NOT EXISTS).
 * Does not delete historical expense vendors or rewrite existing rows' meaning:
 * NULL/legacy rows default to EXPENSE until explicitly tagged PURCHASE/BOTH.
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
    || req.authUser?.email
    || req.authUser?.name
    || (body && body.created_by)
    || 'ui';
}

async function ensureVendorScope() {
  await db.query(`
    ALTER TABLE finance_vendors ADD COLUMN IF NOT EXISTS vendor_scope TEXT DEFAULT 'EXPENSE';
    ALTER TABLE finance_vendors ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS idx_vendors_scope ON finance_vendors(vendor_scope);
    CREATE INDEX IF NOT EXISTS idx_vendors_entity ON finance_vendors(entity_id);
  `).catch(() => {});
}

function gateVendors(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  const action = method === 'GET' ? 'view' : 'vendors';
  if (denyUnless(req, res, action)) return;
  return next();
}

router.use('/vendors', gateVendors);

router.get('/vendors', async (req, res) => {
  try {
    await ensureVendorScope();
    const eid = entityId(req);
    const scope = String(req.query.scope || 'PURCHASE').toUpperCase();
    let sql;
    let params;
    if (scope === 'ALL') {
      sql = `SELECT * FROM finance_vendors WHERE entity_id = $1 OR entity_id IS NULL ORDER BY vendor_id DESC`;
      params = [eid];
    } else if (scope === 'EXPENSE') {
      sql = `SELECT * FROM finance_vendors
             WHERE (entity_id = $1 OR entity_id IS NULL)
               AND COALESCE(vendor_scope, 'EXPENSE') IN ('EXPENSE', 'BOTH')
             ORDER BY vendor_id DESC`;
      params = [eid];
    } else {
      sql = `SELECT * FROM finance_vendors
             WHERE (entity_id = $1 OR entity_id IS NULL)
               AND COALESCE(vendor_scope, 'EXPENSE') IN ('PURCHASE', 'BOTH')
             ORDER BY vendor_id DESC`;
      params = [eid];
    }
    const r = await db.query(sql, params);
    res.json({ success: true, vendors: r.rows, count: r.rows.length, scope });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/vendors/:id', async (req, res) => {
  try {
    await ensureVendorScope();
    const eid = entityId(req);
    const vendorId = Number(req.params.id);
    const v = await db.query(
      `SELECT * FROM finance_vendors WHERE vendor_id = $1 AND (entity_id = $2 OR entity_id IS NULL)`,
      [vendorId, eid]
    );
    if (!v.rows[0]) return res.status(404).json({ success: false, error: 'المورد غير موجود' });
    const vendor = v.rows[0];
    const name = vendor.vendor_name_ar || vendor.vendor_name_en || '';
    const [orders, invoices] = await Promise.all([
      db.query(
        `SELECT po_id, po_number, status, total_amount, order_date, currency_code
         FROM finance_purchase_orders
         WHERE entity_id = $1 AND (vendor_id = $2 OR vendor_name = $3)
         ORDER BY po_id DESC LIMIT 50`,
        [eid, vendorId, name]
      ).catch(() => ({ rows: [] })),
      db.query(
        `SELECT vendor_invoice_id, invoice_number, status, total_amount, paid_amount, invoice_date, po_id
         FROM finance_vendor_invoices
         WHERE entity_id = $1 AND (vendor_id = $2 OR vendor_name = $3)
         ORDER BY vendor_invoice_id DESC LIMIT 50`,
        [eid, vendorId, name]
      ).catch(() => ({ rows: [] }))
    ]);
    const invRows = invoices.rows;
    const paid = invRows.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    const payable = invRows.reduce((s, i) => s + Math.max(Number(i.total_amount || 0) - Number(i.paid_amount || 0), 0), 0);
    res.json({
      success: true,
      vendor,
      orders: orders.rows,
      invoices: invRows,
      totals: {
        orders_count: orders.rows.length,
        invoices_count: invRows.length,
        paid_amount: paid,
        payable_amount: payable
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/vendors', async (req, res) => {
  try {
    await ensureVendorScope();
    const b = req.body || {};
    const eid = entityId(req, b);
    const who = actor(req, b);
    const nameAr = String(b.vendor_name_ar || b.vendor_name || '').trim();
    if (!nameAr) return res.status(400).json({ success: false, error: 'اسم المورد مطلوب' });
    const code = String(b.vendor_code || '').trim() || `PV-${Date.now()}`;
    const scope = String(b.vendor_scope || 'PURCHASE').toUpperCase();
    if (!['PURCHASE', 'EXPENSE', 'BOTH'].includes(scope)) {
      return res.status(400).json({ success: false, error: 'vendor_scope يجب أن يكون PURCHASE أو EXPENSE أو BOTH' });
    }
    const r = await db.query(
      `INSERT INTO finance_vendors (
         vendor_code, vendor_name_ar, vendor_name_en, vendor_type, email, phone, mobile,
         tax_number, payment_terms, payment_term_days, entity_type, entity_id, is_active,
         created_by, vendor_scope, audit_log, city, country
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18
       ) RETURNING *`,
      [
        code,
        nameAr,
        b.vendor_name_en || null,
        b.vendor_type || 'SUPPLIER',
        b.email || null,
        b.phone || null,
        b.mobile || null,
        b.tax_number || null,
        b.payment_terms || null,
        b.payment_term_days != null ? Number(b.payment_term_days) : 30,
        b.entity_type || 'HQ',
        eid,
        b.is_active === false ? false : true,
        who,
        scope,
        JSON.stringify([{ action: 'create', by: who, at: new Date().toISOString(), scope }]),
        b.city || null,
        b.country || 'Saudi Arabia'
      ]
    );
    res.status(201).json({ success: true, vendor: r.rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({
      success: false,
      error: e.code === '23505' ? 'رمز المورد مستخدم مسبقًا' : e.message,
      code: e.code === '23505' ? 'DUPLICATE_VENDOR_CODE' : undefined
    });
  }
});

router.put('/vendors/:id', async (req, res) => {
  try {
    await ensureVendorScope();
    const b = req.body || {};
    const eid = entityId(req, b);
    const who = actor(req, b);
    const vendorId = Number(req.params.id);
    const cur = await db.query(
      `SELECT * FROM finance_vendors WHERE vendor_id = $1 AND (entity_id = $2 OR entity_id IS NULL)`,
      [vendorId, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    const scope = b.vendor_scope != null ? String(b.vendor_scope).toUpperCase() : null;
    if (scope && !['PURCHASE', 'EXPENSE', 'BOTH'].includes(scope)) {
      return res.status(400).json({ success: false, error: 'vendor_scope غير صالح' });
    }
    const r = await db.query(
      `UPDATE finance_vendors SET
         vendor_name_ar = COALESCE($2, vendor_name_ar),
         vendor_name_en = COALESCE($3, vendor_name_en),
         email = COALESCE($4, email),
         phone = COALESCE($5, phone),
         mobile = COALESCE($6, mobile),
         tax_number = COALESCE($7, tax_number),
         payment_terms = COALESCE($8, payment_terms),
         payment_term_days = COALESCE($9, payment_term_days),
         is_active = COALESCE($10, is_active),
         vendor_scope = COALESCE($11, vendor_scope),
         city = COALESCE($12, city),
         audit_log = COALESCE(audit_log, '[]'::jsonb) || $13::jsonb,
         updated_at = NOW()
       WHERE vendor_id = $1
       RETURNING *`,
      [
        vendorId,
        b.vendor_name_ar || b.vendor_name || null,
        b.vendor_name_en || null,
        b.email || null,
        b.phone || null,
        b.mobile || null,
        b.tax_number || null,
        b.payment_terms || null,
        b.payment_term_days != null ? Number(b.payment_term_days) : null,
        typeof b.is_active === 'boolean' ? b.is_active : null,
        scope,
        b.city || null,
        JSON.stringify([{ action: 'update', by: who, at: new Date().toISOString() }])
      ]
    );
    res.json({ success: true, vendor: r.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/vendors/:id/deactivate', async (req, res) => {
  try {
    await ensureVendorScope();
    const eid = entityId(req, req.body);
    const who = actor(req, req.body);
    const r = await db.query(
      `UPDATE finance_vendors SET
         is_active = false,
         audit_log = COALESCE(audit_log, '[]'::jsonb) || $3::jsonb,
         updated_at = NOW()
       WHERE vendor_id = $1 AND (entity_id = $2 OR entity_id IS NULL)
       RETURNING *`,
      [req.params.id, eid, JSON.stringify([{ action: 'deactivate', by: who, at: new Date().toISOString() }])]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, vendor: r.rows[0], message: 'تم إيقاف المورد دون حذف السجل التاريخي' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
