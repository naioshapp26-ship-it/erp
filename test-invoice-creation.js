const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: { rejectUnauthorized: false }
});

async function testInvoiceCreation() {
  try {
    console.log('\n🧪 Testing Invoice Creation\n');
    console.log('=' .repeat(60));
    
    // Test 1: Check invoices table columns
    console.log('\n📌 Test 1: Verify Invoice Table Columns');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'invoices'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = [
      'id', 'entity_id', 'type', 'title', 'amount', 'paid_amount', 
      'status', 'issue_date', 'due_date', 'customer_name', 
      'customer_number', 'customer_phone', 'customer_email', 'payment_method'
    ];
    
    const existingColumns = columnsResult.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`❌ FAILED - Missing columns: ${missingColumns.join(', ')}`);
      await pool.end();
      process.exit(1);
    }
    
    console.log('✅ PASSED - All required columns exist');
    console.log('   Columns:', existingColumns.join(', '));
    
    // Test 2: Try creating a test invoice
    console.log('\n📌 Test 2: Create Test Invoice');
    const testInvoice = {
      id: `TEST-INV-${Date.now()}`,
      entity_id: 'HQ001',
      type: 'SERVICE',
      title: 'Test Invoice - Auto Generated',
      amount: 1000.00,
      paid_amount: 0,
      status: 'UNPAID',
      issue_date: '2026-01-14',
      due_date: '2026-02-14',
      customer_name: 'Test Customer',
      customer_number: 'CUST-001',
      customer_phone: '+966501234567',
      customer_email: 'test@example.com',
      payment_method: 'تحويل بنكي - البنك الأهلي'
    };
    
    const insertResult = await pool.query(`
      INSERT INTO invoices (
        id, entity_id, type, title, amount, paid_amount, status,
        issue_date, due_date, customer_name, customer_number,
        customer_phone, customer_email, payment_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      testInvoice.id,
      testInvoice.entity_id,
      testInvoice.type,
      testInvoice.title,
      testInvoice.amount,
      testInvoice.paid_amount,
      testInvoice.status,
      testInvoice.issue_date,
      testInvoice.due_date,
      testInvoice.customer_name,
      testInvoice.customer_number,
      testInvoice.customer_phone,
      testInvoice.customer_email,
      testInvoice.payment_method
    ]);
    
    console.log('✅ PASSED - Test invoice created successfully');
    console.log(`   Invoice ID: ${insertResult.rows[0].id}`);
    console.log(`   Customer: ${insertResult.rows[0].customer_name}`);
    console.log(`   Payment Method: ${insertResult.rows[0].payment_method}`);
    
    // Test 3: Verify invoice can be retrieved
    console.log('\n📌 Test 3: Retrieve Test Invoice');
    const selectResult = await pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [testInvoice.id]
    );
    
    if (selectResult.rows.length === 0) {
      console.log('❌ FAILED - Invoice not found');
      await pool.end();
      process.exit(1);
    }
    
    console.log('✅ PASSED - Invoice retrieved successfully');
    
    // Test 4: Cleanup - Delete test invoice
    console.log('\n📌 Test 4: Cleanup Test Data');
    await pool.query('DELETE FROM invoices WHERE id = $1', [testInvoice.id]);
    console.log('✅ PASSED - Test invoice deleted');
    
    await pool.end();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Passed: 4');
    console.log('❌ Failed: 0');
    console.log('📈 Total:  4');
    console.log('🎯 Success Rate: 100.0%');
    console.log('\n🎉 All invoice creation tests passed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

testInvoiceCreation();
