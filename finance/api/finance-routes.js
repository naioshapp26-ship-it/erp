const express = require('express');
const router = express.Router();
const db = require('../../db');
const {
  postManualEntry,
  reverseEntry,
  postInvoiceIssue,
  postPaymentReceipt,
  resolveActor,
  assertEntityOwns,
  PostingError,
  roundMoney
} = require('../services/finance-posting-service');
const {
  assertInvoiceIssueReadyForCollection
} = require('../services/finance-collection-gate');
const {
  assertInvoiceDeletable,
  assertInvoiceMutable,
  assertPaymentMutable,
  assertPaymentDeletable,
  GuardError,
  sendGuardError
} = require('../services/finance-posted-guards');
const { computeInvoiceTotalsFromLines } = require('../services/finance-invoice-amounts');
const pageDocumentSettings = require('../services/page-document-settings');
const {
  resolveDefaultTaxRate,
  loadActiveOffer,
  applyOfferAndTaxToLines
} = require('../services/tax-and-offers');
const { resolveScopedEntityId, resolveScopedEntityType } = require('./resolve-scoped-entity');

/**
 * B1.d.2 — invoice create via FinancePostingService.
 * Default FALSE. Must remain false in Staging/Production until explicit approval.
 * Tests may set FINANCE_POST_INVOICE_VIA_SERVICE=true in an isolated process only.
 */
function isFinancePostInvoiceViaService() {
  const v = String(process.env.FINANCE_POST_INVOICE_VIA_SERVICE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * B1.d.3.d — payment create via FinancePostingService (postPaymentReceipt).
 * Default FALSE. Must remain false in Staging/Production until explicit approval.
 * Tests may set FINANCE_POST_PAYMENT_VIA_SERVICE=true in an isolated process only.
 */
function isFinancePostPaymentViaService() {
  const v = String(process.env.FINANCE_POST_PAYMENT_VIA_SERVICE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function sameStoredValue(current, next) {
  if (current == null && (next == null || next === '')) return true;
  if (next == null && (current == null || current === '')) return true;
  if (current instanceof Date) {
    return current.toISOString().slice(0, 10) === String(next).slice(0, 10);
  }
  const left = typeof current === 'number' ? current : Number(current);
  const right = typeof next === 'number' ? next : Number(next);
  if (Number.isFinite(left) && Number.isFinite(right) && String(current).trim() !== '' && String(next).trim() !== '') {
    return Math.abs(left - right) < 0.009;
  }
  return String(current ?? '').trim().toUpperCase() === String(next ?? '').trim().toUpperCase();
}

function fieldPresentAndChanged(row, body, field) {
  if (!Object.prototype.hasOwnProperty.call(body || {}, field)) return false;
  return !sameStoredValue(row[field], body[field]);
}

const INVOICE_FINANCIAL_FIELDS = [
  'invoice_number', 'invoice_date', 'customer_id', 'customer_name',
  'subtotal', 'tax_amount', 'discount_amount', 'total_amount', 'paid_amount', 'remaining_amount',
  'status', 'payment_status', 'entity_type', 'entity_id', 'branch_id', 'incubator_id', 'platform_id'
];

const PAYMENT_FINANCIAL_FIELDS = [
  'payment_date', 'payment_amount', 'payment_method', 'payment_type', 'status'
];

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
  // Match PREFIX-0001 only (ignore seeds like INV-FIN-001 / JE-INV-…)
  const result = await db.query(
    `SELECT ${column} AS num FROM ${table}
     WHERE ${column} ~ ('^' || $1 || '-[0-9]+$')
     ORDER BY ${column} DESC
     LIMIT 1`,
    [prefix]
  );

  const lastNumber = result.rows[0]?.num || '';
  const numericMatches = String(lastNumber).match(/\d+/g) || [];
  const parsed = numericMatches.length ? parseInt(numericMatches[numericMatches.length - 1], 10) : 0;
  const lastNumeric = Number.isFinite(parsed) ? parsed : 0;
  const nextNum = lastNumeric + 1;
  if (!Number.isFinite(nextNum) || nextNum < 1) {
    throw new Error(`تعذر توليد رقم متسلسل للبادئة ${prefix}`);
  }
  const safePrefix = String(prefix || '').replace(/[^A-Za-z0-9_-]/g, '') || 'DOC';
  const separator = safePrefix.endsWith('-') ? '' : '-';
  const padded = nextNum < 10000 ? String(nextNum).padStart(4, '0') : String(nextNum);
  const value = `${safePrefix}${separator}${padded}`;
  if (/nan/i.test(value) || /undefined/i.test(value)) {
    throw new Error('توليد المرجع أنتج قيمة غير صالحة');
  }
  return value;
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

// Post journal entry (make it permanent) — B1.b via FinancePostingService
router.post('/journal-entries/:id/post', async (req, res) => {
  try {
    const { id } = req.params;
    const out = await postManualEntry(db.pool, id, { req, reason: req.body?.reason });
    res.json({
      success: true,
      entry: out.entry,
      message: out.message || 'Journal entry posted successfully'
    });
  } catch (error) {
    if (error instanceof PostingError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code,
        ...(error.extra || {})
      });
    }
    console.error('Error posting journal entry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reverse a posted journal entry — B1.b (new linked REVERSAL; does not mutate original row amounts/status)
router.post('/journal-entries/:id/reverse', async (req, res) => {
  try {
    const { id } = req.params;
    const out = await reverseEntry(db.pool, id, { req, reason: req.body?.reason });
    res.status(201).json({
      success: true,
      entry: out.entry,
      original_entry_id: out.original_entry_id,
      message: out.message || 'Journal entry reversed successfully'
    });
  } catch (error) {
    if (error instanceof PostingError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code,
        ...(error.extra || {})
      });
    }
    console.error('Error reversing journal entry:', error);
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
    const { status, customer_id, from_date, to_date, q, limit = 100, offset = 0 } = req.query;
    
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

    if (q && String(q).trim()) {
      params.push(`%${String(q).trim()}%`);
      query += ` AND (i.invoice_number ILIKE $${params.length} OR c.customer_name_ar ILIKE $${params.length} OR COALESCE(c.customer_code, '') ILIKE $${params.length})`;
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
    const payloadPreview = req.body || {};
    const existingInvoice = await db.query('SELECT * FROM finance_invoices WHERE invoice_id = $1', [id]);
    if (!existingInvoice.rows.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    const financialChanged = INVOICE_FINANCIAL_FIELDS.some((field) =>
      fieldPresentAndChanged(existingInvoice.rows[0], payloadPreview, field)
    );
    // Posted invoices keep their ledger amounts. Notes, due date, and address stay editable.
    if (financialChanged) {
      await assertInvoiceMutable(db.pool, id);
    }
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
    if (sendGuardError(res, error)) return;
    console.error('Error updating invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete invoice — B1.d.2 D3/G3: posted lock + trusted entity ownership (no cross-entity)
router.delete('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await assertInvoiceDeletable(db.pool, id, { req });
    const actor = resolveActor({ req });

    await db.query('DELETE FROM finance_payment_allocations WHERE invoice_id = $1', [id]);
    await db.query('DELETE FROM finance_payment_plans WHERE invoice_id = $1', [id]);
    await db.query('DELETE FROM finance_invoice_lines WHERE invoice_id = $1', [id]);
    // Defense in depth: require entity_id match after ownership gate
    const result = await db.query(
      `DELETE FROM finance_invoices
       WHERE invoice_id = $1 AND entity_id IS NOT DISTINCT FROM $2
       RETURNING *`,
      [id, invoice.entity_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({
      success: true,
      invoice: result.rows[0],
      meta: { entity_gate: 'assertInvoiceDeletable', actor_entity_id: actor.entityId }
    });
  } catch (error) {
    if (sendGuardError(res, error)) return;
    console.error('Error deleting invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function ensureInvoiceAddressColumns() {
  await db.query(`
    ALTER TABLE finance_invoices
    ADD COLUMN IF NOT EXISTS street_name TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT,
    ADD COLUMN IF NOT EXISTS building_number TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS national_address_number TEXT,
    ADD COLUMN IF NOT EXISTS short_address TEXT,
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);
  `);
}

async function ensurePaymentAddressColumns() {
  await db.query(`
    ALTER TABLE finance_payments
    ADD COLUMN IF NOT EXISTS street_name TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT,
    ADD COLUMN IF NOT EXISTS building_number TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS national_address_number TEXT,
    ADD COLUMN IF NOT EXISTS short_address TEXT;
  `);
}

// Cancel a posted invoice by reversing its issue journal. Hard delete stays blocked.
router.post('/invoices/:id/cancel', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!reason) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'سبب الإلغاء إلزامي', code: 'REASON_REQUIRED' });
    }

    const invRes = await client.query(
      'SELECT * FROM finance_invoices WHERE invoice_id = $1 FOR UPDATE',
      [id]
    );
    if (!invRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الفاتورة غير موجودة', code: 'NOT_FOUND' });
    }
    const invoice = invRes.rows[0];
    const actor = resolveActor({ req });
    if (!actor.authenticated) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        error: 'يجب تسجيل الدخول قبل إلغاء فاتورة مرحّلة',
        code: 'AUTH_REQUIRED'
      });
    }
    try {
      assertEntityOwns(invoice.entity_id, actor, 'الفاتورة');
    } catch (ownErr) {
      await client.query('ROLLBACK');
      if (ownErr instanceof PostingError) {
        return res.status(ownErr.status).json({ success: false, error: ownErr.message, code: ownErr.code });
      }
      throw ownErr;
    }
    if (String(invoice.status || '').toUpperCase() === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'الفاتورة ملغاة مسبقًا', code: 'ALREADY_CANCELLED' });
    }

    const paid = Number(invoice.paid_amount || 0);
    const alloc = await client.query(
      `SELECT COUNT(*)::int AS n
       FROM finance_payment_allocations a
       JOIN finance_payments p ON p.payment_id = a.payment_id
       WHERE a.invoice_id = $1
         AND UPPER(COALESCE(p.status, '')) <> 'CANCELLED'`,
      [id]
    );
    if (paid > 0.009 || alloc.rows[0].n > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'لا يمكن إلغاء فاتورة عليها تحصيل. ألغِ التحصيل أولًا.',
        code: 'COLLECTION_EXISTS'
      });
    }

    let reversal = null;
    if (invoice.journal_entry_id) {
      try {
        reversal = await reverseEntry(client, invoice.journal_entry_id, {
          req,
          reason,
          manageTransaction: false
        });
      } catch (revErr) {
        if (!(revErr instanceof PostingError) || revErr.code !== 'ALREADY_REVERSED') throw revErr;
      }
    }

    const updated = await client.query(
      `UPDATE finance_invoices
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE invoice_id = $1
       RETURNING *`,
      [id]
    );
    await client.query('COMMIT');
    res.json({
      success: true,
      invoice: updated.rows[0],
      reversal_entry_id: reversal && reversal.entry ? reversal.entry.entry_id : null,
      message: 'تم إلغاء الفاتورة وعكس قيد الإصدار'
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    if (error instanceof PostingError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code,
        ...(error.extra || {})
      });
    }
    if (sendGuardError(res, error)) return;
    console.error('Error cancelling invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Create new invoice
// B1.d.2: when FINANCE_POST_INVOICE_VIA_SERVICE=true → service posting (exclusive).
// Default false → legacy inline JE (unchanged). Never run both paths.
router.post('/invoices', async (req, res) => {
  const client = await db.pool.connect();
  const useService = isFinancePostInvoiceViaService();

  try {
    await ensureInvoiceAddressColumns();
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
      offer_code = null,
      lines = []
    } = req.body;
    let notes = req.body.notes;

    const customerResult = await client.query(
      'SELECT * FROM finance_customers WHERE customer_id = $1',
      [customer_id]
    );

    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customer = customerResult.rows[0];

    let subtotal;
    let tax_amount;
    let discount_amount;
    let total_amount;
    let lineRows = lines;
    let resolvedEntityType = entity_type;
    let resolvedEntityId = entity_id;
    let resolvedBranchId = branch_id;
    let resolvedIncubatorId = incubator_id;
    let createdBy = req.headers['x-user-id'] || 'system';
    let actor = null;

    if (useService) {
      // Trusted session required for service path (entity ownership + posting permission)
      actor = resolveActor({ req });
      if (!actor.authenticated) {
        await client.query('ROLLBACK');
        return res.status(401).json({
          success: false,
          error: 'يجب تسجيل الدخول بصلاحية خادمية موثوقة قبل إنشاء فاتورة عبر خدمة الترحيل',
          code: 'AUTH_REQUIRED'
        });
      }
      if (!actor.entityId) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'جلسة المستخدم بلا كيان موثوق — مرفوض',
          code: 'ENTITY_SCOPE_REQUIRED'
        });
      }

      // Target entity: body value if present, else session. Ownership enforced server-side.
      resolvedEntityId = entity_id != null && String(entity_id).trim() !== ''
        ? String(entity_id).trim()
        : String(actor.entityId);
      resolvedEntityType = entity_type || actor.entityType || null;
      try {
        assertEntityOwns(resolvedEntityId, actor, 'الفاتورة');
      } catch (ownErr) {
        await client.query('ROLLBACK');
        if (ownErr instanceof PostingError) {
          return res.status(ownErr.status).json({
            success: false,
            error: ownErr.message,
            code: ownErr.code,
            ...(ownErr.extra || {})
          });
        }
        throw ownErr;
      }

      const computed = computeInvoiceTotalsFromLines(lines || []);
      subtotal = computed.subtotal;
      tax_amount = computed.tax_amount;
      discount_amount = computed.discount_amount;
      total_amount = computed.total_amount;
      lineRows = computed.lines;
      createdBy = String(actor.userId || createdBy);
      if (!resolvedBranchId && actor.entityType === 'BRANCH') {
        resolvedBranchId = resolvedEntityId;
      }
    } else {
      // Legacy calculation (unchanged) — exclusive when flag is false
      subtotal = 0;
      tax_amount = 0;
      discount_amount = 0;
      for (const line of lines) {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = line.discount_amount || (lineSubtotal * (line.discount_percentage || 0) / 100);
        const lineTaxable = lineSubtotal - lineDiscount;
        const lineTax = lineTaxable * (line.tax_percentage || 15) / 100;
        subtotal += lineSubtotal;
        discount_amount += lineDiscount;
        tax_amount += lineTax;
      }
      total_amount = subtotal - discount_amount + tax_amount;
    }

    // Apply sales-invoice page settings (prefix, due days, defaults) — no FINANCE_POST_* change
    let invoiceDocSettings = {};
    try {
      const doc = await pageDocumentSettings.getDocSettings(
        'sales-invoices',
        pageDocumentSettings.resolveTenantId(req)
      );
      invoiceDocSettings = doc.value || {};
    } catch (settingsErr) {
      console.warn('sales-invoices settings skipped:', settingsErr.message);
    }

    if (!useService) {
      resolvedEntityId = resolveScopedEntityId(req, resolvedEntityId);
      resolvedEntityType = resolveScopedEntityType(req, resolvedEntityType);
    }

    if (invoiceDocSettings.require_customer !== false && !customer_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'العميل مطلوب حسب إعدادات فواتير المبيعات'
      });
    }

    let resolvedDueDate = due_date;
    if (!resolvedDueDate && invoice_date) {
      const dueDays = Number(invoiceDocSettings.due_days);
      if (Number.isFinite(dueDays) && dueDays >= 0) {
        const d = new Date(invoice_date);
        d.setDate(d.getDate() + dueDays);
        resolvedDueDate = d.toISOString().slice(0, 10);
      }
    }

    const allowPartial =
      allow_partial_payment != null
        ? allow_partial_payment
        : invoiceDocSettings.allow_partial_payment_default !== false;
    const allowInstall =
      allow_installments != null
        ? allow_installments
        : !!invoiceDocSettings.allow_installments_default;

    const defaultTaxPct = Number(invoiceDocSettings.default_tax_pct);
    let activeOffer = null;
    let resolvedTaxRate = Number.isFinite(defaultTaxPct) ? defaultTaxPct : null;
    let exemptItemCodes = [];
    if (!useService) {
      try {
        const taxHit = await resolveDefaultTaxRate(client, {
          entityId: resolvedEntityId,
          branchId: resolvedBranchId,
          onDate: invoice_date,
          applicableOn: 'invoice'
        });
        if (taxHit) {
          resolvedTaxRate = taxHit.rate;
          exemptItemCodes = taxHit.tax?.exempt_item_codes || [];
        }
      } catch (taxErr) {
        console.warn('tax_settings resolve skipped:', taxErr.message);
      }
      if (offer_code) {
        activeOffer = await loadActiveOffer(client, {
          entityId: resolvedEntityId,
          offerCode: offer_code
        });
        if (!activeOffer) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'رمز العرض غير صالح أو خارج فترة الصلاحية أو غير مفعّل'
          });
        }
      }
      const priced = applyOfferAndTaxToLines(lines, {
        offer: activeOffer,
        taxRate: resolvedTaxRate,
        settingsTaxPct: Number.isFinite(defaultTaxPct) ? defaultTaxPct : 0,
        exemptItemCodes
      });
      lineRows = priced.lines;
      subtotal = priced.subtotal;
      discount_amount = priced.discount_amount;
      tax_amount = priced.tax_amount;
      total_amount = priced.total_amount;
      if (activeOffer) {
        notes = [notes, `عرض ترويجي: ${activeOffer.offer_code}`].filter(Boolean).join(' | ');
      }
    }

    const invPrefix = String(invoiceDocSettings.number_prefix || 'INV').trim() || 'INV';
    const invoiceCurrency = String(invoiceDocSettings.default_currency || 'SAR').trim().toUpperCase() || 'SAR';
    const invoice_number = await generateNextNumber(invPrefix, 'finance_invoices', 'invoice_number');

    const invoiceResult = await client.query(
      `INSERT INTO finance_invoices 
       (invoice_number, invoice_date, due_date, customer_id, customer_name,
        subtotal, tax_amount, discount_amount, total_amount, remaining_amount,
        program_id, service_id, entity_type, entity_id, branch_id, incubator_id, platform_id,
        allow_partial_payment, allow_installments, notes, status, payment_status, created_by,
        street_name, postal_code, building_number, city, district, national_address_number, short_address,
        currency_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'ISSUED', 'UNPAID', $21, $22, $23, $24, $25, $26, $27, $28, $29)
       RETURNING *`,
      [invoice_number, invoice_date, resolvedDueDate, customer_id, customer.customer_name_ar,
       subtotal, tax_amount, discount_amount, total_amount, total_amount,
       program_id, service_id, resolvedEntityType, resolvedEntityId, resolvedBranchId, resolvedIncubatorId, platform_id,
       allowPartial, allowInstall, notes,
       createdBy,
       street_name || null,
       postal_code || null,
       building_number || null,
       city || null,
       district || null,
       national_address_number || null,
       short_address || null,
       invoiceCurrency]
    );

    const invoice_id = invoiceResult.rows[0].invoice_id;
    let invoiceRow = invoiceResult.rows[0];

    for (let i = 0; i < lineRows.length; i++) {
      const line = lineRows[i];
      if (useService) {
        await client.query(
          `INSERT INTO finance_invoice_lines 
           (invoice_id, line_number, item_code, item_name, description, quantity, unit_price,
            discount_percentage, discount_amount, tax_percentage, tax_amount, line_total, revenue_account_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [invoice_id, i + 1, line.item_code || null, line.item_name, line.description || null,
           line.quantity, line.unit_price, line.discount_percentage || 0, line.discount_amount,
           line.tax_percentage, line.tax_amount, line.line_total, line.revenue_account_id || null]
        );
      } else {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = Number(line.discount_amount);
        const resolvedDiscount = Number.isFinite(lineDiscount)
          ? lineDiscount
          : (lineSubtotal * (line.discount_percentage || 0) / 100);
        const lineTaxable = Math.max(0, lineSubtotal - resolvedDiscount);
        const taxPct = line.tax_percentage != null ? Number(line.tax_percentage) : 15;
        const lineTax = Number.isFinite(Number(line.tax_amount))
          ? Number(line.tax_amount)
          : lineTaxable * (taxPct || 0) / 100;
        const lineTotal = Number.isFinite(Number(line.line_total))
          ? Number(line.line_total)
          : lineTaxable + lineTax;
        await client.query(
          `INSERT INTO finance_invoice_lines 
           (invoice_id, line_number, item_code, item_name, description, quantity, unit_price,
            discount_percentage, discount_amount, tax_percentage, tax_amount, line_total, revenue_account_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [invoice_id, i + 1, line.item_code, line.item_name, line.description,
           line.quantity, line.unit_price, line.discount_percentage || 0, resolvedDiscount,
           taxPct || 0, lineTax, lineTotal, line.revenue_account_id]
        );
      }
    }

    let journal_entry_id;

    if (useService) {
      // Exclusive service path — same client, no nested COMMIT
      const posted = await postInvoiceIssue(client, invoice_id, {
        req,
        manageTransaction: false
      });
      journal_entry_id = posted.entry.entry_id;
      const refreshed = await client.query(
        `SELECT * FROM finance_invoices WHERE invoice_id = $1`,
        [invoice_id]
      );
      invoiceRow = refreshed.rows[0] || invoiceRow;
    } else {
      // Exclusive legacy path
      const entry_number = await generateNextNumber('JE', 'finance_journal_entries', 'entry_number');

      const journalResult = await client.query(
        `INSERT INTO finance_journal_entries 
         (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
          entity_type, entity_id, branch_id, incubator_id, status, is_posted, created_by)
         VALUES ($1, $2, 'AUTO', $3, $4, 'INVOICE', $5, $6, $7, $8, $9, 'POSTED', true, $10)
         RETURNING *`,
        [entry_number, invoice_date, `قيد آلي - فاتورة رقم ${invoice_number}`, invoice_number, invoice_id,
         resolvedEntityType, resolvedEntityId, resolvedBranchId, resolvedIncubatorId, createdBy]
      );

      journal_entry_id = journalResult.rows[0].entry_id;

      await client.query(
        `INSERT INTO finance_journal_lines 
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
         VALUES ($1, 1, (SELECT account_id FROM finance_accounts WHERE account_code = '1130'), '1130', $2, 0, $3)`,
        [journal_entry_id, total_amount, `ذمم مدينة - ${customer.customer_name_ar}`]
      );

      await client.query(
        `INSERT INTO finance_journal_lines 
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
         VALUES ($1, 2, (SELECT account_id FROM finance_accounts WHERE account_code = '4100'), '4100', 0, $2, $3)`,
        [journal_entry_id, subtotal - discount_amount, `إيرادات`]
      );

      if (tax_amount > 0) {
        await client.query(
          `INSERT INTO finance_journal_lines 
           (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
           VALUES ($1, 3, (SELECT account_id FROM finance_accounts WHERE account_code = '2140'), '2140', 0, $2, $3)`,
          [journal_entry_id, tax_amount, `ضريبة القيمة المضافة`]
        );
      }

      await client.query(
        'UPDATE finance_invoices SET journal_entry_id = $1 WHERE invoice_id = $2',
        [journal_entry_id, invoice_id]
      );
      invoiceRow = { ...invoiceRow, journal_entry_id };
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      invoice: invoiceRow,
      journal_entry_id,
      message: 'Invoice created successfully',
      meta: {
        posting_via_service: useService,
        finance_post_invoice_via_service: useService
      }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* */
    }
    if (error instanceof PostingError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code,
        ...(error.extra || {})
      });
    }
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
// B1.d.3.d: when FINANCE_POST_PAYMENT_VIA_SERVICE=true → postPaymentReceipt (exclusive).
// Default false → legacy inline JE + balance updates (unchanged). Never run both paths.
router.post('/payments', async (req, res) => {
  const client = await db.pool.connect();
  const useService = isFinancePostPaymentViaService();

  try {
    await ensurePaymentAddressColumns();
    await client.query('BEGIN');

    const {
      customer_id,
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

    let resolvedEntityId = entity_id || (req.userEntity ? req.userEntity.id : 'HQ001');
    let resolvedEntityType = entity_type || (req.userEntity ? req.userEntity.type : 'HQ');
    let resolvedBranchId = branch_id;
    let resolvedIncubatorId = incubator_id;
    let createdBy = req.headers['x-user-id'] || 'system';
    let actor = null;
    const allocList = Array.isArray(allocations) ? allocations : [];

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

    if (useService) {
      // Trusted session — ignore spoofed role/entity from headers/body for ownership
      actor = resolveActor({ req });
      if (!actor.authenticated) {
        await client.query('ROLLBACK');
        return res.status(401).json({
          success: false,
          error: 'يجب تسجيل الدخول بصلاحية خادمية موثوقة قبل إنشاء دفعة عبر خدمة الترحيل',
          code: 'AUTH_REQUIRED'
        });
      }
      if (!actor.entityId) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'جلسة المستخدم بلا كيان موثوق — مرفوض',
          code: 'ENTITY_SCOPE_REQUIRED'
        });
      }

      resolvedEntityId =
        entity_id != null && String(entity_id).trim() !== ''
          ? String(entity_id).trim()
          : String(actor.entityId);
      resolvedEntityType = entity_type || actor.entityType || null;
      try {
        assertEntityOwns(resolvedEntityId, actor, 'الدفعة');
      } catch (ownErr) {
        await client.query('ROLLBACK');
        if (ownErr instanceof PostingError) {
          return res.status(ownErr.status).json({
            success: false,
            error: ownErr.message,
            code: ownErr.code,
            ...(ownErr.extra || {})
          });
        }
        throw ownErr;
      }

      createdBy = String(actor.userId || createdBy);
      if (!resolvedBranchId && actor.entityType === 'BRANCH') {
        resolvedBranchId = resolvedEntityId;
      }
    }

    // ADVANCE-B (RC): block unallocated payments on BOTH legacy and service paths.
    // No customer-advance liability CoA in v1 — empty allocations must not Cr 1130.
    if (!allocList.length) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        success: false,
        error:
          'الدفعات غير المخصصة / العربون (ADVANCE) غير مسموحة في الإصدار الأول. يلزم تخصيص على فاتورة واحدة نظام عربون محاسبي متكامل لاحقًا.',
        code: 'ALLOCATIONS_REQUIRED',
        policy: 'ADVANCE_B',
        payment_type
      });
    }

    // Validate allocation total when allocations present (both paths)
    if (allocList.length) {
      const totalAllocated = allocList.reduce(
        (sum, a) => sum + parseFloat(a.allocated_amount),
        0
      );
      if (Math.abs(totalAllocated - Number(payment_amount)) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Total allocated amount must equal payment amount',
          payment_amount,
          totalAllocated
        });
      }
    }

    const storedPaymentAmount = useService ? roundMoney(payment_amount) : payment_amount;

    // B1.d.5a.3 — collection safety gate for BOTH legacy and service HTTP paths
    // (must not be nested under useService-only prechecks).
    let sortedAllocs = allocList;
    if (allocList.length) {
      sortedAllocs = [...allocList].sort(
        (a, b) => Number(a.invoice_id) - Number(b.invoice_id)
      );
      const seenGate = new Set();
      for (const allocation of sortedAllocs) {
        const invId = Number(allocation.invoice_id);
        if (seenGate.has(invId)) continue;
        seenGate.add(invId);
        try {
          await assertInvoiceIssueReadyForCollection(client, invId);
        } catch (gateErr) {
          await client.query('ROLLBACK');
          if (gateErr instanceof PostingError) {
            return res.status(gateErr.status).json({
              success: false,
              error: gateErr.message,
              code: gateErr.code,
              ...(gateErr.extra || {})
            });
          }
          throw gateErr;
        }
      }
    }

    // Lock invoices in stable order; block over-allocation on BOTH legacy and service paths.
    if (sortedAllocs.length) {
      const seenInv = new Set();
      for (const allocation of sortedAllocs) {
        const invId = Number(allocation.invoice_id);
        if (seenInv.has(invId)) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: 'تخصيص مكرر لنفس الفاتورة في طلب واحد مرفوض',
            code: 'DUPLICATE_ALLOCATION'
          });
        }
        seenInv.add(invId);

        const invRes = await client.query(
          `SELECT invoice_id, entity_id, total_amount, paid_amount, remaining_amount, status, payment_status
           FROM finance_invoices WHERE invoice_id = $1 FOR UPDATE`,
          [invId]
        );
        const inv = invRes.rows[0];
        if (!inv) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: `فاتورة التخصيص غير موجودة: ${invId}`,
            code: 'INVOICE_NOT_FOUND'
          });
        }
        if (useService && actor) {
          try {
            assertEntityOwns(inv.entity_id, actor, `فاتورة ${invId}`);
          } catch (ownErr) {
            await client.query('ROLLBACK');
            if (ownErr instanceof PostingError) {
              return res.status(ownErr.status).json({
                success: false,
                error: ownErr.message,
                code: ownErr.code,
                ...(ownErr.extra || {})
              });
            }
            throw ownErr;
          }
        }
        if (String(inv.entity_id) !== String(resolvedEntityId)) {
          await client.query('ROLLBACK');
          return res.status(403).json({
            success: false,
            error: 'تخصيص دفعة لفاتورة من كيان مختلف مرفوض',
            code: 'ALLOCATION_ENTITY_MISMATCH',
            payment_entity_id: String(resolvedEntityId),
            invoice_entity_id: String(inv.entity_id)
          });
        }
        const remaining = roundMoney(
          inv.remaining_amount != null
            ? inv.remaining_amount
            : Number(inv.total_amount) - Number(inv.paid_amount || 0)
        );
        const allocated = roundMoney(allocation.allocated_amount);
        if (remaining <= 0.01 || allocated > remaining + 0.01) {
          await client.query('ROLLBACK');
          return res.status(422).json({
            success: false,
            error: remaining <= 0.01
              ? 'الفاتورة مسددة بالكامل — لا يُسمح بتكرار التحصيل'
              : 'التخصيص يتجاوز المبلغ المتبقي للفاتورة',
            code: 'OVER_ALLOCATION',
            invoice_id: inv.invoice_id,
            remaining,
            allocated
          });
        }
      }
    }

    // Generate payment number
    const payment_number = await generateNextNumber('PAY', 'finance_payments', 'payment_number');

    // Create payment (service: PENDING until postPaymentReceipt; legacy: APPROVED as before)
    const paymentStatus = useService ? 'PENDING' : 'APPROVED';
    const paymentResult = await client.query(
      `INSERT INTO finance_payments 
       (payment_number, payment_date, customer_id, customer_name, payment_amount, payment_method,
        payment_type, bank_name, check_number, transaction_reference,
        street_name, postal_code, building_number, city, district, national_address_number, short_address,
        entity_type, entity_id, branch_id, incubator_id, notes, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
       RETURNING *`,
      [
        payment_number,
        payment_date,
        customer.customer_id,
        customer.customer_name_ar,
        storedPaymentAmount,
        payment_method,
        payment_type,
        bank_name,
        check_number,
        transaction_reference,
        street_name || null,
        postal_code || null,
        building_number || null,
        city || null,
        district || null,
        national_address_number || null,
        short_address || null,
        resolvedEntityType,
        resolvedEntityId,
        resolvedBranchId,
        resolvedIncubatorId,
        notes,
        paymentStatus,
        createdBy
      ]
    );

    const payment_id = paymentResult.rows[0].payment_id;
    let paymentRow = paymentResult.rows[0];
    let journal_entry_id;

    if (useService) {
      // Insert allocations only — balances + JE exclusively via postPaymentReceipt
      for (const allocation of sortedAllocs) {
        await client.query(
          `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount)
           VALUES ($1, $2, $3)`,
          [payment_id, allocation.invoice_id, roundMoney(allocation.allocated_amount)]
        );
      }

      const posted = await postPaymentReceipt(client, payment_id, {
        req,
        manageTransaction: false
      });
      journal_entry_id = posted.entry.entry_id;
      const refreshed = await client.query(
        `SELECT * FROM finance_payments WHERE payment_id = $1`,
        [payment_id]
      );
      paymentRow = refreshed.rows[0] || paymentRow;
    } else {
      // Exclusive legacy path — allocations guaranteed non-empty by ADVANCE-B guard above
      for (const allocation of allocList) {
        await client.query(
          `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount)
           VALUES ($1, $2, $3)`,
          [payment_id, allocation.invoice_id, allocation.allocated_amount]
        );

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
          [
            allocation.allocated_amount,
            allocation.allocated_amount,
            allocation.allocated_amount,
            allocation.allocated_amount,
            allocation.invoice_id
          ]
        );
      }

      const entry_number = await generateNextNumber('JE', 'finance_journal_entries', 'entry_number');

      const journalResult = await client.query(
        `INSERT INTO finance_journal_entries 
         (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
          entity_type, entity_id, branch_id, incubator_id, status, is_posted, created_by)
         VALUES ($1, $2, 'AUTO', $3, $4, 'PAYMENT', $5, $6, $7, $8, $9, 'POSTED', true, $10)
         RETURNING *`,
        [
          entry_number,
          payment_date,
          `قيد آلي - دفعة رقم ${payment_number}`,
          payment_number,
          payment_id,
          resolvedEntityType,
          resolvedEntityId,
          resolvedBranchId,
          resolvedIncubatorId,
          createdBy
        ]
      );

      journal_entry_id = journalResult.rows[0].entry_id;

      const cashAccount = payment_method === 'CASH' ? '1110' : '1120';
      await client.query(
        `INSERT INTO finance_journal_lines 
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
         VALUES ($1, 1, (SELECT account_id FROM finance_accounts WHERE account_code = $2), $3, $4, 0, $5)`,
        [
          journal_entry_id,
          cashAccount,
          cashAccount,
          payment_amount,
          `دفعة من ${customer.customer_name_ar}`
        ]
      );

      await client.query(
        `INSERT INTO finance_journal_lines 
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
         VALUES ($1, 2, (SELECT account_id FROM finance_accounts WHERE account_code = '1130'), '1130', 0, $2, $3)`,
        [journal_entry_id, payment_amount, `ذمم مدينة - ${customer.customer_name_ar}`]
      );

      await client.query(
        'UPDATE finance_payments SET journal_entry_id = $1 WHERE payment_id = $2',
        [journal_entry_id, payment_id]
      );
      const refreshedLegacy = await client.query(
        `SELECT * FROM finance_payments WHERE payment_id = $1`,
        [payment_id]
      );
      paymentRow = refreshedLegacy.rows[0] || paymentRow;
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      payment: paymentRow,
      journal_entry_id,
      message: 'Payment created successfully',
      meta: useService
        ? { posting_path: 'service', flag: 'FINANCE_POST_PAYMENT_VIA_SERVICE' }
        : { posting_path: 'legacy' }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* */
    }
    if (error instanceof PostingError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code,
        ...(error.extra || {})
      });
    }
    if (sendGuardError(res, error)) return;
    console.error('Error creating payment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Update payment — B1.d.3.e: posted lock + trusted entity ownership (no header/body role trust)
router.put('/payments/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const actor = resolveActor({ req });
    const body = req.body || {};
    const currentRes = await client.query(
      'SELECT * FROM finance_payments WHERE payment_id = $1 FOR UPDATE',
      [id]
    );
    if (!currentRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    const currentPayment = currentRes.rows[0];
    const financialChanged = PAYMENT_FINANCIAL_FIELDS.some((field) =>
      fieldPresentAndChanged(currentPayment, body, field)
    );
    let payment = currentPayment;
    if (financialChanged) {
      payment = await assertPaymentMutable(client, id, {
        forDelete: false,
        ctx: { req },
        forUpdate: true
      });
    } else if (currentPayment.journal_entry_id || actor.authenticated) {
      if (!actor.authenticated) {
        await client.query('ROLLBACK');
        return res.status(401).json({
          success: false,
          error: 'يجب تسجيل الدخول قبل تعديل دفعة مرحّلة',
          code: 'AUTH_REQUIRED'
        });
      }
      try {
        assertEntityOwns(currentPayment.entity_id, actor, 'الدفعة');
      } catch (ownErr) {
        await client.query('ROLLBACK');
        if (ownErr instanceof PostingError) {
          return res.status(ownErr.status).json({
            success: false,
            error: ownErr.message,
            code: ownErr.code
          });
        }
        throw ownErr;
      }
    }

    // Reject bypass attempts: clearing JE link, moving entity, or mutating posting fields
    const forbidden = [
      'journal_entry_id',
      'entity_id',
      'entity_type',
      'payment_id',
      'created_by'
    ];
    for (const f of forbidden) {
      if (Object.prototype.hasOwnProperty.call(body, f)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: `لا يمكن تعديل الحقل المحمي: ${f}`,
          code: 'PROTECTED_FIELD'
        });
      }
    }
    if (body.status != null) {
      const st = String(body.status).toUpperCase();
      if (st === 'DRAFT' || st === 'CANCELLED' || st === 'VOID') {
        // Draft payments may set status freely among non-posting bypass values only if still unposted
        // Re-check links already passed; still block DRAFT/VOID labels that confuse posted lifecycle
        if (payment.journal_entry_id) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: 'لا يمكن تغيير حالة دفعة مرتبطة بقيد إلى DRAFT/إلغاء من هذا المسار',
            code: 'POSTED_STATUS_LOCKED'
          });
        }
      }
    }

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
    } = body;

    const result = await client.query(
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
         AND entity_id IS NOT DISTINCT FROM $14
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
        id,
        payment.entity_id
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      payment: result.rows[0],
      meta: { entity_gate: 'assertPaymentMutable', actor_entity_id: actor.entityId }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* */
    }
    if (sendGuardError(res, error)) return;
    console.error('Error updating payment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Delete payment — B1.d.3.e: posted lock + trusted entity ownership
router.delete('/payments/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const actor = resolveActor({ req });
    const payment = await assertPaymentDeletable(client, id, { req });

    // Draft-only delete: remove unposted allocations then payment (no invoice balance side-effects here)
    await client.query('DELETE FROM finance_payment_allocations WHERE payment_id = $1', [id]);
    const result = await client.query(
      `DELETE FROM finance_payments
       WHERE payment_id = $1 AND entity_id IS NOT DISTINCT FROM $2
       RETURNING *`,
      [id, payment.entity_id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      payment: result.rows[0],
      meta: { entity_gate: 'assertPaymentDeletable', actor_entity_id: actor.entityId }
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* */
    }
    if (sendGuardError(res, error)) return;
    console.error('Error deleting payment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Cancel a posted collection: reverse its journal and restore the invoice balance.
router.post('/payments/:id/cancel', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!reason) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'سبب الإلغاء إلزامي', code: 'REASON_REQUIRED' });
    }

    const payRes = await client.query(
      'SELECT * FROM finance_payments WHERE payment_id = $1 FOR UPDATE',
      [id]
    );
    if (!payRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الدفعة غير موجودة', code: 'NOT_FOUND' });
    }
    const payment = payRes.rows[0];
    const actor = resolveActor({ req });
    if (!actor.authenticated) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        error: 'يجب تسجيل الدخول قبل إلغاء تحصيل مرحّل',
        code: 'AUTH_REQUIRED'
      });
    }
    try {
      assertEntityOwns(payment.entity_id, actor, 'الدفعة');
    } catch (ownErr) {
      await client.query('ROLLBACK');
      if (ownErr instanceof PostingError) {
        return res.status(ownErr.status).json({ success: false, error: ownErr.message, code: ownErr.code });
      }
      throw ownErr;
    }
    if (String(payment.status || '').toUpperCase() === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'التحصيل ملغى مسبقًا', code: 'ALREADY_CANCELLED' });
    }

    const allocs = await client.query(
      'SELECT invoice_id, allocated_amount FROM finance_payment_allocations WHERE payment_id = $1 ORDER BY invoice_id',
      [id]
    );
    let reversal = null;
    if (payment.journal_entry_id) {
      try {
        reversal = await reverseEntry(client, payment.journal_entry_id, {
          req,
          reason,
          manageTransaction: false
        });
      } catch (revErr) {
        if (!(revErr instanceof PostingError) || revErr.code !== 'ALREADY_REVERSED') throw revErr;
      }
    }

    for (const row of allocs.rows) {
      const amount = Number(row.allocated_amount || 0);
      await client.query(
        `UPDATE finance_invoices
         SET paid_amount = GREATEST(COALESCE(paid_amount, 0) - $1, 0),
             remaining_amount = LEAST(COALESCE(total_amount, 0), COALESCE(remaining_amount, 0) + $1),
             payment_status = CASE
               WHEN GREATEST(COALESCE(paid_amount, 0) - $1, 0) <= 0.009 THEN 'UNPAID'
               WHEN GREATEST(COALESCE(paid_amount, 0) - $1, 0) + 0.009 >= COALESCE(total_amount, 0) THEN 'PAID'
               ELSE 'PARTIAL'
             END,
             status = CASE
               WHEN UPPER(COALESCE(status, '')) = 'CANCELLED' THEN status
               WHEN GREATEST(COALESCE(paid_amount, 0) - $1, 0) + 0.009 >= COALESCE(total_amount, 0) THEN 'PAID'
               WHEN UPPER(COALESCE(status, '')) = 'PAID' THEN 'ISSUED'
               ELSE status
             END,
             updated_at = NOW()
         WHERE invoice_id = $2`,
        [amount, row.invoice_id]
      );
    }

    const updated = await client.query(
      `UPDATE finance_payments
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE payment_id = $1
       RETURNING *`,
      [id]
    );
    await client.query('COMMIT');
    res.json({
      success: true,
      payment: updated.rows[0],
      reversal_entry_id: reversal && reversal.entry ? reversal.entry.entry_id : null,
      message: 'تم إلغاء التحصيل وعكس أثره على الفاتورة'
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    if (error instanceof PostingError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code,
        ...(error.extra || {})
      });
    }
    if (sendGuardError(res, error)) return;
    console.error('Error cancelling payment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ========================================
// CUSTOMERS APIs
// ========================================

async function ensureCustomerAddressColumns() {
  await db.query(`
    ALTER TABLE finance_customers
    ADD COLUMN IF NOT EXISTS street_name TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT,
    ADD COLUMN IF NOT EXISTS building_number TEXT,
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS national_address_number TEXT,
    ADD COLUMN IF NOT EXISTS short_address TEXT,
    ADD COLUMN IF NOT EXISTS shipping_copy_billing BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS shipping_street_name TEXT,
    ADD COLUMN IF NOT EXISTS shipping_city TEXT,
    ADD COLUMN IF NOT EXISTS shipping_region TEXT,
    ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS email_secondary TEXT,
    ADD COLUMN IF NOT EXISTS mobile_secondary TEXT,
    ADD COLUMN IF NOT EXISTS company_name TEXT;
  `);
}

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
    // finance_customers has entity_id but no office_id/branch_id columns —
    // do not use getEntityFilter OFFICE branch (references missing c.office_id).
    const customerScope =
      userEntity.type === 'HQ'
        ? '1=1'
        : `c.entity_id = '${String(userEntity.id || '').replace(/'/g, "''")}'`;
    
    let query = `
      SELECT 
        c.*,
        COUNT(DISTINCT i.invoice_id) as invoices_count,
        COALESCE(SUM(i.total_amount), 0) as total_invoiced,
        COALESCE(SUM(i.remaining_amount), 0) as total_outstanding
      FROM finance_customers c
      LEFT JOIN finance_invoices i ON c.customer_id = i.customer_id
      WHERE ${customerScope}
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
    await ensureCustomerAddressColumns();
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

    let customerSettings = {};
    try {
      const doc = await pageDocumentSettings.getDocSettings(
        'customers',
        pageDocumentSettings.resolveTenantId(req)
      );
      customerSettings = doc.value || {};
      if (customerSettings.require_tax_number && !normalized.tax_number) {
        return res.status(400).json({
          success: false,
          error: 'الرقم الضريبي مطلوب حسب إعدادات العملاء'
        });
      }
      if (customerSettings.require_phone && !normalized.phone && !normalized.mobile) {
        return res.status(400).json({
          success: false,
          error: 'رقم الهاتف/الجوال مطلوب حسب إعدادات العملاء'
        });
      }
      if (customerSettings.require_email && !normalized.email) {
        return res.status(400).json({
          success: false,
          error: 'البريد الإلكتروني مطلوب حسب إعدادات العملاء'
        });
      }
    } catch (settingsErr) {
      console.warn('customer page settings skipped:', settingsErr.message);
    }

    const resolvedEntityId = resolveScopedEntityId(req, entity_id);
    const resolvedEntityType = resolveScopedEntityType(req, entity_type);
    if (!resolvedEntityId) {
      return res.status(400).json({
        success: false,
        error: 'entity_id is required — لا يُمنح HQ001 تلقائيًا'
      });
    }

    const resolvedCreditLimit =
      credit_limit != null && Number(credit_limit) !== 0
        ? credit_limit
        : Number(customerSettings.default_credit_limit) || credit_limit || 0;
    const resolvedCreditDays =
      credit_period_days != null && Number(credit_period_days) !== 30
        ? credit_period_days
        : Number(customerSettings.default_payment_terms_days) || credit_period_days || 30;

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
        resolvedCreditLimit,
        resolvedCreditDays,
        resolvedEntityType,
        resolvedEntityId,
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

router.isFinancePostInvoiceViaService = isFinancePostInvoiceViaService;
router.isFinancePostPaymentViaService = isFinancePostPaymentViaService;
module.exports = router;
module.exports.isFinancePostInvoiceViaService = isFinancePostInvoiceViaService;
module.exports.isFinancePostPaymentViaService = isFinancePostPaymentViaService;
