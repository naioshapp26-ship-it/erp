'use strict';

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const platformService = require('./platform-service');
const tenantService = require('./tenant-service');
const creditBilling = require('./credit-billing');
const { ensureStoreSchema } = require('./store-schema');
const { capturePayPalOrder, createPayPalOrder, formatPayPalAmount } = require('./paypal-client');
const { createPaymobIntention } = require('./paymob-client');

const router = express.Router();

async function optionalTenantAuth(req, res, next) {
  if (!req.tenantPool) return next();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.cookies?.tenant_session || '');

  if (!token) return next();

  try {
    const result = await req.tenantPool.query(
      `SELECT s.user_id, u.role, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = true
       LIMIT 1`,
      [token]
    );
    if (result.rows.length) {
      req.tenantUser = result.rows[0];
    }
  } catch (_) { /* ignore */ }
  return next();
}

router.use(optionalTenantAuth);

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(paymentLimiter);

function getBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
  return `${proto}://${req.headers.host}`;
}

function isPlatformRequest(req) {
  return !req.tenantPool;
}

function parseAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) acc[k.trim()] = decodeURIComponent(v.join('=') || '');
    return acc;
  }, {});
  return cookies.authToken || cookies.tenant_session || '';
}

async function resolveCentralUser(req) {
  const token = parseAuthToken(req);
  if (!token) return null;
  try {
    const result = await db.query(
      `SELECT u.id AS user_id, u.email, u.role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.session_token = $1
         AND s.expires_at > NOW()
         AND COALESCE(u.is_active, true) = true
       LIMIT 1`,
      [token]
    );
    return result.rows[0] || null;
  } catch (_) {
    return null;
  }
}

async function resolveCreditsContext(req) {
  if (req.tenantPool) {
    const userId = req.tenantUser?.user_id || null;
    return { pool: req.tenantPool, userId, isPlatform: false };
  }
  const centralUser = await resolveCentralUser(req);
  if (!centralUser) {
    return { pool: null, userId: null, isPlatform: true };
  }
  return { pool: db, userId: centralUser.user_id, isPlatform: true };
}

async function isProviderConfiguredForContext(ctx, provider) {
  if (ctx.isPlatform) {
    return platformService.isProviderConfigured(provider);
  }
  return tenantService.isProviderConfigured(ctx.pool, provider);
}

async function createPlatformCreditSession({
  provider,
  bundle,
  baseUrl,
  customerEmail,
  metadata,
}) {
  const successUrl = `${baseUrl}/credit-topup.html?status=success`;
  const cancelUrl = `${baseUrl}/credit-topup.html?status=cancelled`;
  const amountCents = platformService.toCents(bundle.amount, bundle.currency);

  if (provider === 'stripe') {
    return platformService.createStripeCheckoutSession({
      amount: amountCents,
      currency: bundle.currency || 'SAR',
      productName: bundle.name,
      successUrl,
      cancelUrl,
      returnUrl: successUrl,
      customerEmail,
      metadata,
      uiMode: 'embedded',
    });
  }

  if (provider === 'paypal') {
    const auth = await platformService.getPayPalAuth();
    const order = await createPayPalOrder({
      auth,
      amount: formatPayPalAmount(Number(bundle.amount) || 0),
      currency: String(bundle.currency || 'SAR').toUpperCase(),
      customId: metadata?.credit_account_id ? String(metadata.credit_account_id) : undefined,
      description: bundle.name,
    });
    return {
      sessionId: order.id,
      checkoutUrl: order.links?.find((l) => l.rel === 'approve')?.href || null,
      clientSecret: null,
    };
  }

  if (provider === 'paymob') {
    const auth = await platformService.getPaymobAuth();
    const intention = await createPaymobIntention({
      auth: { secretKey: auth.secretKey, baseUrl: auth.baseUrl },
      amount: amountCents,
      currency: String(bundle.currency || 'EGP').toUpperCase(),
      paymentMethods: auth.integrationIds,
      items: [{ name: bundle.name, amount: amountCents, quantity: 1 }],
      billingData: {},
      metadata,
      successUrl,
      failureUrl: cancelUrl,
      callbackUrl: `${baseUrl}/api/payment/webhook/paymob/platform`,
    });
    return {
      sessionId: String(intention.id || intention.client_secret || ''),
      checkoutUrl: intention.redirect_url || intention.payment_url || null,
      clientSecret: intention.client_secret || null,
    };
  }

  throw new Error(`مزود الدفع ${provider} غير مدعوم.`);
}

// ================================================================
// Public provider status (platform or tenant context)
// ================================================================

router.get('/status/:provider', async (req, res) => {
  const { provider } = req.params;
  try {
    const configured = req.tenantPool
      ? await tenantService.isProviderConfigured(req.tenantPool, provider)
      : await platformService.isProviderConfigured(provider);
    return res.json({ configured, provider });
  } catch (err) {
    return res.status(500).json({ configured: false, message: err.message });
  }
});

router.get('/stripe/publishable-key', async (req, res) => {
  try {
    const config = req.tenantPool
      ? await tenantService.getPublicConfig(req.tenantPool, 'stripe')
      : await platformService.getPublicConfig('stripe');
    if (!config.configured) {
      return res.status(503).json({ message: 'Stripe not configured' });
    }
    return res.json({ publishableKey: config.publishableKey });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/paypal/client-id', async (req, res) => {
  try {
    const config = req.tenantPool
      ? await tenantService.getPublicConfig(req.tenantPool, 'paypal')
      : await platformService.getPublicConfig('paypal');
    if (!config.configured) {
      return res.status(503).json({ message: 'PayPal not configured' });
    }
    return res.json({ clientId: config.clientId });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/paymob/config', async (req, res) => {
  try {
    const config = req.tenantPool
      ? await tenantService.getPublicConfig(req.tenantPool, 'paymob')
      : await platformService.getPublicConfig('paymob');
    if (!config.configured) {
      return res.status(503).json({ message: 'Paymob not configured' });
    }
    return res.json({ publicKey: config.publicKey, baseUrl: config.baseUrl });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ================================================================
// Credit bundles & balance (tenant)
// ================================================================

router.get('/credits/bundles', (req, res) => {
  return res.json({ success: true, bundles: creditBilling.getCreditBundles() });
});

router.get('/credits/summary', async (req, res) => {
  const ctx = await resolveCreditsContext(req);
  if (!ctx.pool || !ctx.userId) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول.' });
  }
  try {
    const balance = await creditBilling.getCreditBalance(ctx.pool, { userId: Number(ctx.userId) });
    const lowBalanceThreshold = parseInt(process.env.CREDIT_LOW_BALANCE_THRESHOLD, 10) || 10;
    const numericBalance = Number(balance.balance) || 0;
    const isLow = numericBalance > 0 && numericBalance <= lowBalanceThreshold;
    const exhausted = numericBalance <= 0;
    return res.json({
      success: true,
      balance: numericBalance,
      currency: balance.currency || 'SAR',
      lowBalanceThreshold,
      isLow,
      exhausted,
      bundles: creditBilling.getCreditBundles(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/credits/balance', async (req, res) => {
  const ctx = await resolveCreditsContext(req);
  if (!ctx.pool || !ctx.userId) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول.' });
  }
  try {
    const balance = await creditBilling.getCreditBalance(ctx.pool, { userId: Number(ctx.userId) });
    return res.json({ success: true, ...balance });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/credits/checkout', async (req, res) => {
  const ctx = await resolveCreditsContext(req);
  if (!ctx.pool || !ctx.userId) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول.' });
  }

  const {
    bundleId,
    paymentProvider = 'stripe',
    userId,
    customerEmail,
  } = req.body || {};

  const bundles = creditBilling.getCreditBundles();
  const bundle = bundles.find((b) => b.id === bundleId);
  if (!bundle) {
    return res.status(400).json({ success: false, message: 'الباقة غير موجودة.' });
  }

  const configured = await isProviderConfiguredForContext(ctx, paymentProvider);
  if (!configured) {
    const hint = ctx.isPlatform
      ? 'فعّل بوابة الدفع من إعدادات المنصة أولاً.'
      : 'فعّل بوابة الدفع من إعدادات المستأجر أولاً.';
    return res.status(503).json({ success: false, message: `مزود الدفع ${paymentProvider} غير مفعّل. ${hint}` });
  }

  try {
    const effectiveUserId = userId ? Number(userId) : Number(ctx.userId);
    const account = await creditBilling.ensureCreditAccount(ctx.pool, {
      userId: effectiveUserId,
    });

    const baseUrl = getBaseUrl(req);
    const metadata = {
      payment_type: 'credit_topup',
      bundle_id: bundle.id,
      credits_delta: bundle.credits,
      credit_account_id: account.id,
      user_id: effectiveUserId,
      scope: ctx.isPlatform ? 'platform' : 'tenant',
    };

    const session = ctx.isPlatform
      ? await createPlatformCreditSession({
        provider: paymentProvider,
        bundle,
        baseUrl,
        customerEmail,
        metadata,
      })
      : await tenantService.createCheckoutSession(ctx.pool, {
        provider: paymentProvider,
        amount: bundle.amount,
        currency: bundle.currency || 'SAR',
        productName: bundle.name,
        successUrl: `${baseUrl}/credit-topup.html?status=success`,
        cancelUrl: `${baseUrl}/credit-topup.html?status=cancelled`,
        returnUrl: `${baseUrl}/credit-topup.html?status=success`,
        customerEmail,
        metadata,
        callbackUrl: `${baseUrl}/api/payment/webhook/paymob/tenant`,
      });

    await creditBilling.createPendingCreditPurchase(ctx.pool, {
      creditAccountId: account.id,
      bundleId: bundle.id,
      creditsDelta: bundle.credits,
      amountPaid: bundle.amount,
      currency: bundle.currency,
      checkoutSessionId: session.sessionId,
      provider: paymentProvider,
      metadata,
    });

    if (ctx.isPlatform) {
      await platformService.logPlatformTransaction({
        provider: paymentProvider,
        providerTransactionId: session.sessionId,
        amount: bundle.amount,
        currency: bundle.currency,
        status: 'pending',
        type: 'subscription',
        metadata: { ...metadata, payment_type: 'credit_topup' },
      });
    } else {
      await tenantService.logTenantTransaction(ctx.pool, {
        provider: paymentProvider,
        providerTransactionId: session.sessionId,
        amount: bundle.amount,
        currency: bundle.currency,
        status: 'pending',
        type: 'credit_topup',
        referenceType: 'credit_bundle',
        metadata,
      });
    }

    return res.json({
      success: true,
      sessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl,
      clientSecret: session.clientSecret,
      paymentProvider,
      bundle,
    });
  } catch (err) {
    console.error('[Payment] credit checkout error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================================
// Store cart & checkout (tenant)
// ================================================================

router.get('/cart', async (req, res) => {
  if (!req.tenantPool) return res.status(400).json({ success: false, message: 'يتطلب نطاق مستأجر.' });
  const userId = req.tenantUser?.user_id;
  if (!userId) return res.status(401).json({ success: false, message: 'غير مصرح.' });

  try {
    await ensureStoreSchema(req.tenantPool);
    const result = await req.tenantPool.query(
      `SELECT ci.*, p.name, p.sale_price, p.sku
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1`,
      [userId]
    );
    const items = result.rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      price: Number(row.sale_price) || 0,
      quantity: Number(row.quantity) || 1,
      lineTotal: (Number(row.sale_price) || 0) * (Number(row.quantity) || 1),
    }));
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return res.json({ success: true, items, subtotal, currency: process.env.STORE_CURRENCY || 'SAR' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/cart/items', async (req, res) => {
  if (!req.tenantPool) return res.status(400).json({ success: false, message: 'يتطلب نطاق مستأجر.' });
  const userId = req.tenantUser?.user_id;
  if (!userId) return res.status(401).json({ success: false, message: 'غير مصرح.' });

  const { productId, quantity = 1 } = req.body || {};
  if (!productId) return res.status(400).json({ success: false, message: 'productId مطلوب.' });

  try {
    await ensureStoreSchema(req.tenantPool);
    await req.tenantPool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id) DO UPDATE
         SET quantity = cart_items.quantity + EXCLUDED.quantity,
             updated_at = CURRENT_TIMESTAMP`,
      [userId, productId, quantity]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/cart/checkout', async (req, res) => {
  if (!req.tenantPool) return res.status(400).json({ success: false, message: 'يتطلب نطاق مستأجر.' });
  const userId = req.tenantUser?.user_id;
  if (!userId) return res.status(401).json({ success: false, message: 'غير مصرح.' });

  const {
    paymentProvider = 'stripe',
    paymentMethod = 'card',
    shippingAddress,
    shippingCity,
    shippingCountry,
    shippingPhone,
    notes,
    customerEmail,
  } = req.body || {};

  if (paymentMethod !== 'card') {
    return res.status(400).json({ success: false, message: 'الدفع الإلكتروني مطلوب للسلة.' });
  }

  try {
    await ensureStoreSchema(req.tenantPool);
    const cartResult = await req.tenantPool.query(
      `SELECT ci.*, p.name, p.sale_price
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1`,
      [userId]
    );
    if (!cartResult.rows.length) {
      return res.status(400).json({ success: false, message: 'السلة فارغة.' });
    }

    const currency = process.env.STORE_CURRENCY || 'SAR';
    const orderItems = cartResult.rows.map((row) => ({
      productId: row.product_id,
      productName: row.name,
      productPrice: Number(row.sale_price) || 0,
      quantity: Number(row.quantity) || 1,
      subtotal: (Number(row.sale_price) || 0) * (Number(row.quantity) || 1),
    }));
    const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    const orderResult = await req.tenantPool.query(
      `INSERT INTO store_orders
         (user_id, status, total, currency, payment_method, payment_status, payment_provider,
          shipping_address, shipping_city, shipping_country, shipping_phone, notes)
       VALUES ($1,'pending',$2,$3,'card','pending',$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [userId, total, currency, paymentProvider,
        shippingAddress, shippingCity, shippingCountry, shippingPhone, notes || null]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of orderItems) {
      await req.tenantPool.query(
        `INSERT INTO store_order_items
           (order_id, product_id, product_name, product_price, quantity, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [orderId, item.productId, item.productName, item.productPrice, item.quantity, item.subtotal]
      );
    }

    const baseUrl = getBaseUrl(req);
    const metadata = {
      payment_type: 'store_order',
      order_id: orderId,
      user_id: userId,
    };

    const stripeItems = orderItems.map((item) => ({
      name: item.productName,
      amount: platformService.toCents(item.productPrice, currency),
      quantity: item.quantity,
    }));

    const session = await tenantService.createCheckoutSession(req.tenantPool, {
      provider: paymentProvider,
      amount: total,
      currency,
      productName: `Order #${orderId}`,
      items: stripeItems,
      successUrl: `${baseUrl}/dashboard.html#orders?payment=success&order=${orderId}`,
      cancelUrl: `${baseUrl}/dashboard.html#cart?payment=cancelled`,
      returnUrl: `${baseUrl}/dashboard.html#orders?payment=success&order=${orderId}`,
      customerEmail,
      metadata,
      billingData: {
        street: shippingAddress,
        city: shippingCity,
        country: shippingCountry,
        phone_number: shippingPhone,
      },
      callbackUrl: `${baseUrl}/api/payment/webhook/paymob/tenant`,
    });

    await tenantService.logTenantTransaction(req.tenantPool, {
      provider: paymentProvider,
      providerTransactionId: session.sessionId,
      amount: total,
      currency,
      status: 'pending',
      type: 'store_order',
      referenceType: 'store_order',
      referenceId: orderId,
      metadata,
    });

    await req.tenantPool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    return res.status(201).json({
      success: true,
      orderId,
      sessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl,
      clientSecret: session.clientSecret,
      paymentProvider,
    });
  } catch (err) {
    console.error('[Payment] cart checkout error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ================================================================
// PayPal capture
// ================================================================

router.post('/paypal/orders/:orderId/capture', async (req, res) => {
  try {
    const auth = req.tenantPool
      ? await tenantService.getPayPalAuth(req.tenantPool)
      : await platformService.getPayPalAuth();
    const result = await capturePayPalOrder(auth, req.params.orderId);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// COD order (tenant) — without online gateway
router.post('/orders/cod', async (req, res) => {
  if (!req.tenantPool) return res.status(400).json({ success: false, message: 'يتطلب نطاق مستأجر.' });
  const userId = req.tenantUser?.user_id;
  if (!userId) return res.status(401).json({ success: false, message: 'غير مصرح.' });

  const { items, shippingAddress, shippingCity, shippingCountry, shippingPhone, notes } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, message: 'العناصر مطلوبة.' });
  }

  try {
    await ensureStoreSchema(req.tenantPool);
    const currency = process.env.STORE_CURRENCY || 'SAR';
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await req.tenantPool.query('SELECT id, name, sale_price FROM products WHERE id = $1', [item.productId]);
      if (!product.rows.length) continue;
      const row = product.rows[0];
      const qty = Number(item.quantity) || 1;
      const price = Number(row.sale_price) || 0;
      const subtotal = price * qty;
      total += subtotal;
      orderItems.push({ productId: row.id, productName: row.name, productPrice: price, quantity: qty, subtotal });
    }

    if (!orderItems.length) return res.status(400).json({ success: false, message: 'لا توجد منتجات صالحة.' });

    const orderResult = await req.tenantPool.query(
      `INSERT INTO store_orders
         (user_id, status, total, currency, payment_method, payment_status, payment_provider,
          shipping_address, shipping_city, shipping_country, shipping_phone, notes)
       VALUES ($1,'pending',$2,$3,'cod','pending','cod',$4,$5,$6,$7,$8)
       RETURNING id`,
      [userId, total, currency, shippingAddress, shippingCity, shippingCountry, shippingPhone, notes || null]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of orderItems) {
      await req.tenantPool.query(
        `INSERT INTO store_order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [orderId, item.productId, item.productName, item.productPrice, item.quantity, item.subtotal]
      );
    }

    return res.status(201).json({ success: true, orderId, total, currency, paymentMethod: 'cod' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
