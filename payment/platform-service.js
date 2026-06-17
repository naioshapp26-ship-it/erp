'use strict';

const Stripe = require('stripe');
const db = require('../db');
const { decryptPlatformSecret } = require('./secrets');
const { createPaymobIntention } = require('./paymob-client');
const {
  createPayPalOrder,
  createPayPalSubscription,
  formatPayPalAmount,
} = require('./paypal-client');

const PROVIDERS = new Set(['stripe', 'paypal', 'paymob']);

async function getProviderSettings(provider) {
  if (!PROVIDERS.has(provider)) return null;
  const result = await db.query(
    `SELECT * FROM platform_payment_settings WHERE provider = $1 LIMIT 1`,
    [provider]
  );
  return result.rows[0] || null;
}

async function isProviderConfigured(provider) {
  const row = await getProviderSettings(provider);
  if (!row || !row.is_enabled) return false;
  if (provider === 'stripe') return Boolean(row.stripe_public_key && row.stripe_secret_key);
  if (provider === 'paypal') return Boolean(row.paypal_client_id && row.paypal_client_secret);
  if (provider === 'paymob') return Boolean(row.paymob_public_key && row.paymob_secret_key);
  return false;
}

function parsePlansConfig(row) {
  if (!row?.plans_config) return {};
  if (typeof row.plans_config === 'string') {
    try { return JSON.parse(row.plans_config); } catch { return {}; }
  }
  return row.plans_config || {};
}

function getPlanDetails(provider, plan) {
  const fallback = {
    amount: plan === 'basic' ? 0 : null,
    currency: 'USD',
    trialDays: 0,
  };

  return getProviderSettings(provider).then((settings) => {
    if (!settings) return { ...fallback, settings: null };
    const plansConfig = parsePlansConfig(settings);
    const planDetails = plansConfig[plan] || {};
    return {
      amount: typeof planDetails.amount === 'number' ? planDetails.amount : fallback.amount,
      currency: planDetails.currency || fallback.currency,
      priceId: planDetails.price_id || planDetails.stripe_price_id || null,
      paypalPlanId: planDetails.paypal_plan_id || null,
      trialDays: settings.trial_days || 0,
      settings,
    };
  });
}

function toCents(amount, currency = 'USD') {
  const value = Number(amount) || 0;
  if (value <= 0) return 0;
  // amounts < 1000 treated as major units (49.99 USD → 4999 cents)
  if (value < 1000 && !String(amount).includes('.')) {
    return Math.round(value * 100);
  }
  if (String(amount).includes('.')) {
    return Math.round(value * 100);
  }
  return Math.round(value);
}

async function getStripeClient() {
  const row = await getProviderSettings('stripe');
  if (!row?.stripe_secret_key) throw new Error('PLATFORM_STRIPE_NOT_CONFIGURED');
  const secretKey = decryptPlatformSecret(row.stripe_secret_key);
  if (!secretKey) throw new Error('PLATFORM_STRIPE_NOT_CONFIGURED');
  return new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });
}

async function createStripeCheckoutSession(options) {
  const stripe = await getStripeClient();
  const uiMode = options.uiMode || 'embedded';
  const isEmbedded = uiMode === 'embedded';
  const metadata = options.metadata || {};
  const isSubscription = Boolean(options.priceId);

  if (isSubscription) {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: options.priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: options.trialPeriodDays ?? 0,
        metadata,
      },
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

  const lineItems = (options.items && options.items.length)
    ? options.items.map((item) => ({
      price_data: {
        currency: (options.currency || 'usd').toLowerCase(),
        product_data: { name: item.name, description: item.description },
        unit_amount: item.amount,
      },
      quantity: item.quantity || 1,
    }))
    : [{
      price_data: {
        currency: (options.currency || 'usd').toLowerCase(),
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

async function getPayPalAuth() {
  const row = await getProviderSettings('paypal');
  if (!row?.paypal_client_id || !row.paypal_client_secret) {
    throw new Error('PLATFORM_PAYPAL_NOT_CONFIGURED');
  }
  return {
    clientId: row.paypal_client_id,
    clientSecret: decryptPlatformSecret(row.paypal_client_secret),
    isLiveMode: !row.is_test_mode,
    webhookId: row.paypal_webhook_id || null,
  };
}

async function getPaymobAuth() {
  const row = await getProviderSettings('paymob');
  if (!row?.paymob_public_key || !row.paymob_secret_key) {
    throw new Error('PLATFORM_PAYMOB_NOT_CONFIGURED');
  }
  const integrationIds = Array.isArray(row.paymob_integration_ids)
    ? row.paymob_integration_ids
    : (typeof row.paymob_integration_ids === 'string'
      ? JSON.parse(row.paymob_integration_ids || '[]')
      : []);
  return {
    publicKey: row.paymob_public_key,
    secretKey: decryptPlatformSecret(row.paymob_secret_key),
    hmacSecret: row.paymob_hmac_secret ? decryptPlatformSecret(row.paymob_hmac_secret) : null,
    integrationIds,
    baseUrl: row.paymob_base_url || null,
    isLiveMode: !row.is_test_mode,
  };
}

async function createSaasPaymentSession({
  provider,
  plan,
  registrationToken,
  customerEmail,
  customerName,
  customerPhone,
  baseUrl,
  metadata = {},
}) {
  const pricing = await getPlanDetails(provider, plan);
  if (!pricing.settings) throw new Error('PLATFORM_PAYMENT_NOT_CONFIGURED');

  const currency = provider === 'paymob'
    ? 'EGP'
    : String(pricing.currency || 'USD').toUpperCase();

  const successUrl = `${baseUrl}/saas-signup.html?step=3&token=${registrationToken}&status=success`;
  const cancelUrl = `${baseUrl}/saas-signup.html?step=2&token=${registrationToken}&status=cancelled`;

  const sessionMetadata = {
    ...metadata,
    registration_token: registrationToken,
    payment_type: 'saas_signup',
    subscription_plan: plan,
    payment_provider: provider,
  };

  if (provider === 'stripe') {
    const amountCents = toCents(pricing.amount, currency);
    if (pricing.priceId) {
      return createStripeCheckoutSession({
        currency,
        priceId: pricing.priceId,
        trialPeriodDays: pricing.trialDays,
        successUrl,
        cancelUrl,
        returnUrl: successUrl,
        customerEmail,
        metadata: sessionMetadata,
        uiMode: 'embedded',
      });
    }
    return createStripeCheckoutSession({
      currency,
      amount: amountCents,
      productName: `NAIOSH ERP — ${plan} plan`,
      successUrl,
      cancelUrl,
      returnUrl: successUrl,
      customerEmail,
      metadata: sessionMetadata,
      uiMode: 'embedded',
    });
  }

  if (provider === 'paypal') {
    const auth = await getPayPalAuth();
    if (pricing.paypalPlanId) {
      const subscription = await createPayPalSubscription({
        auth,
        planId: pricing.paypalPlanId,
        customId: registrationToken,
        returnUrl: successUrl,
        cancelUrl,
        subscriber: {
          emailAddress: customerEmail,
          name: {
            givenName: (customerName || '').split(' ')[0] || customerName,
            surname: (customerName || '').split(' ').slice(1).join(' ') || undefined,
          },
        },
      });
      return {
        sessionId: subscription.id,
        checkoutUrl: subscription.links?.find((l) => l.rel === 'approve')?.href || null,
        clientSecret: null,
      };
    }
    const order = await createPayPalOrder({
      auth,
      amount: formatPayPalAmount(Number(pricing.amount) || 0),
      currency,
      customId: registrationToken,
      description: `NAIOSH ERP — ${plan} plan`,
    });
    return {
      sessionId: order.id,
      checkoutUrl: order.links?.find((l) => l.rel === 'approve')?.href || null,
      clientSecret: null,
    };
  }

  if (provider === 'paymob') {
    const auth = await getPaymobAuth();
    const amountCents = toCents(pricing.amount, 'EGP');
    const intention = await createPaymobIntention({
      auth: { secretKey: auth.secretKey, baseUrl: auth.baseUrl },
      amount: amountCents,
      currency: 'EGP',
      paymentMethods: auth.integrationIds,
      items: [{
        name: `NAIOSH ERP — ${plan}`,
        amount: amountCents,
        quantity: 1,
      }],
      billingData: {
        first_name: (customerName || '').split(' ')[0] || customerName || '',
        last_name: (customerName || '').split(' ').slice(1).join(' ') || '',
        email: customerEmail || undefined,
        phone_number: customerPhone || undefined,
      },
      metadata: sessionMetadata,
      successUrl,
      failureUrl: cancelUrl,
      callbackUrl: `${baseUrl}/api/payment/webhook/paymob/platform`,
    });
    return {
      sessionId: intention.id || `paymob-${Date.now()}`,
      checkoutUrl: intention.paymentUrl,
      clientSecret: intention.clientSecret,
    };
  }

  throw new Error('UNSUPPORTED_PROVIDER');
}

async function logPlatformTransaction({
  provider,
  providerTransactionId,
  tenantId,
  amount,
  currency,
  status,
  type,
  metadata,
}) {
  await db.query(
    `INSERT INTO platform_payment_transactions
       (tenant_id, provider, provider_transaction_id, amount, currency, status, type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      tenantId || null,
      provider,
      providerTransactionId,
      amount || 0,
      currency || 'USD',
      status || 'pending',
      type || 'subscription',
      JSON.stringify(metadata || {}),
    ]
  );
}

async function getPublicConfig(provider) {
  const row = await getProviderSettings(provider);
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
  getPlanDetails,
  toCents,
  getStripeClient,
  createStripeCheckoutSession,
  getPayPalAuth,
  getPaymobAuth,
  createSaasPaymentSession,
  logPlatformTransaction,
  getPublicConfig,
};
