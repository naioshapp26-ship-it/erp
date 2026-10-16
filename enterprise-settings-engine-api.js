'use strict';

/**
 * Enterprise Settings Engine API — Phase 1 Foundation
 *
 * GET  /api/enterprise-settings/catalog
 * GET  /api/enterprise-settings/definitions
 * POST /api/enterprise-settings/definitions/seed   (super_admin / platform only)
 * GET  /api/enterprise-settings/values
 * GET  /api/enterprise-settings/values/:key
 * PUT  /api/enterprise-settings/values/:key
 * GET  /api/enterprise-settings/values/:key/versions
 * GET  /api/enterprise-settings/audit
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { getCatalog, getSeedDefinitions } = require('./enterprise-settings-catalog');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
});
router.use(limiter);

let schemaReady = false;
let schemaPromise = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const sqlPath = path.join(__dirname, 'create-enterprise-settings-engine.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await db.query(sql);
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

function parseAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) acc[k.trim()] = decodeURIComponent(v.join('=') || '');
    return acc;
  }, {});
  return cookies.authToken || '';
}

async function resolveCentralUser(token) {
  if (!token) return null;
  const result = await db.query(
    `SELECT u.id, u.role, u.tenant_type, u.email
     FROM user_sessions us
     JOIN users u ON us.user_id = u.id
     WHERE us.session_token = $1 AND us.expires_at > NOW()
       AND COALESCE(u.is_active, true) = true
     LIMIT 1`,
    [token]
  );
  return result.rows[0] || null;
}

async function resolveTenantAdmin(req, token) {
  if (!req.tenantPool || !token) return null;
  try {
    const result = await req.tenantPool.query(
      `SELECT u.id, u.role, u.email
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.session_token = $1 AND us.expires_at > NOW()
         AND COALESCE(u.is_active, true) = true
       LIMIT 1`,
      [token]
    );
    const user = result.rows[0];
    if (!user) return null;
    const role = String(user.role || '').toLowerCase();
    if (!['admin', 'tenant_admin', 'super_admin', 'company_admin'].includes(role) && role !== 'systemadministrator') {
      // allow SystemAdministrator style roles from tenant signup
      if (!role.includes('admin')) return null;
    }
    return user;
  } catch {
    return null;
  }
}

async function attachActor(req, res, next) {
  try {
    await ensureSchema();
    const token = parseAuthToken(req);
    const central = await resolveCentralUser(token);
    const tenantAdmin = await resolveTenantAdmin(req, token);
    req.settingsActor = {
      token,
      central,
      tenantAdmin,
      isPlatformAdmin: Boolean(
        central && (central.role === 'super_admin' || central.tenant_type === 'HQ')
      ),
      isTenantAdmin: Boolean(tenantAdmin),
      tenantId: req.tenant?.id || req.tenantId || null,
      isTenantHost: Boolean(req.tenant)
    };

    if (!req.settingsActor.isPlatformAdmin && !req.settingsActor.isTenantAdmin) {
      return res.status(401).json({
        success: false,
        message: 'يتطلب تسجيل دخول بصلاحية إدارة للمنصة أو الشركة.'
      });
    }
    return next();
  } catch (err) {
    console.error('[EnterpriseSettings] attachActor:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر تهيئة محرك الإعدادات.' });
  }
}

router.use(attachActor);

router.get('/catalog', (req, res) => {
  const includeMock = String(req.query.includeMock || 'true') === 'true';
  const catalog = getCatalog({ includeMock });
  // Hide platform entries on tenant host
  if (req.settingsActor.isTenantHost) {
    catalog.byLevel.platform = [];
    catalog.entries = catalog.entries.filter((e) => e.level !== 'platform');
    catalog.counts = {
      total: catalog.entries.length,
      live: catalog.entries.filter((e) => e.status === 'live').length,
      partial: catalog.entries.filter((e) => e.status === 'partial').length,
      planned: catalog.entries.filter((e) => e.status === 'planned').length,
      mock: catalog.entries.filter((e) => e.status === 'mock').length
    };
  }
  return res.json({ success: true, data: catalog });
});

router.get('/definitions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT key, scope, module_key, data_type, default_value, label_ar, label_en,
              description_ar, description_en, validation, read_permission, write_permission,
              is_sensitive, is_active, updated_at
       FROM setting_definitions
       WHERE is_active = true
       ORDER BY scope, module_key NULLS FIRST, key`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[EnterpriseSettings] definitions:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر قراءة تعريفات الإعدادات.' });
  }
});

router.post('/definitions/seed', async (req, res) => {
  if (!req.settingsActor.isPlatformAdmin || req.settingsActor.isTenantHost) {
    return res.status(403).json({ success: false, message: 'البذر متاح لمشرف المنصة على النطاق المركزي فقط.' });
  }
  try {
    const seeds = getSeedDefinitions();
    let upserted = 0;
    for (const seed of seeds) {
      await db.query(
        `INSERT INTO setting_definitions
           (key, scope, module_key, data_type, default_value, label_ar, label_en, description_ar, is_sensitive, is_active)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,true)
         ON CONFLICT (key) DO UPDATE SET
           scope = EXCLUDED.scope,
           module_key = EXCLUDED.module_key,
           data_type = EXCLUDED.data_type,
           default_value = EXCLUDED.default_value,
           label_ar = EXCLUDED.label_ar,
           label_en = EXCLUDED.label_en,
           description_ar = EXCLUDED.description_ar,
           updated_at = NOW()`,
        [
          seed.key,
          seed.scope,
          seed.module_key,
          seed.data_type,
          JSON.stringify(seed.default_value || {}),
          seed.label_ar,
          seed.label_en,
          seed.description_ar,
          seed.is_sensitive
        ]
      );
      upserted += 1;
    }
    await db.query(
      `INSERT INTO setting_audit_events (definition_key, tenant_id, actor_id, action, meta)
       VALUES ('*', NULL, $1, 'seed_definitions', $2::jsonb)`,
      [req.settingsActor.central.id, JSON.stringify({ upserted })]
    );
    return res.json({ success: true, data: { upserted } });
  } catch (err) {
    console.error('[EnterpriseSettings] seed:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر بذر تعريفات الإعدادات.' });
  }
});

function scopeTenantId(req) {
  if (req.settingsActor.isTenantHost) return Number(req.settingsActor.tenantId) || null;
  if (req.query.tenantId != null && req.settingsActor.isPlatformAdmin) {
    return Number(req.query.tenantId) || null;
  }
  return null;
}

router.get('/values', async (req, res) => {
  try {
    const tenantId = scopeTenantId(req);
    const result = await db.query(
      `SELECT sv.id, sv.definition_key, sv.tenant_id, sv.branch_id, sv.module_key,
              sv.value, sv.version, sv.updated_by, sv.updated_at,
              sd.scope, sd.label_ar, sd.is_sensitive
       FROM setting_values sv
       JOIN setting_definitions sd ON sd.key = sv.definition_key
       WHERE ($1::int IS NULL AND sv.tenant_id IS NULL)
          OR ($1::int IS NOT NULL AND sv.tenant_id = $1)
       ORDER BY sv.definition_key`,
      [tenantId]
    );
    const rows = result.rows.map((row) => {
      if (row.is_sensitive) {
        return { ...row, value: { redacted: true } };
      }
      return row;
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[EnterpriseSettings] values list:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر قراءة قيم الإعدادات.' });
  }
});

router.get('/values/:key', async (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const tenantId = scopeTenantId(req);
    const def = await db.query(`SELECT * FROM setting_definitions WHERE key = $1 LIMIT 1`, [key]);
    if (!def.rows.length) {
      return res.status(404).json({ success: false, message: 'تعريف الإعداد غير موجود.' });
    }
    const value = await db.query(
      `SELECT * FROM setting_values
       WHERE definition_key = $1
         AND (($2::int IS NULL AND tenant_id IS NULL) OR tenant_id = $2)
       ORDER BY id DESC LIMIT 1`,
      [key, tenantId]
    );
    const row = value.rows[0] || null;
    if (row && def.rows[0].is_sensitive) {
      row.value = { redacted: true };
    }
    return res.json({
      success: true,
      data: {
        definition: def.rows[0],
        value: row,
        effective: row ? row.value : def.rows[0].default_value
      }
    });
  } catch (err) {
    console.error('[EnterpriseSettings] value get:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر قراءة قيمة الإعداد.' });
  }
});

router.put('/values/:key', async (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const tenantId = scopeTenantId(req);
    const defRes = await db.query(`SELECT * FROM setting_definitions WHERE key = $1 AND is_active = true`, [key]);
    if (!defRes.rows.length) {
      return res.status(404).json({ success: false, message: 'تعريف الإعداد غير موجود.' });
    }
    const def = defRes.rows[0];

    if (def.scope === 'platform') {
      if (!req.settingsActor.isPlatformAdmin || req.settingsActor.isTenantHost) {
        return res.status(403).json({ success: false, message: 'إعدادات المنصة مركزية فقط.' });
      }
    } else if (def.scope === 'tenant' || def.scope === 'module') {
      if (req.settingsActor.isTenantHost) {
        if (!req.settingsActor.isTenantAdmin) {
          return res.status(403).json({ success: false, message: 'غير مصرح.' });
        }
      } else if (!req.settingsActor.isPlatformAdmin) {
        return res.status(403).json({ success: false, message: 'غير مصرح.' });
      }
    }

    if (typeof req.body?.value === 'undefined') {
      return res.status(400).json({ success: false, message: 'الحقل value مطلوب.' });
    }

    const actorId = req.settingsActor.central?.id || req.settingsActor.tenantAdmin?.id || null;
    const reason = String(req.body.changeReason || req.body.reason || '').slice(0, 500);
    const newValue = req.body.value;

    const existing = await db.query(
      `SELECT * FROM setting_values
       WHERE definition_key = $1
         AND (($2::int IS NULL AND tenant_id IS NULL) OR tenant_id = $2)
       LIMIT 1`,
      [key, tenantId]
    );

    let saved;
    if (existing.rows.length) {
      const prev = existing.rows[0];
      const nextVersion = Number(prev.version || 1) + 1;
      await db.query(
        `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [prev.id, prev.version, JSON.stringify(prev.value), actorId, reason || 'overwrite']
      );
      const updated = await db.query(
        `UPDATE setting_values
         SET value = $1::jsonb, version = $2, updated_by = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [JSON.stringify(newValue), nextVersion, actorId, prev.id]
      );
      saved = updated.rows[0];
      await db.query(
        `INSERT INTO setting_audit_events
           (definition_key, tenant_id, actor_id, action, old_value, new_value, meta)
         VALUES ($1, $2, $3, 'update', $4::jsonb, $5::jsonb, $6::jsonb)`,
        [
          key,
          tenantId,
          actorId,
          JSON.stringify(prev.value),
          JSON.stringify(newValue),
          JSON.stringify({ version: nextVersion, reason })
        ]
      );
    } else {
      const inserted = await db.query(
        `INSERT INTO setting_values
           (definition_key, tenant_id, branch_id, module_key, value, version, updated_by)
         VALUES ($1, $2, NULL, $3, $4::jsonb, 1, $5)
         RETURNING *`,
        [key, tenantId, def.module_key || null, JSON.stringify(newValue), actorId]
      );
      saved = inserted.rows[0];
      await db.query(
        `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
         VALUES ($1, 1, $2::jsonb, $3, $4)`,
        [saved.id, JSON.stringify(newValue), actorId, reason || 'create']
      );
      await db.query(
        `INSERT INTO setting_audit_events
           (definition_key, tenant_id, actor_id, action, old_value, new_value, meta)
         VALUES ($1, $2, $3, 'create', NULL, $4::jsonb, $5::jsonb)`,
        [key, tenantId, actorId, JSON.stringify(newValue), JSON.stringify({ version: 1, reason })]
      );
    }

    return res.json({ success: true, data: saved });
  } catch (err) {
    console.error('[EnterpriseSettings] value put:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر حفظ قيمة الإعداد.' });
  }
});

router.get('/values/:key/versions', async (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const tenantId = scopeTenantId(req);
    const value = await db.query(
      `SELECT id FROM setting_values
       WHERE definition_key = $1
         AND (($2::int IS NULL AND tenant_id IS NULL) OR tenant_id = $2)
       LIMIT 1`,
      [key, tenantId]
    );
    if (!value.rows.length) {
      return res.json({ success: true, data: [] });
    }
    const versions = await db.query(
      `SELECT id, version, value, changed_by, change_reason, created_at
       FROM setting_versions
       WHERE setting_value_id = $1
       ORDER BY version DESC
       LIMIT 50`,
      [value.rows[0].id]
    );
    return res.json({ success: true, data: versions.rows });
  } catch (err) {
    console.error('[EnterpriseSettings] versions:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر قراءة الإصدارات.' });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const tenantId = scopeTenantId(req);
    if (req.settingsActor.isTenantHost && !req.settingsActor.isTenantAdmin) {
      return res.status(403).json({ success: false, message: 'غير مصرح.' });
    }
    const result = await db.query(
      `SELECT id, definition_key, tenant_id, actor_id, action, old_value, new_value, meta, created_at
       FROM setting_audit_events
       WHERE ($1::int IS NULL AND tenant_id IS NULL)
          OR ($1::int IS NOT NULL AND (tenant_id = $1 OR tenant_id IS NULL))
       ORDER BY created_at DESC
       LIMIT 100`,
      [tenantId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[EnterpriseSettings] audit:', err.message);
    return res.status(500).json({ success: false, message: 'تعذر قراءة سجل الإعدادات.' });
  }
});

module.exports = router;
module.exports.ensureSchema = ensureSchema;
