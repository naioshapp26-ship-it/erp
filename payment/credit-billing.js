'use strict';

const DEFAULT_BUNDLES = [
  { id: 'starter', name: 'باقة البداية', credits: 100, amount: 49, currency: 'SAR' },
  { id: 'growth', name: 'باقة النمو', credits: 500, amount: 199, currency: 'SAR' },
  { id: 'pro', name: 'باقة احترافية', credits: 2000, amount: 699, currency: 'SAR' },
];

async function ensureCreditSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      tenant_entity_id INTEGER,
      balance NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id SERIAL PRIMARY KEY,
      credit_account_id INTEGER NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
      checkout_session_id VARCHAR(255),
      provider VARCHAR(50),
      provider_transaction_id VARCHAR(255),
      credits_delta NUMERIC(14,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
      status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
      bundle_id VARCHAR(100),
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_credit_txn_session ON credit_transactions (checkout_session_id);
    CREATE INDEX IF NOT EXISTS idx_credit_txn_account ON credit_transactions (credit_account_id);
  `);
}

function getCreditBundles() {
  try {
    const raw = process.env.CREDIT_BUNDLES_JSON;
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return DEFAULT_BUNDLES;
}

async function ensureCreditAccount(pool, { userId, tenantEntityId }) {
  await ensureCreditSchema(pool);
  const existing = await pool.query(
    `SELECT * FROM credit_accounts
     WHERE ($1::int IS NULL OR user_id = $1)
       AND ($2::int IS NULL OR tenant_entity_id = $2)
     ORDER BY id ASC LIMIT 1`,
    [userId || null, tenantEntityId || null]
  );
  if (existing.rows.length) return existing.rows[0];

  const created = await pool.query(
    `INSERT INTO credit_accounts (user_id, tenant_entity_id)
     VALUES ($1, $2)
     RETURNING *`,
    [userId || null, tenantEntityId || null]
  );
  return created.rows[0];
}

async function createPendingCreditPurchase(pool, {
  creditAccountId,
  bundleId,
  creditsDelta,
  amountPaid,
  currency,
  checkoutSessionId,
  provider,
  metadata,
}) {
  await ensureCreditSchema(pool);
  const result = await pool.query(
    `INSERT INTO credit_transactions
       (credit_account_id, checkout_session_id, provider, credits_delta, amount_paid, currency, status, bundle_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
     RETURNING *`,
    [
      creditAccountId,
      checkoutSessionId,
      provider,
      creditsDelta,
      amountPaid,
      currency || 'SAR',
      bundleId,
      JSON.stringify(metadata || {}),
    ]
  );
  return result.rows[0];
}

async function settleCreditPurchase(pool, checkoutSessionId, providerTransactionId) {
  await ensureCreditSchema(pool);
  const pending = await pool.query(
    `SELECT ct.*, ca.id AS account_id
     FROM credit_transactions ct
     JOIN credit_accounts ca ON ca.id = ct.credit_account_id
     WHERE ct.checkout_session_id = $1 AND ct.status = 'pending'
     ORDER BY ct.created_at DESC LIMIT 1`,
    [checkoutSessionId]
  );
  if (!pending.rows.length) return null;

  const tx = pending.rows[0];
  await pool.query(
    `UPDATE credit_transactions
     SET status = 'completed',
         provider_transaction_id = COALESCE($2, provider_transaction_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [tx.id, providerTransactionId || null]
  );

  await pool.query(
    `UPDATE credit_accounts
     SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [tx.credits_delta, tx.credit_account_id]
  );

  return tx;
}

async function getCreditBalance(pool, { userId, tenantEntityId }) {
  const account = await ensureCreditAccount(pool, { userId, tenantEntityId });
  return {
    accountId: account.id,
    balance: Number(account.balance) || 0,
    currency: account.currency || 'SAR',
  };
}

module.exports = {
  ensureCreditSchema,
  getCreditBundles,
  ensureCreditAccount,
  createPendingCreditPurchase,
  settleCreditPurchase,
  getCreditBalance,
};
