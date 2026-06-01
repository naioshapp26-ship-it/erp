'use strict';

/**
 * tenant-resolver.js
 * المرحلة 0 — وسيط تحديد هوية المستأجر (Tenant Resolution Middleware)
 *
 * يستنتج سياق المستأجر من النطاق الفرعي في كل طلب، ويُضيف إلى req:
 *   req.tenant      — صف المستأجر من الجدول المركزي (أو null للنطاق الرئيسي)
 *   req.tenantPool  — حمام اتصال قاعدة بيانات المستأجر (أو null للنطاق الرئيسي)
 *
 * السلوك:
 *   - apex (example.com) أو www.example.com → تطبيق مركزي، req.tenant = null
 *   - نطاق فرعي محجوز (app, api, admin, saas) → 400
 *   - نطاق فرعي صالح + مستأجر نشط → req.tenant + req.tenantPool
 *   - مستأجر موقوف (suspended) → صفحة HTML للمتصفح، 403 JSON لـ API
 *   - دفع معلق (pending_payment) → 402 JSON
 *   - محذوف أو غير موجود → 404
 *
 * متطلبات بيئة التشغيل:
 *   BASE_DOMAIN  — النطاق الرئيسي مثل "example.com"
 */

const db = require('./db');
const { getTenantPool } = require('./tenant-connection-manager');

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'saas']);

/**
 * استخراج النطاق الفرعي من hostname.
 * مثال: "acme.example.com" مع BASE_DOMAIN="example.com" → "acme"
 * @param {string} hostname
 * @param {string} baseDomain
 * @returns {string|null}  النطاق الفرعي، أو null إذا كان النطاق هو apex أو www
 */
function extractSubdomain(hostname, baseDomain) {
  // أزل المنفذ إن وُجد
  const host = hostname.split(':')[0].toLowerCase();
  const base = baseDomain.toLowerCase();

  if (host === base || host === `www.${base}`) return null;
  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, host.length - base.length - 1);
    // نطاق فرعي من مستوى واحد فقط
    if (!sub.includes('.')) return sub;
  }
  return null;
}

/**
 * صفحة HTML للمستأجر الموقوف.
 */
function suspendedHtmlPage(companyName) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>الحساب موقوف</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #f5f5f5; }
    .card { background: #fff; padding: 2rem 3rem; border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,.1); text-align: center; max-width: 480px; }
    h1 { color: #c0392b; }
    p { color: #555; line-height: 1.6; }
    a { color: #2980b9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚠️ الحساب موقوف</h1>
    <p>عذراً، تم تعليق حساب <strong>${companyName || 'هذه الشركة'}</strong> مؤقتاً.</p>
    <p>للاستفسار والدعم، يرجى <a href="mailto:support@${process.env.BASE_DOMAIN || 'example.com'}">التواصل معنا</a>.</p>
  </div>
</body>
</html>`;
}

/**
 * وسيط Express الرئيسي لتحديد هوية المستأجر.
 */
async function tenantResolver(req, res, next) {
  const baseDomain = process.env.BASE_DOMAIN || '';

  // إذا لم يُضبط BASE_DOMAIN، تجاوز التحقق (بيئة تطوير محلية)
  if (!baseDomain) {
    req.tenant = null;
    req.tenantPool = null;
    return next();
  }

  const subdomain = extractSubdomain(req.hostname, baseDomain);

  // apex أو www → نطاق مركزي
  if (subdomain === null) {
    req.tenant = null;
    req.tenantPool = null;
    return next();
  }

  // نطاق فرعي محجوز
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return res.status(400).json({ error: 'النطاق الفرعي محجوز ولا يمكن استخدامه.' });
  }

  // تحميل المستأجر من الجدول المركزي
  let tenant;
  try {
    const result = await db.query(
      'SELECT * FROM tenants WHERE subdomain = $1 LIMIT 1',
      [subdomain]
    );
    tenant = result.rows[0] || null;
  } catch (err) {
    console.error('[tenantResolver] خطأ في الاستعلام عن المستأجر:', err.message);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم.' });
  }

  if (!tenant) {
    return res.status(404).json({ error: 'المستأجر غير موجود.' });
  }

  // معالجة حالات المستأجر
  switch (tenant.status) {
    case 'active':
      break;

    case 'suspended': {
      const isApiRequest =
        req.path.startsWith('/api/') ||
        req.xhr ||
        (req.headers.accept || '').includes('application/json') ||
        (req.headers['content-type'] || '').includes('application/json');
      if (isApiRequest) {
        return res.status(403).json({ error: 'الحساب موقوف.', status: 'suspended' });
      }
      return res
        .status(403)
        .set('Content-Type', 'text/html; charset=utf-8')
        .send(suspendedHtmlPage(tenant.company_name));
    }

    case 'pending_payment':
      return res.status(402).json({ error: 'الدفع مطلوب لتفعيل الحساب.', status: 'pending_payment' });

    case 'deleted':
    default:
      return res.status(404).json({ error: 'المستأجر غير موجود.' });
  }

  // ربط حمام الاتصال بالطلب
  try {
    req.tenant = tenant;
    req.tenantPool = getTenantPool(tenant.subdomain, tenant.encrypted_db_url);
    return next();
  } catch (err) {
    console.error('[tenantResolver] خطأ في إنشاء حمام اتصال المستأجر:', err.message);
    return res.status(500).json({ error: 'تعذّر الاتصال بقاعدة بيانات المستأجر.' });
  }
}

module.exports = { tenantResolver, extractSubdomain, RESERVED_SUBDOMAINS };
