-- Create payment_methods table for managing payment methods dynamically
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    method_code VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'bank_transfer', 'cash', 'credit_card'
    method_name_ar VARCHAR(255) NOT NULL,       -- Arabic name
    method_name_en VARCHAR(255),                 -- English name (optional)
    description_ar TEXT,
    description_en TEXT,
    icon VARCHAR(100),                          -- Emoji or icon class
    color VARCHAR(50) DEFAULT '#3b82f6',        -- Border/theme color
    is_active BOOLEAN DEFAULT TRUE,
    requires_bank_details BOOLEAN DEFAULT FALSE,
    requires_card_details BOOLEAN DEFAULT FALSE,
    processing_fee_percentage DECIMAL(5, 2) DEFAULT 0.00,
    processing_fee_fixed DECIMAL(10, 2) DEFAULT 0.00,
    min_amount DECIMAL(10, 2),
    max_amount DECIMAL(10, 2),
    display_order INTEGER DEFAULT 0,
    
    -- Audit fields
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_code ON payment_methods(method_code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_order ON payment_methods(display_order);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_payment_methods_timestamp ON payment_methods;
CREATE TRIGGER update_payment_methods_timestamp
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_methods_updated_at();

-- Insert default payment methods
INSERT INTO payment_methods (method_code, method_name_ar, method_name_en, description_ar, description_en, icon, color, display_order, requires_bank_details) VALUES
('bank_transfer', 'تحويل بنكي', 'Bank Transfer', 'تحويل مباشر من حسابك البنكي', 'Direct transfer from your bank account', '🏦', '#3b82f6', 1, true),
('cash', 'دفع نقداً', 'Cash Payment', 'دفع فوري في أحد فروعنا', 'Instant payment at our branches', '💰', '#10b981', 2, false),
('credit_card', 'بطاقة ائتمان', 'Credit Card', 'بطاقات فيزا وماستركارد', 'Visa and Mastercard', '💳', '#a855f7', 3, false),
('debit_card', 'بطاقة مدى', 'Debit Card', 'بطاقة مدى السعودية', 'Saudi Mada Card', '💳', '#f59e0b', 4, false),
('wallet', 'محفظة إلكترونية', 'Digital Wallet', 'STC Pay, Apple Pay, Google Pay', 'Digital wallet payment', '📱', '#ec4899', 5, false),
('cheque', 'شيك', 'Cheque', 'شيك بنكي معتمد', 'Certified bank cheque', '📝', '#6366f1', 6, true)
ON CONFLICT (method_code) DO NOTHING;

-- Create view for active payment methods
CREATE OR REPLACE VIEW active_payment_methods AS
SELECT * FROM payment_methods
WHERE is_active = TRUE
ORDER BY display_order, method_name_ar;

COMMENT ON TABLE payment_methods IS 'جدول طرق الدفع - يسمح بإدارة وإضافة طرق دفع جديدة ديناميكياً';
