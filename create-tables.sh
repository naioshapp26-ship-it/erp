#!/bin/bash

export PGPASSWORD='PddzJpAQYezqknsntSzmCUlQYuYJldcT'

echo "🚀 إنشاء جداول التدفقات النقدية على Railway..."

psql -h crossover.proxy.rlwy.net -p 44255 -U postgres -d railway << 'EOF'
-- التدفقات التشغيلية
DROP TABLE IF EXISTS finance_cashflow_operating CASCADE;
CREATE TABLE finance_cashflow_operating (
    flow_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL,
    flow_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    flow_date DATE NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- التدفقات الاستثمارية
DROP TABLE IF EXISTS finance_cashflow_investing CASCADE;
CREATE TABLE finance_cashflow_investing (
    flow_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL,
    flow_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    flow_date DATE NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- التدفقات التمويلية
DROP TABLE IF EXISTS finance_cashflow_financing CASCADE;
CREATE TABLE finance_cashflow_financing (
    flow_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL,
    flow_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    flow_date DATE NOT NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- التوقعات الذكية
DROP TABLE IF NOT EXISTS finance_ai_forecasts CASCADE;
CREATE TABLE finance_ai_forecasts (
    forecast_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL,
    forecast_period VARCHAR(100) NOT NULL,
    forecast_type VARCHAR(50) NOT NULL,
    forecast_amount DECIMAL(15,2) NOT NULL,
    confidence_level DECIMAL(5,4),
    ai_model VARCHAR(100),
    ai_insights JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

\dt finance*
EOF

echo "✅ تم إنشاء الجداول"
