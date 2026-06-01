'use strict';

/**
 * tenant-user-api.js
 * المرحلة 2 — إدارة مستخدمي المستأجر
 *
 * جميع العمليات تجري على قاعدة بيانات المستأجر (req.tenantPool).
 * يشترط المصادقة الناجحة عبر tenant-auth-api (دور admin أو أعلى).
 *
 * قاعدة النطاق:
 *  - كل إنشاء/استعلام/تحديث/حذف للمستخدمين يستخدم قاعدة بيانات المستأجر.
 *  - لا يُكشف أي مستخدم من قاعدة البيانات المركزية.
 *  - فحوصات التفرد (username/email) تجري داخل قاعدة بيانات المستأجر فقط.
 *  - كلمات المرور مشفرة دائماً.
 *
 * المسارات:
 *  GET    /api/tenant-users          — قائمة المستخدمين
 *  POST   /api/tenant-users          — إنشاء مستخدم (admin)
 *  GET    /api/tenant-users/:id      — عرض مستخدم
 *  PATCH  /api/tenant-users/:id      — تحديث مستخدم (admin)
 *  DELETE /api/tenant-users/:id      — تعطيل مستخدم (admin)
 *  POST   /api/tenant-users/:id/reset-password — إعادة تعيين كلمة مرور (admin)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const { getTenantPool } = require('./tenant-connection-manager');
const db = require('./db');
const {
  syncCentralTenantUserDirectoryEntry,
  deactivateCentralTenantUserDirectoryEntry
} = require('./tenant-directory-sync');

const router = express.Router();

const VALID_ROLES = new Set(['admin', 'manager', 'staff', 'readonly']);

// ---- Rate Limiter ----
const userMgmtLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(userMgmtLimiter);

// ================================================================
// وسيط: التحقق من req.tenantPool
// ================================================================
function requireTenantContext(req, res, next) {
  if (!req.tenantPool) {
    return res.status(400).json({
      success: false,
      message: 'هذا المسار يتطلب نطاقاً فرعياً نشطاً للمستأجر.'
    });
  }
  return next();
}

router.use(requireTenantContext);

// ================================================================
// وسيط: مصادقة مستخدم المستأجر من رمز الجلسة
// يُضيف req.tenantUser و req.tenantSession
// ================================================================
async function requireTenantAuth(req, res, next) {
  let token = '';
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = (req.headers.cookie || '').split(';').reduce((acc, part) => {
      const [k, ...v] = part.trim().split('=');
      if (k) acc[k.trim()] = decodeURIComponent(v.join('=') || '');
      return acc;
    }, {});
    token = cookies.authToken || '';
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'غير مصادَق.' });
  }

  try {
    const tenantPool = req.tenantPool;
    const sessionRes = await tenantPool.query(
      `SELECT s.user_id, s.tenant_id, s.expires_at, u.*
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = true
       LIMIT 1`,
      [token]
    );

    if (!sessionRes.rows.length) {
      return res.status(401).json({ success: false, message: 'الجلسة غير صالحة أو منتهية.' });
    }

    req.tenantUser = sessionRes.rows[0];
    req.tenantSessionToken = token;
    return next();
  } catch (err) {
    console.error('[TenantUserAPI] requireTenantAuth error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
}

// ================================================================
// وسيط: اشتراط دور admin
// ================================================================
function requireAdmin(req, res, next) {
  if (!req.tenantUser || req.tenantUser.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'مقيد بالمشرف (admin) فقط.' });
  }
  return next();
}

// ---- مساعدات ----
function _formatUser(user) {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

// ================================================================
// GET /api/tenant-users  — قائمة المستخدمين
// ================================================================
router.get('/', requireTenantAuth, async (req, res) => {
  const { search = '', role = '', page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['is_active = true'];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR username ILIKE $${params.length} OR email ILIKE $${params.length})`
    );
  }
  if (role && VALID_ROLES.has(role)) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  try {
    const tenantPool = req.tenantPool;
    const countRes = await tenantPool.query(`SELECT COUNT(*) FROM users ${where}`, params);
    params.push(limitNum, offset);
    const dataRes = await tenantPool.query(
      `SELECT id, first_name, last_name, username, email, phone, role, is_active, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      total: parseInt(countRes.rows[0].count, 10),
      page: pageNum,
      limit: limitNum,
      users: dataRes.rows.map(_formatUser)
    });
  } catch (err) {
    console.error('[TenantUserAPI] list error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// POST /api/tenant-users  — إنشاء مستخدم (admin فقط)
// ================================================================
router.post('/', requireTenantAuth, requireAdmin, async (req, res) => {
  const { firstName, lastName = '', username, email, phone, password, role = 'staff' } = req.body || {};

  if (!firstName || !username || !password) {
    return res.status(400).json({
      success: false,
      message: 'الحقول المطلوبة: firstName, username, password'
    });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
  }
  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ success: false, message: 'الدور غير صالح.' });
  }
  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'يجب توفير البريد الإلكتروني أو رقم الجوال.'
    });
  }

  const tenantPool = req.tenantPool;
  const normalizedUsername = String(username).trim().toLowerCase();

  try {
    // تحقق من التفرد داخل قاعدة بيانات المستأجر فقط
    const existing = await tenantPool.query(
      `SELECT id FROM users WHERE LOWER(username) = $1
          OR (email IS NOT NULL AND LOWER(email) = $2)
       LIMIT 1`,
      [normalizedUsername, email ? String(email).trim().toLowerCase() : '']
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const insertRes = await tenantPool.query(
      `INSERT INTO users (first_name, last_name, username, email, phone, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [
        String(firstName).trim(),
        String(lastName).trim(),
        normalizedUsername,
        email ? String(email).trim().toLowerCase() : null,
        phone ? String(phone).trim() : null,
        passwordHash,
        role
      ]
    );

    try {
      await syncCentralTenantUserDirectoryEntry({ tenant: req.tenant, user: insertRes.rows[0] });
    } catch (syncError) {
      console.warn('[TenantUserAPI] central directory sync on create failed:', syncError.message);
    }

    return res.status(201).json({
      success: true,
      user: _formatUser(insertRes.rows[0]),
      message: 'تم إنشاء المستخدم بنجاح.'
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.'
      });
    }
    console.error('[TenantUserAPI] create error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// GET /api/tenant-users/:id  — عرض مستخدم
// ================================================================
router.get('/:id', requireTenantAuth, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  // المستخدم يمكنه رؤية ملفه الشخصي فقط ما لم يكن admin
  if (req.tenantUser.role !== 'admin' && req.tenantUser.id !== userId) {
    return res.status(403).json({ success: false, message: 'غير مصرح.' });
  }

  try {
    const result = await req.tenantPool.query(
      `SELECT id, first_name, last_name, username, email, phone, role, is_active, created_at, updated_at
       FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
    }
    return res.json({ success: true, user: _formatUser(result.rows[0]) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// PATCH /api/tenant-users/:id  — تحديث مستخدم
// ================================================================
router.patch('/:id', requireTenantAuth, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  const isAdmin = req.tenantUser.role === 'admin';
  const isSelf = req.tenantUser.id === userId;

  // المستخدم يمكنه تعديل بياناته الشخصية فقط (بدون تغيير الدور)؛ الأدمن يُعدِّل الكل
  if (!isAdmin && !isSelf) {
    return res.status(403).json({ success: false, message: 'غير مصرح.' });
  }

  const { firstName, lastName, email, phone, role } = req.body || {};
  const updates = [];
  const params = [];

  if (firstName !== undefined) {
    params.push(String(firstName).trim());
    updates.push(`first_name = $${params.length}`);
  }
  if (lastName !== undefined) {
    params.push(String(lastName).trim());
    updates.push(`last_name = $${params.length}`);
  }
  if (email !== undefined) {
    params.push(email ? String(email).trim().toLowerCase() : null);
    updates.push(`email = $${params.length}`);
  }
  if (phone !== undefined) {
    params.push(phone ? String(phone).trim() : null);
    updates.push(`phone = $${params.length}`);
  }
  if (role !== undefined && isAdmin) {
    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'الدور غير صالح.' });
    }
    params.push(role);
    updates.push(`role = $${params.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'لا توجد حقول للتحديث.' });
  }

  params.push(userId);
  try {
    const previousUserResult = await req.tenantPool.query(
      `SELECT id, email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const result = await req.tenantPool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
    }

    try {
      await syncCentralTenantUserDirectoryEntry({
        tenant: req.tenant,
        user: result.rows[0],
        previousEmail: previousUserResult.rows[0]?.email || null
      });
    } catch (syncError) {
      console.warn('[TenantUserAPI] central directory sync on update failed:', syncError.message);
    }

    return res.json({ success: true, user: _formatUser(result.rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'البريد الإلكتروني أو رقم الجوال مستخدم بالفعل.' });
    }
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// DELETE /api/tenant-users/:id  — تعطيل مستخدم (admin فقط)
// ================================================================
router.delete('/:id', requireTenantAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  // لا يُمكن تعطيل النفس
  if (req.tenantUser.id === userId) {
    return res.status(400).json({ success: false, message: 'لا يمكنك تعطيل حسابك الخاص.' });
  }

  try {
    const existingUserResult = await req.tenantPool.query(
      `SELECT id, email, first_name, last_name, username, role, is_active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const result = await req.tenantPool.query(
      `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING id, username, email, first_name, last_name, role, is_active`,
      [userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
    }

    // إلغاء جميع جلسات المستخدم المعطَّل
    const deletedSessions = await req.tenantPool.query(
      `DELETE FROM sessions WHERE user_id = $1 RETURNING session_token`,
      [userId]
    );
    if (deletedSessions.rows.length > 0) {
      const tokens = deletedSessions.rows.map(r => r.session_token);
      await db.query(
        `DELETE FROM tenant_session_index WHERE session_token = ANY($1)`,
        [tokens]
      ).catch(() => {});
    }

    try {
      await deactivateCentralTenantUserDirectoryEntry({
        tenant: req.tenant,
        user: result.rows[0],
        previousEmail: existingUserResult.rows[0]?.email || null
      });
    } catch (syncError) {
      console.warn('[TenantUserAPI] central directory sync on delete failed:', syncError.message);
    }

    return res.json({ success: true, message: 'تم تعطيل المستخدم.' });
  } catch (err) {
    console.error('[TenantUserAPI] delete error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// POST /api/tenant-users/:id/reset-password  — إعادة تعيين كلمة مرور (admin)
// ================================================================
router.post('/:id/reset-password', requireTenantAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId) return res.status(400).json({ success: false, message: 'معرف غير صالح.' });

  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.'
    });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await req.tenantPool.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING id, username`,
      [passwordHash, userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
    }

    // إلغاء جلسات المستخدم بعد تغيير كلمة المرور
    const deletedSessions = await req.tenantPool.query(
      `DELETE FROM sessions WHERE user_id = $1 RETURNING session_token`,
      [userId]
    );
    if (deletedSessions.rows.length > 0) {
      const tokens = deletedSessions.rows.map(r => r.session_token);
      await db.query(
        `DELETE FROM tenant_session_index WHERE session_token = ANY($1)`,
        [tokens]
      ).catch(() => {});
    }

    return res.json({ success: true, message: 'تم تغيير كلمة المرور وإلغاء الجلسات.' });
  } catch (err) {
    console.error('[TenantUserAPI] reset-password error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

module.exports = router;
