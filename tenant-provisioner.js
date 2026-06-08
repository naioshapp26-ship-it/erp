'use strict';

/**
 * tenant-provisioner.js
 * المرحلة 1 — محرك تجهيز المستأجر (Tenant Provisioning Engine)
 *
 * تسلسل التجهيز (7 خطوات):
 *  1. CREATE_TENANT_RECORD    — إنشاء سجل المستأجر في قاعدة البيانات المركزية
 *  2. CREATE_TENANT_DATABASE  — إنشاء قاعدة بيانات المستأجر باستخدام اتصال المشرف
 *  3. STORE_DATABASE_SECRET   — تشفير رابط قاعدة البيانات وتخزينه
 *  4. RUN_MIGRATIONS          — تشغيل هجرات SQL بالترتيب وتتبعها
 *  5. CREATE_ADMIN            — إنشاء أول أدمن في قاعدة بيانات المستأجر
 *  6. CREATE_SUBSCRIPTION     — إنشاء صف الاشتراك المركزي
 *  7. SEND_WELCOME_EMAIL      — تسجيل خطوة البريد الترحيبي (بدون إرسال فعلي)
 *
 * متطلبات بيئة التشغيل:
 *  PROVISION_DB_URL         — رابط اتصال Postgres بصلاحية CREATEDB (admin connection)
 *  TENANT_DB_URL_TEMPLATE   — قالب رابط قاعدة بيانات المستأجر يحتوي على {db}
 *                             مثال: postgresql://user:pass@host:5432/{db}
 *  TENANT_DB_ENCRYPTION_KEY — مفتاح هيكس بطول 64 حرف
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { encryptDbUrl, getTenantPool } = require('./tenant-connection-manager');

const MIGRATIONS_DIR = path.join(__dirname, 'tenant-migrations');
const CENTRAL_TENANT_ACCOUNT_TYPE = 'TENANT';
const CENTRAL_TENANT_ENTITY_TYPE = 'PLATFORM';
const CENTRAL_TENANT_ENTITY_PREFIX = 'TEN';
const SHARED_DB_MARKER = 'shared://central';

function _shouldUseLiteProvisioning() {
  return process.env.SAAS_LITE_PROVISIONING === 'true'
    || process.env.SAAS_SHARED_DB_MODE === 'true'
    || !process.env.TENANT_DB_URL_TEMPLATE;
}

async function _ensureCentralCredentialSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_credentials (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      last_login TIMESTAMP,
      failed_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id)
    );
  `);
}

// ---- اتصال المشرف لإنشاء قواعد البيانات ----
let _provisionPool = null;

function _getProvisionPool() {
  if (_provisionPool) return _provisionPool;
  const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.PROVISION_DB_URL;
  if (!url) throw new Error('PROVISION_DB_URL environment variable is not set.');

  let connectionString = url;
  let ssl = { rejectUnauthorized: false };

  try {
    const parsed = new URL(url);
    if (process.env.NODE_ENV === 'production' && parsed.hostname.endsWith('.railway.internal')) {
      ssl = false;
    }
  } catch (_) {
    // fallback to the original URL and relaxed SSL config
  }

  _provisionPool = new Pool({
    connectionString,
    ssl,
    max: 2
  });
  return _provisionPool;
}

// ---- مساعدات ----

/**
 * تسجيل خطوة تجهيز في جدول provisioning_logs المركزي.
 */
async function _logStep(tenantId, step, status, message = '', details = {}) {
  try {
    await db.query(
      `INSERT INTO provisioning_logs (tenant_id, step, status, message, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, step, status, message, JSON.stringify(details)]
    );
  } catch (err) {
    console.error(`[Provisioner] فشل تسجيل الخطوة ${step}:`, err.message);
  }
}

/**
 * قراءة ملفات الهجرات بالترتيب الأبجدي.
 */
function _getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

/**
 * توحيد رقم الهاتف: أرقام فقط.
 */
function _normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * تقسيم الاسم الكامل إلى اسم أول واسم أخير.
 */
function _splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  const firstName = parts[0] || 'Admin';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

/**
 * التحقق من أن اسم قاعدة البيانات آمن (أحرف إنجليزية صغيرة وأرقام وشرطات سفلية فقط).
 */
function _validateDbName(dbName) {
  if (!/^tenant_[a-z0-9_]{1,55}$/.test(dbName)) {
    throw new Error(`اسم قاعدة البيانات غير صالح: ${dbName}`);
  }
}

function _buildCentralTenantEntityId(tenantId) {
  const normalizedTenantId = Number.parseInt(tenantId, 10);
  if (!Number.isInteger(normalizedTenantId) || normalizedTenantId <= 0) {
    throw new Error(`معرّف المستأجر غير صالح للمزامنة المركزية: ${tenantId}`);
  }
  return `${CENTRAL_TENANT_ENTITY_PREFIX}${String(normalizedTenantId).padStart(6, '0')}`;
}

async function _syncCentralTenantDirectoryEntry({
  tenantId,
  companyName,
  plan,
  adminName,
  adminEmail
}) {
  const client = await db.pool.connect();
  const entityId = _buildCentralTenantEntityId(tenantId);
  const normalizedCompanyName = String(companyName || '').trim();
  const normalizedAdminName = String(adminName || normalizedCompanyName || 'Tenant Admin').trim();
  const normalizedAdminEmail = String(adminEmail || '').trim().toLowerCase() || null;
  const normalizedPlan = String(plan || 'basic').trim().toUpperCase();
  const normalizedJobTitle = 'مدير المستأجر';

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO entities (id, name, type, status, users_count, plan, created_at, updated_at)
       VALUES ($1, $2, $3, 'Active', 1, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         status = EXCLUDED.status,
         plan = EXCLUDED.plan,
         users_count = GREATEST(COALESCE(entities.users_count, 0), 1),
         updated_at = NOW()`,
      [entityId, normalizedCompanyName, CENTRAL_TENANT_ENTITY_TYPE, normalizedPlan]
    );

    const existingByEntity = await client.query(
      `SELECT id, email
       FROM users
       WHERE entity_id = $1
       ORDER BY created_at ASC NULLS LAST, id ASC
       LIMIT 1`,
      [entityId]
    );

    let directoryUserId = existingByEntity.rows[0]?.id || null;
    let emailForDirectory = normalizedAdminEmail || existingByEntity.rows[0]?.email || null;

    if (!directoryUserId && normalizedAdminEmail) {
      const existingByEmail = await client.query(
        `SELECT id, entity_id
         FROM users
         WHERE LOWER(email) = LOWER($1)
         ORDER BY created_at ASC NULLS LAST, id ASC
         LIMIT 1`,
        [normalizedAdminEmail]
      );

      if (existingByEmail.rows.length > 0) {
        if (existingByEmail.rows[0].entity_id === entityId) {
          directoryUserId = existingByEmail.rows[0].id;
        } else {
          emailForDirectory = null;
        }
      }
    }

    if (emailForDirectory) {
      const duplicateEmailResult = await client.query(
        `SELECT id
         FROM users
         WHERE LOWER(email) = LOWER($1)
           AND ($2::INTEGER IS NULL OR id <> $2)
         ORDER BY created_at ASC NULLS LAST, id ASC
         LIMIT 1`,
        [emailForDirectory, directoryUserId]
      );

      if (duplicateEmailResult.rows.length > 0) {
        emailForDirectory = existingByEntity.rows[0]?.email || null;
      }
    }

    if (directoryUserId) {
      await client.query(
        `UPDATE users
         SET name = $1,
             email = $2,
             role = COALESCE(NULLIF(role, ''), 'tenant_admin'),
             tenant_type = $3,
             entity_id = $4,
             entity_name = $5,
             is_active = true,
             job_title = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [
          normalizedAdminName,
          emailForDirectory,
          CENTRAL_TENANT_ACCOUNT_TYPE,
          entityId,
          normalizedCompanyName,
          normalizedJobTitle,
          directoryUserId
        ]
      );
    } else {
      await client.query(
        `INSERT INTO users (
          name, email, role, tenant_type, entity_id, entity_name, is_active, job_title
        ) VALUES ($1, $2, 'tenant_admin', $3, $4, $5, true, $6)`,
        [
          normalizedAdminName,
          emailForDirectory,
          CENTRAL_TENANT_ACCOUNT_TYPE,
          entityId,
          normalizedCompanyName,
          normalizedJobTitle
        ]
      );
    }

    await client.query(
      `UPDATE entities
       SET users_count = (
         SELECT COUNT(*)::INTEGER
         FROM users
         WHERE entity_id = $1
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [entityId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`SYNC_CENTRAL_TENANT_DIRECTORY فشل: ${err.message}`);
  } finally {
    client.release();
  }
}

async function provisionTenantLite({
  subdomain,
  companyName,
  plan = 'basic',
  adminName,
  adminEmail,
  adminPhone,
  adminPassword,
  settings = {},
  existingTenantId = null
}) {
  let tenantId = existingTenantId;
  const baseDomain = process.env.BASE_DOMAIN || 'localhost';
  const normalizedSettings = {
    ...(settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}),
    sharedDb: true,
    liteProvision: true,
    directoryContact: {
      adminName: String(adminName || '').trim(),
      adminEmail: String(adminEmail || '').trim().toLowerCase(),
      adminPhone: String(adminPhone || '').trim()
    }
  };

  if (!tenantId) {
    await _logStep(null, 'CREATE_TENANT_RECORD', 'running');
    try {
      const res = await db.query(
        `INSERT INTO tenants (subdomain, company_name, subscription_plan, status, db_name, settings)
         VALUES ($1, $2, $3, 'pending_payment', $4, $5)
         RETURNING id`,
        [subdomain, companyName, plan, `tenant_${subdomain}`, JSON.stringify(normalizedSettings)]
      );
      tenantId = res.rows[0].id;
      await _logStep(tenantId, 'CREATE_TENANT_RECORD', 'success', `tenant_id=${tenantId}`);
    } catch (err) {
      await _logStep(null, 'CREATE_TENANT_RECORD', 'failed', err.message);
      throw new Error(`CREATE_TENANT_RECORD فشل: ${err.message}`);
    }
  }

  await _logStep(tenantId, 'CREATE_TENANT_DATABASE', 'success', 'shared-db-mode');
  await _logStep(tenantId, 'STORE_DATABASE_SECRET', 'running');
  try {
    await db.query(
      `UPDATE tenants
       SET encrypted_db_url = $1,
           settings = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [SHARED_DB_MARKER, JSON.stringify(normalizedSettings), tenantId]
    );
    await _logStep(tenantId, 'STORE_DATABASE_SECRET', 'success', 'shared-db-mode');
  } catch (err) {
    await _logStep(tenantId, 'STORE_DATABASE_SECRET', 'failed', err.message);
    throw new Error(`STORE_DATABASE_SECRET فشل: ${err.message}`);
  }

  await _logStep(tenantId, 'RUN_MIGRATIONS', 'success', 'skipped in shared-db-mode');

  await _logStep(tenantId, 'CREATE_ADMIN', 'running');
  try {
    const normalizedPhone = _normalizePhone(adminPhone);
    const username = (normalizedPhone || String(adminEmail || '').trim().toLowerCase() || `${subdomain}-admin`).slice(0, 100);
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const entityId = _buildCentralTenantEntityId(tenantId);
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      await _ensureCentralCredentialSchema(client);

      const existingUser = await client.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR entity_id = $2 ORDER BY id ASC LIMIT 1`,
        [adminEmail || username, entityId]
      );

      let userId = existingUser.rows[0]?.id || null;
      if (userId) {
        await client.query(
          `UPDATE users
           SET name = $1,
               email = COALESCE($2, email),
               role = 'tenant_admin',
               tenant_type = $3,
               entity_id = $4,
               entity_name = $5,
               is_active = true,
               job_title = 'مدير المستأجر',
               updated_at = NOW()
           WHERE id = $6`,
          [adminName, adminEmail || null, CENTRAL_TENANT_ACCOUNT_TYPE, entityId, companyName, userId]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO users (name, email, role, tenant_type, entity_id, entity_name, is_active, job_title)
           VALUES ($1, $2, 'tenant_admin', $3, $4, $5, true, 'مدير المستأجر')
           RETURNING id`,
          [adminName, adminEmail || null, CENTRAL_TENANT_ACCOUNT_TYPE, entityId, companyName]
        );
        userId = inserted.rows[0].id;
      }

      await client.query(
        `INSERT INTO user_credentials (user_id, username, password_hash, is_active, failed_attempts)
         VALUES ($1, $2, $3, true, 0)
         ON CONFLICT (user_id) DO UPDATE SET
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           is_active = true,
           updated_at = NOW()`,
        [userId, username, passwordHash]
      );

      await client.query('COMMIT');
      await _logStep(tenantId, 'CREATE_ADMIN', 'success', `username=${username}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    await _logStep(tenantId, 'CREATE_ADMIN', 'failed', err.message);
    throw new Error(`CREATE_ADMIN فشل: ${err.message}`);
  }

  await _logStep(tenantId, 'CREATE_SUBSCRIPTION', 'running');
  try {
    await db.query(
      `INSERT INTO subscriptions (tenant_id, plan, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (tenant_id) DO UPDATE SET
         plan = EXCLUDED.plan,
         status = 'active',
         updated_at = NOW()`,
      [tenantId, plan]
    );
    await db.query(`UPDATE tenants SET status = 'active', updated_at = NOW() WHERE id = $1`, [tenantId]);
    await _logStep(tenantId, 'CREATE_SUBSCRIPTION', 'success');
  } catch (err) {
    await _logStep(tenantId, 'CREATE_SUBSCRIPTION', 'failed', err.message);
    throw new Error(`CREATE_SUBSCRIPTION فشل: ${err.message}`);
  }

  await _logStep(tenantId, 'SEND_WELCOME_EMAIL', 'success',
    `Welcome email queued for ${adminEmail || adminPhone}`);

  await _logStep(tenantId, 'SYNC_CENTRAL_TENANT_DIRECTORY', 'running');
  try {
    await _syncCentralTenantDirectoryEntry({
      tenantId,
      companyName,
      plan,
      adminName,
      adminEmail
    });
    await _logStep(tenantId, 'SYNC_CENTRAL_TENANT_DIRECTORY', 'success');
  } catch (err) {
    await _logStep(tenantId, 'SYNC_CENTRAL_TENANT_DIRECTORY', 'failed', err.message);
    throw err;
  }

  const loginUrl = `https://${subdomain}.${baseDomain}`;
  return { tenantId, subdomain, loginUrl };
}

// ================================================================
// الدالة الرئيسية للتجهيز
// ================================================================

/**
 * تجهيز مستأجر جديد بالترتيب الكامل.
 *
 * @param {object} params
 * @param {string} params.subdomain       - النطاق الفرعي
 * @param {string} params.companyName     - اسم الشركة
 * @param {string} params.plan            - خطة الاشتراك (basic, pro, enterprise)
 * @param {string} params.adminName       - الاسم الكامل للأدمن
 * @param {string} params.adminEmail      - البريد الإلكتروني للأدمن
 * @param {string} params.adminPhone      - رقم الجوال (يُستخدم كاسم مستخدم)
 * @param {string} params.adminPassword   - كلمة المرور (نص عادي — ستُشفَّر)
 * @param {object} [params.settings]      - إعدادات إضافية
 * @param {number} [params.existingTenantId] - معرف مستأجر موجود (لتجنب إنشاء سجل جديد)
 *
 * @returns {Promise<{tenantId: number, subdomain: string, loginUrl: string}>}
 */
async function provisionTenant(params) {
  if (_shouldUseLiteProvisioning()) {
    return provisionTenantLite(params);
  }

  const {
    subdomain,
    companyName,
    plan = 'basic',
    adminName,
    adminEmail,
    adminPhone,
    adminPassword,
    settings = {},
    existingTenantId = null
  } = params;

  let tenantId = existingTenantId;
  const dbName = `tenant_${subdomain.replace(/[^a-z0-9_]/g, '_')}`;
  const baseDomain = process.env.BASE_DOMAIN || 'localhost';
  const normalizedSettings = {
    ...(settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}),
    directoryContact: {
      adminName: String(adminName || '').trim(),
      adminEmail: String(adminEmail || '').trim().toLowerCase(),
      adminPhone: String(adminPhone || '').trim()
    }
  };

  // -------------------------------------------------------
  // الخطوة 1: CREATE_TENANT_RECORD
  // -------------------------------------------------------
  if (!tenantId) {
    await _logStep(null, 'CREATE_TENANT_RECORD', 'running');
    try {
      const res = await db.query(
        `INSERT INTO tenants (subdomain, company_name, subscription_plan, status, db_name, settings)
         VALUES ($1, $2, $3, 'pending_payment', $4, $5)
         RETURNING id`,
        [subdomain, companyName, plan, dbName, JSON.stringify(normalizedSettings)]
      );
      tenantId = res.rows[0].id;
      await _logStep(tenantId, 'CREATE_TENANT_RECORD', 'success', `tenant_id=${tenantId}`);
    } catch (err) {
      await _logStep(null, 'CREATE_TENANT_RECORD', 'failed', err.message);
      throw new Error(`CREATE_TENANT_RECORD فشل: ${err.message}`);
    }
  }

  // -------------------------------------------------------
  // الخطوة 2: CREATE_TENANT_DATABASE
  // -------------------------------------------------------
  await _logStep(tenantId, 'CREATE_TENANT_DATABASE', 'running');
  try {
    _validateDbName(dbName); // أمان: التحقق من اسم قاعدة البيانات قبل الاستخدام
    const provisionPool = _getProvisionPool();
    // لا يمكن استخدام معاملات مع CREATE DATABASE، لذا نستخدم اتصالاً مباشراً
    const client = await provisionPool.connect();
    try {
      // تحقق أولاً إذا كانت قاعدة البيانات موجودة
      const existing = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName]
      );
      if (existing.rows.length === 0) {
        // CREATE DATABASE لا يُنفَّذ داخل معاملة
        // dbName تم التحقق منه بـ _validateDbName أعلاه لضمان عدم احتوائه على محارف خطرة
        await client.query(`CREATE DATABASE "${dbName}"`);
      }
    } finally {
      client.release();
    }
    await _logStep(tenantId, 'CREATE_TENANT_DATABASE', 'success', `db_name=${dbName}`);
  } catch (err) {
    await _logStep(tenantId, 'CREATE_TENANT_DATABASE', 'failed', err.message);
    throw new Error(`CREATE_TENANT_DATABASE فشل: ${err.message}`);
  }

  // -------------------------------------------------------
  // الخطوة 3: STORE_DATABASE_SECRET
  // -------------------------------------------------------
  await _logStep(tenantId, 'STORE_DATABASE_SECRET', 'running');
  let encryptedDbUrl;
  try {
    const template = process.env.TENANT_DB_URL_TEMPLATE;
    if (!template || !template.includes('{db}')) {
      throw new Error('TENANT_DB_URL_TEMPLATE غير مضبوط أو لا يحتوي على {db}');
    }
    const plainDbUrl = template.replace('{db}', dbName);
    encryptedDbUrl = encryptDbUrl(plainDbUrl);
    await db.query(
      `UPDATE tenants SET encrypted_db_url = $1, db_name = $2 WHERE id = $3`,
      [encryptedDbUrl, dbName, tenantId]
    );
    await _logStep(tenantId, 'STORE_DATABASE_SECRET', 'success');
  } catch (err) {
    await _logStep(tenantId, 'STORE_DATABASE_SECRET', 'failed', err.message);
    throw new Error(`STORE_DATABASE_SECRET فشل: ${err.message}`);
  }

  // -------------------------------------------------------
  // الخطوة 4: RUN_MIGRATIONS
  // -------------------------------------------------------
  await _logStep(tenantId, 'RUN_MIGRATIONS', 'running');
  try {
    const tenantPool = getTenantPool(subdomain, encryptedDbUrl);
    const migrationFiles = _getMigrationFiles();

    for (const filename of migrationFiles) {
      // تحقق إذا كانت الهجرة طُبِّقت بالفعل
      // نتعامل مع خطأ "الجدول غير موجود" (42P01) فقط — هجرة 001 ستُنشئه
      let applied = { rows: [] };
      try {
        applied = await tenantPool.query(
          `SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1`,
          [filename]
        );
      } catch (checkErr) {
        if (checkErr.code !== '42P01') throw checkErr; // أعد رمي الأخطاء الأخرى
      }

      if (applied.rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
      await tenantPool.query(sql);
      await tenantPool.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
        [filename]
      );
    }
    await _logStep(tenantId, 'RUN_MIGRATIONS', 'success', `applied ${migrationFiles.length} migration(s)`);
  } catch (err) {
    await _logStep(tenantId, 'RUN_MIGRATIONS', 'failed', err.message);
    throw new Error(`RUN_MIGRATIONS فشل: ${err.message}`);
  }

  // -------------------------------------------------------
  // الخطوة 5: CREATE_ADMIN
  // -------------------------------------------------------
  await _logStep(tenantId, 'CREATE_ADMIN', 'running');
  try {
    const tenantPool = getTenantPool(subdomain, encryptedDbUrl);
    const { firstName, lastName } = _splitName(adminName);
    // استخدم الجوال (أرقام فقط) كاسم مستخدم أو البريد الإلكتروني أو 'admin' كحل أخير
    const normalizedPhone = _normalizePhone(adminPhone);
    const username = normalizedPhone || adminEmail || 'admin';
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await tenantPool.query(
      `INSERT INTO users (first_name, last_name, username, email, phone, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'admin', true)
       ON CONFLICT (username) DO UPDATE SET
         first_name    = EXCLUDED.first_name,
         last_name     = EXCLUDED.last_name,
         email         = EXCLUDED.email,
         phone         = EXCLUDED.phone,
         password_hash = EXCLUDED.password_hash,
         role          = 'admin',
         is_active     = true,
         updated_at    = CURRENT_TIMESTAMP`,
      [firstName, lastName, username, adminEmail || null, adminPhone || null, passwordHash]
    );
    await _logStep(tenantId, 'CREATE_ADMIN', 'success', `username=${username}`);
  } catch (err) {
    await _logStep(tenantId, 'CREATE_ADMIN', 'failed', err.message);
    throw new Error(`CREATE_ADMIN فشل: ${err.message}`);
  }

  // -------------------------------------------------------
  // الخطوة 6: CREATE_SUBSCRIPTION
  // -------------------------------------------------------
  await _logStep(tenantId, 'CREATE_SUBSCRIPTION', 'running');
  try {
    await db.query(
      `INSERT INTO subscriptions (tenant_id, plan, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, plan]
    );
    // تفعيل المستأجر الآن
    await db.query(
      `UPDATE tenants SET status = 'active' WHERE id = $1`,
      [tenantId]
    );
    await _logStep(tenantId, 'CREATE_SUBSCRIPTION', 'success');
  } catch (err) {
    await _logStep(tenantId, 'CREATE_SUBSCRIPTION', 'failed', err.message);
    throw new Error(`CREATE_SUBSCRIPTION فشل: ${err.message}`);
  }

  // -------------------------------------------------------
  // الخطوة 7: SEND_WELCOME_EMAIL
  // (تُسجَّل فقط دون إرسال بريد فعلي أثناء التجهيز)
  // -------------------------------------------------------
  await _logStep(tenantId, 'SEND_WELCOME_EMAIL', 'success',
    `Welcome email queued for ${adminEmail || adminPhone}`);

  await _logStep(tenantId, 'SYNC_CENTRAL_TENANT_DIRECTORY', 'running');
  try {
    await _syncCentralTenantDirectoryEntry({
      tenantId,
      companyName,
      plan,
      adminName,
      adminEmail
    });
    await _logStep(tenantId, 'SYNC_CENTRAL_TENANT_DIRECTORY', 'success');
  } catch (err) {
    await _logStep(tenantId, 'SYNC_CENTRAL_TENANT_DIRECTORY', 'failed', err.message);
    throw err;
  }

  const loginUrl = `https://${subdomain}.${baseDomain}`;
  return { tenantId, subdomain, loginUrl };
}

/**
 * إعادة تشغيل هجرات المستأجر (للمشرف الأعلى).
 * يُطبِّق فقط الهجرات غير المُطبَّقة.
 * @param {number} tenantId
 * @returns {Promise<{applied: string[]}>}
 */
async function rerunMigrations(tenantId) {
  const tenantRes = await db.query(
    `SELECT subdomain, encrypted_db_url FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId]
  );
  if (!tenantRes.rows.length) throw new Error('المستأجر غير موجود.');
  const { subdomain, encrypted_db_url } = tenantRes.rows[0];

  const tenantPool = getTenantPool(subdomain, encrypted_db_url);
  const migrationFiles = _getMigrationFiles();
  const applied = [];

  for (const filename of migrationFiles) {
    let existing = { rows: [] };
    try {
      existing = await tenantPool.query(
        `SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1`,
        [filename]
      );
    } catch (checkErr) {
      if (checkErr.code !== '42P01') throw checkErr;
    }

    if (existing.rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    await tenantPool.query(sql);
    await tenantPool.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      [filename]
    );
    applied.push(filename);
  }

  await _logStep(tenantId, 'RUN_MIGRATIONS', 'success',
    `Re-run: applied ${applied.length} migration(s)`, { files: applied });
  return { applied };
}

module.exports = { provisionTenant, rerunMigrations };
