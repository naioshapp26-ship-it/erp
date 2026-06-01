-- Create tax_settings table for managing branch-specific tax rates
CREATE TABLE IF NOT EXISTS tax_settings (
    id SERIAL PRIMARY KEY,
    tax_code VARCHAR(100) UNIQUE NOT NULL,      -- e.g., 'vat_5', 'vat_15', 'corporate_tax'
    tax_name_ar VARCHAR(255) NOT NULL,           -- Arabic name: اسم الضريبة
    tax_name_en VARCHAR(255),                    -- English name (optional)
    description_ar TEXT,
    description_en TEXT,
    tax_type VARCHAR(50) NOT NULL DEFAULT 'VAT',    -- VAT, Income, Corporate, Custom
    
    -- Default tax rate
    default_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,  -- e.g., 15.00 for 15%
    
    -- Branch-specific rates
    branch_id INTEGER,                           -- NULL means applies to all branches
    branch_name_ar VARCHAR(255),                 -- Cached branch name for quick reference
    branch_specific_rate DECIMAL(5, 2),          -- Branch-specific override rate
    
    -- Configuration
    is_active BOOLEAN DEFAULT TRUE,
    applicable_on VARCHAR(100) DEFAULT 'invoice', -- invoice, product, service, all
    calculation_method VARCHAR(50) DEFAULT 'percentage', -- percentage, fixed_amount
    include_in_total BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,            -- Mark as default tax
    priority INTEGER DEFAULT 0,                  -- Order of calculation
    
    -- Additional settings
    min_amount DECIMAL(10, 2),                   -- Minimum amount to apply tax
    max_amount DECIMAL(10, 2),                   -- Maximum amount to apply tax
    
    -- Audit fields
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tax_settings_code ON tax_settings(tax_code);
CREATE INDEX IF NOT EXISTS idx_tax_settings_active ON tax_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_tax_settings_branch ON tax_settings(branch_id);
CREATE INDEX IF NOT EXISTS idx_tax_settings_type ON tax_settings(tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_settings_default ON tax_settings(is_default);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_tax_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tax_settings_timestamp ON tax_settings;
CREATE TRIGGER update_tax_settings_timestamp
    BEFORE UPDATE ON tax_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_tax_settings_updated_at();

-- Insert default tax settings (global rates for all branches)
INSERT INTO tax_settings (tax_code, tax_name_ar, tax_name_en, description_ar, description_en, tax_type, default_rate, applicable_on, is_active, is_default, priority) VALUES
('vat_15', 'ضريبة القيمة المضافة 15%', 'VAT 15%', 'ضريبة القيمة المضافة للسلع والخدمات', 'Value Added Tax on goods and services', 'VAT', 15.00, 'invoice', true, true, 1),
('vat_5', 'ضريبة القيمة المضافة 5%', 'VAT 5%', 'ضريبة القيمة المضافة على الخدمات المالية', 'VAT on financial services', 'VAT', 5.00, 'service', true, false, 2),
('corporate_tax', 'ضريبة الدخل للشركات', 'Corporate Income Tax', 'ضريبة الدخل على الشركات', 'Corporate income tax', 'Income', 20.00, 'all', false, false, 3),
('stamp_tax', 'الرسم الإداري', 'Administrative Fee', 'الرسم الإداري على العقود والمستندات', 'Administrative fee on contracts', 'Custom', 2.50, 'invoice', false, false, 4),
('municipal_tax', 'الرسم البلدي', 'Municipal Tax', 'الرسم البلدي والخدمات', 'Municipal services tax', 'Custom', 1.00, 'all', false, false, 5),
('withholding_tax', 'ضريبة الخصم من المصدر', 'Withholding Tax', 'ضريبة الخصم من المصدر', 'Withholding tax', 'Income', 5.00, 'all', false, false, 6)
ON CONFLICT (tax_code) DO NOTHING;

-- Create view for active tax settings by branch
CREATE OR REPLACE VIEW active_tax_settings AS
SELECT 
    t.id,
    t.tax_code,
    t.tax_name_ar,
    t.tax_name_en,
    t.tax_type,
    t.default_rate,
    COALESCE(t.branch_specific_rate, t.default_rate) as applicable_rate,
    t.branch_id,
    t.branch_name_ar,
    t.applicable_on,
    t.calculation_method,
    t.priority
FROM tax_settings t
WHERE t.is_active = TRUE
ORDER BY t.branch_id DESC NULLS FIRST, t.priority, t.tax_name_ar;

-- Create view for branch-specific tax rates
CREATE OR REPLACE VIEW branch_tax_overrides AS
SELECT 
    t.id,
    t.tax_code,
    t.tax_name_ar,
    t.branch_id,
    t.branch_name_ar,
    t.default_rate,
    t.branch_specific_rate,
    (t.branch_specific_rate - t.default_rate) as rate_difference,
    t.is_active
FROM tax_settings t
WHERE t.branch_id IS NOT NULL
  AND t.branch_specific_rate IS NOT NULL
ORDER BY t.branch_id, t.tax_name_ar;
