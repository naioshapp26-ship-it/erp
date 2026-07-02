'use strict';

const db = require('../db');
const { encryptDbUrl } = require('../tenant-connection-manager');

const PROVIDERS = ['stripe', 'paypal', 'paymob'];

function encrypt(value) {
  if (!value) return null;
  try {
    return encryptDbUrl(String(value));
  } catch {
    return null;
  }
}

function parseIntegrationIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(raw).split(',').map((v) => v.trim()).filter(Boolean);
  }
}

function readProviderEnv(provider) {
  const prefix = `PLATFORM_${provider.toUpperCase()}`;
  const autoEnable = process.env.PAYMENT_AUTO_ENABLE !== '0';

  if (provider === 'stripe') {
    const publicKey = process.env.PLATFORM_STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '';
    const secretKey = process.env.PLATFORM_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
    const webhookSecret = process.env.PLATFORM_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
    const enabledFlag = process.env.PLATFORM_STRIPE_ENABLED;
    return {
      provider,
      isEnabled: enabledFlag === '1' || (enabledFlag !== '0' && autoEnable && !!(publicKey && secretKey)),
      isTestMode: process.env.PLATFORM_STRIPE_TEST_MODE !== '0',
      fields: {
        stripe_public_key: publicKey || null,
        stripe_secret_key: encrypt(secretKey),
        stripe_webhook_secret: encrypt(webhookSecret),
      },
      hasSecrets: !!(publicKey && secretKey),
    };
  }

  if (provider === 'paypal') {
    const clientId = process.env.PLATFORM_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '';
    const clientSecret = process.env.PLATFORM_PAYPAL_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '';
    const webhookId = process.env.PLATFORM_PAYPAL_WEBHOOK_ID || process.env.PAYPAL_WEBHOOK_ID || '';
    const merchantId = process.env.PLATFORM_PAYPAL_MERCHANT_ID || '';
    const enabledFlag = process.env.PLATFORM_PAYPAL_ENABLED;
    return {
      provider,
      isEnabled: enabledFlag === '1' || (enabledFlag !== '0' && autoEnable && !!(clientId && clientSecret)),
      isTestMode: process.env.PLATFORM_PAYPAL_TEST_MODE !== '0',
      fields: {
        paypal_client_id: clientId || null,
        paypal_client_secret: encrypt(clientSecret),
        paypal_webhook_id: webhookId || null,
        paypal_merchant_id: merchantId || null,
      },
      hasSecrets: !!(clientId && clientSecret),
    };
  }

  const publicKey = process.env.PLATFORM_PAYMOB_PUBLIC_KEY || process.env.PAYMOB_PUBLIC_KEY || '';
  const secretKey = process.env.PLATFORM_PAYMOB_SECRET_KEY || process.env.PAYMOB_SECRET_KEY || '';
  const hmacSecret = process.env.PLATFORM_PAYMOB_HMAC_SECRET || process.env.PAYMOB_HMAC_SECRET || '';
  const integrationIds = parseIntegrationIds(
    process.env.PLATFORM_PAYMOB_INTEGRATION_IDS || process.env.PAYMOB_INTEGRATION_IDS || '[]'
  );
  const baseUrl = process.env.PLATFORM_PAYMOB_BASE_URL || 'https://accept.paymob.com';
  const enabledFlag = process.env.PLATFORM_PAYMOB_ENABLED;
  return {
    provider,
    isEnabled: enabledFlag === '1' || (enabledFlag !== '0' && autoEnable && !!(publicKey && secretKey)),
    isTestMode: process.env.PLATFORM_PAYMOB_TEST_MODE !== '0',
    fields: {
      paymob_public_key: publicKey || null,
      paymob_secret_key: encrypt(secretKey),
      paymob_hmac_secret: encrypt(hmacSecret),
      paymob_integration_ids: JSON.stringify(integrationIds),
      paymob_base_url: baseUrl,
    },
    hasSecrets: !!(publicKey && secretKey),
  };
}

async function upsertPlatformProvider(config) {
  if (!config.hasSecrets && !config.isEnabled) return false;

  const existing = await db.query(
    `SELECT id, is_enabled FROM platform_payment_settings WHERE provider = $1 LIMIT 1`,
    [config.provider]
  );

  if (existing.rows.length) {
    const updates = [];
    const params = [];
    const add = (col, val) => {
      if (val !== undefined && val !== null) {
        params.push(val);
        updates.push(`${col} = $${params.length}`);
      }
    };

    if (config.isEnabled) {
      params.push(true);
      updates.push(`is_enabled = $${params.length}`);
    }
    params.push(!!config.isTestMode);
    updates.push(`is_test_mode = $${params.length}`);

    Object.entries(config.fields).forEach(([col, val]) => add(col, val));

    if (!updates.length) return false;
    params.push(existing.rows[0].id);
    await db.query(
      `UPDATE platform_payment_settings
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length}`,
      params
    );
    return true;
  }

  await db.query(
    `INSERT INTO platform_payment_settings (
       provider, is_enabled, is_test_mode,
       stripe_public_key, stripe_secret_key, stripe_webhook_secret,
       paypal_client_id, paypal_client_secret, paypal_webhook_id, paypal_merchant_id,
       paymob_public_key, paymob_secret_key, paymob_hmac_secret, paymob_integration_ids, paymob_base_url
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
    [
      config.provider,
      !!config.isEnabled,
      !!config.isTestMode,
      config.fields.stripe_public_key || null,
      config.fields.stripe_secret_key || null,
      config.fields.stripe_webhook_secret || null,
      config.fields.paypal_client_id || null,
      config.fields.paypal_client_secret || null,
      config.fields.paypal_webhook_id || null,
      config.fields.paypal_merchant_id || null,
      config.fields.paymob_public_key || null,
      config.fields.paymob_secret_key || null,
      config.fields.paymob_hmac_secret || null,
      config.fields.paymob_integration_ids || '[]',
      config.fields.paymob_base_url || 'https://accept.paymob.com',
    ]
  );
  return true;
}

async function seedPlatformPaymentFromEnv() {
  const results = [];
  for (const provider of PROVIDERS) {
    try {
      const config = readProviderEnv(provider);
      if (!config.hasSecrets) continue;
      const seeded = await upsertPlatformProvider(config);
      if (seeded) results.push(provider);
    } catch (err) {
      console.warn(`[Payment EnvSeed] ${provider}:`, err.message);
    }
  }
  if (results.length) {
    console.log(`[Payment EnvSeed] Platform gateways configured from env: ${results.join(', ')}`);
  }
  return results;
}

function isDemoPaymentMode() {
  return process.env.PAYMENT_DEMO_MODE === '1' || process.env.PAYMENT_DEMO_MODE === 'true';
}

module.exports = {
  seedPlatformPaymentFromEnv,
  isDemoPaymentMode,
  readProviderEnv,
};
