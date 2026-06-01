ALTER TABLE finance_customers
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS website VARCHAR(200),
    ADD COLUMN IF NOT EXISTS email_secondary VARCHAR(200),
    ADD COLUMN IF NOT EXISTS mobile_secondary VARCHAR(50),
    ADD COLUMN IF NOT EXISTS shipping_copy_billing BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS shipping_street_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_region VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20);
