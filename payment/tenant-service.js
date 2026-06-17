'use strict';

const Stripe = require('stripe');
const { decryptSecretForContext } = require('./secrets');
const { createPaymobIntention } = require('./paymob-client');
const { createPayPalOrder, formatPayPalAmount } = require('./paypal-client');
const platformService = require('./platform-service');

const PROVIDERS = new Set(['stripe', 'paypal', 'paymob']);

async function getProviderSettings(pool, provider) {
  const result = await pool.query(
    `SELECT * FROM tenant_payment_settings WHERE provider = $1 LIMIT 1`,
    [provider]
  );
  return result.rows[0] || null;
}

async function isProviderConfigured(pool, provider) {
  const row = await getProviderSettings(pool, provider);
  if (!row || !row.is_enabled) return false;
  if (provider === 'stripe') return Boolean(row.stripe_public_key && row.stripe_secret_key);
  if (provider === 'paypal') return Boolean(row.paypal_client_id && row.paypal_client_secret);
  if (provider === 'paymob') return Boolean(row.paymob_public_key && row.paymob_secret_key);
  return false;
}

async function getStripeClient(pool) {
  const row = await getProviderSettings(pool, 'stripe');
  if (!row?.stripe_secret_key) throw new Error('TENANT_STRIPE_NOT_CONFIGURED');
  const secretKey = decryptSecretForContext(row.stripe_secret_key, 'tenant');
  if (!secretKey) throw new Error('TENANT_STRIPE_NOT_CONFIGURED');
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });
}

async function createStripeCheckoutSession(pool, options) {
  const stripe = await getStripeClient(pool);
  const uiMode = options.uiMode || 'embedded';
  const isEmbedded = uiMode === 'embedded';
  const metadata = options.metadata || {};

  const lineItems = (options.items && options.items.length)
    ? options.items.map((item) => ({
      price_data: {
        currency: (options.currency || 'sar').toLowerCase(),
        product_data: { name: item.name },
        unit_amount: item.amount,
      },
      quantity: item.quantity || 1,
    }))
    : [{
      price_data: {
        currency: (options.currency || 'sar').toLowerCase(),
        product_data: { name: options.productName || 'Payment' },
        unit_amount: options.amount,
      },
      quantity: 1,
    }];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    ...(isEmbedded ? {
      ui_mode: 'embedded',
      return_url: options.returnUrl || options.successUrl,
      redirect_on_completion: 'if_required',
    } : {
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
    }),
    customer_email: options.customerEmail || undefined,
    metadata,
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
    clientSecret: session.client_secret,
  };
}

async function getPayPalAuth(pool) {
  const row = await getProviderSettings(pool, 'paypal');
  if (!row?.paypal_client_id || !row.paypal_client_secret) {
    throw new Error('TENANT_PAYPAL_NOT_CONFIGURED');
  }
  return {
    clientId: row.paypal_client_id,
    clientSecret: decryptSecretForContext(row.paypal_client_secret, 'tenant'),
    isLiveMode: !row.is_test_mode,
    webhookId: row.paypal_webhook_id || null,
  };
}

async function getPaymobAuth(pool) {
  const row = await getProviderSettings(pool, 'paymob');
  if (!row?.paymob_public_key || !row.paymob_secret_key) {
    throw new Error('TENANT_PAYMOB_NOT_CONFIGURED');
  }
  const integrationIds = Array.isArray(row.paymob_integration_ids)
    ? row.paymob_integration_ids
    : [];
  return {
    publicKey: row.paymob_public_key,
    secretKey: decryptSecretForContext(row.paymob_secret_key, 'tenant'),
    hmacSecret: row.paymob_hmac_secret
      ? decryptSecretForContext(row.paymob_hmac_secret, 'tenant')
      : null,
    integrationIds,
    baseUrl: row.paymob_base_url || null,
    isLiveMode: !row.is_test_mode,
  };
}

async function createCheckoutSession(pool, {
  provider,
  amount,
  currency,
  productName,
  items,
  successUrl,
  cancelUrl,
  returnUrl,
  customerEmail,
  metadata,
  billingData,
  callbackUrl,
}) {
  if (provider === 'stripe') {
    return createStripeCheckoutSession(pool, {
      amount: platformService.toCents(amount, currency),
      currency,
      productName,
      items,
      successUrl,
      cancelUrl,
      returnUrl,
      customerEmail,
      metadata,
      uiMode: 'embedded',
    });
  }

  if (provider === 'paypal') {
    const auth = await getPayPalAuth(pool);
    const order = await createPayPalOrder({
      auth,
      amount: formatPayPalAmount(Number(amount) || 0),
      currency: String(currency || 'SAR').toUpperCase(),
      customId: metadata?.reference_id || metadata?.order_id || undefined,
      description: productName || 'Payment',
      items: items?.map((item) => ({
        name: item.name,
        unitAmount: formatPayPalAmount((item.amount || 0) / 100),
        quantity: item.quantity || 1,
      })),
    });
    return {
      sessionId: order.id,
      checkoutUrl: order.links?.find((l) => l.rel === 'approve')?.href || null,
      clientSecret: null,
    };
  }

  if (provider === 'paymob') {
    const auth = await getPaymobAuth(pool);
    const amountCents = platformService.toCents(amount, currency);
    const intention = await createPaymobIntention({
      auth: { secretKey: auth.secretKey, baseUrl: auth.baseUrl },
      amount: amountCents,
      currency: String(currency || 'EGP').toUpperCase(),
      paymentMethods: auth.integrationIds,
      items: items?.map((item) => ({
        name: item.name,
        amount: item.amount,
        quantity: item.quantity || 1,
      })) || [{
        name: productName || 'Payment',
        amount: amountCents,
        quantity: 1,
      }],
      billingData: billingData || {},
      metadata: metadata || {},
      successUrl,
      failureUrl: cancelUrl,
      callbackUrl,
    });
    return {
      sessionId: intention.id || `paymob-${Date.now()}`,
      checkoutUrl: intention.paymentUrl,
      clientSecret: intention.clientSecret,
    };
  }

  throw new Error('UNSUPPORTED_PROVIDER');
}

async function logTenantTransaction(pool, {
  provider,
  providerTransactionId,
  amount,
  currency,
  status,
  type,
  referenceType,
  referenceId,
  metadata,
}) {
  await pool.query(
    `INSERT INTO tenant_payment_transactions
       (provider, provider_transaction_id, amount, currency, status, type, reference_type, reference_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      provider,
      providerTransactionId,
      amount || 0,
      currency || 'SAR',
      status || 'pending',
      type || 'purchase',
      referenceType || null,
      referenceId || null,
      JSON.stringify(metadata || {}),
    ]
  );
}

async function updateTenantTransactionStatus(pool, providerTransactionId, status) {
  await pool.query(
    `UPDATE tenant_payment_transactions
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE provider_transaction_id = $2`,
    [status, providerTransactionId]
  );
}

async function getPublicConfig(pool, provider) {
  const row = await getProviderSettings(pool, provider);
  if (!row || !row.is_enabled) return { configured: false };

  if (provider === 'stripe') {
    return { configured: true, publishableKey: row.stripe_public_key || null };
  }
  if (provider === 'paypal') {
    return { configured: true, clientId: row.paypal_client_id || null };
  }
  if (provider === 'paymob') {
    return {
      configured: true,
      publicKey: row.paymob_public_key || null,
      baseUrl: row.paymob_base_url || null,
    };
  }
  return { configured: false };
}

module.exports = {
  PROVIDERS,
  getProviderSettings,
  isProviderConfigured,
  createCheckoutSession,
  logTenantTransaction,
  updateTenantTransactionStatus,
  getPublicConfig,
  getStripeClient,
  getPayPalAuth,
  getPaymobAuth,
};
