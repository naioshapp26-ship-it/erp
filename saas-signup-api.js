'use strict';

/**
 * saas-signup-api.js
 * المرحلة 1 — واجهة برمجية للانضمام الذاتي عبر SaaS
 *
 * المسارات:
 *  POST /api/saas/validate-subdomain         — التحقق من توفر النطاق الفرعي
 *  POST /api/saas/signup/start               — الخطوة 1: حفظ بيانات التسجيل مؤقتاً
 *  POST /api/saas/payment/create-session     — الخطوة 2: إنشاء جلسة دفع
 *  POST /api/saas/payment/webhook/stripe     — Webhook: Stripe
 *  POST /api/saas/payment/webhook/paypal     — Webhook: PayPal
 *  POST /api/saas/payment/webhook/paymob     — Webhook: Paymob
 *  POST /api/saas/payment/verify             — التحقق اليدوي من الدفع وبدء التجهيز
 *  GET  /api/saas/signup/status/:token       — الخطوة 4: حالة التسجيل وعنوان الدخول
 *
 * ملاحظات:
 *  - الدفع يجري دائماً على النطاق المركزي/المنصة.
 *  - بيانات التسجيل المعلقة تُخزَّن في خريطة في الذاكرة (TTL ~1 ساعة).
 *  - بعد نجاح الدفع يتم التحقق منه مع مزود الخدمة قبل تجهيز المستأجر.
 */

const express = require('express');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { provisionTenant } = require('./tenant-provisioner');

const router = express.Router();

// ---- ثوابت ----
const PENDING_TTL_MS = 60 * 60 * 1000; // ساعة واحدة
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'saas']);
const VALID_PLANS = new Set(['basic', 'pro', 'enterprise']);

// ---- تخزين التسجيلات المعلقة في الذاكرة ----
// { token: { data, expiresAt } }
const _pendingRegistrations = new Map();

// تنظيف دوري للتسجيلات المنتهية الصلاحية
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of _pendingRegistrations.entries()) {
    if (entry.expiresAt <= now) _pendingRegistrations.delete(token);
  }
}, 10 * 60 * 1000).unref();

// ---- Rate Limiters ----
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تم تجاوز عدد المحاولات المسموح بها. يرجى المحاولة لاحقاً.' }
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

// ---- مساعدات التحقق ----
function _isValidSubdomain(sub) {
  return typeof sub === 'string' &&
    /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(sub) &&
    !RESERVED_SUBDOMAINS.has(sub);
}

function _isValidEmail(email) {
  if (!email || email.length > 254) return false;
  const parts = String(email).split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  return domain.split('.').length >= 2;
}

async function _isSubdomainAvailable(subdomain) {
  const res = await db.query(
    `SELECT 1 FROM tenants WHERE subdomain = $1 AND status != 'deleted' LIMIT 1`,
    [subdomain]
  );
  return res.rows.length === 0;
}

// ---- إعدادات الدفع المركزية ----
async function _getPaymentSettings(provider) {
  const res = await db.query(
    `SELECT * FROM platform_payment_settings WHERE provider = $1 AND is_enabled = true LIMIT 1`,
    [provider]
  );
  return res.rows[0] || null;
}

async function _getPlanPricing(provider, plan) {
  const fallback = {
    amount: plan === 'basic' ? 0 : null,
    currency: 'USD',
    trialDays: 0,
    settings: null
  };

  const settings = await _getPaymentSettings(provider).catch(() => null);
  if (!settings) return fallback;

  let plansConfig = {};
  try {
    plansConfig = typeof settings.plans_config === 'string'
      ? JSON.parse(settings.plans_config)
      : (settings.plans_config || {});
  } catch (_) {
    plansConfig = {};
  }

  const planDetails = plansConfig[plan] || {};
  return {
    amount: typeof planDetails.amount === 'number' ? planDetails.amount : fallback.amount,
    currency: planDetails.currency || 'USD',
    trialDays: settings.trial_days || 0,
    settings
  };
}

async function _getProvisioningStepsByTenantId(tenantId) {
  if (!tenantId) return [];

  const res = await db.query(
    `SELECT step, status, message, details, created_at
     FROM provisioning_logs
     WHERE tenant_id = $1
     ORDER BY id ASC`,
    [tenantId]
  ).catch(() => ({ rows: [] }));

  return res.rows;
}

// ================================================================
// POST /api/saas/validate-subdomain
// ================================================================
router.post('/validate-subdomain', signupLimiter, async (req, res) => {
  const { subdomain } = req.body || {};
  if (!subdomain) {
    return res.status(400).json({ success: false, message: 'النطاق الفرعي مطلوب.' });
  }
  const normalized = String(subdomain).toLowerCase().trim();
  if (!_isValidSubdomain(normalized)) {
    return res.status(400).json({
      success: false,
      message: 'النطاق الفرعي غير صالح. يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط.'
    });
  }
  try {
    const available = await _isSubdomainAvailable(normalized);
    if (!available) {
      return res.status(409).json({ success: false, message: 'النطاق الفرعي مستخدم بالفعل.' });
    }
    return res.json({ success: true, available: true, subdomain: normalized });
  } catch (err) {
    console.error('[SaaS] validate-subdomain error:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }
});

// ================================================================
// POST /api/saas/signup/start   — الخطوة 1
// ================================================================
router.post('/signup/start', signupLimiter, async (req, res) => {
  const {
    subdomain, companyName, adminName, adminEmail,
    adminPhone, adminPassword, plan = 'basic'
  } = req.body || {};

  // تحقق من الحقول المطلوبة
  if (!subdomain || !companyName || !adminName || !adminPassword) {
    return res.status(400).json({
      success: false,
      message: 'الحقول المطلوبة: subdomain, companyName, adminName, adminPassword'
    });
  }
  if (!adminEmail && !adminPhone) {
    return res.status(400).json({
      success: false,
      message: 'يجب توفير البريد الإلكتروني أو رقم الجوال.'
    });
  }
  if (adminEmail && !_isValidEmail(adminEmail)) {
    return res.status(400).json({ success: false, message: 'البريد الإلكتروني غير صالح.' });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
  }

  const normalizedSubdomain = String(subdomain).toLowerCase().trim();
  if (!_isValidSubdomain(normalizedSubdomain)) {
    return res.status(400).json({ success: false, message: 'النطاق الفرعي غير صالح.' });
  }
  if (!VALID_PLANS.has(plan)) {
    return res.status(400).json({ success: false, message: 'خطة الاشتراك غير صالحة.' });
  }

  try {
    const available = await _isSubdomainAvailable(normalizedSubdomain);
    if (!available) {
      return res.status(409).json({ success: false, message: 'النطاق الفرعي مستخدم بالفعل.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'خطأ داخلي.' });
  }

  // حفظ البيانات مؤقتاً في الذاكرة
  const token = crypto.randomBytes(32).toString('hex');
  _pendingRegistrations.set(token, {
    data: { subdomain: normalizedSubdomain, companyName, adminName, adminEmail, adminPhone, adminPassword, plan },
    expiresAt: Date.now() + PENDING_TTL_MS
  });

  return res.status(201).json({
    success: true,
    token,
    message: 'تم حفظ بيانات التسجيل. انتقل لإتمام الدفع.',
    nextStep: '/api/saas/payment/create-session'
  });
});

// ================================================================
// POST /api/saas/payment/create-session   — الخطوة 2
// ================================================================
router.post('/payment/create-session', signupLimiter, async (req, res) => {
  const { token, provider = 'stripe' } = req.body || {};

  const pending = _pendingRegistrations.get(token);
  if (!pending || pending.expiresAt <= Date.now()) {
    return res.status(400).json({ success: false, message: 'رمز التسجيل غير صالح أو منتهي الصلاحية.' });
  }

  const { plan } = pending.data;
  const pricing = await _getPlanPricing(provider, plan);

  if ((pricing.amount || 0) <= 0) {
    const result = await _handlePostPaymentProvisioning(
      token,
      provider,
      `free-${provider}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
      pricing
    );

    return res.json({
      success: true,
      provider,
      plan,
      amount: 0,
      currency: pricing.currency,
      trialDays: pricing.trialDays,
      skipPayment: true,
      alreadyVerified: true,
      tenantId: result.tenantId,
      loginUrl: result.loginUrl,
      registrationToken: token,
      verifyEndpoint: '/api/saas/payment/verify',
      message: 'الخطة المجانية لا تتطلب دفعاً. سيبدأ تجهيز المستأجر مباشرة.'
    });
  }

  if (!pricing.settings) {
    return res.status(422).json({
      success: false,
      message: `مزود الدفع "${provider}" غير مفعَّل. يرجى التواصل مع الدعم.`
    });
  }

  // الاستجابة تحتوي على بيانات تكفي الواجهة الأمامية لإنشاء جلسة الدفع
  // التكامل الفعلي مع Stripe/PayPal/Paymob SDK يُضاف لاحقاً حسب الإعدادات
  return res.json({
    success: true,
    provider,
    plan,
    amount: pricing.amount,
    currency: pricing.currency,
    trialDays: pricing.trialDays,
    registrationToken: token,
    message: `أكمل الدفع باستخدام ${provider} ثم أرسل طلب التحقق.`,
    webhookEndpoint: `/api/saas/payment/webhook/${provider}`,
    verifyEndpoint: '/api/saas/payment/verify'
  });
});

// ================================================================
// POST /api/saas/payment/webhook/stripe
// ================================================================
router.post('/payment/webhook/stripe', webhookLimiter, express.raw({ type: 'application/json' }), async (req, res) => {
  // التحقق من توقيع Stripe Webhook
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature header');

  let event;
  try {
    const settings = await _getPaymentSettings('stripe');
    if (!settings || !settings.stripe_webhook_secret) {
      return res.status(422).send('Stripe not configured');
    }
    // فك تشفير stripe_webhook_secret إذا كان مشفراً
    // (يُفترض أن يُضاف فك التشفير عبر tenant-connection-manager عند الحاجة)
    const webhookSecret = settings.stripe_webhook_secret;

    // التحقق من التوقيع يدوياً (بدون stripe SDK مُثبَّت)
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');

    // تحليل آمن لرأس stripe-signature
    const sigParts = String(sig).split(',');
    const tPart = sigParts.find(p => p.trim().startsWith('t='));
    const v1Part = sigParts.find(p => p.trim().startsWith('v1='));
    if (!tPart || !v1Part) {
      return res.status(400).send('Invalid signature format');
    }
    const timestamp = tPart.trim().split('=')[1];
    const receivedSig = v1Part.trim().slice(3); // strip "v1="

    // التحقق من حداثة الطلب (مضاد لإعادة التشغيل Replay Attack) — نافذة 5 دقائق
    const tsSeconds = parseInt(timestamp, 10);
    if (!tsSeconds || Math.abs(Date.now() / 1000 - tsSeconds) > 300) {
      return res.status(400).send('Webhook timestamp too old or invalid');
    }

    const payload = `${timestamp}.${rawBody.toString()}`;
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // timingSafeEqual requires equal-length buffers
    if (receivedSig.length !== expectedSig.length) {
      return res.status(400).send('Invalid signature');
    }
    try {
      if (!crypto.timingSafeEqual(
        Buffer.from(receivedSig, 'hex'),
        Buffer.from(expectedSig, 'hex')
      )) {
        return res.status(400).send('Invalid signature');
      }
    } catch (_) {
      return res.status(400).send('Invalid signature');
    }

    event = JSON.parse(rawBody.toString());
  } catch (err) {
    console.error('[SaaS Stripe Webhook] error:', err.message);
    return res.status(400).send('Webhook error');
  }

  // معالجة حدث نجاح الدفع
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const metadata = event.data?.object?.metadata || {};
    const registrationToken = metadata.registration_token;
    if (registrationToken) {
      _handlePostPaymentProvisioning(registrationToken, 'stripe', event.data?.object?.id).catch(
        err => console.error('[SaaS] Provisioning after Stripe webhook failed:', err.message)
      );
    }
  }

  return res.status(200).json({ received: true });
});

// ================================================================
// POST /api/saas/payment/webhook/paypal
// ================================================================
router.post('/payment/webhook/paypal', webhookLimiter, async (req, res) => {
  const event = req.body || {};

  // التحقق الأساسي من نوع الحدث
  if (
    event.event_type === 'PAYMENT.CAPTURE.COMPLETED' ||
    event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED'
  ) {
    const registrationToken = event.resource?.custom_id;
    if (registrationToken) {
      _handlePostPaymentProvisioning(registrationToken, 'paypal', event.id).catch(
        err => console.error('[SaaS] Provisioning after PayPal webhook failed:', err.message)
      );
    }
  }

  return res.status(200).json({ received: true });
});

// ================================================================
// POST /api/saas/payment/webhook/paymob
// ================================================================
router.post('/payment/webhook/paymob', webhookLimiter, async (req, res) => {
  const payload = req.body || {};

  // التحقق من HMAC
  try {
    const settings = await _getPaymentSettings('paymob');
    if (settings && settings.paymob_hmac_secret) {
      const hmacSecret = settings.paymob_hmac_secret;
      const receivedHmac = payload.hmac;
      if (receivedHmac) {
        // بناء سلسلة التحقق من Paymob (حسب وثائقهم)
        const obj = payload.obj || {};
        const keys = [
          'amount_cents', 'created_at', 'currency', 'error_occured',
          'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
          'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
          'is_voided', 'order.id', 'owner', 'pending',
          'source_data.pan', 'source_data.sub_type', 'source_data.type',
          'success'
        ];
        const concatenated = keys
          .map(k => {
            const parts = k.split('.');
            return parts.reduce((o, p) => (o && o[p] !== undefined ? o[p] : ''), parts[0] === 'order' ? { id: obj.order?.id } : obj);
          })
          .join('');
        const expected = crypto.createHmac('sha512', hmacSecret).update(concatenated).digest('hex');
        // مقارنة hex strings مباشرةً بعد تحويلها لأحرف صغيرة
        const receivedNormalized = String(receivedHmac).toLowerCase();
        const expectedNormalized = expected.toLowerCase();
        if (receivedNormalized.length !== expectedNormalized.length) {
          return res.status(400).json({ error: 'Invalid HMAC' });
        }
        if (!crypto.timingSafeEqual(
          Buffer.from(receivedNormalized, 'hex'),
          Buffer.from(expectedNormalized, 'hex')
        )) {
          return res.status(400).json({ error: 'Invalid HMAC' });
        }
      }
    }
  } catch (err) {
    console.error('[SaaS Paymob Webhook] HMAC check error:', err.message);
  }

  if (payload.type === 'TRANSACTION' && payload.obj?.success === true) {
    const registrationToken = payload.obj?.order?.merchant_order_id;
    if (registrationToken) {
      _handlePostPaymentProvisioning(registrationToken, 'paymob', String(payload.obj?.id)).catch(
        err => console.error('[SaaS] Provisioning after Paymob webhook failed:', err.message)
      );
    }
  }

  return res.status(200).json({ received: true });
});

// ================================================================
// POST /api/saas/payment/verify   — تحقق يدوي + بدء التجهيز
// ================================================================
router.post('/payment/verify', signupLimiter, async (req, res) => {
  const { token, transactionId, provider = 'stripe' } = req.body || {};

  if (!token) {
    return res.status(400).json({ success: false, message: 'token مطلوب.' });
  }

  const pending = _pendingRegistrations.get(token);
  if (!pending || pending.expiresAt <= Date.now()) {
    return res.status(400).json({ success: false, message: 'رمز التسجيل غير صالح أو منتهي الصلاحية.' });
  }

  const pricing = await _getPlanPricing(provider, pending.data.plan);
  const requiresPaidTransaction = (pricing.amount || 0) > 0;
  const effectiveTransactionId = transactionId || (
    requiresPaidTransaction
      ? null
      : `free-${provider}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
  );

  if (!effectiveTransactionId) {
    return res.status(400).json({
      success: false,
      message: 'transactionId مطلوب لإتمام التحقق من الدفع لهذه الخطة.'
    });
  }

  // التحقق من أن المعاملة لم تُعالَج من قبل
  const existing = await db.query(
    `SELECT 1 FROM platform_payment_transactions WHERE provider_transaction_id = $1 LIMIT 1`,
    [effectiveTransactionId]
  ).catch(() => ({ rows: [] }));
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, message: 'هذه المعاملة مُعالَجة بالفعل.' });
  }

  try {
    const result = await _handlePostPaymentProvisioning(token, provider, effectiveTransactionId, pricing);
    return res.json({
      success: true,
      tenantId: result.tenantId,
      loginUrl: result.loginUrl,
      message: 'تم تجهيز حسابك بنجاح! يمكنك الدخول الآن.'
    });
  } catch (err) {
    console.error('[SaaS] payment/verify provisioning error:', err.message);
    return res.status(500).json({ success: false, message: `فشل التجهيز: ${err.message}` });
  }
});

// ================================================================
// GET /api/saas/signup/status/:token   — الخطوة 4
// ================================================================
router.get('/signup/status/:token', async (req, res) => {
  const { token } = req.params;

  // البحث عن المستأجر المرتبط بهذا الرمز في قاعدة البيانات
  const txnRes = await db.query(
    `SELECT ppt.tenant_id, t.status, t.subdomain, t.company_name
     FROM platform_payment_transactions ppt
     JOIN tenants t ON t.id = ppt.tenant_id
     WHERE ppt.metadata->>'registration_token' = $1
     ORDER BY ppt.created_at DESC LIMIT 1`,
    [token]
  ).catch(() => ({ rows: [] }));

  if (!txnRes.rows.length) {
    // ربما لا يزال معلقاً في الذاكرة
    const pending = _pendingRegistrations.get(token);
    if (pending && pending.expiresAt > Date.now()) {
      return res.json({ success: true, status: 'pending_payment', steps: [], message: 'في انتظار الدفع.' });
    }
    return res.status(404).json({ success: false, message: 'لم يُعثر على تسجيل بهذا الرمز.' });
  }

  const row = txnRes.rows[0];
  const baseDomain = process.env.BASE_DOMAIN || 'localhost';
  const loginUrl = `https://${row.subdomain}.${baseDomain}`;
  const steps = await _getProvisioningStepsByTenantId(row.tenant_id);
  const hasFailure = steps.some(step => step.status === 'failed');

  let status = 'provisioning';
  if (hasFailure) {
    status = 'failed';
  } else if (row.status === 'active') {
    status = 'ready';
  } else if (row.status === 'pending_payment') {
    status = 'pending_payment';
  }

  return res.json({
    success: true,
    status,
    subdomain: row.subdomain,
    companyName: row.company_name,
    loginUrl: status === 'ready' ? loginUrl : null,
    steps,
    message: status === 'ready'
      ? 'الحساب جاهز!'
      : (status === 'failed' ? 'فشل التجهيز.' : 'جارٍ التجهيز…')
  });
});

// ================================================================
// دالة مشتركة: معالجة ما بعد الدفع + تجهيز المستأجر
// ================================================================
async function _handlePostPaymentProvisioning(registrationToken, provider, transactionId, pricing = null) {
  const pending = _pendingRegistrations.get(registrationToken);
  if (!pending || pending.expiresAt <= Date.now()) {
    throw new Error('رمز التسجيل غير صالح أو منتهي الصلاحية.');
  }

  const {
    subdomain, companyName, adminName, adminEmail,
    adminPhone, adminPassword, plan
  } = pending.data;

  // تسجيل معاملة الدفع في الجدول المركزي (بدون tenant_id بعد)
  const txnRes = await db.query(
    `INSERT INTO platform_payment_transactions
       (provider, provider_transaction_id, status, type, metadata)
     VALUES ($1, $2, 'succeeded', 'signup', $3)
     RETURNING id`,
    [
      provider,
      transactionId,
      JSON.stringify({
        registration_token: registrationToken,
        subdomain,
        plan,
        amount: pricing?.amount ?? null,
        currency: pricing?.currency || 'USD'
      })
    ]
  );
  const txnId = txnRes.rows[0].id;

  // تجهيز المستأجر
  const result = await provisionTenant({
    subdomain, companyName, plan,
    adminName, adminEmail, adminPhone, adminPassword
  });

  // ربط معاملة الدفع بالمستأجر المُنشأ
  await db.query(
    `UPDATE platform_payment_transactions SET tenant_id = $1 WHERE id = $2`,
    [result.tenantId, txnId]
  );

  // حذف التسجيل المعلق من الذاكرة
  _pendingRegistrations.delete(registrationToken);

  return result;
}

module.exports = router;
