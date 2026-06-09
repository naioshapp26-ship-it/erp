'use strict';

/**
 * tenant-auth-api.js
 * المرحلة 2 — المصادقة الخاصة بالمستأجر
 *
 * يُعالج تسجيل الدخول والتحقق وتسجيل الخروج وإنشاء الحسابات
 * مقابل قاعدة بيانات المستأجر الخاصة (req.tenantPool).
 *
 * يعتمد على وسيط tenant-resolver الذي يُضبط req.tenant و req.tenantPool.
 *
 * المسارات:
 *  POST /api/tenant-auth/login      — تسجيل الدخول (بريد أو جوال)
 *  GET  /api/tenant-auth/verify     — التحقق من صلاحية الجلسة
 *  POST /api/tenant-auth/logout     — تسجيل الخروج
 *  POST /api/tenant-auth/register   — تسجيل مستخدم جديد (انضمام عام)
 *
 * قاعدة نطاق الطلب:
 *  - login/register/logout تشترط req.tenantPool (نطاق فرعي نشط)
 *  - verify يدعم كلا المسارين:
 *      أ) req.tenantPool موجود → يستعلم مباشرة من قاعدة بيانات المستأجر
 *      ب) req.tenantPool مفقود → يُعيد حل سياق المستأجر عبر tenant_session_index المركزي
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { getTenantPool } = require('./tenant-connection-manager');
const {
  buildCentralTenantEntityId,
  buildDisplayName,
  syncCentralTenantUserDirectoryEntry
} = require('./tenant-directory-sync');

const router = express.Router();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 ساعة

// ---- Rate Limiters ----
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تم تجاوز عدد محاولات الدخول. يرجى المحاولة لاحقاً.' }
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تم تجاوز حد إنشاء الحسابات. يرجى المحاولة لاحقاً.' }
});

// ---- مساعدات ----

const SHARED_DB_MARKER = 'shared://central';

function _parseTenantSettings(tenant) {
  if (!tenant?.settings) return {};
  if (typeof tenant.settings === 'object' && !Array.isArray(tenant.settings)) {
    return tenant.settings;
  }
  if (typeof tenant.settings !== 'string') return {};
  try {
    return JSON.parse(tenant.settings);
  } catch (_) {
    return {};
  }
}

function _isSharedDbTenant(tenant) {
  if (!tenant) return false;
  if (tenant.encrypted_db_url === SHARED_DB_MARKER) return true;
  const settings = _parseTenantSettings(tenant);
  return settings.sharedDb === true || settings.liteProvision === true;
}

async function _ensureSharedSessionsSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      session_token VARCHAR(255) NOT NULL UNIQUE,
      ip_address VARCHAR(50),
      user_agent TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token VARCHAR(255) UNIQUE NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_activity TIMESTAMP DEFAULT NOW()
    )
  `);
}

/**
 * استخراج رمز المصادقة من الرأس أو الكعكة.
 */
function _extractToken(req) {
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

/**
 * التحقق من req.tenantPool وإرجاع خطأ 400 إذا لم يكن موجوداً.
 */
function _requireTenantPool(req, res) {
  if (!req.tenantPool) {
    res.status(400).json({
      success: false,
      message: 'هذا المسار يتطلب نطاقاً فرعياً نشطاً للمستأجر.'
    });
    return false;
  }
  return true;
}

/**
 * بناء كائن استجابة المستخدم المصادق.
 */
function _buildUserResponse(user, tenant) {
  const entityId = buildCentralTenantEntityId(tenant.id);

  return {
    id: user.id,
    name: buildDisplayName(user),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
    isActive: user.is_active,
    tenant_type: 'TENANT',
    tenantType: 'TENANT',
    entity_id: entityId,
    entityId,
    entity_name: tenant.company_name,
    entityName: tenant.company_name,
    tenantId: tenant.id,
    tenantSubdomain: tenant.subdomain,
    companyName: tenant.company_name,
    allowed_pages: [],
    allowedPages: []
  };
}

async function _getAllowedTenantPages(tenant) {
  if (!tenant?.id) {
    return [];
  }

  const entityId = buildCentralTenantEntityId(tenant.id);

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tenant_page_access (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        tenant_entity_id VARCHAR(120),
        page_key VARCHAR(120) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.query(`ALTER TABLE tenant_page_access ALTER COLUMN tenant_id DROP NOT NULL`);
    await db.query(`ALTER TABLE tenant_page_access ADD COLUMN IF NOT EXISTS tenant_entity_id VARCHAR(120)`);
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS tenant_page_access_tenant_page_key_idx
      ON tenant_page_access (tenant_id, page_key)
    `);
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS tenant_page_access_entity_page_key_idx
      ON tenant_page_access (tenant_entity_id, page_key)
    `);

    const tenantPagesResult = await db.query(
      `SELECT page_key
       FROM tenant_page_access
       WHERE ($1::INTEGER IS NOT NULL AND tenant_id = $1)
          OR tenant_entity_id = $2
       ORDER BY page_key`,
      [tenant.id, entityId]
    );

    const tenantPages = tenantPagesResult.rows.map((row) => row.page_key);
    if (tenantPages.length > 0) {
      return tenantPages;
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS account_type_sidebar_config (
        id SERIAL PRIMARY KEY,
        account_type VARCHAR(50) NOT NULL,
        page_key VARCHAR(120) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(account_type, page_key)
      )
    `);
    const typePagesResult = await db.query(
      `SELECT page_key
       FROM account_type_sidebar_config
       WHERE account_type = 'TENANT'
       ORDER BY page_key`
    );
    return typePagesResult.rows.map((row) => row.page_key);
  } catch (error) {
    console.warn('[TenantAuth] failed to load tenant allowed pages:', error.message);
    return [];
  }
}

/**
 * إنشاء جلسة جديدة في قاعدة بيانات المستأجر وتسجيلها في الفهرس المركزي.
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
async function _createSession(tenantPool, userId, tenantId, req, options = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
  const ua = req.headers['user-agent'] || '';

  if (options.sharedDb) {
    await _ensureSharedSessionsSchema(tenantPool);
  }

  await tenantPool.query(
    `INSERT INTO sessions (user_id, tenant_id, session_token, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, tenantId, token, ip, ua, expiresAt]
  );

  if (options.sharedDb) {
    await tenantPool.query(
      `INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, token, ip, ua, expiresAt]
    );
  }

  // تسجيل في الفهرس المركزي لإتاحة إعادة الحل لاحقاً
  await db.query(
    `INSERT INTO tenant_session_index (session_token, tenant_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_token) DO UPDATE SET
       tenant_id  = EXCLUDED.tenant_id,
       expires_at = EXCLUDED.expires_at`,
    [token, tenantId, expiresAt]
  ).catch(async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tenant_session_index (
        session_token VARCHAR(255) PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.query(
      `INSERT INTO tenant_session_index (session_token, tenant_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_token) DO UPDATE SET
         tenant_id  = EXCLUDED.tenant_id,
         expires_at = EXCLUDED.expires_at`,
      [token, tenantId, expiresAt]
    );
  });

  return { token, expiresAt };
}

/**
 * حذف الجلسة من قاعدة بيانات المستأجر والفهرس المركزي.
 */
async function _deleteSession(tenantPool, token) {
  await tenantPool.query(
    `DELETE FROM sessions WHERE session_token = $1`,
    [token]
  );
  await db.query(
    `DELETE FROM tenant_session_index WHERE session_token = $1`,
    [token]
  ).catch(() => {}); // لا تفشل إذا لم يُعثر على السجل
}

// ================================================================
// POST /api/tenant-auth/login
// ================================================================
router.post('/login', loginLimiter, async (req, res) => {
  if (!_requireTenantPool(req, res)) return;

  try {
    const identifier = String(req.body?.identifier || req.body?.email || req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال بيانات الدخول.' });
    }

    const sharedDb = _isSharedDbTenant(req.tenant);
    let user = null;
    let passwordHash = null;

    if (sharedDb) {
      const entityId = buildCentralTenantEntityId(req.tenant.id);
      const userRes = await req.tenantPool.query(
        `SELECT
           u.id,
           u.name,
           u.email,
           u.role,
           u.is_active,
           u.entity_id,
           u.entity_name,
           u.tenant_type,
           uc.username,
           uc.password_hash
         FROM user_credentials uc
         JOIN users u ON u.id = uc.user_id
         WHERE u.entity_id = $2
           AND u.is_active = true
           AND uc.is_active = true
           AND (
             LOWER(uc.username) = LOWER($1)
             OR LOWER(COALESCE(u.email, '')) = LOWER($1)
           )
         LIMIT 1`,
        [identifier, entityId]
      );
      user = userRes.rows[0] || null;
      passwordHash = user?.password_hash || null;
    } else {
      const userRes = await req.tenantPool.query(
        `SELECT *
         FROM users
         WHERE (LOWER(username) = LOWER($1)
            OR LOWER(COALESCE(email, '')) = LOWER($1)
            OR phone = $1)
           AND is_active = true
         LIMIT 1`,
        [identifier]
      );
      user = userRes.rows[0] || null;
      passwordHash = user?.password_hash || null;
    }

    if (!user || !passwordHash || !(await bcrypt.compare(password, passwordHash))) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة.' });
    }

    const { token, expiresAt } = await _createSession(
      req.tenantPool,
      user.id,
      req.tenant.id,
      req,
      { sharedDb }
    );
    const responseUser = _buildUserResponse(user, req.tenant);
    responseUser.allowed_pages = await _getAllowedTenantPages(req.tenant);
    responseUser.allowedPages = responseUser.allowed_pages;

    res.cookie('authToken', token, {
      httpOnly: false,
      secure: req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS
    });

    return res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user: responseUser,
        session: { token, expires_at: expiresAt }
      }
    });
  } catch (error) {
    console.error('[TenantAuth] login failed:', error);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء تسجيل الدخول.' });
  }
});

// ================================================================
// GET /api/tenant-auth/verify
// ================================================================
router.get('/verify', verifyLimiter, async (req, res) => {
  const token = _extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'لم يتم توفير رمز الجلسة.' });
  }

  try {
    let tenantPool = req.tenantPool;
    let tenant = req.tenant;

    // إعادة حل سياق المستأجر إذا لم يكن موجوداً (طلب من خارج النطاق الفرعي)
    if (!tenantPool) {
      const indexRes = await db.query(
        `SELECT tsi.tenant_id, t.subdomain, t.company_name, t.encrypted_db_url, t.status
         FROM tenant_session_index tsi
         JOIN tenants t ON t.id = tsi.tenant_id
         WHERE tsi.session_token = $1 AND tsi.expires_at > NOW()
         LIMIT 1`,
        [token]
      );

      if (!indexRes.rows.length) {
        return res.status(401).json({ success: false, message: 'الجلسة غير صحيحة أو منتهية.' });
      }

      const row = indexRes.rows[0];
      if (row.status !== 'active') {
        return res.status(403).json({ success: false, message: 'حساب المستأجر غير نشط.' });
      }

      tenant = row;
      tenantPool = getTenantPool(row.subdomain, row.encrypted_db_url);
    }

    // التحقق من الجلسة في قاعدة بيانات المستأجر
    const sessionRes = await tenantPool.query(
      `SELECT s.user_id, s.tenant_id, s.expires_at, u.*
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = true
       LIMIT 1`,
      [token]
    );

    if (!sessionRes.rows.length) {
      return res.status(401).json({ success: false, message: 'الجلسة غير صحيحة أو منتهية.' });
    }

    const row = sessionRes.rows[0];

    // تحديث آخر نشاط للجلسة
    await tenantPool.query(
      `UPDATE sessions SET last_activity = NOW() WHERE session_token = $1`,
      [token]
    );
    const allowedPages = await _getAllowedTenantPages(tenant);
    const responseUser = {
      ..._buildUserResponse(row, tenant),
      allowed_pages: allowedPages,
      allowedPages: allowedPages
    };

    return res.json({
      success: true,
      data: {
        user: responseUser,
        session: {
          token,
          expires_at: row.expires_at
        }
      }
    });
  } catch (err) {
    console.error('[TenantAuth] verify error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// POST /api/tenant-auth/logout
// ================================================================
router.post('/logout', async (req, res) => {
  if (!_requireTenantPool(req, res)) return;

  const token = _extractToken(req);
  if (!token) {
    return res.status(400).json({ success: false, message: 'رمز الجلسة مطلوب.' });
  }

  try {
    await _deleteSession(req.tenantPool, token);
    return res.json({ success: true, message: 'تم تسجيل الخروج بنجاح.' });
  } catch (err) {
    console.error('[TenantAuth] logout error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// POST /api/tenant-auth/register  — انضمام عام للمستخدم
// ================================================================
router.post('/register', registerLimiter, async (req, res) => {
  if (!_requireTenantPool(req, res)) return;

  const { firstName, lastName = '', username, email, phone, password } = req.body || {};

  if (!firstName || !username || !password) {
    return res.status(400).json({
      success: false,
      message: 'الحقول المطلوبة: firstName, username, password'
    });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
  }
  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'يجب توفير البريد الإلكتروني أو رقم الجوال.'
    });
  }

  const tenantPool = req.tenantPool;
  const tenant = req.tenant;
  const normalizedUsername = String(username).trim().toLowerCase();

  try {
    // تحقق من التفرد داخل قاعدة بيانات المستأجر فقط
    const existingRes = await tenantPool.query(
      `SELECT id FROM users WHERE LOWER(username) = $1
          OR (email IS NOT NULL AND LOWER(email) = $2)
       LIMIT 1`,
      [normalizedUsername, email ? String(email).trim().toLowerCase() : null]
    );

    if (existingRes.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const insertRes = await tenantPool.query(
      `INSERT INTO users (first_name, last_name, username, email, phone, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'staff', true)
       RETURNING *`,
      [
        String(firstName).trim(),
        String(lastName).trim(),
        normalizedUsername,
        email ? String(email).trim().toLowerCase() : null,
        phone ? String(phone).trim() : null,
        passwordHash
      ]
    );

    const user = insertRes.rows[0];
    try {
      await syncCentralTenantUserDirectoryEntry({ tenant, user });
    } catch (syncError) {
      console.warn('[TenantAuth] central directory sync on register failed:', syncError.message);
    }

    const session = await _createSession(tenantPool, user.id, tenant.id, req);
    const allowedPages = await _getAllowedTenantPages(tenant);
    const responseUser = {
      ..._buildUserResponse(user, tenant),
      allowed_pages: allowedPages,
      allowedPages: allowedPages
    };

    return res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب وتسجيل الدخول بنجاح.',
      data: {
        user: responseUser,
        session: {
          token: session.token,
          expires_at: session.expiresAt
        }
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.'
      });
    }
    console.error('[TenantAuth] register error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

module.exports = router;
