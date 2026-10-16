'use strict';

/**
 * Phase 3 — Company Settings Center service.
 * Uses Phase 1 Settings Engine for versioned company.* keys (central, tenant-scoped).
 * Uses tenant DB tables for org structure (branches/departments/titles/locations).
 * Does not create a second settings engine.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const settingsApi = require('./enterprise-settings-engine-api');

const COMPANY_DEFINITIONS = [
  {
    key: 'company.general',
    scope: 'tenant',
    module_key: 'general',
    data_type: 'json',
    default_value: {
      legal_name: '',
      trade_name: '',
      registration_number: '',
      tax_number: '',
      country: 'SA',
      city: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      language: 'ar',
      locale: 'ar-SA',
      timezone: 'Asia/Riyadh',
      currency: 'SAR',
      date_format: 'YYYY-MM-DD',
      number_format: '1,234.56',
      fiscal_year_start_month: 1
    },
    label_ar: 'البيانات العامة والقانونية',
    label_en: 'General & legal profile',
    is_sensitive: false
  },
  {
    key: 'company.security',
    scope: 'tenant',
    module_key: 'security',
    data_type: 'json',
    default_value: {
      session_ttl_hours: 12,
      require_strong_password: true,
      max_failed_logins: 5,
      lockout_minutes: 15,
      two_factor_optional: true,
      allow_concurrent_sessions: true
    },
    label_ar: 'سياسات الأمان والجلسات',
    label_en: 'Security & sessions',
    is_sensitive: false
  },
  {
    key: 'company.notifications',
    scope: 'tenant',
    module_key: 'notifications',
    data_type: 'json',
    default_value: {
      email_enabled: true,
      sms_enabled: false,
      in_app_enabled: true,
      digest: 'daily',
      channels: { billing: true, security: true, tasks: true, hr: true, finance: true }
    },
    label_ar: 'تفضيلات الإشعارات',
    label_en: 'Notification preferences',
    is_sensitive: false
  },
  {
    key: 'company.preferences',
    scope: 'tenant',
    module_key: 'preferences',
    data_type: 'json',
    default_value: {
      theme: 'system',
      density: 'comfortable',
      sidebar_collapsed: false,
      default_landing: 'dashboard',
      rtl: true
    },
    label_ar: 'تفضيلات الواجهة',
    label_en: 'UI preferences',
    is_sensitive: false
  },
  {
    key: 'company.storage_meter',
    scope: 'tenant',
    module_key: 'storage',
    data_type: 'json',
    default_value: {
      used_bytes: 0,
      last_calculated_at: null,
      sources: {}
    },
    label_ar: 'قياس التخزين',
    label_en: 'Storage meter',
    is_sensitive: false
  }
];

let definitionsSeeded = false;

async function ensureEngine() {
  await settingsApi.ensureSchema();
  if (definitionsSeeded) return;
  for (const def of COMPANY_DEFINITIONS) {
    await db.query(
      `INSERT INTO setting_definitions
         (key, scope, module_key, data_type, default_value, label_ar, label_en, is_sensitive, is_active)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,true)
       ON CONFLICT (key) DO UPDATE SET
         default_value = EXCLUDED.default_value,
         label_ar = EXCLUDED.label_ar,
         label_en = EXCLUDED.label_en,
         updated_at = NOW()`,
      [
        def.key,
        def.scope,
        def.module_key,
        def.data_type,
        JSON.stringify(def.default_value),
        def.label_ar,
        def.label_en,
        def.is_sensitive
      ]
    );
  }
  definitionsSeeded = true;
}

async function ensureOrgSchema(pool) {
  const sql = fs.readFileSync(path.join(__dirname, 'create-company-settings-org.sql'), 'utf8');
  await pool.query(sql);
}

async function getEngineValue(tenantId, key) {
  await ensureEngine();
  const def = COMPANY_DEFINITIONS.find((d) => d.key === key);
  const value = await db.query(
    `SELECT * FROM setting_values
     WHERE definition_key = $1 AND tenant_id = $2
     ORDER BY id DESC LIMIT 1`,
    [key, tenantId]
  );
  if (!value.rows.length) {
    return {
      key,
      version: 0,
      value: def ? { ...def.default_value } : {},
      source: 'default'
    };
  }
  return {
    key,
    version: value.rows[0].version,
    value: value.rows[0].value,
    updated_at: value.rows[0].updated_at,
    source: 'db'
  };
}

async function putEngineValue(tenantId, key, newValue, actorId, reason) {
  await ensureEngine();
  const defRes = await db.query(
    `SELECT * FROM setting_definitions WHERE key = $1 AND is_active = true LIMIT 1`,
    [key]
  );
  if (!defRes.rows.length) {
    const err = new Error(`تعريف الإعداد غير موجود: ${key}`);
    err.status = 404;
    throw err;
  }

  const existing = await db.query(
    `SELECT * FROM setting_values WHERE definition_key = $1 AND tenant_id = $2 LIMIT 1`,
    [key, tenantId]
  );

  let saved;
  if (existing.rows.length) {
    const prev = existing.rows[0];
    const nextVersion = Number(prev.version || 1) + 1;
    await db.query(
      `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (setting_value_id, version) DO NOTHING`,
      [prev.id, prev.version, JSON.stringify(prev.value), actorId || null, reason || 'company-update']
    );
    const updated = await db.query(
      `UPDATE setting_values
       SET value = $1::jsonb, version = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [JSON.stringify(newValue), nextVersion, actorId || null, prev.id]
    );
    saved = updated.rows[0];
    await db.query(
      `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (setting_value_id, version) DO UPDATE SET value = EXCLUDED.value`,
      [prev.id, nextVersion, JSON.stringify(newValue), actorId || null, reason || 'company-update']
    );
    await db.query(
      `INSERT INTO setting_audit_events
         (definition_key, tenant_id, actor_id, action, old_value, new_value, meta)
       VALUES ($1, $2, $3, 'update', $4::jsonb, $5::jsonb, $6::jsonb)`,
      [
        key,
        tenantId,
        actorId || null,
        JSON.stringify(prev.value),
        JSON.stringify(newValue),
        JSON.stringify({ version: nextVersion, reason: reason || 'company-update', phase: 3 })
      ]
    );
  } else {
    const inserted = await db.query(
      `INSERT INTO setting_values
         (definition_key, tenant_id, branch_id, module_key, value, version, updated_by)
       VALUES ($1, $2, NULL, $3, $4::jsonb, 1, $5)
       RETURNING *`,
      [key, tenantId, defRes.rows[0].module_key || null, JSON.stringify(newValue), actorId || null]
    );
    saved = inserted.rows[0];
    await db.query(
      `INSERT INTO setting_versions (setting_value_id, version, value, changed_by, change_reason)
       VALUES ($1, 1, $2::jsonb, $3, $4)`,
      [saved.id, JSON.stringify(newValue), actorId || null, reason || 'company-create']
    );
    await db.query(
      `INSERT INTO setting_audit_events
         (definition_key, tenant_id, actor_id, action, old_value, new_value, meta)
       VALUES ($1, $2, $3, 'create', NULL, $4::jsonb, $5::jsonb)`,
      [
        key,
        tenantId,
        actorId || null,
        JSON.stringify(newValue),
        JSON.stringify({ version: 1, reason: reason || 'company-create', phase: 3 })
      ]
    );
  }
  return saved;
}

async function syncGeneralToTenantStore(pool, general) {
  await pool.query(
    `INSERT INTO tenant_settings (key, value_json, description, updated_at)
     VALUES ('company_general', $1::jsonb, 'Phase 3 general settings mirror', NOW())
     ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()`,
    [JSON.stringify(general || {})]
  );
}

async function readGeneralFromTenantStore(pool) {
  const result = await pool.query(
    `SELECT value_json FROM tenant_settings WHERE key = 'company_general' LIMIT 1`
  );
  return result.rows[0]?.value_json || null;
}

async function getBundle(tenantId, pool) {
  await ensureOrgSchema(pool);
  const [general, security, notifications, preferences, storage] = await Promise.all([
    getEngineValue(tenantId, 'company.general'),
    getEngineValue(tenantId, 'company.security'),
    getEngineValue(tenantId, 'company.notifications'),
    getEngineValue(tenantId, 'company.preferences'),
    getEngineValue(tenantId, 'company.storage_meter')
  ]);

  // Prefer engine; fall back to tenant mirror if engine default empty names
  const mirrored = await readGeneralFromTenantStore(pool).catch(() => null);
  if (mirrored && general.source === 'default' && mirrored.legal_name) {
    general.value = { ...general.value, ...mirrored };
    general.source = 'tenant_mirror';
  }

  const branches = await pool.query(
    `SELECT * FROM tenant_branches ORDER BY name ASC`
  );
  const departments = await pool.query(
    `SELECT * FROM tenant_departments ORDER BY name ASC`
  );
  const jobTitles = await pool.query(
    `SELECT * FROM tenant_job_titles ORDER BY title_ar ASC`
  );
  const locations = await pool.query(
    `SELECT * FROM tenant_locations ORDER BY name_ar ASC`
  );

  return {
    general,
    security,
    notifications,
    preferences,
    storage,
    org: {
      branches: branches.rows,
      departments: departments.rows,
      job_titles: jobTitles.rows,
      locations: locations.rows
    },
    links: {
      branding: '/tenant-branding-settings.html',
      payment: '/tenant-payment-settings.html',
      email_api: '/api/tenant-settings/email',
      seo_api: '/api/tenant-settings/seo',
      ai_api: '/api/tenant-settings/ai',
      users_api: '/api/tenant-users',
      center: '/company/settings'
    }
  };
}

async function saveSection(tenantId, pool, section, value, actorId, reason) {
  const keyMap = {
    general: 'company.general',
    security: 'company.security',
    notifications: 'company.notifications',
    preferences: 'company.preferences'
  };
  const key = keyMap[section];
  if (!key) {
    const err = new Error('قسم إعدادات غير معروف.');
    err.status = 400;
    throw err;
  }
  const current = await getEngineValue(tenantId, key);
  const merged = { ...(current.value || {}), ...(value || {}) };
  const saved = await putEngineValue(tenantId, key, merged, actorId, reason || `company.${section}`);
  if (section === 'general') {
    await ensureOrgSchema(pool);
    await syncGeneralToTenantStore(pool, merged);
  }
  return saved;
}

// ---- Org CRUD ----
async function listBranches(pool) {
  await ensureOrgSchema(pool);
  const result = await pool.query(`SELECT * FROM tenant_branches ORDER BY name`);
  return result.rows;
}

async function upsertBranch(pool, body) {
  await ensureOrgSchema(pool);
  if (body.id) {
    const result = await pool.query(
      `UPDATE tenant_branches SET
         name = COALESCE($2, name),
         code = COALESCE($3, code),
         country = COALESCE($4, country),
         city = COALESCE($5, city),
         address = COALESCE($6, address),
         manager_name = COALESCE($7, manager_name),
         phone = COALESCE($8, phone),
         email = COALESCE($9, email),
         is_active = COALESCE($10, is_active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        body.id,
        body.name || null,
        body.code || null,
        body.country || null,
        body.city || null,
        body.address || null,
        body.manager_name || body.managerName || null,
        body.phone || null,
        body.email || null,
        body.is_active != null ? Boolean(body.is_active) : null
      ]
    );
    if (!result.rows.length) {
      const err = new Error('الفرع غير موجود.');
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  if (!body.name) {
    const err = new Error('اسم الفرع مطلوب.');
    err.status = 400;
    throw err;
  }
  // Idempotent when code already exists (non-destructive re-save)
  if (body.code) {
    const byCode = await pool.query(
      `UPDATE tenant_branches SET
         name = $2,
         country = COALESCE($3, country),
         city = COALESCE($4, city),
         address = COALESCE($5, address),
         manager_name = COALESCE($6, manager_name),
         phone = COALESCE($7, phone),
         email = COALESCE($8, email),
         is_active = COALESCE($9, is_active, true),
         updated_at = NOW()
       WHERE code = $1
       RETURNING *`,
      [
        body.code,
        body.name,
        body.country || null,
        body.city || null,
        body.address || null,
        body.manager_name || body.managerName || null,
        body.phone || null,
        body.email || null,
        body.is_active != null ? Boolean(body.is_active) : true
      ]
    );
    if (byCode.rows.length) return byCode.rows[0];
  }
  const inserted = await pool.query(
    `INSERT INTO tenant_branches
       (name, code, country, city, address, manager_name, phone, email, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,true))
     RETURNING *`,
    [
      body.name,
      body.code || null,
      body.country || null,
      body.city || null,
      body.address || null,
      body.manager_name || body.managerName || null,
      body.phone || null,
      body.email || null,
      body.is_active
    ]
  );
  return inserted.rows[0];
}

async function deactivateBranch(pool, id) {
  await ensureOrgSchema(pool);
  const result = await pool.query(
    `UPDATE tenant_branches SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!result.rows.length) {
    const err = new Error('الفرع غير موجود.');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

async function upsertDepartment(pool, body) {
  await ensureOrgSchema(pool);
  if (body.id) {
    const result = await pool.query(
      `UPDATE tenant_departments SET
         name = COALESCE($2, name),
         code = COALESCE($3, code),
         branch_id = COALESCE($4, branch_id),
         parent_id = COALESCE($5, parent_id),
         manager_id = COALESCE($6, manager_id),
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        body.id,
        body.name || null,
        body.code || null,
        body.branch_id || body.branchId || null,
        body.parent_id || body.parentId || null,
        body.manager_id || body.managerId || null,
        body.is_active != null ? Boolean(body.is_active) : null
      ]
    );
    if (!result.rows.length) {
      const err = new Error('القسم غير موجود.');
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  if (!body.name) {
    const err = new Error('اسم القسم مطلوب.');
    err.status = 400;
    throw err;
  }
  const inserted = await pool.query(
    `INSERT INTO tenant_departments (name, code, branch_id, parent_id, manager_id, is_active)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,true)) RETURNING *`,
    [
      body.name,
      body.code || null,
      body.branch_id || body.branchId || null,
      body.parent_id || body.parentId || null,
      body.manager_id || body.managerId || null,
      body.is_active
    ]
  );
  return inserted.rows[0];
}

async function upsertJobTitle(pool, body) {
  await ensureOrgSchema(pool);
  if (body.id) {
    const result = await pool.query(
      `UPDATE tenant_job_titles SET
         title_ar = COALESCE($2, title_ar),
         title_en = COALESCE($3, title_en),
         code = COALESCE($4, code),
         grade = COALESCE($5, grade),
         department_id = COALESCE($6, department_id),
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        body.id,
        body.title_ar || body.titleAr || null,
        body.title_en || body.titleEn || null,
        body.code || null,
        body.grade || null,
        body.department_id || body.departmentId || null,
        body.is_active != null ? Boolean(body.is_active) : null
      ]
    );
    if (!result.rows.length) {
      const err = new Error('المسمى الوظيفي غير موجود.');
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  const titleAr = body.title_ar || body.titleAr;
  if (!titleAr) {
    const err = new Error('المسمى الوظيفي مطلوب.');
    err.status = 400;
    throw err;
  }
  const inserted = await pool.query(
    `INSERT INTO tenant_job_titles (title_ar, title_en, code, grade, department_id, is_active)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,true)) RETURNING *`,
    [
      titleAr,
      body.title_en || body.titleEn || null,
      body.code || null,
      body.grade || null,
      body.department_id || body.departmentId || null,
      body.is_active
    ]
  );
  return inserted.rows[0];
}

async function upsertLocation(pool, body) {
  await ensureOrgSchema(pool);
  if (body.id) {
    const result = await pool.query(
      `UPDATE tenant_locations SET
         name_ar = COALESCE($2, name_ar),
         name_en = COALESCE($3, name_en),
         location_type = COALESCE($4, location_type),
         branch_id = COALESCE($5, branch_id),
         country = COALESCE($6, country),
         city = COALESCE($7, city),
         address = COALESCE($8, address),
         timezone = COALESCE($9, timezone),
         is_active = COALESCE($10, is_active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        body.id,
        body.name_ar || body.nameAr || null,
        body.name_en || body.nameEn || null,
        body.location_type || body.locationType || null,
        body.branch_id || body.branchId || null,
        body.country || null,
        body.city || null,
        body.address || null,
        body.timezone || null,
        body.is_active != null ? Boolean(body.is_active) : null
      ]
    );
    if (!result.rows.length) {
      const err = new Error('الموقع غير موجود.');
      err.status = 404;
      throw err;
    }
    return result.rows[0];
  }
  const nameAr = body.name_ar || body.nameAr;
  if (!nameAr) {
    const err = new Error('اسم الموقع مطلوب.');
    err.status = 400;
    throw err;
  }
  const inserted = await pool.query(
    `INSERT INTO tenant_locations
       (name_ar, name_en, location_type, branch_id, country, city, address, timezone, is_active)
     VALUES ($1,$2,COALESCE($3,'office'),$4,$5,$6,$7,$8,COALESCE($9,true))
     RETURNING *`,
    [
      nameAr,
      body.name_en || body.nameEn || null,
      body.location_type || body.locationType || 'office',
      body.branch_id || body.branchId || null,
      body.country || null,
      body.city || null,
      body.address || null,
      body.timezone || null,
      body.is_active
    ]
  );
  return inserted.rows[0];
}

async function createInvite(pool, { email, role = 'staff', branchId, invitedBy }) {
  await ensureOrgSchema(pool);
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    const err = new Error('بريد الدعوة غير صالح.');
    err.status = 400;
    throw err;
  }
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const inserted = await pool.query(
    `INSERT INTO tenant_user_invites
       (email, role, branch_id, invited_by, token_hash, status, expires_at)
     VALUES ($1,$2,$3,$4,$5,'pending',$6)
     RETURNING id, email, role, branch_id, status, expires_at, created_at`,
    [normalized, role, branchId || null, invitedBy || null, tokenHash, expiresAt]
  );
  // Return one-time token to caller only (not stored plaintext)
  return { invite: inserted.rows[0], invite_token: token };
}

async function listInvites(pool) {
  await ensureOrgSchema(pool);
  const result = await pool.query(
    `SELECT id, email, role, branch_id, status, expires_at, accepted_at, created_at
     FROM tenant_user_invites ORDER BY created_at DESC LIMIT 100`
  );
  return result.rows;
}

async function revokeInvite(pool, id) {
  await ensureOrgSchema(pool);
  const result = await pool.query(
    `UPDATE tenant_user_invites SET status = 'revoked' WHERE id = $1 AND status = 'pending' RETURNING id, email, status`,
    [id]
  );
  if (!result.rows.length) {
    const err = new Error('الدعوة غير موجودة أو غير قابلة للإلغاء.');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

/**
 * Phase 4 — accept invite by one-time token; creates tenant user when needed.
 */
async function ensureUsersAuthColumns(pool) {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
}

async function acceptInvite(pool, { token, password, firstName, lastName, username }) {
  await ensureOrgSchema(pool);
  await ensureUsersAuthColumns(pool);
  const raw = String(token || '').trim();
  if (!raw || raw.length < 20) {
    const err = new Error('رمز الدعوة غير صالح.');
    err.status = 400;
    throw err;
  }
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const inviteRes = await pool.query(
    `SELECT * FROM tenant_user_invites
     WHERE token_hash = $1 AND status = 'pending' AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  if (!inviteRes.rows.length) {
    const err = new Error('الدعوة منتهية أو غير موجودة أو مُستخدمة.');
    err.status = 404;
    throw err;
  }
  const invite = inviteRes.rows[0];
  const pwd = String(password || '');
  if (pwd.length < 8) {
    const err = new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
    err.status = 400;
    throw err;
  }

  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(pwd, 12);
  const uname = String(username || invite.email.split('@')[0]).trim().toLowerCase();
  const fname = String(firstName || uname).trim();
  const lname = String(lastName || '').trim();

  let user;
  const existing = await pool.query(
    `SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [invite.email]
  );
  if (existing.rows.length) {
    user = existing.rows[0];
    await pool.query(
      `UPDATE users SET
         password_hash = $2,
         role = COALESCE($3, role),
         is_active = true,
         first_name = COALESCE($4, first_name),
         last_name = COALESCE($5, last_name),
         username = COALESCE($6, username),
         name = COALESCE(name, $4)
       WHERE id = $1`,
      [user.id, passwordHash, invite.role || null, fname, lname, uname]
    );
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (name, first_name, last_name, username, email, password_hash, role, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING id, email, role, username`,
      [`${fname} ${lname}`.trim(), fname, lname, uname, invite.email, passwordHash, invite.role || 'staff']
    );
    user = inserted.rows[0];
  }

  await pool.query(
    `UPDATE tenant_user_invites
     SET status = 'accepted', accepted_at = NOW()
     WHERE id = $1`,
    [invite.id]
  );

  return {
    invite: { id: invite.id, email: invite.email, role: invite.role, status: 'accepted' },
    user: { id: user.id, email: user.email || invite.email, role: invite.role || user.role, username: user.username || uname }
  };
}

async function listAudit(tenantId, limit = 50) {
  await ensureEngine();
  const result = await db.query(
    `SELECT id, definition_key, tenant_id, actor_id, action, old_value, new_value, meta, created_at
     FROM setting_audit_events
     WHERE tenant_id = $1
       AND definition_key LIKE 'company.%'
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenantId, Math.min(200, Number(limit) || 50)]
  );
  return result.rows;
}

/**
 * Storage metering design + lightweight implementation.
 * Counts bytes under tenant branding uploads dir when present; stores in engine.
 */
async function recalculateStorageMeter(tenantId, subdomain, actorId) {
  const uploadsRoot = (() => {
    try {
      return require('./uploads-config').resolveUploadsRootDir();
    } catch {
      return path.join(__dirname, 'uploads');
    }
  })();
  const dir = path.join(uploadsRoot, 'tenant-branding', String(subdomain || `tenant-${tenantId}`));
  let usedBytes = 0;
  const sources = {};

  function walk(current, bucket) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, bucket);
      else {
        const size = fs.statSync(full).size;
        usedBytes += size;
        sources[bucket] = (sources[bucket] || 0) + size;
      }
    }
  }

  walk(dir, 'branding_uploads');

  // Phase 4 — broaden metering to tenant uploads buckets when present
  const extraBuckets = [
    ['uploads', path.join(uploadsRoot, String(subdomain || `tenant-${tenantId}`))],
    ['documents', path.join(uploadsRoot, 'documents', String(subdomain || `tenant-${tenantId}`))],
    ['hr-attachments', path.join(uploadsRoot, 'hr-attachments', String(subdomain || `tenant-${tenantId}`))]
  ];
  for (const [bucket, extraDir] of extraBuckets) {
    walk(extraDir, bucket);
  }

  const meter = {
    used_bytes: usedBytes,
    used_mb: Math.round((usedBytes / (1024 * 1024)) * 100) / 100,
    last_calculated_at: new Date().toISOString(),
    sources
  };
  await putEngineValue(tenantId, 'company.storage_meter', meter, actorId, 'storage-recalc');

  // Sync to central license counter when available (MB)
  try {
    const usedMb = Math.ceil(usedBytes / (1024 * 1024));
    await db.query(
      `UPDATE tenant_licenses SET storage_mb_used = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId, usedMb]
    );
  } catch {
    /* license table may be absent in pure tenant tests */
  }

  return meter;
}

async function checkStorageAllowance(tenantId, additionalBytes = 0) {
  try {
    const lic = await db.query(
      `SELECT storage_mb_limit, storage_mb_used, status FROM tenant_licenses WHERE tenant_id = $1`,
      [tenantId]
    );
    if (!lic.rows.length) return { allowed: true, enforced: false };
    const row = lic.rows[0];
    if (row.status === 'suspended' || row.status === 'expired') {
      return { allowed: false, enforced: true, reason: 'license_inactive' };
    }
    const limitBytes = Number(row.storage_mb_limit || 0) * 1024 * 1024;
    const usedBytes = Number(row.storage_mb_used || 0) * 1024 * 1024;
    if (limitBytes > 0 && usedBytes + additionalBytes > limitBytes) {
      return {
        allowed: false,
        enforced: true,
        reason: 'storage_limit',
        storage_mb_limit: row.storage_mb_limit,
        storage_mb_used: row.storage_mb_used
      };
    }
    return {
      allowed: true,
      enforced: true,
      storage_mb_limit: row.storage_mb_limit,
      storage_mb_used: row.storage_mb_used
    };
  } catch {
    return { allowed: true, enforced: false };
  }
}

module.exports = {
  COMPANY_DEFINITIONS,
  ensureEngine,
  ensureOrgSchema,
  getEngineValue,
  putEngineValue,
  getBundle,
  saveSection,
  listBranches,
  upsertBranch,
  deactivateBranch,
  upsertDepartment,
  upsertJobTitle,
  upsertLocation,
  createInvite,
  listInvites,
  revokeInvite,
  acceptInvite,
  listAudit,
  recalculateStorageMeter,
  checkStorageAllowance,
  syncGeneralToTenantStore
};
