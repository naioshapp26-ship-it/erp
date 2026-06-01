-- Ensure sales settlements table exists for finance sales module
CREATE TABLE IF NOT EXISTS finance_sales_settlements (
    settlement_id SERIAL PRIMARY KEY,
    settlement_number VARCHAR(50) UNIQUE NOT NULL,
    period_label TEXT,
    channel TEXT,
    gross_amount DECIMAL(15,2) DEFAULT 0,
    fees_amount DECIMAL(15,2) DEFAULT 0,
    refunds_amount DECIMAL(15,2) DEFAULT 0,
    collected_amount DECIMAL(15,2) DEFAULT 0,
    variance_amount DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'مفتوح',
    risk_level VARCHAR(20) DEFAULT 'منخفض',
    owner_name TEXT,
    customer_name TEXT,
    priority_level VARCHAR(20),
    cycle_days INTEGER DEFAULT 0,
    last_update DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    branch_id VARCHAR(50),
    incubator_id VARCHAR(50),
    platform_id VARCHAR(50),
    office_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_entity ON finance_sales_settlements(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_status ON finance_sales_settlements(status);
CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_channel ON finance_sales_settlements(channel);
CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_owner ON finance_sales_settlements(owner_name);
CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_last_update ON finance_sales_settlements(last_update);
