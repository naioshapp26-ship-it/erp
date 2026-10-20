'use strict';

/**
 * Finance page-document settings API
 * Mount: /finance/page-settings
 *
 * GET  /finance/page-settings
 * GET  /finance/page-settings/:docId
 * PUT  /finance/page-settings/:docId
 * GET  /finance/page-settings/:docId/schema
 */

const express = require('express');
const {
  DOC_IDS,
  resolveTenantId,
  getDocSettings,
  putDocSettings,
  listDocSettings,
  getFieldSchema,
  ensureSchema
} = require('../services/page-document-settings');

const router = express.Router();

function actorId(req) {
  return (req.authUser && req.authUser.id) || null;
}

router.get('/', async (req, res) => {
  try {
    await ensureSchema();
    const tenantId = resolveTenantId(req);
    const items = await listDocSettings(tenantId);
    res.json({ success: true, tenantId, count: items.length, items });
  } catch (error) {
    console.error('page-settings list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:docId/schema', async (req, res) => {
  const schema = getFieldSchema(req.params.docId);
  if (!schema) {
    return res.status(404).json({ success: false, error: 'إعدادات المستند غير معروفة' });
  }
  return res.json({ success: true, schema });
});

router.get('/:docId', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const item = await getDocSettings(req.params.docId, tenantId);
    res.json({ success: true, tenantId, item });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.put('/:docId', async (req, res) => {
  try {
    if (!DOC_IDS.includes(req.params.docId)) {
      return res.status(404).json({ success: false, error: 'إعدادات المستند غير معروفة' });
    }
    const tenantId = resolveTenantId(req);
    const value = req.body && (req.body.value != null ? req.body.value : req.body);
    const reason = req.body && req.body.reason ? String(req.body.reason) : null;
    const item = await putDocSettings(req.params.docId, tenantId, value, actorId(req), reason);
    res.json({ success: true, tenantId, item });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

module.exports = router;
