-- Create employee_requests table for all types of employee requests
CREATE TABLE IF NOT EXISTS employee_requests (
    id VARCHAR(50) PRIMARY KEY,
    entity_id VARCHAR(20) REFERENCES entities(id) ON DELETE CASCADE,
    employee_id VARCHAR(50),
    employee_name VARCHAR(255) NOT NULL,
    request_type VARCHAR(100) NOT NULL,
    request_title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    
    -- Request-specific data (JSON format for flexibility)
    request_data JSONB,
    
    -- Approval workflow
    requires_approval BOOLEAN DEFAULT TRUE,
    approver_id VARCHAR(50),
    approver_name VARCHAR(255),
    approval_date TIMESTAMP,
    approval_notes TEXT,
    
    -- Dates
    requested_date DATE NOT NULL,
    start_date DATE,
    end_date DATE,
    completion_date DATE,
    
    -- Attachments and notes
    attachments TEXT[], -- Array of attachment URLs/paths
    notes TEXT,
    
    -- Audit fields
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexing for better performance
    CONSTRAINT check_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_employee_requests_entity ON employee_requests(entity_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_employee ON employee_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON employee_requests(status);
CREATE INDEX IF NOT EXISTS idx_employee_requests_type ON employee_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_employee_requests_date ON employee_requests(requested_date);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_employee_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_employee_requests_timestamp ON employee_requests;
CREATE TRIGGER update_employee_requests_timestamp
    BEFORE UPDATE ON employee_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_requests_updated_at();

-- Create view for request statistics
CREATE OR REPLACE VIEW employee_requests_stats AS
SELECT 
    entity_id,
    request_type,
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_count,
    COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_count
FROM employee_requests
GROUP BY entity_id, request_type, status;
