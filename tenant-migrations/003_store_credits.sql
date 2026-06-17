-- Migration 003: Store cart/orders + credit billing tables
-- يُطبَّق على قواعد بيانات المستأجرين

CREATE TABLE IF NOT EXISTS store_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
  payment_method VARCHAR(20) NOT NULL DEFAULT 'card',
  payment_status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_provider VARCHAR(50),
  shipping_address TEXT,
  shipping_city VARCHAR(100),
  shipping_country VARCHAR(100),
  shipping_phone VARCHAR(50),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  product_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, product_id)
);

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

CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items (user_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_user ON store_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_session ON credit_transactions (checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_account ON credit_transactions (credit_account_id);
