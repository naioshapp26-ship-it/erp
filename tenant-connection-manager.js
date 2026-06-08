'use strict';

/**
 * tenant-connection-manager.js
 * المرحلة 0 — إدارة اتصالات قواعد بيانات المستأجرين
 *
 * يوفر:
 *  - تشفير/فك تشفير روابط قواعد بيانات المستأجرين بـ AES-256-GCM
 *  - تخزين حمامات اتصال (Connection Pools) في الذاكرة مع صلاحية محدودة المدة
 *  - إعادة استخدام الحمام لجميع طلبات النطاق الفرعي نفسه
 *
 * متطلبات بيئة التشغيل:
 *  TENANT_DB_ENCRYPTION_KEY  — مفتاح هيكس بطول 64 حرف (32 بايت)
 *  TENANT_POOL_TTL_MS        — مدة صلاحية حمام الاتصال بالميلي-ثانية (افتراضي: 30 دقيقة)
 */

const { Pool } = require('pg');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_HEX = process.env.TENANT_DB_ENCRYPTION_KEY || '';
const POOL_TTL_MS = process.env.TENANT_POOL_TTL_MS
  ? parseInt(process.env.TENANT_POOL_TTL_MS, 10)
  : 30 * 60 * 1000;

function _buildTenantConnectionConfig(rawDbUrl) {
  let connectionString = rawDbUrl;
  let ssl = { rejectUnauthorized: false };

  try {
    const targetUrl = new URL(rawDbUrl);
    const appDbUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL ? new URL(process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL) : null;
    const isProxyHost = targetUrl.hostname.endsWith('.proxy.rlwy.net');
    const isInternalHost = targetUrl.hostname.endsWith('.railway.internal');

    if (process.env.NODE_ENV === 'production' && appDbUrl && (isProxyHost || isInternalHost)) {
      targetUrl.hostname = appDbUrl.hostname;
      targetUrl.port = appDbUrl.port;
      connectionString = targetUrl.toString();
      ssl = false;
    }
  } catch (_) {
    // إذا تعذر تحليل الرابط، استخدمه كما هو مع تعطيل التحقق الصارم من الشهادة.
  }

  return { connectionString, ssl };
}

// ---- مفتاح التشفير ----
let _encryptionKey = null;

function _getEncryptionKey() {
  if (_encryptionKey) return _encryptionKey;
  if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY_HEX)) {
    throw new Error(
      'TENANT_DB_ENCRYPTION_KEY must be set to a 64-character hexadecimal string (32 bytes).'
    );
  }
  _encryptionKey = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  return _encryptionKey;
}

/**
 * تشفير رابط قاعدة بيانات المستأجر.
 * @param {string} plainDbUrl
 * @returns {string}  نص مشفر بالصيغة hex: iv:authTag:ciphertext
 */
function encryptDbUrl(plainDbUrl) {
  const key = _getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainDbUrl, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

/**
 * فك تشفير رابط قاعدة بيانات المستأجر.
 * @param {string} encryptedDbUrl
 * @returns {string}  الرابط بنص عادي
 */
function decryptDbUrl(encryptedDbUrl) {
  const key = _getEncryptionKey();
  const parts = encryptedDbUrl.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted DB URL format.');
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

// ---- حمامات الاتصال في الذاكرة ----
// { subdomain: { pool: Pool, expiresAt: number } }
const _pools = new Map();

/**
 * إرجاع حمام اتصال المستأجر، إنشاؤه إذا لم يكن موجوداً أو انتهت صلاحيته.
 * @param {string} subdomain
 * @param {string} encryptedDbUrl
 * @returns {Pool}
 */
function getTenantPool(subdomain, encryptedDbUrl) {
  if (!encryptedDbUrl || encryptedDbUrl === 'shared://central') {
    const db = require('./db');
    return db.pool;
  }

  const now = Date.now();
  const cached = _pools.get(subdomain);
  if (cached && cached.expiresAt > now) {
    return cached.pool;
  }

  // إغلاق الحمام المنتهي الصلاحية إذا وُجد
  if (cached) {
    cached.pool.end().catch(() => {});
  }

  const dbUrl = decryptDbUrl(encryptedDbUrl);
  const connectionConfig = _buildTenantConnectionConfig(dbUrl);
  const pool = new Pool({
    connectionString: connectionConfig.connectionString,
    ssl: connectionConfig.ssl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  pool.on('error', (err) => {
    // Use separate args to avoid format-string injection from user-controlled subdomain
    console.error('[TenantPool] خطأ في الاتصال للنطاق:', subdomain, '-', err.message);
    _pools.delete(subdomain);
  });

  _pools.set(subdomain, { pool, expiresAt: now + POOL_TTL_MS });
  return pool;
}

/**
 * حذف حمام اتصال مستأجر محدد وإغلاقه.
 * @param {string} subdomain
 */
async function releaseTenantPool(subdomain) {
  const cached = _pools.get(subdomain);
  if (cached) {
    _pools.delete(subdomain);
    await cached.pool.end().catch(() => {});
  }
}

/**
 * تنظيف الحمامات المنتهية الصلاحية من الذاكرة.
 */
function evictExpiredPools() {
  const now = Date.now();
  for (const [subdomain, entry] of _pools.entries()) {
    if (entry.expiresAt <= now) {
      entry.pool.end().catch(() => {});
      _pools.delete(subdomain);
    }
  }
}

// تشغيل التنظيف الدوري كل نصف دورة TTL
setInterval(evictExpiredPools, Math.max(POOL_TTL_MS / 2, 60000)).unref();

module.exports = {
  encryptDbUrl,
  decryptDbUrl,
  _buildTenantConnectionConfig,
  getTenantPool,
  releaseTenantPool,
  evictExpiredPools
};
