const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function createRequestsTable() {
  try {
    console.log('\n🔄 Creating employee_requests table...\n');
    
    // Create table
    await pool.query(`
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
          request_data JSONB,
          requires_approval BOOLEAN DEFAULT TRUE,
          approver_id VARCHAR(50),
          approver_name VARCHAR(255),
          approval_date TIMESTAMP,
          approval_notes TEXT,
          requested_date DATE NOT NULL,
          start_date DATE,
          end_date DATE,
          completion_date DATE,
          attachments TEXT[],
          notes TEXT,
          created_by VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_dates CHECK (end_date IS NULL OR end_date >= start_date)
      )
    `);
    
    console.log('✅ Table employee_requests created successfully');
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_requests_entity ON employee_requests(entity_id);
      CREATE INDEX IF NOT EXISTS idx_employee_requests_employee ON employee_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON employee_requests(status);
      CREATE INDEX IF NOT EXISTS idx_employee_requests_type ON employee_requests(request_type);
      CREATE INDEX IF NOT EXISTS idx_employee_requests_date ON employee_requests(requested_date);
    `);
    
    console.log('✅ Indexes created successfully');
    
    // Verify table exists
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'employee_requests'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table columns:');
    result.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });
    
    await pool.end();
    console.log('\n✅ Employee requests table setup completed!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createRequestsTable();
