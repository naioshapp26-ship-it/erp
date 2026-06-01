-- ========================================
-- جداول التدفقات النقدية - Cashflow Tables
-- ========================================

-- 1. التدفقات التشغيلية (Operating Cashflow)
CREATE TABLE IF NOT EXISTS finance_cashflow_operating (
    flow_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL,
    flow_type VARCHAR(50) NOT NULL, -- customer_collection, supplier_payment, salary_payment, other_operating
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    flow_date DATE NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cashflow_operating_entity ON finance_cashflow_operating(entity_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_operating_date ON finance_cashflow_operating(flow_date);

-- 2. التدفقات الاستثمارية (Investing Cashflow)
CREATE TABLE IF NOT EXISTS finance_cashflow_investing (
    flow_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL,
    flow_type VARCHAR(50) NOT NULL, -- asset_purchase, asset_sale, investment, other_investing
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    flow_date DATE NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cashflow_investing_entity ON finance_cashflow_investing(entity_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_investing_date ON finance_cashflow_investing(flow_date);

-- 3. التدفقات التمويلية (Financing Cashflow)
CREATE TABLE IF NOT EXISTS finance_cashflow_financing (
    flow_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL,
    flow_type VARCHAR(50) NOT NULL, -- loan_received, loan_payment, capital_injection, dividend_payment
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    flow_date DATE NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cashflow_financing_entity ON finance_cashflow_financing(entity_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_financing_date ON finance_cashflow_financing(flow_date);

-- 4. توقعات الذكاء الاصطناعي (AI Forecasts)
CREATE TABLE IF NOT EXISTS finance_ai_forecasts (
    forecast_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL,
    forecast_period VARCHAR(100) NOT NULL, -- 'يناير 2026', 'Q1 2026', etc.
    forecast_type VARCHAR(50) NOT NULL, -- surplus, deficit
    forecast_amount DECIMAL(15,2) NOT NULL,
    confidence_level DECIMAL(5,4), -- 0.0 - 1.0
    ai_model VARCHAR(100),
    ai_insights JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_forecasts_entity ON finance_ai_forecasts(entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_period ON finance_ai_forecasts(forecast_period);
