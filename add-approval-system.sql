-- ========================================
-- NAYOSH ERP - Financial Approval System
-- ========================================

-- Create approval_workflows table
CREATE TABLE IF NOT EXISTS approval_workflows (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'TRANSACTION', 'PAYMENT'
    item_id VARCHAR(50) NOT NULL,
    item_title VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    current_level INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW')),
    created_by INTEGER REFERENCES users(id),
    created_by_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create approval_steps table
CREATE TABLE IF NOT EXISTS approval_steps (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_level INTEGER NOT NULL,
    approver_role VARCHAR(50) NOT NULL, -- 'ACCOUNTANT', 'FINANCE_MANAGER', 'CFO'
    approver_id INTEGER REFERENCES users(id),
    approver_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
    decision_date TIMESTAMP,
    comments TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'APPROVAL_REQUEST', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'SYSTEM'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_type VARCHAR(50), -- 'WORKFLOW', 'INVOICE', 'TRANSACTION'
    link_id VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_approval_workflows_entity_id ON approval_workflows(entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_status ON approval_workflows(status);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_item ON approval_workflows(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_workflow_id ON approval_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver_id ON approval_steps(approver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Add approval-related columns to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_workflow_id INTEGER REFERENCES approval_workflows(id),
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'NOT_REQUIRED' CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));

-- Add approval-related columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_workflow_id INTEGER REFERENCES approval_workflows(id),
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'NOT_REQUIRED' CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));

-- Insert sample approval workflow
INSERT INTO approval_workflows (entity_id, item_type, item_id, item_title, amount, current_level, status, created_by, created_by_name)
VALUES 
('BR015', 'INVOICE', 'INV-1005', 'فاتورة خدمات تقنية - ديسمبر', 15000.00, 1, 'PENDING', 2, 'سارة محمد'),
('INC03', 'PAYMENT', 'PAY-2001', 'دفعة شراء معدات', 50000.00, 2, 'IN_REVIEW', 3, 'د. خالد الزهراني');

-- Insert sample approval steps
INSERT INTO approval_steps (workflow_id, step_level, approver_role, approver_id, approver_name, status, comments)
VALUES 
(1, 1, 'ACCOUNTANT', 6, 'أ. منى المالية', 'APPROVED', 'تمت المراجعة - البيانات صحيحة'),
(1, 2, 'FINANCE_MANAGER', 6, 'أ. منى المالية', 'PENDING', NULL),
(2, 1, 'ACCOUNTANT', 6, 'أ. منى المالية', 'APPROVED', 'معتمد'),
(2, 2, 'FINANCE_MANAGER', 6, 'أ. منى المالية', 'APPROVED', 'موافق على الدفعة'),
(2, 3, 'CFO', 1, 'م. أحمد العلي', 'PENDING', NULL);

-- Insert sample notifications
INSERT INTO notifications (user_id, entity_id, type, title, message, link_type, link_id, priority)
VALUES 
(6, 'BR015', 'APPROVAL_REQUEST', 'طلب موافقة على فاتورة جديدة', 'يرجى مراجعة واعتماد فاتورة خدمات تقنية - ديسمبر بقيمة 15,000 ريال', 'WORKFLOW', '1', 'HIGH'),
(1, 'HQ001', 'APPROVAL_REQUEST', 'طلب موافقة نهائية - دفعة معدات', 'يتطلب اعتماد CFO لدفعة شراء معدات بقيمة 50,000 ريال', 'WORKFLOW', '2', 'URGENT'),
(3, 'INC03', 'APPROVAL_APPROVED', 'تمت الموافقة على طلبك', 'تمت الموافقة على دفعة شراء معدات من قبل المدير المالي', 'WORKFLOW', '2', 'NORMAL');

-- Success message
SELECT 'تم إضافة نظام الموافقات المالية بنجاح! ✅' AS message;
