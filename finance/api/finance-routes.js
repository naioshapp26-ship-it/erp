const express = require('express');
const router = express.Router();
const db = require('../../db');

// ========================================
// Helper Functions
// ========================================

// Entity Filter Helper
const getEntityFilter = (userEntity, tableAlias = '') => {
  const alias = tableAlias ? `${tableAlias}.` : '';
  
  if (userEntity.type === 'HQ') {
    return '1=1';
  } else if (userEntity.type === 'BRANCH') {
    return `${alias}branch_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  } else if (userEntity.type === 'INCUBATOR') {
    return `${alias}incubator_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  } else if (userEntity.type === 'PLATFORM') {
    return `${alias}platform_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  } else if (userEntity.type === 'OFFICE') {
    return `${alias}office_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  }
  
  return `${alias}entity_id = '${userEntity.id}'`;
};

// Generate Next Number Helper (tolerant to mixed formats like JE-<timestamp>-xyz)
const generateNextNumber = async (prefix, table, column) => {
  const result = await db.query(
    `SELECT ${column} FROM ${table} WHERE ${column} LIKE $1 ORDER BY ${column} DESC LIMIT 1`,
    [`${prefix}%`]
  );

  const lastNumber = result.rows[0]?.[column] || '';
  const numericMatches = String(lastNumber).match(/\d+/g) || [];
  const lastNumeric = numericMatches.length ? parseInt(numericMatches[numericMatches.length - 1], 10) || 0 : 0;
  const nextNum = lastNumeric + 1;
  const separator = prefix.endsWith('-') ? '' : '-';
  const padded = nextNum < 10000 ? nextNum.toString().padStart(4, '0') : String(nextNum);

  return `${prefix}${separator}${padded}`;
};

const ensureSalesSettlementsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS finance_sales_settlements (
        settlement_id SERIAL PRIMARY KEY,
        settlement_number VARCHAR(50) UNIQUE NOT NULL,
        period_label TEXT,
        channel TEXT,
        gross_amount DECIMAL(15,2) DEFAULT 0,
        fees_amount DECIMAL(15,2) DEFAULT 0,
        refunds_amount DECIMAL(15,2) DEFAULT 0,
        collected_amount DECIMAL(15,2) DEFAULT 0,
        variance_amount DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'مفتوح',
        risk_level VARCHAR(20) DEFAULT 'منخفض',
        owner_name TEXT,
        customer_name TEXT,
        priority_level VARCHAR(20),
        cycle_days INTEGER DEFAULT 0,
        last_update DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        entity_type VARCHAR(20),
        entity_id VARCHAR(50),
        branch_id VARCHAR(50),
        incubator_id VARCHAR(50),
        platform_id VARCHAR(50),
        office_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_entity ON finance_sales_settlements(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_status ON finance_sales_settlements(status);
      CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_channel ON finance_sales_settlements(channel);
      CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_owner ON finance_sales_settlements(owner_name);
      CREATE INDEX IF NOT EXISTS idx_fin_sales_settlements_last_update ON finance_sales_settlements(last_update);
    `);
  } catch (error) {
    console.error('Error ensuring finance_sales_settlements table:', error);
  }
};

ensureSalesSettlementsTable();

// ========================================
// CHART OF ACCOUNTS APIs
// ========================================

// Get all accounts (with hierarchy)
router.get('/accounts', async (req, res) => {
  try {
    const userEntity = req.userEntity || { type: 'HQ', id: 'HQ001' };
    const { type, parent_id, level, active_only } = req.query;
    
    let query = `
      SELECT 
        a.*,
        p.account_name_ar as parent_name,
        (SELECT COUNT(*) FROM finance_accounts WHERE parent_account_id = a.account_id) as children_count
      FROM finance_accounts a
      LEFT JOIN finance_accounts p ON a.parent_account_id = p.account_id
      WHERE ${getEntityFilter(userEntity, 'a')}
    `;
    
    const params = [];
    
    if (type) {
      params.push(type);
      query += ` AND a.account_type = $${params.length}`;
    }
    
    if (parent_id) {
      params.push(parent_id);
      query += ` AND a.parent_account_id = $${params.length}`;
    }
    
    if (level) {
      params.push(level);
      query += ` AND a.level = $${params.length}`;
    }
    
    if (active_only === 'true') {
      query += ` AND a.is_active = true`;
    }
    
    query += ` ORDER BY a.account_code`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      accounts: result.rows
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get account by ID with balance
router.get('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const accountResult = await db.query(
      'SELECT * FROM finance_accounts WHERE account_id = $1',
      [id]
    );
    
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    const account = accountResult.rows[0];
    
    // Get balance
    const balanceResult = await db.query(
      `SELECT * FROM finance_account_balances WHERE account_id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      account: account,
      balance: balanceResult.rows[0] || { balance: 0, total_debit: 0, total_credit: 0 }
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new account
router.post('/accounts', async (req, res) => {
  try {
    const {
      account_code,
      account_name_ar,
      account_name_en,
      account_type,
      parent_account_id,
      level,
      is_header,
      normal_balance,
      description,
      entity_type,
      entity_id,
      branch_id,
      incubator_id
    } = req.body;
    
    const result = await db.query(
      `INSERT INTO finance_accounts 
       (account_code, account_name_ar, account_name_en, account_type, parent_account_id, 
        level, is_header, normal_balance, description, entity_type, entity_id, branch_id, incubator_id,
        created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [account_code, account_name_ar, account_name_en, account_type, parent_account_id,
       level, is_header, normal_balance, description, entity_type, entity_id, branch_id, incubator_id,
       req.headers['x-user-id'] || 'system']
    );
    
    res.status(201).json({
      success: true,
      account: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// JOURNAL ENTRIES APIs
// ========================================

// Get all journal entries
router.get('/journal-entries', async (req, res) => {
  try {
    const userEntity = req.userEntity || { type: 'HQ', id: 'HQ001' };
    const { status, from_date, to_date, type, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        je.*,
        COUNT(jl.line_id) as lines_count,
        SUM(jl.debit_amount) as total_debit,
        SUM(jl.credit_amount) as total_credit
      FROM finance_journal_entries je
      LEFT JOIN finance_journal_lines jl ON je.entry_id = jl.entry_id
      WHERE ${getEntityFilter(userEntity, 'je')}
    `;
    
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND je.status = $${params.length}`;
    }
    
    if (from_date) {
      params.push(from_date);
      query += ` AND je.entry_date >= $${params.length}`;
    }
    
    if (to_date) {
      params.push(to_date);
      query += ` AND je.entry_date <= $${params.length}`;
    }
    
    if (type) {
      params.push(type);
      query += ` AND je.entry_type = $${params.length}`;
    }
    
    query += ` GROUP BY je.entry_id ORDER BY je.entry_date DESC, je.entry_number DESC`;
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      entries: result.rows
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get journal entry by ID with lines
router.get('/journal-entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const entryResult = await db.query(
      'SELECT * FROM finance_journal_entries WHERE entry_id = $1',
      [id]
    );
    
    if (entryResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Journal entry not found' });
    }
    
    const linesResult = await db.query(
      `SELECT 
        jl.*,
        a.account_name_ar,
        a.account_type
       FROM finance_journal_lines jl
       JOIN finance_accounts a ON jl.account_id = a.account_id
       WHERE jl.entry_id = $1
       ORDER BY jl.line_number`,
      [id]
    );
    
    res.json({
      success: true,
      entry: entryResult.rows[0],
      lines: linesResult.rows
    });
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new journal entry
router.post('/journal-entries', async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      entry_date,
      entry_type = 'MANUAL',
      description,
      reference_number,
      reference_type,
      reference_id,
      entity_type,
      entity_id,
      branch_id,
      incubator_id,
      platform_id,
      fiscal_year,
      fiscal_period,
      lines = []
    } = req.body;
    
    // Validate: Total debits must equal total credits
    const totalDebit = lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Total debits must equal total credits',
        totalDebit,
        totalCredit
      });
    }
    
    // Generate entry number
    const entry_number = await generateNextNumber('JE', 'finance_journal_entries', 'entry_number');
    
    // Create journal entry
    const entryResult = await client.query(
      `INSERT INTO finance_journal_entries 
       (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
        entity_type, entity_id, branch_id, incubator_id, platform_id, fiscal_year, fiscal_period,
        status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'DRAFT', $15)
       RETURNING *`,
      [entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
       entity_type, entity_id, branch_id, incubator_id, platform_id, fiscal_year, fiscal_period,
       req.headers['x-user-id'] || 'system']
    );
    
    const entry_id = entryResult.rows[0].entry_id;
    
    // Create journal lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      await client.query(
        `INSERT INTO finance_journal_lines 
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description,
          entity_type, entity_id, branch_id, incubator_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [entry_id, i + 1, line.account_id, line.account_code, 
         line.debit_amount || 0, line.credit_amount || 0, line.description,
         entity_type, entity_id, branch_id, incubator_id]
      );
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      entry: entryResult.rows[0],
      message: 'Journal entry created successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating journal entry:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Post journal entry (make it permanent)
router.post('/journal-entries/:id/post', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE finance_journal_entries 
       SET status = 'POSTED', is_posted = true, posted_at = NOW(), posted_by = $1
       WHERE entry_id = $2 AND status = 'DRAFT'
       RETURNING *`,
      [req.headers['x-user-id'] || 'system', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Journal entry not found or already posted' 
      });
    }
    
    res.json({
      success: true,
      entry: result.rows[0],
      message: 'Journal entry posted successfully'
    });
  } catch (error) {
    console.error('Error posting journal entry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// INVOICES APIs
// ========================================

// Get all invoices
router.get('/invoices', async (req, res) => {
  try {
    const userEntity = req.userEntity || { type: 'HQ', id: 'HQ001' };
    const { status, customer_id, from_date, to_date, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        i.*,
        c.customer_name_ar,
        c.customer_code,
        c.risk_level
      FROM finance_invoices i
      JOIN finance_customers c ON i.customer_id = c.customer_id
      WHERE ${getEntityFilter(userEntity, 'i')}
    `;
    
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND i.status = $${params.length}`;
    }
    
    if (customer_id) {
      params.push(customer_id);
      query += ` AND i.customer_id = $${params.length}`;
    }
    
    if (from_date) {
      params.push(from_date);
      query += ` AND i.invoice_date >= $${params.length}`;
    }
    
    if (to_date) {
      params.push(to_date);
      query += ` AND i.invoice_date <= $${params.length}`;
    }
    
    query += ` ORDER BY i.invoice_date DESC, i.invoice_number DESC`;
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      invoices: result.rows
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invoice by ID with lines
router.get('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoiceResult = await db.query(
      `SELECT 
        i.*,
        c.customer_name_ar,
        c.customer_code,
        c.email,
        c.phone,
        c.address,
        c.tax_number,
        c.risk_level
       FROM finance_invoices i
       JOIN finance_customers c ON i.customer_id = c.customer_id
       WHERE i.invoice_id = $1`,
      [id]
    );
    
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    
    const linesResult = await db.query(
      `SELECT * FROM finance_invoice_lines WHERE invoice_id = $1 ORDER BY line_number`,
      [id]
    );
    
    const paymentsResult = await db.query(
      `SELECT 
        p.*,
        pa.allocated_amount
       FROM finance_payments p
       JOIN finance_payment_allocations pa ON p.payment_id = pa.payment_id
       WHERE pa.invoice_id = $1
       ORDER BY p.payment_date DESC`,
      [id]
    );
    
    res.json({
      success: true,
      invoice: invoiceResult.rows[0],
      lines: linesResult.rows,
      payments: paymentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update invoice
router.put('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'invoice_number', 'invoice_date', 'due_date', 'customer_id', 'customer_name',
      'subtotal', 'tax_amount', 'discount_amount', 'total_amount', 'paid_amount', 'remaining_amount',
      'status', 'payment_status', 'notes', 'program_id', 'service_id', 'entity_type', 'entity_id',
      'branch_id', 'incubator_id', 'platform_id', 'payment_terms', 'payment_term_days',
      'street_name', 'postal_code', 'building_number', 'city', 'district', 'national_address_number', 'short_address'
    ];

    const payload = req.body || {};
    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (field in payload) {
        setClauses.push(`${field} = COALESCE($${idx}, ${field})`);
        values.push(payload[field]);
        idx += 1;
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await db.query(
      `UPDATE finance_invoices
       SET ${setClauses.join(', ')}
       WHERE invoice_id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({ success: true, invoice: result.rows[0] });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete invoice
router.delete('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM finance_payment_allocations WHERE invoice_id = $1', [id]);
    await db.query('DELETE FROM finance_payment_plans WHERE invoice_id = $1', [id]);
    await db.query('DELETE FROM finance_invoice_lines WHERE invoice_id = $1', [id]);
    const result = await db.query('DELETE FROM finance_invoices WHERE invoice_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({ success: true, invoice: result.rows[0] });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new invoice
router.post('/invoices', async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      customer_id,
      invoice_date,
      due_date,
      program_id,
      service_id,
      street_name,
      postal_code,
      building_number,
      city,
      district,
      national_address_number,
      short_address,
      entity_type,
      entity_id,
      branch_id,
      incubator_id,
      platform_id,
      allow_partial_payment = true,
      allow_installments = false,
      notes,
      lines = []
    } = req.body;
    
    // Get customer info
    const customerResult = await client.query(
      'SELECT * FROM finance_customers WHERE customer_id = $1',
      [customer_id]
    );
    
    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const customer = customerResult.rows[0];
    
    // Calculate totals
    let subtotal = 0;
    let tax_amount = 0;
    let discount_amount = 0;
    
    for (const line of lines) {
      const lineSubtotal = line.quantity * line.unit_price;
      const lineDiscount = line.discount_amount || (lineSubtotal * (line.discount_percentage || 0) / 100);
      const lineTaxable = lineSubtotal - lineDiscount;
      const lineTax = lineTaxable * (line.tax_percentage || 15) / 100;
      
      subtotal += lineSubtotal;
      discount_amount += lineDiscount;
      tax_amount += lineTax;
    }
    
    const total_amount = subtotal - discount_amount + tax_amount;
    
    // Generate invoice number
    const invoice_number = await generateNextNumber('INV', 'finance_invoices', 'invoice_number');
    
    // Create invoice
    const invoiceResult = await client.query(
      `INSERT INTO finance_invoices 
       (invoice_number, invoice_date, due_date, customer_id, customer_name,
        subtotal, tax_amount, discount_amount, total_amount, remaining_amount,
        program_id, service_id, entity_type, entity_id, branch_id, incubator_id, platform_id,
        allow_partial_payment, allow_installments, notes, status, payment_status, created_by,
        street_name, postal_code, building_number, city, district, national_address_number, short_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'ISSUED', 'UNPAID', $21, $22, $23, $24, $25, $26, $27, $28)
       RETURNING *`,
      [invoice_number, invoice_date, due_date, customer_id, customer.customer_name_ar,
       subtotal, tax_amount, discount_amount, total_amount, total_amount,
       program_id, service_id, entity_type, entity_id, branch_id, incubator_id, platform_id,
       allow_partial_payment, allow_installments, notes,
       req.headers['x-user-id'] || 'system',
       street_name || null,
       postal_code || null,
       building_number || null,
       city || null,
       district || null,
       national_address_number || null,
       short_address || null]
    );
    
    const invoice_id = invoiceResult.rows[0].invoice_id;
    
    // Create invoice lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSubtotal = line.quantity * line.unit_price;
      const lineDiscount = line.discount_amount || (lineSubtotal * (line.discount_percentage || 0) / 100);
      const lineTaxable = lineSubtotal - lineDiscount;
      const lineTax = lineTaxable * (line.tax_percentage || 15) / 100;
      const lineTotal = lineTaxable + lineTax;
      
      await client.query(
        `INSERT INTO finance_invoice_lines 
         (invoice_id, line_number, item_code, item_name, description, quantity, unit_price,
          discount_percentage, discount_amount, tax_percentage, tax_amount, line_total, revenue_account_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [invoice_id, i + 1, line.item_code, line.item_name, line.description,
         line.quantity, line.unit_price, line.discount_percentage || 0, lineDiscount,
         line.tax_percentage || 15, lineTax, lineTotal, line.revenue_account_id]
      );
    }
    
    // Create automatic journal entry
    const entry_number = await generateNextNumber('JE', 'finance_journal_entries', 'entry_number');
    
    const journalResult = await client.query(
      `INSERT INTO finance_journal_entries 
       (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
        entity_type, entity_id, branch_id, incubator_id, status, is_posted, created_by)
       VALUES ($1, $2, 'AUTO', $3, $4, 'INVOICE', $5, $6, $7, $8, $9, 'POSTED', true, $10)
       RETURNING *`,
      [entry_number, invoice_date, `قيد آلي - فاتورة رقم ${invoice_number}`, invoice_number, invoice_id,
       entity_type, entity_id, branch_id, incubator_id, req.headers['x-user-id'] || 'system']
    );
    
    const journal_entry_id = journalResult.rows[0].entry_id;
    
    // Debit: Accounts Receivable
    await client.query(
      `INSERT INTO finance_journal_lines 
       (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
       VALUES ($1, 1, (SELECT account_id FROM finance_accounts WHERE account_code = '1130'), '1130', $2, 0, $3)`,
      [journal_entry_id, total_amount, `ذمم مدينة - ${customer.customer_name_ar}`]
    );
    
    // Credit: Revenue (from lines)
    await client.query(
      `INSERT INTO finance_journal_lines 
       (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
       VALUES ($1, 2, (SELECT account_id FROM finance_accounts WHERE account_code = '4100'), '4100', 0, $2, $3)`,
      [journal_entry_id, subtotal - discount_amount, `إيرادات`]
    );
    
    // Credit: Tax Payable (if applicable)
    if (tax_amount > 0) {
      await client.query(
        `INSERT INTO finance_journal_lines 
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
         VALUES ($1, 3, (SELECT account_id FROM finance_accounts WHERE account_code = '2140'), '2140', 0, $2, $3)`,
        [journal_entry_id, tax_amount, `ضريبة القيمة المضافة`]
      );
    }
    
    // Update invoice with journal entry ID
    await client.query(
      'UPDATE finance_invoices SET journal_entry_id = $1 WHERE invoice_id = $2',
      [journal_entry_id, invoice_id]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      invoice: invoiceResult.rows[0],
      journal_entry_id: journal_entry_id,
      message: 'Invoice created successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ========================================
// PAYMENTS APIs
// ========================================

// Get all payments
router.get('/payments', async (req, res) => {
  try {
    const userEntity = req.userEntity || { type: 'HQ', id: 'HQ001' };
    const { status, customer_id, from_date, to_date, entity_id, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        p.*,
        c.customer_name_ar,
        c.customer_code
      FROM finance_payments p
      JOIN finance_customers c ON p.customer_id = c.customer_id
      WHERE ${getEntityFilter(userEntity, 'p')}
    `;
    
    const params = [];
    
    if (entity_id) {
      params.push(entity_id);
      query += ` AND p.entity_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    }
    
    if (customer_id) {
      params.push(customer_id);
      query += ` AND p.customer_id = $${params.length}`;
    }
    
    if (from_date) {
      params.push(from_date);
      query += ` AND p.payment_date >= $${params.length}`;
    }
    
    if (to_date) {
      params.push(to_date);
      query += ` AND p.payment_date <= $${params.length}`;
    }
    
    query += ` ORDER BY p.payment_date DESC, p.payment_number DESC`;
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      payments: result.rows
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create payment
router.post('/payments', async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      customer_id,
      customer_name,
      payment_date,
      payment_amount,
      payment_method,
      payment_type = 'FULL',
      bank_name,
      check_number,
      transaction_reference,
      street_name,
      postal_code,
      building_number,
      city,
      district,
      national_address_number,
      short_address,
      entity_type,
      entity_id,
      branch_id,
      incubator_id,
      notes,
      allocations = [] // [{ invoice_id, allocated_amount }]
    } = req.body;
    const resolvedEntityId = entity_id || (req.userEntity ? req.userEntity.id : 'HQ001');
    const resolvedEntityType = entity_type || (req.userEntity ? req.userEntity.type : 'HQ');
    
    // Get customer info
    let customer = null;
    if (customer_id) {
      const customerResult = await client.query(
        'SELECT * FROM finance_customers WHERE customer_id = $1',
        [customer_id]
      );
      customer = customerResult.rows[0] || null;
    }

    if (!customer) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Customer not found. Create the customer first with the required fields.'
      });
    }
    
    // Validate allocation total
    if (allocations.length) {
      const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount), 0);
      if (Math.abs(totalAllocated - payment_amount) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Total allocated amount must equal payment amount',
          payment_amount,
          totalAllocated
        });
      }
    }
    
    // Generate payment number
    const payment_number = await generateNextNumber('PAY', 'finance_payments', 'payment_number');
    
    // Create payment
    const paymentResult = await client.query(
      `INSERT INTO finance_payments 
       (payment_number, payment_date, customer_id, customer_name, payment_amount, payment_method,
        payment_type, bank_name, check_number, transaction_reference,
        street_name, postal_code, building_number, city, district, national_address_number, short_address,
        entity_type, entity_id, branch_id, incubator_id, notes, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'APPROVED', $22)
       RETURNING *`,
      [payment_number, payment_date, customer.customer_id, customer.customer_name_ar, payment_amount, payment_method,
             payment_type, bank_name, check_number, transaction_reference,
             street_name || null, postal_code || null, building_number || null, city || null, district || null,
             national_address_number || null, short_address || null,
             resolvedEntityType, resolvedEntityId, branch_id, incubator_id, notes, req.headers['x-user-id'] || 'system']
    );
    
    const payment_id = paymentResult.rows[0].payment_id;
    
    // Create allocations and update invoices
    for (const allocation of allocations) {
      await client.query(
        `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount)
         VALUES ($1, $2, $3)`,
        [payment_id, allocation.invoice_id, allocation.allocated_amount]
      );
      
      // Update invoice
      await client.query(
        `UPDATE finance_invoices 
         SET paid_amount = paid_amount + $1,
             remaining_amount = remaining_amount - $2,
             payment_status = CASE 
               WHEN remaining_amount - $3 <= 0 THEN 'PAID'
               ELSE 'PARTIAL'
             END,
             status = CASE 
               WHEN remaining_amount - $4 <= 0 THEN 'PAID'
               ELSE status
             END,
             updated_at = NOW()
         WHERE invoice_id = $5`,
        [allocation.allocated_amount, allocation.allocated_amount, 
         allocation.allocated_amount, allocation.allocated_amount, allocation.invoice_id]
      );
    }
    
    // Create automatic journal entry
    const entry_number = await generateNextNumber('JE', 'finance_journal_entries', 'entry_number');
    
    const journalResult = await client.query(
      `INSERT INTO finance_journal_entries 
       (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
        entity_type, entity_id, branch_id, incubator_id, status, is_posted, created_by)
       VALUES ($1, $2, 'AUTO', $3, $4, 'PAYMENT', $5, $6, $7, $8, $9, 'POSTED', true, $10)
       RETURNING *`,
      [entry_number, payment_date, `قيد آلي - دفعة رقم ${payment_number}`, payment_number, payment_id,
       entity_type, entity_id, branch_id, incubator_id, req.headers['x-user-id'] || 'system']
    );
    
    const journal_entry_id = journalResult.rows[0].entry_id;
    
    // Debit: Cash/Bank
    const cashAccount = payment_method === 'CASH' ? '1110' : '1120';
    await client.query(
      `INSERT INTO finance_journal_lines 
       (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
       VALUES ($1, 1, (SELECT account_id FROM finance_accounts WHERE account_code = $2), $3, $4, 0, $5)`,
      [journal_entry_id, cashAccount, cashAccount, payment_amount, `دفعة من ${customer.customer_name_ar}`]
    );
    
    // Credit: Accounts Receivable
    await client.query(
      `INSERT INTO finance_journal_lines 
       (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
       VALUES ($1, 2, (SELECT account_id FROM finance_accounts WHERE account_code = '1130'), '1130', 0, $2, $3)`,
      [journal_entry_id, payment_amount, `ذمم مدينة - ${customer.customer_name_ar}`]
    );
    
    // Update payment with journal entry ID
    await client.query(
      'UPDATE finance_payments SET journal_entry_id = $1 WHERE payment_id = $2',
      [journal_entry_id, payment_id]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      payment: paymentResult.rows[0],
      journal_entry_id: journal_entry_id,
      message: 'Payment created successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating payment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Update payment
router.put('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      payment_date,
      payment_amount,
      payment_method,
      status,
      notes,
      street_name,
      postal_code,
      building_number,
      city,
      district,
      national_address_number,
      short_address
    } = req.body;

    const result = await db.query(
      `UPDATE finance_payments
       SET payment_date = COALESCE($1, payment_date),
           payment_amount = COALESCE($2, payment_amount),
           payment_method = COALESCE($3, payment_method),
           status = COALESCE($4, status),
           notes = COALESCE($5, notes),
           street_name = COALESCE($6, street_name),
           postal_code = COALESCE($7, postal_code),
           building_number = COALESCE($8, building_number),
           city = COALESCE($9, city),
           district = COALESCE($10, district),
           national_address_number = COALESCE($11, national_address_number),
           short_address = COALESCE($12, short_address),
           updated_at = NOW()
       WHERE payment_id = $13
       RETURNING *`,
      [
        payment_date || null,
        payment_amount ?? null,
        payment_method || null,
        status || null,
        notes || null,
        street_name || null,
        postal_code || null,
        building_number || null,
        city || null,
        district || null,
        national_address_number || null,
        short_address || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    res.json({ success: true, payment: result.rows[0] });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete payment
router.delete('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM finance_payment_allocations WHERE payment_id = $1', [id]);
    const result = await db.query('DELETE FROM finance_payments WHERE payment_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    res.json({ success: true, payment: result.rows[0] });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// CUSTOMERS APIs
// ========================================

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (typeof value === 'number') return value === 1;
  return !!value;
};

const readText = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value.trim() : String(value).trim();
};

const validateRequiredCustomerFields = (fields) => {
  const missing = [];
  const requiredKeys = [
    'customer_name_ar',
    'tax_number',
    'mobile',
    'mobile_secondary',
    'email',
    'email_secondary',
    'company_name',
    'website',
    'street_name',
    'city',
    'district',
    'building_number',
    'postal_code',
    'country'
  ];

  requiredKeys.forEach((key) => {
    if (!fields[key]) missing.push(key);
  });

  if (!fields.shipping_copy_billing) {
    ['shipping_street_name', 'shipping_city', 'shipping_region', 'shipping_postal_code'].forEach((key) => {
      if (!fields[key]) missing.push(key);
    });
  }

  return missing;
};

// Get all customers
router.get('/customers', async (req, res) => {
  try {
    const userEntity = req.userEntity || { type: 'HQ', id: 'HQ001' };
    const { risk_level, is_active, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        c.*,
        COUNT(DISTINCT i.invoice_id) as invoices_count,
        COALESCE(SUM(i.total_amount), 0) as total_invoiced,
        COALESCE(SUM(i.remaining_amount), 0) as total_outstanding
      FROM finance_customers c
      LEFT JOIN finance_invoices i ON c.customer_id = i.customer_id
      WHERE ${getEntityFilter(userEntity, 'c')}
    `;
    
    const params = [];
    
    if (risk_level) {
      params.push(risk_level);
      query += ` AND c.risk_level = $${params.length}`;
    }
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND c.is_active = $${params.length}`;
    }
    
    query += ` GROUP BY c.customer_id ORDER BY c.customer_name_ar`;
    
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await db.query(query, params);
    const customers = result.rows;
    const summary = {
      total_customers: customers.length,
      active_customers: customers.filter(c => c.is_active && !c.is_blocked).length,
      blocked_customers: customers.filter(c => c.is_blocked).length,
      total_credit_limit: customers.reduce((sum, c) => sum + parseFloat(c.credit_limit || 0), 0)
    };
    
    res.json({
      success: true,
      count: customers.length,
      customers,
      summary
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create customer
router.post('/customers', async (req, res) => {
  try {
    const {
      customer_name_ar,
      customer_name_en,
      customer_type = 'INDIVIDUAL',
      company_name,
      website,
      email,
      email_secondary,
      phone,
      mobile,
      mobile_secondary,
      address,
      city,
      country = 'Saudi Arabia',
      street_name,
      postal_code,
      building_number,
      district,
      national_address_number,
      short_address,
      shipping_copy_billing,
      shipping_street_name,
      shipping_city,
      shipping_region,
      shipping_postal_code,
      tax_number,
      commercial_registration,
      credit_limit = 0,
      credit_period_days = 30,
      entity_type,
      entity_id,
      branch_id,
      incubator_id,
      program_id
    } = req.body;
    
    const normalized = {
      customer_name_ar: readText(customer_name_ar),
      customer_name_en: readText(customer_name_en) || null,
      customer_type: readText(customer_type) || 'COMPANY',
      company_name: readText(company_name),
      website: readText(website),
      email: readText(email),
      email_secondary: readText(email_secondary),
      phone: readText(phone) || null,
      mobile: readText(mobile),
      mobile_secondary: readText(mobile_secondary),
      address: readText(address) || null,
      city: readText(city),
      country: readText(country),
      street_name: readText(street_name),
      postal_code: readText(postal_code),
      building_number: readText(building_number),
      district: readText(district),
      national_address_number: readText(national_address_number) || null,
      short_address: readText(short_address) || null,
      shipping_copy_billing: normalizeBoolean(shipping_copy_billing),
      shipping_street_name: readText(shipping_street_name),
      shipping_city: readText(shipping_city),
      shipping_region: readText(shipping_region),
      shipping_postal_code: readText(shipping_postal_code),
      tax_number: readText(tax_number),
      commercial_registration: readText(commercial_registration) || null
    };

    if (normalized.shipping_copy_billing) {
      normalized.shipping_street_name = normalized.street_name;
      normalized.shipping_city = normalized.city;
      normalized.shipping_region = normalized.district;
      normalized.shipping_postal_code = normalized.postal_code;
    }

    const missingFields = validateRequiredCustomerFields(normalized);
    if (missingFields.length) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Generate customer code
    const customer_code = await generateNextNumber('CUST', 'finance_customers', 'customer_code');
    
    const result = await db.query(
      `INSERT INTO finance_customers 
       (customer_code, customer_name_ar, customer_name_en, customer_type, company_name, website, email,
        email_secondary, phone, mobile, mobile_secondary, address, city, country, tax_number,
        commercial_registration, credit_limit, credit_period_days, entity_type, entity_id, branch_id,
        incubator_id, program_id, created_by, street_name, postal_code, building_number, district,
        national_address_number, short_address, shipping_copy_billing, shipping_street_name,
        shipping_city, shipping_region, shipping_postal_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
       RETURNING *`,
      [
        customer_code,
        normalized.customer_name_ar,
        normalized.customer_name_en,
        normalized.customer_type,
        normalized.company_name,
        normalized.website,
        normalized.email,
        normalized.email_secondary,
        normalized.phone,
        normalized.mobile,
        normalized.mobile_secondary,
        normalized.address,
        normalized.city,
        normalized.country,
        normalized.tax_number,
        normalized.commercial_registration,
        credit_limit,
        credit_period_days,
        entity_type,
        entity_id,
        branch_id,
        incubator_id,
        program_id,
        req.headers['x-user-id'] || 'system',
        normalized.street_name,
        normalized.postal_code,
        normalized.building_number,
        normalized.district,
        normalized.national_address_number,
        normalized.short_address,
        normalized.shipping_copy_billing,
        normalized.shipping_street_name,
        normalized.shipping_city,
        normalized.shipping_region,
        normalized.shipping_postal_code
      ]
    );
    
    res.status(201).json({
      success: true,
      customer: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ELECTRONIC SIGNATURE APIs
// ========================================

const createSignatureFingerprint = (doc) => {
  const base = `${doc.document_type || 'مستند'}-${doc.document_id}-${doc.owner_name || ''}-${doc.document_status || ''}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  return `بصمة-${Math.abs(hash)}`;
};

const logSignatureAction = async (client, signature_id, document_key, action, user_name, fingerprint) => {
  await client.query(
    `INSERT INTO finance_signature_logs (signature_id, document_key, action, user_name, fingerprint)
     VALUES ($1, $2, $3, $4, $5)`,
    [signature_id, document_key, action, user_name, fingerprint]
  );
};

// جلب جميع التوقيعات
router.get('/electronic-signatures', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM finance_electronic_signatures ORDER BY updated_at DESC, signature_id DESC`
    );
    res.json({ success: true, count: result.rows.length, signatures: result.rows });
  } catch (error) {
    console.error('Error fetching electronic signatures:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// جلب سجل التدقيق
router.get('/electronic-signature-logs', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM finance_signature_logs ORDER BY created_at DESC, log_id DESC`
    );
    res.json({ success: true, count: result.rows.length, logs: result.rows });
  } catch (error) {
    console.error('Error fetching electronic signature logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/electronic-signature-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM finance_signature_logs WHERE log_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    res.json({ success: true, message: 'تم الحذف', log: result.rows[0] });
  } catch (error) {
    console.error('Error deleting signature log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/electronic-signature-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, user_name, fingerprint } = req.body;
    const result = await db.query(
      `UPDATE finance_signature_logs
       SET action = COALESCE($1, action),
           user_name = COALESCE($2, user_name),
           fingerprint = COALESCE($3, fingerprint)
       WHERE log_id = $4
       RETURNING *`,
      [action, user_name, fingerprint, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'السجل غير موجود' });
    }
    res.json({ success: true, log: result.rows[0] });
  } catch (error) {
    console.error('Error updating signature log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// إنشاء أو تحديث توقيع (توقيع جديد)
router.post('/electronic-signatures/sign', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const {
      document_type,
      document_id,
      owner_name,
      document_status,
      user_name = 'مسؤول التوقيع',
      notes,
      entity_id = 'HQ001'
    } = req.body;

    if (!document_type || !document_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'يجب تحديد نوع ورقم المستند' });
    }

    const document_key = `${document_type}_${document_id}`;
    const fingerprint = createSignatureFingerprint({ document_type, document_id, owner_name, document_status });

    const upsertResult = await client.query(
      `INSERT INTO finance_electronic_signatures (
        document_key, document_type, document_id, owner_name, document_status,
        signature_status, verified, fingerprint, action, user_name, notes, entity_id, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'موقع', false, $6, 'توقيع', $7, $8, $9, NOW())
      ON CONFLICT (document_key)
      DO UPDATE SET
        owner_name = COALESCE(EXCLUDED.owner_name, finance_electronic_signatures.owner_name),
        document_status = COALESCE(EXCLUDED.document_status, finance_electronic_signatures.document_status),
        signature_status = 'موقع',
        verified = false,
        fingerprint = EXCLUDED.fingerprint,
        action = 'توقيع',
        user_name = EXCLUDED.user_name,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [document_key, document_type, document_id, owner_name, document_status, fingerprint, user_name, notes, entity_id]
    );

    const signature = upsertResult.rows[0];
    await logSignatureAction(client, signature.signature_id, document_key, 'توقيع', user_name, fingerprint);

    await client.query('COMMIT');
    res.status(201).json({ success: true, signature });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error signing document:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// تحقق من التوقيع
router.post('/electronic-signatures/verify', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { document_key, user_name = 'مدقق النظام', notes } = req.body;
    if (!document_key) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'يجب تحديد معرف المستند' });
    }

    const result = await client.query(
      `UPDATE finance_electronic_signatures
       SET verified = true, action = 'تحقق', notes = COALESCE($2, notes), updated_at = NOW()
       WHERE document_key = $1
       RETURNING *`,
      [document_key, notes]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'التوقيع غير موجود' });
    }

    const signature = result.rows[0];
    await logSignatureAction(client, signature.signature_id, document_key, 'تحقق', user_name, signature.fingerprint);
    await client.query('COMMIT');
    res.json({ success: true, signature });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error verifying signature:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// تحديث بيانات التوقيع (تعديل)
router.put('/electronic-signatures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      owner_name,
      document_status,
      signature_status,
      verified,
      user_name,
      notes
    } = req.body;

    const result = await db.query(
      `UPDATE finance_electronic_signatures
       SET owner_name = COALESCE($1, owner_name),
           document_status = COALESCE($2, document_status),
           signature_status = COALESCE($3, signature_status),
           verified = COALESCE($4, verified),
           user_name = COALESCE($5, user_name),
           notes = COALESCE($6, notes),
           updated_at = NOW()
       WHERE signature_id = $7
       RETURNING *`,
      [owner_name, document_status, signature_status, verified, user_name, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'التوقيع غير موجود' });
    }

    res.json({ success: true, signature: result.rows[0] });
  } catch (error) {
    console.error('Error updating signature:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// حذف التوقيع وسجله
router.delete('/electronic-signatures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM finance_electronic_signatures WHERE signature_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'التوقيع غير موجود' });
    }
    res.json({ success: true, message: 'تم الحذف', signature: result.rows[0] });
  } catch (error) {
    console.error('Error deleting signature:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// SALES SETTLEMENTS APIs
// ========================================

const resolveEntityFromHeaders = (req) => ({
  type: req.headers['x-entity-type'] || 'HQ',
  id: req.headers['x-entity-id'] || 'HQ001'
});

const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

router.get('/sales-settlements', async (req, res) => {
  try {
    const userEntity = resolveEntityFromHeaders(req);
    const {
      status,
      channel,
      owner,
      risk,
      from_date,
      to_date,
      search,
      variance_min,
      limit = 200,
      offset = 0
    } = req.query;

    let query = `
      SELECT *
      FROM finance_sales_settlements s
      WHERE ${getEntityFilter(userEntity, 's')}
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }
    if (channel) {
      params.push(channel);
      query += ` AND s.channel = $${params.length}`;
    }
    if (owner) {
      params.push(owner);
      query += ` AND s.owner_name = $${params.length}`;
    }
    if (risk) {
      params.push(risk);
      query += ` AND s.risk_level = $${params.length}`;
    }
    if (from_date) {
      params.push(from_date);
      query += ` AND s.last_update >= $${params.length}`;
    }
    if (to_date) {
      params.push(to_date);
      query += ` AND s.last_update <= $${params.length}`;
    }
    if (variance_min) {
      params.push(Math.abs(parseFloat(variance_min)));
      query += ` AND ABS(s.variance_amount) >= $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        s.settlement_number ILIKE $${params.length}
        OR s.customer_name ILIKE $${params.length}
        OR s.channel ILIKE $${params.length}
        OR s.owner_name ILIKE $${params.length}
      )`;
    }

    query += ' ORDER BY s.last_update DESC, s.settlement_number DESC';
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);
    res.json({ success: true, count: result.rows.length, settlements: result.rows });
  } catch (error) {
    console.error('Error fetching sales settlements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sales-settlements', async (req, res) => {
  try {
    const userEntity = resolveEntityFromHeaders(req);
    const {
      settlement_number,
      period_label,
      channel,
      gross_amount,
      fees_amount,
      refunds_amount,
      collected_amount,
      status,
      risk_level,
      owner_name,
      customer_name,
      priority_level,
      cycle_days,
      last_update,
      notes
    } = req.body || {};

    const settlementNumber = settlement_number || await generateNextNumber('SET', 'finance_sales_settlements', 'settlement_number');
    const gross = toNumber(gross_amount);
    const fees = toNumber(fees_amount);
    const refunds = toNumber(refunds_amount);
    const collected = toNumber(collected_amount);
    const variance = collected - (gross - fees - refunds);

    const result = await db.query(
      `INSERT INTO finance_sales_settlements (
        settlement_number,
        period_label,
        channel,
        gross_amount,
        fees_amount,
        refunds_amount,
        collected_amount,
        variance_amount,
        status,
        risk_level,
        owner_name,
        customer_name,
        priority_level,
        cycle_days,
        last_update,
        notes,
        entity_type,
        entity_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        settlementNumber,
        period_label,
        channel,
        gross,
        fees,
        refunds,
        collected,
        variance,
        status || 'مفتوح',
        risk_level || 'منخفض',
        owner_name,
        customer_name,
        priority_level,
        cycle_days || 0,
        last_update || new Date().toISOString().split('T')[0],
        notes,
        userEntity.type,
        userEntity.id
      ]
    );

    res.status(201).json({ success: true, settlement: result.rows[0] });
  } catch (error) {
    console.error('Error creating sales settlement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/sales-settlements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query(
      'SELECT * FROM finance_sales_settlements WHERE settlement_id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'التسوية غير موجودة' });
    }

    const current = existing.rows[0];
    const {
      settlement_number,
      period_label,
      channel,
      gross_amount,
      fees_amount,
      refunds_amount,
      collected_amount,
      status,
      risk_level,
      owner_name,
      customer_name,
      priority_level,
      cycle_days,
      last_update,
      notes
    } = req.body || {};

    const gross = gross_amount !== undefined ? toNumber(gross_amount) : toNumber(current.gross_amount);
    const fees = fees_amount !== undefined ? toNumber(fees_amount) : toNumber(current.fees_amount);
    const refunds = refunds_amount !== undefined ? toNumber(refunds_amount) : toNumber(current.refunds_amount);
    const collected = collected_amount !== undefined ? toNumber(collected_amount) : toNumber(current.collected_amount);
    const variance = collected - (gross - fees - refunds);

    const result = await db.query(
      `UPDATE finance_sales_settlements
       SET settlement_number = $1,
           period_label = $2,
           channel = $3,
           gross_amount = $4,
           fees_amount = $5,
           refunds_amount = $6,
           collected_amount = $7,
           variance_amount = $8,
           status = $9,
           risk_level = $10,
           owner_name = $11,
           customer_name = $12,
           priority_level = $13,
           cycle_days = $14,
           last_update = $15,
           notes = $16,
           updated_at = NOW()
       WHERE settlement_id = $17
       RETURNING *`,
      [
        settlement_number || current.settlement_number,
        period_label ?? current.period_label,
        channel ?? current.channel,
        gross,
        fees,
        refunds,
        collected,
        variance,
        status ?? current.status,
        risk_level ?? current.risk_level,
        owner_name ?? current.owner_name,
        customer_name ?? current.customer_name,
        priority_level ?? current.priority_level,
        cycle_days !== undefined ? cycle_days : current.cycle_days,
        last_update || current.last_update,
        notes ?? current.notes,
        id
      ]
    );

    res.json({ success: true, settlement: result.rows[0] });
  } catch (error) {
    console.error('Error updating sales settlement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/sales-settlements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM finance_sales_settlements WHERE settlement_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'التسوية غير موجودة' });
    }
    res.json({ success: true, settlement: result.rows[0] });
  } catch (error) {
    console.error('Error deleting sales settlement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
