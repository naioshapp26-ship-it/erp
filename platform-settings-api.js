'use strict';

/**
 * platform-settings-api.js
 * المرحلة 4 — إدارة إعدادات المنصة المركزية (Apex / Control-Plane)
 *
 * تعكس هذه الواجهة البرمجية ما تفعله tenant-settings-api.js
 * لكنها تقرأ وتكتب في جداول المنصة المركزية:
 *   platform_branding_settings
 *   platform_seo_settings
 *   platform_email_settings
 *   platform_payment_settings
 *   platform_settings   (AI وإعدادات عامة)
 *   general_content     (محتوى الموقع العام — صفحة الخصوصية وشروط الاستخدام)
 *
 * جميع المسارات مقيدة بدور super_admin.
 *
 * المسارات:
 *  GET  /api/platform/branding
 *  PUT  /api/platform/branding
 *  GET  /api/platform/seo
 *  PUT  /api/platform/seo
 *  GET  /api/platform/email
 *  PUT  /api/platform/email
 *  GET  /api/platform/payment
 *  PUT  /api/platform/payment/:provider
 *  POST /api/platform/payment/:provider/test
 *  GET  /api/platform/ai
 *  PUT  /api/platform/ai
 *  GET  /api/platform/public-site
 *  PUT  /api/platform/public-site
 */

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { encryptDbUrl, decryptDbUrl } = require('./tenant-connection-manager');

const router = express.Router();

const VALID_PROVIDERS = new Set(['stripe', 'paypal', 'paymob']);

const platformLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(platformLimiter);

// ================================================================
// وسيط التحقق من صلاحية super_admin (نطاق مركزي فقط)
// ================================================================
async function requireSuperAdmin(req, res, next) {
  // مقيد بالنطاق الرئيسي — يُرفض إذا كان الطلب من نطاق فرعي لمستأجر
  if (req.tenant) {
    return res.status(403).json({ success: false, message: 'هذه المسارات مخصصة للنطاق المركزي فقط.' });
  }

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
    const result = await db.query(
      `SELECT u.id, u.role, u.tenant_type
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.session_token = $1 AND us.expires_at > NOW()
         AND COALESCE(u.is_active, true) = true
       LIMIT 1`,
      [token]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'الجلسة منتهية أو غير صالحة.' });
    }
    const user = result.rows[0];
    if (user.role !== 'super_admin' && user.tenant_type !== 'HQ') {
      return res.status(403).json({ success: false, message: 'مقيد بالمشرف الأعلى فقط.' });
    }
    req.platformAdmin = user;
    return next();
  } catch (err) {
    console.error('[PlatformSettings] requireSuperAdmin error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
}

router.use(requireSuperAdmin);

// ================================================================
// مساعدات التشفير للأسرار الحساسة
// ================================================================
function _encrypt(value) {
  if (!value) return null;
  try { return encryptDbUrl(value); } catch { return null; }
}

function _decrypt(value) {
  if (!value) return null;
  try { return decryptDbUrl(value); } catch { return null; }
}

// ================================================================
// GET /api/platform/branding — قراءة إعدادات الواجهة المركزية
// ================================================================
router.get('/branding', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, logo_url, favicon_url, primary_color, secondary_color,
              font_family, custom_css, extra, created_at, updated_at
       FROM platform_branding_settings
       ORDER BY id ASC LIMIT 1`
    );
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('[PlatformSettings] GET branding error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// PUT /api/platform/branding — تحديث إعدادات الواجهة المركزية
// ================================================================
router.put('/branding', async (req, res) => {
  const {
    logo_url, favicon_url, primary_color, secondary_color,
    font_family, custom_css, extra
  } = req.body || {};

  try {
    const existing = await db.query(
      `SELECT id FROM platform_branding_settings ORDER BY id ASC LIMIT 1`
    );

    let row;
    if (existing.rows.length) {
      const updates = [];
      const params = [];

      const addField = (col, val) => {
        if (val !== undefined) { params.push(val); updates.push(`${col} = $${params.length}`); }
      };

      addField('logo_url',        logo_url);
      addField('favicon_url',     favicon_url);
      addField('primary_color',   primary_color);
      addField('secondary_color', secondary_color);
      addField('font_family',     font_family);
      addField('custom_css',      custom_css);
      if (extra !== undefined) {
        params.push(JSON.stringify(extra));
        updates.push(`extra = $${params.length}::jsonb`);
      }

      if (!updates.length) {
        return res.status(400).json({ success: false, message: 'لا توجد حقول للتحديث.' });
      }

      params.push(existing.rows[0].id);
      const r = await db.query(
        `UPDATE platform_branding_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING id, logo_url, favicon_url, primary_color, secondary_color, font_family, custom_css, extra, updated_at`,
        params
      );
      row = r.rows[0];
    } else {
      const r = await db.query(
        `INSERT INTO platform_branding_settings
           (logo_url, favicon_url, primary_color, secondary_color, font_family, custom_css, extra)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, logo_url, favicon_url, primary_color, secondary_color, font_family, custom_css, extra, updated_at`,
        [logo_url || null, favicon_url || null, primary_color || null,
         secondary_color || null, font_family || null, custom_css || null,
         JSON.stringify(extra || {})]
      );
      row = r.rows[0];
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[PlatformSettings] PUT branding error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// GET /api/platform/seo — قراءة إعدادات SEO المركزية
// ================================================================
router.get('/seo', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, meta_title, meta_description, meta_keywords,
              og_title, og_description, og_image_url,
              robots_txt, sitemap_xml, google_analytics_id, extra,
              created_at, updated_at
       FROM platform_seo_settings
       ORDER BY id ASC LIMIT 1`
    );
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('[PlatformSettings] GET seo error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// PUT /api/platform/seo — تحديث إعدادات SEO المركزية
// ================================================================
router.put('/seo', async (req, res) => {
  const {
    meta_title, meta_description, meta_keywords,
    og_title, og_description, og_image_url,
    robots_txt, sitemap_xml, google_analytics_id, extra
  } = req.body || {};

  try {
    const existing = await db.query(
      `SELECT id FROM platform_seo_settings ORDER BY id ASC LIMIT 1`
    );

    let row;
    if (existing.rows.length) {
      const updates = [];
      const params = [];

      const addField = (col, val) => {
        if (val !== undefined) { params.push(val); updates.push(`${col} = $${params.length}`); }
      };

      addField('meta_title',          meta_title);
      addField('meta_description',    meta_description);
      addField('meta_keywords',       meta_keywords);
      addField('og_title',            og_title);
      addField('og_description',      og_description);
      addField('og_image_url',        og_image_url);
      addField('robots_txt',          robots_txt);
      addField('sitemap_xml',         sitemap_xml);
      addField('google_analytics_id', google_analytics_id);
      if (extra !== undefined) {
        params.push(JSON.stringify(extra));
        updates.push(`extra = $${params.length}::jsonb`);
      }

      if (!updates.length) {
        return res.status(400).json({ success: false, message: 'لا توجد حقول للتحديث.' });
      }

      params.push(existing.rows[0].id);
      const r = await db.query(
        `UPDATE platform_seo_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING id, meta_title, meta_description, meta_keywords, og_title, og_description,
                   og_image_url, robots_txt, sitemap_xml, google_analytics_id, extra, updated_at`,
        params
      );
      row = r.rows[0];
    } else {
      const r = await db.query(
        `INSERT INTO platform_seo_settings
           (meta_title, meta_description, meta_keywords,
            og_title, og_description, og_image_url,
            robots_txt, sitemap_xml, google_analytics_id, extra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, meta_title, meta_description, meta_keywords, og_title, og_description,
                   og_image_url, robots_txt, sitemap_xml, google_analytics_id, extra, updated_at`,
        [meta_title || null, meta_description || null, meta_keywords || null,
         og_title || null, og_description || null, og_image_url || null,
         robots_txt || null, sitemap_xml || null, google_analytics_id || null,
         JSON.stringify(extra || {})]
      );
      row = r.rows[0];
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[PlatformSettings] PUT seo error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// GET /api/platform/email — قراءة إعدادات البريد المركزية
// ================================================================
router.get('/email', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, smtp_host, smtp_port, smtp_user, smtp_from, smtp_secure, is_enabled, created_at, updated_at
       FROM platform_email_settings
       ORDER BY id ASC LIMIT 1`
    );
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('[PlatformSettings] GET email error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// PUT /api/platform/email — تحديث إعدادات البريد المركزية
// ================================================================
router.put('/email', async (req, res) => {
  const {
    smtp_host, smtp_port, smtp_user, smtp_password,
    smtp_from, smtp_secure, is_enabled
  } = req.body || {};

  try {
    const existing = await db.query(
      `SELECT id, smtp_password FROM platform_email_settings ORDER BY id ASC LIMIT 1`
    );

    let encryptedPassword = existing.rows[0]?.smtp_password || null;
    if (smtp_password) {
      encryptedPassword = _encrypt(smtp_password);
    }

    let row;
    if (existing.rows.length) {
      const updates = [];
      const params = [];

      const addField = (col, val) => {
        if (val !== undefined) { params.push(val); updates.push(`${col} = $${params.length}`); }
      };

      addField('smtp_host',     smtp_host);
      if (smtp_port !== undefined) { params.push(parseInt(smtp_port, 10) || 587); updates.push(`smtp_port = $${params.length}`); }
      addField('smtp_user',     smtp_user);
      addField('smtp_from',     smtp_from);
      if (smtp_secure !== undefined) { params.push(!!smtp_secure); updates.push(`smtp_secure = $${params.length}`); }
      if (is_enabled !== undefined) { params.push(!!is_enabled); updates.push(`is_enabled = $${params.length}`); }
      if (smtp_password) { params.push(encryptedPassword); updates.push(`smtp_password = $${params.length}`); }

      if (!updates.length) {
        return res.status(400).json({ success: false, message: 'لا توجد حقول للتحديث.' });
      }

      params.push(existing.rows[0].id);
      const r = await db.query(
        `UPDATE platform_email_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING id, smtp_host, smtp_port, smtp_user, smtp_from, smtp_secure, is_enabled, updated_at`,
        params
      );
      row = r.rows[0];
    } else {
      const r = await db.query(
        `INSERT INTO platform_email_settings
           (smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, smtp_secure, is_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, smtp_host, smtp_port, smtp_user, smtp_from, smtp_secure, is_enabled, updated_at`,
        [smtp_host || null, parseInt(smtp_port, 10) || 587, smtp_user || null,
         encryptedPassword, smtp_from || null, !!smtp_secure, !!is_enabled]
      );
      row = r.rows[0];
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[PlatformSettings] PUT email error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// GET /api/platform/payment — قراءة إعدادات الدفع المركزية (بدون أسرار)
// ================================================================
router.get('/payment', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, provider, is_enabled, is_test_mode,
              stripe_public_key,
              paypal_client_id, paypal_webhook_id, paypal_merchant_id,
              paymob_public_key, paymob_integration_ids, paymob_base_url,
              plans_config, trial_days, created_at, updated_at
       FROM platform_payment_settings
       ORDER BY provider`
    );
    return res.json({ success: true, providers: result.rows });
  } catch (err) {
    console.error('[PlatformSettings] GET payment error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// PUT /api/platform/payment/:provider — تحديث إعدادات مزود الدفع المركزي
// ================================================================
router.put('/payment/:provider', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, message: 'مزود الدفع غير صالح.' });
  }

  const body = req.body || {};

  try {
    const existing = await db.query(
      `SELECT * FROM platform_payment_settings WHERE provider = $1 LIMIT 1`,
      [provider]
    );

    const updates = [];
    const params = [];

    const addField = (col, val) => {
      if (val !== undefined) { params.push(val); updates.push(`${col} = $${params.length}`); }
    };
    const addEncrypted = (col, val) => {
      if (val) { params.push(_encrypt(val)); updates.push(`${col} = $${params.length}`); }
    };

    if (body.is_enabled !== undefined) { params.push(!!body.is_enabled); updates.push(`is_enabled = $${params.length}`); }
    if (body.is_test_mode !== undefined) { params.push(!!body.is_test_mode); updates.push(`is_test_mode = $${params.length}`); }

    if (provider === 'stripe') {
      addField('stripe_public_key', body.stripe_public_key);
      addEncrypted('stripe_secret_key', body.stripe_secret_key);
      addEncrypted('stripe_webhook_secret', body.stripe_webhook_secret);
    } else if (provider === 'paypal') {
      addField('paypal_client_id', body.paypal_client_id);
      addEncrypted('paypal_client_secret', body.paypal_client_secret);
      addField('paypal_webhook_id', body.paypal_webhook_id);
      addField('paypal_merchant_id', body.paypal_merchant_id);
    } else if (provider === 'paymob') {
      addField('paymob_public_key', body.paymob_public_key);
      addEncrypted('paymob_secret_key', body.paymob_secret_key);
      addEncrypted('paymob_hmac_secret', body.paymob_hmac_secret);
      if (body.paymob_integration_ids !== undefined) {
        params.push(JSON.stringify(body.paymob_integration_ids));
        updates.push(`paymob_integration_ids = $${params.length}::jsonb`);
      }
      addField('paymob_base_url', body.paymob_base_url);
    }

    if (body.plans_config !== undefined) {
      params.push(JSON.stringify(body.plans_config));
      updates.push(`plans_config = $${params.length}::jsonb`);
    }
    if (body.trial_days !== undefined) {
      params.push(parseInt(body.trial_days, 10) || 0);
      updates.push(`trial_days = $${params.length}`);
    }

    let row;
    if (existing.rows.length) {
      if (!updates.length) {
        return res.status(400).json({ success: false, message: 'لا توجد حقول للتحديث.' });
      }
      params.push(existing.rows[0].id);
      const r = await db.query(
        `UPDATE platform_payment_settings
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING id, provider, is_enabled, is_test_mode, stripe_public_key,
                   paypal_client_id, paypal_webhook_id, paypal_merchant_id,
                   paymob_public_key, paymob_integration_ids, paymob_base_url,
                   plans_config, trial_days, updated_at`,
        params
      );
      row = r.rows[0];
    } else {
      const r = await db.query(
        `INSERT INTO platform_payment_settings (provider, is_enabled, is_test_mode)
         VALUES ($1, false, true)
         RETURNING id, provider, is_enabled, is_test_mode, stripe_public_key,
                   paypal_client_id, paypal_webhook_id, paypal_merchant_id,
                   paymob_public_key, paymob_integration_ids, paymob_base_url,
                   plans_config, trial_days, updated_at`,
        [provider]
      );
      row = r.rows[0];
      if (updates.length) {
        // إعادة المحاولة بعد الإنشاء
        const r2 = await db.query(
          `UPDATE platform_payment_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
           WHERE id = $${params.length + 1}
           RETURNING id, provider, is_enabled, is_test_mode, stripe_public_key,
                     paypal_client_id, paypal_webhook_id, paypal_merchant_id,
                     paymob_public_key, paymob_integration_ids, paymob_base_url,
                     plans_config, trial_days, updated_at`,
          [...params, row.id]
        );
        row = r2.rows[0];
      }
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[PlatformSettings] PUT payment error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// POST /api/platform/payment/:provider/test — اختبار الاتصال بمزود الدفع
// ================================================================
router.post('/payment/:provider/test', async (req, res) => {
  const { provider } = req.params;
  if (!VALID_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, message: 'مزود الدفع غير صالح.' });
  }

  try {
    const result = await db.query(
      `SELECT * FROM platform_payment_settings WHERE provider = $1 LIMIT 1`,
      [provider]
    );
    if (!result.rows.length || !result.rows[0].is_enabled) {
      return res.status(400).json({ success: false, message: 'المزود غير مُفعَّل أو غير مُعَدَّ.' });
    }
    const cfg = result.rows[0];

    if (provider === 'stripe') {
      const secretKey = _decrypt(cfg.stripe_secret_key);
      if (!secretKey) return res.status(400).json({ success: false, message: 'المفتاح السري مفقود.' });
      const https = require('https');
      const ok = await new Promise(resolve => {
        const r = https.get('https://api.stripe.com/v1/account', {
          headers: { Authorization: `Bearer ${secretKey}` }
        }, resp => resolve(resp.statusCode === 200));
        r.on('error', () => resolve(false));
        r.setTimeout(5000, () => { r.destroy(); resolve(false); });
      });
      return res.json({ success: ok, message: ok ? 'Stripe متصل.' : 'فشل الاتصال بـ Stripe.' });
    }

    if (provider === 'paypal') {
      const clientId     = cfg.paypal_client_id;
      const clientSecret = _decrypt(cfg.paypal_client_secret);
      if (!clientId || !clientSecret) {
        return res.status(400).json({ success: false, message: 'بيانات PayPal ناقصة.' });
      }
      const baseUrl = cfg.is_test_mode ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';
      const https = require('https');
      const ok = await new Promise(resolve => {
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const body = 'grant_type=client_credentials';
        const opts = {
          hostname: baseUrl, path: '/v1/oauth2/token', method: 'POST',
          headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }
        };
        const req2 = https.request(opts, resp => {
          resp.resume();
          resolve(resp.statusCode === 200);
        });
        req2.on('error', () => resolve(false));
        req2.setTimeout(5000, () => { req2.destroy(); resolve(false); });
        req2.write(body);
        req2.end();
      });
      return res.json({ success: ok, message: ok ? 'PayPal متصل.' : 'فشل الاتصال بـ PayPal.' });
    }

    if (provider === 'paymob') {
      const secretKey = _decrypt(cfg.paymob_secret_key);
      if (!secretKey) return res.status(400).json({ success: false, message: 'المفتاح السري مفقود.' });
      const baseUrl = cfg.paymob_base_url || 'https://accept.paymob.com';
      try {
        const url = new URL('/api/auth/tokens', baseUrl);
        const https = require('https');
        const http  = require('http');
        const lib = url.protocol === 'https:' ? https : http;
        const body = JSON.stringify({ api_key: secretKey });
        const ok = await new Promise(resolve => {
          const opts = {
            hostname: url.hostname, path: url.pathname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
          };
          const req2 = lib.request(opts, resp => { resp.resume(); resolve(resp.statusCode === 201); });
          req2.on('error', () => resolve(false));
          req2.setTimeout(5000, () => { req2.destroy(); resolve(false); });
          req2.write(body);
          req2.end();
        });
        return res.json({ success: ok, message: ok ? 'Paymob متصل.' : 'فشل الاتصال بـ Paymob.' });
      } catch {
        return res.json({ success: false, message: 'رابط Paymob غير صالح.' });
      }
    }
  } catch (err) {
    console.error('[PlatformSettings] payment test error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// GET /api/platform/ai — قراءة إعدادات الذكاء الاصطناعي المركزية
// ================================================================
router.get('/ai', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT value_json FROM platform_settings WHERE key = 'ai_settings' LIMIT 1`
    );
    return res.json({ success: true, data: result.rows[0]?.value_json || {} });
  } catch (err) {
    console.error('[PlatformSettings] GET ai error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// PUT /api/platform/ai — تحديث إعدادات الذكاء الاصطناعي المركزية
// ================================================================
router.put('/ai', async (req, res) => {
  const { provider, api_key, model, temperature, max_tokens, extra } = req.body || {};

  const aiSettings = {};
  if (provider     !== undefined) aiSettings.provider     = provider;
  if (model        !== undefined) aiSettings.model        = model;
  if (temperature  !== undefined) aiSettings.temperature  = parseFloat(temperature) || 0.7;
  if (max_tokens   !== undefined) aiSettings.max_tokens   = parseInt(max_tokens, 10) || 2048;
  if (extra        !== undefined) aiSettings.extra        = extra;
  // تشفير مفتاح API إذا أُرسل
  if (api_key) aiSettings.api_key_encrypted = _encrypt(api_key);

  try {
    await db.query(
      `INSERT INTO platform_settings (key, value_json, description)
       VALUES ('ai_settings', $1::jsonb, 'إعدادات الذكاء الاصطناعي للمنصة')
       ON CONFLICT (key) DO UPDATE
         SET value_json = platform_settings.value_json || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(aiSettings)]
    );
    const result = await db.query(
      `SELECT value_json FROM platform_settings WHERE key = 'ai_settings' LIMIT 1`
    );
    return res.json({ success: true, data: result.rows[0]?.value_json || {} });
  } catch (err) {
    console.error('[PlatformSettings] PUT ai error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// GET /api/platform/public-site — قراءة محتوى الموقع العام المركزي
// ================================================================
router.get('/public-site', async (req, res) => {
  try {
    const [privacyRes, termsRes] = await Promise.all([
      db.query(`SELECT body, meta FROM general_content WHERE slug = 'privacy' LIMIT 1`),
      db.query(`SELECT body, meta FROM general_content WHERE slug = 'terms' LIMIT 1`)
    ]);
    return res.json({
      success: true,
      data: {
        privacy_policy: privacyRes.rows[0]?.body || '',
        terms_of_service: termsRes.rows[0]?.body || '',
        privacy_meta: privacyRes.rows[0]?.meta || {},
        terms_meta: termsRes.rows[0]?.meta || {}
      }
    });
  } catch (err) {
    console.error('[PlatformSettings] GET public-site error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// PUT /api/platform/public-site — تحديث محتوى الموقع العام المركزي
// ================================================================
router.put('/public-site', async (req, res) => {
  const { privacy_policy, terms_of_service } = req.body || {};

  try {
    if (privacy_policy !== undefined) {
      await db.query(
        `INSERT INTO general_content (slug, title, body, is_published)
         VALUES ('privacy', 'سياسة الخصوصية', $1, true)
         ON CONFLICT (slug) DO UPDATE
           SET body = EXCLUDED.body, is_published = true, updated_at = CURRENT_TIMESTAMP`,
        [privacy_policy]
      );
    }
    if (terms_of_service !== undefined) {
      await db.query(
        `INSERT INTO general_content (slug, title, body, is_published)
         VALUES ('terms', 'شروط الاستخدام', $1, true)
         ON CONFLICT (slug) DO UPDATE
           SET body = EXCLUDED.body, is_published = true, updated_at = CURRENT_TIMESTAMP`,
        [terms_of_service]
      );
    }
    return res.json({ success: true, message: 'تم الحفظ بنجاح.' });
  } catch (err) {
    console.error('[PlatformSettings] PUT public-site error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

module.exports = router;
