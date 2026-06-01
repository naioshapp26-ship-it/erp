'use strict';

/**
 * tenant-public-api.js
 * المرحلة 3 — المسارات العامة المدركة للسياق (robots.txt / sitemap.xml / صفحات ثابتة)
 *
 * عند وجود req.tenantPool تُقرأ الإعدادات من قاعدة بيانات المستأجر.
 * عند غيابه تُستخدم إعدادات المنصة المركزية.
 *
 * المسارات:
 *  GET /robots.txt              — ملف robots.txt خاص بالمستأجر أو المنصة
 *  GET /sitemap.xml             — ملف sitemap.xml خاص بالمستأجر أو المنصة
 *  GET /privacy                 — صفحة سياسة الخصوصية (HTML أو JSON)
 *  GET /terms                   — صفحة شروط الاستخدام (HTML أو JSON)
 *  GET /api/tenant-public/branding — إعدادات الواجهة للاستخدام في الواجهة الأمامية
 *  GET /api/tenant-public/seo      — إعدادات SEO للاستخدام في الواجهة الأمامية
 *  GET /api/tenant-public/site     — إعدادات الموقع العام
 */

const express = require('express');
const db = require('./db');

const router = express.Router();

// ================================================================
// مساعدات
// ================================================================

/**
 * قراءة إعداد SEO من قاعدة بيانات المستأجر أو المنصة المركزية.
 */
async function _resolveSeoSettings(tenantPool) {
  if (tenantPool) {
    try {
      const result = await tenantPool.query('SELECT * FROM seo_settings LIMIT 1');
      if (result.rows.length) return result.rows[0];
    } catch {
      // الرجوع للمنصة في حالة الخطأ
    }
  }
  try {
    const result = await db.query('SELECT * FROM platform_seo_settings LIMIT 1');
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * قراءة إعدادات الواجهة من قاعدة بيانات المستأجر أو المنصة المركزية.
 */
async function _resolveBrandingSettings(tenantPool) {
  if (tenantPool) {
    try {
      const result = await tenantPool.query('SELECT * FROM branding_settings LIMIT 1');
      if (result.rows.length) return result.rows[0];
    } catch {
      // الرجوع للمنصة في حالة الخطأ
    }
  }
  try {
    const result = await db.query('SELECT * FROM platform_branding_settings LIMIT 1');
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * قراءة إعدادات الموقع العام من قاعدة بيانات المستأجر.
 */
async function _resolvePublicSiteSettings(tenantPool) {
  if (tenantPool) {
    try {
      const result = await tenantPool.query('SELECT * FROM public_site_settings LIMIT 1');
      if (result.rows.length) return result.rows[0];
    } catch {
      // الرجوع إلى قيمة فارغة
    }
  }
  return null;
}

// ================================================================
// robots.txt
// ================================================================

router.get('/robots.txt', async (req, res) => {
  const seo = await _resolveSeoSettings(req.tenantPool);
  const content = seo?.robots_txt || 'User-agent: *\nDisallow:\n';
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(content);
});

// ================================================================
// sitemap.xml
// ================================================================

router.get('/sitemap.xml', async (req, res) => {
  const seo = await _resolveSeoSettings(req.tenantPool);

  let content = seo?.sitemap_xml;
  if (!content) {
    // توليد sitemap.xml بسيط بالنطاق الحالي
    const host = `${req.protocol}://${req.hostname}`;
    content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${host}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(content);
});

// ================================================================
// صفحة سياسة الخصوصية
// ================================================================

router.get('/privacy', async (req, res) => {
  const site = await _resolvePublicSiteSettings(req.tenantPool);
  const branding = await _resolveBrandingSettings(req.tenantPool);

  const policy = site?.privacy_policy || '<p>سياسة الخصوصية غير متاحة حالياً.</p>';
  const siteName = site?.site_name || req.hostname;
  const primaryColor = _sanitizeCssColor(branding?.primary_color);

  const acceptJson = req.headers.accept?.includes('application/json');
  if (acceptJson) {
    return res.json({ success: true, data: { privacy_policy: policy } });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>سياسة الخصوصية — ${_escapeHtml(siteName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
    h1 { color: ${primaryColor}; }
    a { color: ${primaryColor}; }
  </style>
</head>
<body>
  <h1>سياسة الخصوصية</h1>
  <div>${policy}</div>
  <hr>
  <p><a href="/">العودة للرئيسية</a></p>
</body>
</html>`);
});

// ================================================================
// صفحة شروط الاستخدام
// ================================================================

router.get('/terms', async (req, res) => {
  const site = await _resolvePublicSiteSettings(req.tenantPool);
  const branding = await _resolveBrandingSettings(req.tenantPool);

  const terms = site?.terms_of_service || '<p>شروط الاستخدام غير متاحة حالياً.</p>';
  const siteName = site?.site_name || req.hostname;
  const primaryColor = _sanitizeCssColor(branding?.primary_color);

  const acceptJson = req.headers.accept?.includes('application/json');
  if (acceptJson) {
    return res.json({ success: true, data: { terms_of_service: terms } });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>شروط الاستخدام — ${_escapeHtml(siteName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
    h1 { color: ${primaryColor}; }
    a { color: ${primaryColor}; }
  </style>
</head>
<body>
  <h1>شروط الاستخدام</h1>
  <div>${terms}</div>
  <hr>
  <p><a href="/">العودة للرئيسية</a></p>
</body>
</html>`);
});

// ================================================================
// نقاط نهاية JSON العامة (للاستخدام في الواجهة الأمامية)
// ================================================================

/**
 * GET /api/tenant-public/branding
 * إعدادات الواجهة (متاحة بدون مصادقة للواجهة الأمامية).
 */
router.get('/api/tenant-public/branding', async (req, res) => {
  const data = await _resolveBrandingSettings(req.tenantPool);
  return res.json({ success: true, data });
});

/**
 * GET /api/tenant-public/seo
 * إعدادات SEO (بدون robots_txt و sitemap_xml للأمان).
 */
router.get('/api/tenant-public/seo', async (req, res) => {
  const seo = await _resolveSeoSettings(req.tenantPool);
  if (!seo) return res.json({ success: true, data: null });
  // نُخرج فقط الحقول العامة
  const { robots_txt, sitemap_xml, ...publicSeo } = seo;
  return res.json({ success: true, data: publicSeo });
});

/**
 * GET /api/tenant-public/site
 * إعدادات الموقع العام (بدون كلمات مرور أو بيانات حساسة).
 */
router.get('/api/tenant-public/site', async (req, res) => {
  const data = await _resolvePublicSiteSettings(req.tenantPool);
  return res.json({ success: true, data });
});

// ================================================================
// مساعد داخلي: تهريب HTML
// ================================================================

function _escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * التحقق من صلاحية قيمة اللون CSS ومنع حقن CSS.
 * يقبل فقط: hex (#fff / #ffffff / #ffffffff), rgb(), rgba(), hsl(), hsla(), وأسماء الألوان المعيارية.
 */
function _sanitizeCssColor(color) {
  const safe = String(color || '').trim();
  // hex, rgb, rgba, hsl, hsla, أو اسم لون (حروف فقط، بحد أقصى 30 حرفاً)
  if (/^#[0-9a-fA-F]{3,8}$/.test(safe)) return safe;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$/.test(safe)) return safe;
  if (/^hsla?\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/.test(safe)) return safe;
  if (/^[a-zA-Z]{1,30}$/.test(safe)) return safe;
  return '#2563eb'; // قيمة افتراضية آمنة
}

module.exports = router;
