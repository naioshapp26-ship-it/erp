'use strict';

/**
 * Independent purchase receiving API.
 * Posts stock receipts through stock-link (inventory + journal) for approved POs.
 * Additive only — no destructive DDL. Does not hard-delete posted receipts.
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { denyUnless } = require('../services/purchases-authz');
const {
  ensureStockLinkSchema,
  postReceipt,
  present,
  httpError
} = require('../services/stock-link');
const inventoryApi = require('./inventory');

async function ensureInventoryAndLink(clientOrDb) {
  if (typeof inventoryApi.ensureTables === 'function') {
    await inventoryApi.ensureTables();
  }
  await ensureStockLinkSchema(clientOrDb || require('../../db'));
}

function entityId(req, body) {
  return (body && body.entity_id) || req.query.entity_id || req.headers['x-entity-id']
    || req.authenticatedEntityContext?.id || req.userEntity?.id || 'HQ001';
}

function entityType(req, body) {
  return (body && body.entity_type) || req.authenticatedEntityContext?.type || req.userEntity?.type || 'HQ';
}

function actorName(req) {
  return req.purchasesActor?.userName
    || req.authUser?.email
    || req.authUser?.name
    || 'ui';
}

function gateReceive(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '');
  if (method === 'GET') {
    if (denyUnless(req, res, 'view')) return;
    return next();
  }
  if (/\/complete$/i.test(path)) {
    if (denyUnless(req, res, 'receive')) return;
    return next();
  }
  if (denyUnless(req, res, 'receive')) return;
  return next();
}

router.use('/receiving', gateReceive);

router.get('/receiving/open-orders', async (req, res) => {
  try {
    const eid = entityId(req);
    const r = await db.query(
      `SELECT o.po_id, o.po_number, o.vendor_name, o.vendor_id, o.status, o.total_amount,
              o.currency_code, o.order_date, o.expected_date,
              (SELECT COUNT(*)::int FROM finance_purchase_order_lines l WHERE l.po_id = o.po_id) AS line_count
       FROM finance_purchase_orders o
       WHERE o.entity_id = $1
         AND UPPER(o.status) IN ('APPROVED', 'PARTIALLY_RECEIVED')
       ORDER BY o.po_id DESC`,
      [eid]
    );
    const withLines = [];
    for (const row of r.rows) {
      const lines = await db.query(
        `SELECT * FROM finance_purchase_order_lines WHERE po_id = $1 ORDER BY line_number`,
        [row.po_id]
      );
      withLines.push({ ...row, lines: lines.rows });
    }
    res.json({ success: true, orders: withLines, count: withLines.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/receiving/documents', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const eid = entityId(req);
    await ensureInventoryAndLink(client);
    const r = await client.query(
      `SELECT d.document_id, d.document_no, d.movement_type, d.reason, d.created_by, d.created_at,
              d.journal_entry_id, d.source_type, d.source_id,
              p.po_number, p.vendor_name
       FROM finance_stock_documents d
       LEFT JOIN finance_purchase_orders p
         ON p.po_id::text = d.source_id AND p.entity_id = d.entity_id
       WHERE d.entity_id = $1
         AND d.movement_type = 'RECEIPT'
         AND (d.source_type = 'PURCHASE_ORDER' OR d.source_type IS NULL)
       ORDER BY d.document_id DESC
       LIMIT 200`,
      [eid]
    );
    res.json({ success: true, documents: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.get('/receiving/documents/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const eid = entityId(req);
    await ensureInventoryAndLink(client);
    const payload = await present(client, eid, Number(req.params.id));
    res.json({ success: true, ...payload });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.post('/receiving', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const body = req.body || {};
    const eid = entityId(req, body);
    await ensureInventoryAndLink(client);
    await client.query('BEGIN');
    const result = await postReceipt(client, {
      entityId: eid,
      entityType: entityType(req, body),
      actor: actorName(req),
      poId: body.po_id,
      warehouseId: body.warehouse_id,
      lines: body.lines,
      clientRequestId: body.client_request_id || `recv-${eid}-${body.po_id}-${Date.now()}`,
      costCenterId: body.cost_center_id,
      currencyCode: body.currency_code,
      reason: body.reason || null
    });
    // Optional: mark fully received when requested
    if (body.mark_complete === true && result.document) {
      await client.query(
        `UPDATE finance_purchase_orders SET
           status = 'RECEIVED',
           received_at = COALESCE(received_at, NOW()),
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $2::jsonb,
           updated_at = NOW()
         WHERE po_id = $1 AND entity_id = $3
           AND UPPER(status) IN ('APPROVED', 'PARTIALLY_RECEIVED')`,
        [
          body.po_id,
          JSON.stringify([{ action: 'received', by: actorName(req), at: new Date().toISOString(), via: 'receiving_ui' }]),
          eid
        ]
      );
    }
    await client.query('COMMIT');
    res.status(result.replayed ? 200 : 201).json({ success: true, ...result });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    const status = e.status || 500;
    res.status(status).json({ success: false, error: e.message, code: e.code || undefined });
  } finally {
    client.release();
  }
});

router.post('/receiving/:poId/complete', async (req, res) => {
  try {
    const eid = entityId(req, req.body);
    const who = actorName(req);
    const poId = Number(req.params.poId);
    const cur = await db.query(
      `SELECT status FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2`,
      [poId, eid]
    );
    if (!cur.rows[0]) return res.status(404).json({ success: false, error: 'أمر الشراء غير موجود' });
    const st = String(cur.rows[0].status).toUpperCase();
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(st)) {
      return res.status(409).json({ success: false, error: 'لا يُكمَّل الاستلام إلا لأمر معتمد أو مستلم جزئيًا', code: 'BAD_STATE' });
    }
    const r = await db.query(
      `UPDATE finance_purchase_orders SET
         status = 'RECEIVED',
         received_at = COALESCE(received_at, NOW()),
         audit_log = COALESCE(audit_log, '[]'::jsonb) || $2::jsonb,
         updated_at = NOW()
       WHERE po_id = $1 AND entity_id = $3
       RETURNING *`,
      [poId, JSON.stringify([{ action: 'received', by: who, at: new Date().toISOString(), via: 'complete' }]), eid]
    );
    res.json({ success: true, order: r.rows[0], message: 'تم تعليم الأمر مستلمًا بالكامل' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
module.exports.httpError = httpError;
