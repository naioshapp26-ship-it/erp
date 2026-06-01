-- Ensure payroll settlements table exists for finance payroll module
CREATE TABLE IF NOT EXISTS finance_payroll_settlements (
    settlement_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES finance_payroll_employees(employee_id) ON DELETE CASCADE,
    settlement_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT',
    payroll_run_id INTEGER REFERENCES finance_payroll_runs(run_id),
    entity_type VARCHAR(20),
    entity_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_settlements_employee ON finance_payroll_settlements(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_status ON finance_payroll_settlements(status);
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_run ON finance_payroll_settlements(payroll_run_id);
