'use strict';

const db = require('../db');

let ready = false;

async function ensurePaymentBootstrap() {
  if (ready) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS pending_signups (
      token VARCHAR(128) PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pending_signups_expires ON pending_signups (expires_at);

    INSERT INTO platform_payment_settings (provider, is_enabled, is_test_mode, plans_config, trial_days)
    VALUES
      ('stripe', false, true, '{"basic":{"amount":0,"currency":"USD"},"pro":{"amount":49,"currency":"USD"},"enterprise":{"amount":199,"currency":"USD"}}'::jsonb, 14),
      ('paypal', false, true, '{}'::jsonb, 14),
      ('paymob', false, true, '{}'::jsonb, 14)
    ON CONFLICT (provider) DO NOTHING;
  `).catch((err) => {
    console.warn('[Payment Bootstrap] partial skip:', err.message);
  });

  ready = true;
}

module.exports = { ensurePaymentBootstrap };
