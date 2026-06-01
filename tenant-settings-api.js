'use strict';

/**
 * tenant-settings-api.js
 * المرحلة 3 — إدارة إعدادات المستأجر
 *
 * جميع العمليات تجري على قاعدة بيانات المستأجر (req.tenantPool).
 * يشترط المصادقة الناجحة عبر tenant-auth-api بدور admin.
 *
 * المسارات:
 *  -- إعدادات الدفع --
 *  GET  /api/tenant-settings/payment                  — قراءة إعدادات الدفع (بدون أسرار)
 *  PUT  /api/tenant-settings/payment/:provider        — حفظ إعدادات مزود دفع
 *  POST /api/tenant-settings/payment/:provider/test   — اختبار الاتصال
 *
 *  -- إعدادات البريد --
 *  GET  /api/tenant-settings/email                    — قراءة إعدادات SMTP
 *  PUT  /api/tenant-settings/email                    — حفظ إعدادات SMTP
 *
 *  -- الواجهة والعلامة التجارية --
 *  GET  /api/tenant-settings/branding                 — قراءة إعدادات الواجهة
 *  PUT  /api/tenant-settings/branding                 — حفظ إعدادات الواجهة
 *
 *  -- SEO --
 *  GET  /api/tenant-settings/seo                      — قراءة إعدادات SEO
 *  PUT  /api/tenant-settings/seo                      — حفظ إعدادات SEO
 *
 *  -- الذكاء الاصطناعي (عبر tenant_settings) --
 *  GET  /api/tenant-settings/ai                       — قراءة إعدادات الذكاء الاصطناعي
 *  PUT  /api/tenant-settings/ai                       — حفظ إعدادات الذكاء الاصطناعي
 *
 *  -- إعدادات الموقع العام --
 *  GET  /api/tenant-settings/public-site              — قراءة إعدادات الموقع العام
 *  PUT  /api/tenant-settings/public-site              — حفظ إعدادات الموقع العام
 *
 *  -- معاملات الدفع --
 *  GET  /api/tenant-settings/payment-transactions     — قائمة معاملات الدفع
 *  POST /api/tenant-settings/payment-transactions     — تسجيل معاملة دفع
 */

const express = require('express');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');

const router = express.Router();

// ---- Rate Limiter ----
const settingsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(settingsLimiter);

// ================================================================
// تشفير/فك تشفير الأسرار الحساسة (AES-256-GCM)
// ================================================================

const ALGORITHM = 'aes-256-gcm';

function _getSettingsKey() {
  const hex = process.env.TENANT_DB_ENCRYPTION_KEY || '';
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('TENANT_DB_ENCRYPTION_KEY مطلوب وبطول 64 حرفاً هيكس.');
  }
  return Buffer.from(hex, 'hex');
}

function encryptSecret(plain) {
  if (!plain) return null;
  const key = _getSettingsKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), ct.toString('hex')].join(':');
}

function decryptSecret(encrypted) {
  if (!encrypted) return null;
  try {
    const key = _getSettingsKey();
    const parts = String(encrypted).split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, ctHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final()
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

// ================================================================
// الوسطاء المشتركة
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

/**
 * التحقق من المصادقة من جدول sessions في قاعدة بيانات المستأجر.
 */
async function requireTenantAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : req.cookies?.tenant_session;

  if (!token) {
    return res.status(401).json({ success: false, message: 'غير مصرح — يرجى تسجيل الدخول.' });
  }

  try {
    const result = await req.tenantPool.query(
      `SELECT s.user_id, u.role, u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.session_token = $1
         AND s.expires_at > NOW()
         AND u.is_active = true
       LIMIT 1`,
      [token]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'الجلسة منتهية أو غير صالحة.' });
    }
    req.tenantUser = result.rows[0];
    return next();
  } catch (err) {
    console.error('[TenantSettings] auth error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي في التحقق.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.tenantUser || req.tenantUser.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'يتطلب صلاحيات المشرف.' });
  }
  return next();
}

// جميع المسارات تشترط المصادقة والدور admin
router.use(requireTenantAuth, requireAdmin);

// ================================================================
// إعدادات الدفع
// ================================================================

const PAYMENT_PROVIDERS = new Set(['stripe', 'paypal', 'paymob']);

/**
 * GET /api/tenant-settings/payment
 * إرجاع جميع إعدادات الدفع (الأسرار تُحجب).
 */
router.get('/payment', async (req, res) => {
  try {
    const result = await req.tenantPool.query(
      `SELECT id, provider, is_enabled, is_test_mode,
              stripe_public_key,
              paypal_client_id, paypal_webhook_id, paypal_merchant_id,
              paymob_public_key, paymob_integration_ids, paymob_base_url,
              extra, updated_at
       FROM tenant_payment_settings
       ORDER BY provider`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[TenantSettings] GET payment:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في قراءة إعدادات الدفع.' });
  }
});

/**
 * PUT /api/tenant-settings/payment/:provider
 * حفظ/تحديث إعدادات مزود دفع (الأسرار تُشفَّر قبل التخزين).
 */
router.put('/payment/:provider', async (req, res) => {
  const { provider } = req.params;
  if (!PAYMENT_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, message: 'مزود الدفع غير مدعوم.' });
  }

  const {
    is_enabled, is_test_mode,
    // Stripe
    stripe_public_key, stripe_secret_key, stripe_webhook_secret,
    // PayPal
    paypal_client_id, paypal_client_secret, paypal_webhook_id, paypal_merchant_id,
    // Paymob
    paymob_public_key, paymob_secret_key, paymob_hmac_secret,
    paymob_integration_ids, paymob_base_url,
    extra
  } = req.body;

  try {
    // نحدد القيم المشفرة فقط إذا أُرسلت (لتجنب الكتابة فوق قيم موجودة بقيم فارغة)
    const encStripe = stripe_secret_key !== undefined
      ? encryptSecret(stripe_secret_key) : undefined;
    const encStripeWH = stripe_webhook_secret !== undefined
      ? encryptSecret(stripe_webhook_secret) : undefined;
    const encPayPal = paypal_client_secret !== undefined
      ? encryptSecret(paypal_client_secret) : undefined;
    const encPaymobSK = paymob_secret_key !== undefined
      ? encryptSecret(paymob_secret_key) : undefined;
    const encPaymobHMAC = paymob_hmac_secret !== undefined
      ? encryptSecret(paymob_hmac_secret) : undefined;

    await req.tenantPool.query(
      `INSERT INTO tenant_payment_settings (
         provider, is_enabled, is_test_mode,
         stripe_public_key, stripe_secret_key, stripe_webhook_secret,
         paypal_client_id, paypal_client_secret, paypal_webhook_id, paypal_merchant_id,
         paymob_public_key, paymob_secret_key, paymob_hmac_secret,
         paymob_integration_ids, paymob_base_url, extra
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (provider) DO UPDATE SET
         is_enabled              = COALESCE($2, tenant_payment_settings.is_enabled),
         is_test_mode            = COALESCE($3, tenant_payment_settings.is_test_mode),
         stripe_public_key       = COALESCE($4, tenant_payment_settings.stripe_public_key),
         stripe_secret_key       = COALESCE($5, tenant_payment_settings.stripe_secret_key),
         stripe_webhook_secret   = COALESCE($6, tenant_payment_settings.stripe_webhook_secret),
         paypal_client_id        = COALESCE($7, tenant_payment_settings.paypal_client_id),
         paypal_client_secret    = COALESCE($8, tenant_payment_settings.paypal_client_secret),
         paypal_webhook_id       = COALESCE($9, tenant_payment_settings.paypal_webhook_id),
         paypal_merchant_id      = COALESCE($10, tenant_payment_settings.paypal_merchant_id),
         paymob_public_key       = COALESCE($11, tenant_payment_settings.paymob_public_key),
         paymob_secret_key       = COALESCE($12, tenant_payment_settings.paymob_secret_key),
         paymob_hmac_secret      = COALESCE($13, tenant_payment_settings.paymob_hmac_secret),
         paymob_integration_ids  = COALESCE($14, tenant_payment_settings.paymob_integration_ids),
         paymob_base_url         = COALESCE($15, tenant_payment_settings.paymob_base_url),
         extra                   = COALESCE($16, tenant_payment_settings.extra),
         updated_at              = CURRENT_TIMESTAMP`,
      [
        provider,
        is_enabled ?? null,
        is_test_mode ?? null,
        stripe_public_key ?? null,
        encStripe ?? null,
        encStripeWH ?? null,
        paypal_client_id ?? null,
        encPayPal ?? null,
        paypal_webhook_id ?? null,
        paypal_merchant_id ?? null,
        paymob_public_key ?? null,
        encPaymobSK ?? null,
        encPaymobHMAC ?? null,
        paymob_integration_ids !== null && paymob_integration_ids !== undefined ? JSON.stringify(paymob_integration_ids) : null,
        paymob_base_url ?? null,
        extra !== null && extra !== undefined ? JSON.stringify(extra) : null
      ]
    );

    return res.json({ success: true, message: 'تم حفظ إعدادات الدفع بنجاح.' });
  } catch (err) {
    console.error('[TenantSettings] PUT payment:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في حفظ إعدادات الدفع.' });
  }
});

/**
 * POST /api/tenant-settings/payment/:provider/test
 * اختبار الاتصال ببوابة الدفع (يُفك تشفير الأسرار ثم يختبر الاتصال الأساسي).
 */
router.post('/payment/:provider/test', async (req, res) => {
  const { provider } = req.params;
  if (!PAYMENT_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, message: 'مزود الدفع غير مدعوم.' });
  }

  try {
    const result = await req.tenantPool.query(
      `SELECT * FROM tenant_payment_settings WHERE provider = $1 LIMIT 1`,
      [provider]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: `لم يتم ضبط إعدادات ${provider} بعد.`
      });
    }

    const row = result.rows[0];

    if (provider === 'stripe') {
      const secretKey = decryptSecret(row.stripe_secret_key);
      if (!secretKey) {
        return res.status(400).json({ success: false, message: 'مفتاح Stripe السري مفقود.' });
      }
      // اختبار بسيط: قراءة معلومات الحساب من Stripe
      const https = require('https');
      const testResult = await new Promise((resolve) => {
        const options = {
          hostname: 'api.stripe.com',
          path: '/v1/account',
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secretKey}`
          }
        };
        const req2 = https.request(options, (resp) => {
          let data = '';
          resp.on('data', (chunk) => { data += chunk; });
          resp.on('end', () => {
            resolve({ status: resp.statusCode, ok: resp.statusCode === 200 });
          });
        });
        req2.on('error', (e) => resolve({ status: 0, ok: false, error: e.message }));
        req2.end();
      });

      if (!testResult.ok) {
        return res.status(400).json({
          success: false,
          message: `فشل الاتصال بـ Stripe (HTTP ${testResult.status}).`
        });
      }
      return res.json({ success: true, message: 'الاتصال بـ Stripe ناجح.' });
    }

    if (provider === 'paymob') {
      const secretKey = decryptSecret(row.paymob_secret_key);
      if (!secretKey) {
        return res.status(400).json({ success: false, message: 'مفتاح Paymob السري مفقود.' });
      }
      const baseUrl = row.paymob_base_url || 'https://accept.paymob.com';
      const https2 = require('https');
      const http2 = require('http');
      const lib = baseUrl.startsWith('https') ? https2 : http2;
      const url = new URL('/api/auth/tokens', baseUrl);
      const body = JSON.stringify({ api_key: secretKey });

      const testResult = await new Promise((resolve) => {
        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        };
        const req2 = lib.request(options, (resp) => {
          let data = '';
          resp.on('data', (chunk) => { data += chunk; });
          resp.on('end', () => {
            resolve({ status: resp.statusCode, ok: resp.statusCode === 201 });
          });
        });
        req2.on('error', (e) => resolve({ status: 0, ok: false, error: e.message }));
        req2.write(body);
        req2.end();
      });

      if (!testResult.ok) {
        return res.status(400).json({
          success: false,
          message: `فشل الاتصال بـ Paymob (HTTP ${testResult.status}).`
        });
      }
      return res.json({ success: true, message: 'الاتصال بـ Paymob ناجح.' });
    }

    // PayPal: اختبار أساسي بالتحقق من وجود بيانات الاعتماد
    if (provider === 'paypal') {
      const secret = decryptSecret(row.paypal_client_secret);
      if (!row.paypal_client_id || !secret) {
        return res.status(400).json({ success: false, message: 'بيانات اعتماد PayPal مفقودة.' });
      }
      const https3 = require('https');
      const creds = Buffer.from(`${row.paypal_client_id}:${secret}`).toString('base64');
      const mode = row.is_test_mode ? 'sandbox' : 'live';
      const testResult = await new Promise((resolve) => {
        const body2 = 'grant_type=client_credentials';
        const options = {
          hostname: `api-m.${mode}.paypal.com`,
          path: '/v1/oauth2/token',
          method: 'POST',
          headers: {
            Authorization: `Basic ${creds}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body2)
          }
        };
        const req2 = https3.request(options, (resp) => {
          let data = '';
          resp.on('data', (c) => { data += c; });
          resp.on('end', () => resolve({ status: resp.statusCode, ok: resp.statusCode === 200 }));
        });
        req2.on('error', (e) => resolve({ status: 0, ok: false, error: e.message }));
        req2.write(body2);
        req2.end();
      });

      if (!testResult.ok) {
        return res.status(400).json({
          success: false,
          message: `فشل الاتصال بـ PayPal (HTTP ${testResult.status}).`
        });
      }
      return res.json({ success: true, message: 'الاتصال بـ PayPal ناجح.' });
    }

    return res.status(400).json({ success: false, message: 'مزود الدفع غير مدعوم للاختبار.' });
  } catch (err) {
    console.error('[TenantSettings] test payment:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في اختبار الاتصال.' });
  }
});

// ================================================================
// إعدادات البريد الإلكتروني (SMTP)
// ================================================================

/**
 * GET /api/tenant-settings/email
 */
router.get('/email', async (req, res) => {
  try {
    const result = await req.tenantPool.query(
      `SELECT id, smtp_host, smtp_port, smtp_user, smtp_from, smtp_secure, is_enabled, extra, updated_at
       FROM tenant_email_settings
       LIMIT 1`
    );
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('[TenantSettings] GET email:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في قراءة إعدادات البريد.' });
  }
});

/**
 * PUT /api/tenant-settings/email
 */
router.put('/email', async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, smtp_secure, is_enabled, extra } = req.body;

  const encPassword = smtp_password !== undefined ? encryptSecret(smtp_password) : undefined;

  try {
    const existing = await req.tenantPool.query(
      'SELECT id FROM tenant_email_settings LIMIT 1'
    );

    if (existing.rows.length > 0) {
      await req.tenantPool.query(
        `UPDATE tenant_email_settings SET
           smtp_host     = COALESCE($1, smtp_host),
           smtp_port     = COALESCE($2, smtp_port),
           smtp_user     = COALESCE($3, smtp_user),
           smtp_password = COALESCE($4, smtp_password),
           smtp_from     = COALESCE($5, smtp_from),
           smtp_secure   = COALESCE($6, smtp_secure),
           is_enabled    = COALESCE($7, is_enabled),
           extra         = COALESCE($8, extra),
           updated_at    = CURRENT_TIMESTAMP
         WHERE id = $9`,
        [
          smtp_host ?? null,
          smtp_port ?? null,
          smtp_user ?? null,
          encPassword ?? null,
          smtp_from ?? null,
          smtp_secure ?? null,
          is_enabled ?? null,
          extra != null ? JSON.stringify(extra) : null,
          existing.rows[0].id
        ]
      );
    } else {
      await req.tenantPool.query(
        `INSERT INTO tenant_email_settings
           (smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, smtp_secure, is_enabled, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          smtp_host ?? null,
          smtp_port ?? 587,
          smtp_user ?? null,
          encPassword ?? null,
          smtp_from ?? null,
          smtp_secure ?? false,
          is_enabled ?? false,
          extra != null ? JSON.stringify(extra) : '{}'
        ]
      );
    }

    return res.json({ success: true, message: 'تم حفظ إعدادات البريد بنجاح.' });
  } catch (err) {
    console.error('[TenantSettings] PUT email:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في حفظ إعدادات البريد.' });
  }
});

// ================================================================
// إعدادات الواجهة والعلامة التجارية
// ================================================================

/**
 * GET /api/tenant-settings/branding
 */
router.get('/branding', async (req, res) => {
  try {
    const result = await req.tenantPool.query(
      'SELECT * FROM branding_settings LIMIT 1'
    );
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('[TenantSettings] GET branding:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في قراءة إعدادات الواجهة.' });
  }
});

/**
 * PUT /api/tenant-settings/branding
 */
router.put('/branding', async (req, res) => {
  const { logo_url, favicon_url, primary_color, secondary_color, font_family, custom_css, extra } = req.body;

  try {
    const existing = await req.tenantPool.query('SELECT id FROM branding_settings LIMIT 1');

    if (existing.rows.length > 0) {
      await req.tenantPool.query(
        `UPDATE branding_settings SET
           logo_url        = COALESCE($1, logo_url),
           favicon_url     = COALESCE($2, favicon_url),
           primary_color   = COALESCE($3, primary_color),
           secondary_color = COALESCE($4, secondary_color),
           font_family     = COALESCE($5, font_family),
           custom_css      = COALESCE($6, custom_css),
           extra           = COALESCE($7, extra),
           updated_at      = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [
          logo_url ?? null,
          favicon_url ?? null,
          primary_color ?? null,
          secondary_color ?? null,
          font_family ?? null,
          custom_css ?? null,
          extra != null ? JSON.stringify(extra) : null,
          existing.rows[0].id
        ]
      );
    } else {
      await req.tenantPool.query(
        `INSERT INTO branding_settings (logo_url, favicon_url, primary_color, secondary_color, font_family, custom_css, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          logo_url ?? null,
          favicon_url ?? null,
          primary_color ?? null,
          secondary_color ?? null,
          font_family ?? null,
          custom_css ?? null,
          extra != null ? JSON.stringify(extra) : '{}'
        ]
      );
    }

    return res.json({ success: true, message: 'تم حفظ إعدادات الواجهة بنجاح.' });
  } catch (err) {
    console.error('[TenantSettings] PUT branding:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في حفظ إعدادات الواجهة.' });
  }
});

// ================================================================
// إعدادات SEO
// ================================================================

/**
 * GET /api/tenant-settings/seo
 */
router.get('/seo', async (req, res) => {
  try {
    const result = await req.tenantPool.query('SELECT * FROM seo_settings LIMIT 1');
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('[TenantSettings] GET seo:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في قراءة إعدادات SEO.' });
  }
});

/**
 * PUT /api/tenant-settings/seo
 */
router.put('/seo', async (req, res) => {
  const {
    meta_title, meta_description, meta_keywords,
    og_title, og_description, og_image_url,
    robots_txt, sitemap_xml,
    google_analytics_id, extra
  } = req.body;

  try {
    const existing = await req.tenantPool.query('SELECT id FROM seo_settings LIMIT 1');

    if (existing.rows.length > 0) {
      await req.tenantPool.query(
        `UPDATE seo_settings SET
           meta_title          = COALESCE($1, meta_title),
           meta_description    = COALESCE($2, meta_description),
           meta_keywords       = COALESCE($3, meta_keywords),
           og_title            = COALESCE($4, og_title),
           og_description      = COALESCE($5, og_description),
           og_image_url        = COALESCE($6, og_image_url),
           robots_txt          = COALESCE($7, robots_txt),
           sitemap_xml         = COALESCE($8, sitemap_xml),
           google_analytics_id = COALESCE($9, google_analytics_id),
           extra               = COALESCE($10, extra),
           updated_at          = CURRENT_TIMESTAMP
         WHERE id = $11`,
        [
          meta_title ?? null, meta_description ?? null, meta_keywords ?? null,
          og_title ?? null, og_description ?? null, og_image_url ?? null,
          robots_txt ?? null, sitemap_xml ?? null,
          google_analytics_id ?? null,
          extra != null ? JSON.stringify(extra) : null,
          existing.rows[0].id
        ]
      );
    } else {
      await req.tenantPool.query(
        `INSERT INTO seo_settings
           (meta_title, meta_description, meta_keywords, og_title, og_description, og_image_url, robots_txt, sitemap_xml, google_analytics_id, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          meta_title ?? null, meta_description ?? null, meta_keywords ?? null,
          og_title ?? null, og_description ?? null, og_image_url ?? null,
          robots_txt ?? null, sitemap_xml ?? null,
          google_analytics_id ?? null,
          extra != null ? JSON.stringify(extra) : '{}'
        ]
      );
    }

    return res.json({ success: true, message: 'تم حفظ إعدادات SEO بنجاح.' });
  } catch (err) {
    console.error('[TenantSettings] PUT seo:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في حفظ إعدادات SEO.' });
  }
});

// ================================================================
// إعدادات الذكاء الاصطناعي (عبر tenant_settings)
// ================================================================

const AI_SETTINGS_KEY = 'ai_settings';

/**
 * GET /api/tenant-settings/ai
 */
router.get('/ai', async (req, res) => {
  try {
    const result = await req.tenantPool.query(
      `SELECT value_json FROM tenant_settings WHERE key = $1 LIMIT 1`,
      [AI_SETTINGS_KEY]
    );
    const data = result.rows.length ? result.rows[0].value_json : null;
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[TenantSettings] GET ai:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في قراءة إعدادات الذكاء الاصطناعي.' });
  }
});

/**
 * PUT /api/tenant-settings/ai
 */
router.put('/ai', async (req, res) => {
  const aiConfig = req.body;
  if (typeof aiConfig !== 'object' || aiConfig === null || Array.isArray(aiConfig)) {
    return res.status(400).json({ success: false, message: 'يجب أن تكون إعدادات الذكاء الاصطناعي كائن JSON.' });
  }

  try {
    await req.tenantPool.query(
      `INSERT INTO tenant_settings (key, value_json, description)
       VALUES ($1, $2, 'إعدادات وحدة الذكاء الاصطناعي')
       ON CONFLICT (key) DO UPDATE SET
         value_json = $2,
         updated_at = CURRENT_TIMESTAMP`,
      [AI_SETTINGS_KEY, JSON.stringify(aiConfig)]
    );
    return res.json({ success: true, message: 'تم حفظ إعدادات الذكاء الاصطناعي بنجاح.' });
  } catch (err) {
    console.error('[TenantSettings] PUT ai:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في حفظ إعدادات الذكاء الاصطناعي.' });
  }
});

// ================================================================
// إعدادات الموقع العام
// ================================================================

/**
 * GET /api/tenant-settings/public-site
 */
router.get('/public-site', async (req, res) => {
  try {
    const result = await req.tenantPool.query('SELECT * FROM public_site_settings LIMIT 1');
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('[TenantSettings] GET public-site:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في قراءة إعدادات الموقع العام.' });
  }
});

/**
 * PUT /api/tenant-settings/public-site
 */
router.put('/public-site', async (req, res) => {
  const {
    site_name, site_tagline,
    privacy_policy, terms_of_service,
    contact_email, contact_phone, address,
    social_links, extra
  } = req.body;

  try {
    const existing = await req.tenantPool.query('SELECT id FROM public_site_settings LIMIT 1');

    if (existing.rows.length > 0) {
      await req.tenantPool.query(
        `UPDATE public_site_settings SET
           site_name        = COALESCE($1, site_name),
           site_tagline     = COALESCE($2, site_tagline),
           privacy_policy   = COALESCE($3, privacy_policy),
           terms_of_service = COALESCE($4, terms_of_service),
           contact_email    = COALESCE($5, contact_email),
           contact_phone    = COALESCE($6, contact_phone),
           address          = COALESCE($7, address),
           social_links     = COALESCE($8, social_links),
           extra            = COALESCE($9, extra),
           updated_at       = CURRENT_TIMESTAMP
         WHERE id = $10`,
        [
          site_name ?? null, site_tagline ?? null,
          privacy_policy ?? null, terms_of_service ?? null,
          contact_email ?? null, contact_phone ?? null, address ?? null,
          social_links != null ? JSON.stringify(social_links) : null,
          extra != null ? JSON.stringify(extra) : null,
          existing.rows[0].id
        ]
      );
    } else {
      await req.tenantPool.query(
        `INSERT INTO public_site_settings
           (site_name, site_tagline, privacy_policy, terms_of_service, contact_email, contact_phone, address, social_links, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          site_name ?? null, site_tagline ?? null,
          privacy_policy ?? null, terms_of_service ?? null,
          contact_email ?? null, contact_phone ?? null, address ?? null,
          social_links != null ? JSON.stringify(social_links) : '{}',
          extra != null ? JSON.stringify(extra) : '{}'
        ]
      );
    }

    return res.json({ success: true, message: 'تم حفظ إعدادات الموقع العام بنجاح.' });
  } catch (err) {
    console.error('[TenantSettings] PUT public-site:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في حفظ إعدادات الموقع العام.' });
  }
});

// ================================================================
// معاملات الدفع الخاصة بالمستأجر
// ================================================================

/**
 * GET /api/tenant-settings/payment-transactions
 * قائمة معاملات الدفع مع تصفية اختيارية.
 */
router.get('/payment-transactions', async (req, res) => {
  const { provider, status, reference_type, page = 1, per_page = 30 } = req.query;
  const limit = Math.min(parseInt(per_page, 10) || 30, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const conditions = [];
  const params = [];

  if (provider) {
    params.push(provider);
    conditions.push(`provider = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (reference_type) {
    params.push(reference_type);
    conditions.push(`reference_type = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    params.push(limit, offset);
    const result = await req.tenantPool.query(
      `SELECT * FROM tenant_payment_transactions
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // عدد إجمالي
    const countParams = params.slice(0, params.length - 2);
    const countResult = await req.tenantPool.query(
      `SELECT COUNT(*) AS total FROM tenant_payment_transactions ${where}`,
      countParams
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total, 10),
        page: parseInt(page, 10),
        per_page: limit
      }
    });
  } catch (err) {
    console.error('[TenantSettings] GET payment-transactions:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في قراءة معاملات الدفع.' });
  }
});

/**
 * POST /api/tenant-settings/payment-transactions
 * تسجيل معاملة دفع جديدة.
 */
router.post('/payment-transactions', async (req, res) => {
  const {
    provider, provider_transaction_id,
    amount, currency,
    status, type,
    reference_type, reference_id,
    metadata
  } = req.body;

  if (!provider || amount == null) {
    return res.status(400).json({ success: false, message: 'provider و amount مطلوبان.' });
  }

  try {
    const result = await req.tenantPool.query(
      `INSERT INTO tenant_payment_transactions
         (provider, provider_transaction_id, amount, currency, status, type, reference_type, reference_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        provider,
        provider_transaction_id ?? null,
        amount,
        currency || 'SAR',
        status || 'pending',
        type || 'purchase',
        reference_type ?? null,
        reference_id ?? null,
        metadata != null ? JSON.stringify(metadata) : '{}'
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'تم تسجيل معاملة الدفع بنجاح.',
      data: { id: result.rows[0].id }
    });
  } catch (err) {
    console.error('[TenantSettings] POST payment-transactions:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في تسجيل معاملة الدفع.' });
  }
});

module.exports = router;
