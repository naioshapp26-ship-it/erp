const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function updateInvoicesTable() {
  try {
    console.log('\n🔄 Updating invoices table schema...\n');
    
    // Add customer columns
    await pool.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255)
    `);
    
    console.log('✅ Successfully added customer information columns');
    
    // Verify columns
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'invoices'
      AND column_name IN ('customer_name', 'customer_number', 'customer_phone', 'customer_email', 'payment_method')
      ORDER BY column_name
    `);
    
    console.log('\n📋 New columns added:');
    result.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });
    
    await pool.end();
    console.log('\n✅ Schema update completed successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

updateInvoicesTable();
