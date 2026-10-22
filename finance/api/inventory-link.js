'use strict';

const db = require('../../db');
const {
  ensureStockLinkSchema,
  postReceipt,
  postIssue,
  postReturn,
  present,
  trace,
  getAccountMap,
  saveAccountMap,
  httpError
} = require('../services/stock-link');

function register(router, helpers) {
  async function run(req, res, work) {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await ensureStockLinkSchema(client);
      await client.query('BEGIN');
      const result = await work(client, entityId);
      await client.query('COMMIT');
      res.status(result.status || 200).json(result.body);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* already closed */ }
      if (error.code === '23505' && req.body && req.body.client_request_id) {
        try {
          const existing = await db.query(
            `SELECT document_id FROM finance_stock_documents WHERE entity_id = $1 AND client_request_id = $2`,
            [entityId, String(req.body.client_request_id)]
          );
          if (existing.rows[0]) {
            const replay = await present(client, entityId, existing.rows[0].document_id);
            return res.json({ success: true, replayed: true, ...replay });
          }
        } catch (replayError) {
          return helpers.fail(res, 500, replayError.message);
        }
      }
      helpers.fail(res, error.status || 500, error.message);
    } finally {
      client.release();
    }
  }

  router.get('/account-map', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    try {
      await helpers.ensureTables();
      await ensureStockLinkSchema(db);
      const map = await getAccountMap(db, entityId);
      res.json({ success: true, account_map: map });
    } catch (error) {
      helpers.fail(res, 500, error.message);
    }
  });

  router.put('/account-map', async (req, res) => {
    await run(req, res, async (client, entityId) => {
      const map = await saveAccountMap(client, entityId, req.body || {}, helpers.actorOf(req));
      return { status: 200, body: { success: true, account_map: map } };
    });
  });

  router.post('/receipts', async (req, res) => {
    await run(req, res, async (client, entityId) => {
      const body = req.body || {};
      const result = await postReceipt(client, {
        entityId,
        entityType: req.authenticatedEntityContext && req.authenticatedEntityContext.type,
        actor: helpers.actorOf(req),
        poId: body.po_id,
        warehouseId: body.warehouse_id,
        lines: body.lines,
        clientRequestId: body.client_request_id,
        costCenterId: body.cost_center_id,
        currencyCode: body.currency_code,
        reason: body.reason
      });
      return { status: result.replayed ? 200 : 201, body: { success: true, ...result } };
    });
  });

  router.post('/issues', async (req, res) => {
    await run(req, res, async (client, entityId) => {
      const body = req.body || {};
      const result = await postIssue(client, {
        entityId,
        entityType: req.authenticatedEntityContext && req.authenticatedEntityContext.type,
        actor: helpers.actorOf(req),
        invoiceId: body.invoice_id,
        warehouseId: body.warehouse_id,
        lines: body.lines,
        clientRequestId: body.client_request_id,
        costCenterId: body.cost_center_id,
        currencyCode: body.currency_code,
        reason: body.reason
      });
      return { status: result.replayed ? 200 : 201, body: { success: true, ...result } };
    });
  });

  router.post('/returns', async (req, res) => {
    await run(req, res, async (client, entityId) => {
      const body = req.body || {};
      const result = await postReturn(client, {
        entityId,
        entityType: req.authenticatedEntityContext && req.authenticatedEntityContext.type,
        actor: helpers.actorOf(req),
        documentId: body.document_id,
        lines: body.lines,
        clientRequestId: body.client_request_id,
        reason: body.reason
      });
      return { status: result.replayed ? 200 : 201, body: { success: true, ...result } };
    });
  });

  router.get('/documents/:id', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await ensureStockLinkSchema(client);
      const payload = await present(client, entityId, Number(req.params.id));
      res.json({ success: true, ...payload });
    } catch (error) {
      helpers.fail(res, error.status || 500, error.message);
    } finally {
      client.release();
    }
  });

  router.get('/trace', async (req, res) => {
    const entityId = helpers.requireEntity(req, res);
    if (!entityId) return;
    const client = await db.pool.connect();
    try {
      await helpers.ensureTables();
      await ensureStockLinkSchema(client);
      const chain = await trace(client, entityId, req.query.from_type, req.query.from_id);
      res.json({ success: true, ...chain });
    } catch (error) {
      helpers.fail(res, error.status || 500, error.message);
    } finally {
      client.release();
    }
  });

  router.use((error, req, res, next) => {
    if (error instanceof Error && error.status) return helpers.fail(res, error.status, error.message);
    return next(error);
  });
}

module.exports = { register, httpError };
