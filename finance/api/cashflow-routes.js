const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getRequestEntityContext } = require('../../entity-context');

const normalizeSignedAmount = (amount, direction) => {
  const numeric = parseFloat(amount || 0);
  if (Number.isNaN(numeric)) return null;
  if (!direction) return numeric;
  return direction.toUpperCase() === 'OUT' ? -Math.abs(numeric) : Math.abs(numeric);
};

const resolveScopedEntityId = (req, explicitEntityId = null) => {
  const context = getRequestEntityContext(req);
  if (context.type !== 'HQ') {
    return context.id;
  }
  return explicitEntityId || req.headers['x-entity-id'] || context.id;
};

const summarizeFlows = (rows = []) => {
  return rows.reduce(
    (acc, row) => {
      const amt = parseFloat(row.amount || 0);
      if (Number.isNaN(amt)) return acc;
      if (amt >= 0) {
        acc.inflow += amt;
      } else {
        acc.outflow += Math.abs(amt);
      }
      acc.net = acc.inflow - acc.outflow;
      return acc;
    },
    { inflow: 0, outflow: 0, net: 0 }
  );
};

// ========================================
// CASHFLOW APIs - الصفحة 1
// ========================================
// تطبيق التدفقات الثلاثة + التوقعات AI

// نظرة شاملة للتدفق النقدي (تشغيلي + استثماري + تمويلي)
router.get('/overview', async (req, res) => {
  const entityId = resolveScopedEntityId(req, req.query.entity_id);

  try {
    const [operating, investing, financing] = await Promise.all([
      db.query('SELECT * FROM finance_cashflow_operating WHERE entity_id = $1 ORDER BY flow_date DESC', [entityId]),
      db.query('SELECT * FROM finance_cashflow_investing WHERE entity_id = $1 ORDER BY flow_date DESC', [entityId]),
      db.query('SELECT * FROM finance_cashflow_financing WHERE entity_id = $1 ORDER BY flow_date DESC', [entityId])
    ]);

    const opSummary = summarizeFlows(operating.rows);
    const invSummary = summarizeFlows(investing.rows);
    const finSummary = summarizeFlows(financing.rows);

    const totalNet = opSummary.net + invSummary.net + finSummary.net;

    res.json({
      success: true,
      entity_id: entityId,
      generated_at: new Date().toISOString(),
      rows: operating.rows.length + investing.rows.length + financing.rows.length,
      operating: opSummary,
      investing: invSummary,
      financing: finSummary,
      total_net_cashflow: totalNet,
      cashflows: {
        operating: operating.rows,
        investing: investing.rows,
        financing: financing.rows
      }
    });
  } catch (error) {
    console.error('Error building cashflow overview:', error);
    res.status(500).json({ success: false, error: error.message || 'فشل في جلب ملخص التدفق النقدي' });
  }
});

// Helper function for entity filter
const getEntityFilter = (userEntity, tableAlias = '') => {
  const alias = tableAlias ? `${tableAlias}.` : '';
  
  if (userEntity.type === 'HQ') {
    return '1=1';
  } else if (userEntity.type === 'BRANCH') {
    return `${alias}branch_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  } else if (userEntity.type === 'INCUBATOR') {
    return `${alias}incubator_id = '${userEntity.id}' OR ${alias}entity_id = '${userEntity.id}'`;
  }
  
  return `${alias}entity_id = '${userEntity.id}'`;
};

// ========================================
// 1. التدفقات التشغيلية - Operating Cash Flow
// ========================================

// Get Operating Cash Flow
router.get('/operating', async (req, res) => {
  try {
    const { entity_id } = req.query;
    
    const result = await db.query(`
      SELECT * FROM finance_cashflow_operating 
      WHERE entity_id = $1
      ORDER BY flow_date DESC
    `, [resolveScopedEntityId(req, entity_id)]);
    
    const totalIn = result.rows.filter(r => r.amount > 0).reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const totalOut = Math.abs(result.rows.filter(r => r.amount < 0).reduce((sum, r) => sum + parseFloat(r.amount), 0));
    
    res.json({
      success: true,
      count: result.rows.length,
      summary: { inflow: totalIn, outflow: totalOut, net_flow: totalIn - totalOut },
      cashflows: result.rows
    });
  } catch (error) {
    console.error('Error fetching operating cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record Operating Cash Flow
router.post('/operating', async (req, res) => {
  try {
    const {
      transaction_date,
      flow_date, // Accept flow_date from frontend
      flow_type, // Accept flow_type from frontend
      flow_category, // 'CUSTOMER_COLLECTIONS', 'VENDOR_PAYMENTS', 'SALARIES', 'OPERATING_EXPENSES'
      amount,
      flow_direction, // 'IN' or 'OUT'
      description,
      reference_type,
      reference_id,
      entity_type,
      entity_id,
      branch_id,
      incubator_id,
      fiscal_year,
      fiscal_period
    } = req.body;
    
    // Use flow_date if transaction_date not provided
    const dateToUse = transaction_date || flow_date || new Date().toISOString().split('T')[0];
    
    // Map flow_type from frontend to flow_category
    const categoryMap = {
      'customer_collection': 'CUSTOMER_COLLECTIONS',
      'vendor_payment': 'VENDOR_PAYMENTS',
      'salary_payment': 'SALARIES',
      'rent_payment': 'OPERATING_EXPENSES',
      'utilities_payment': 'OPERATING_EXPENSES'
    };
    
    const categoryToUse = flow_category || categoryMap[flow_type] || 'OPERATING_EXPENSES';
    
    // Determine direction based on flow_type
    let directionToUse = flow_direction;
    if (!directionToUse && flow_type) {
      directionToUse = flow_type.includes('collection') ? 'IN' : 'OUT';
    } else if (!directionToUse) {
      directionToUse = 'OUT'; // default
    }
    
    const amountNumeric = parseFloat(amount || 0);
    const signedAmount = directionToUse === 'OUT' ? -Math.abs(amountNumeric) : Math.abs(amountNumeric);

    const result = await db.query(
      `INSERT INTO finance_cashflow 
       (transaction_date, flow_type, flow_category, amount, flow_direction, description,
        reference_type, reference_id, entity_type, entity_id, branch_id, incubator_id,
        fiscal_year, fiscal_period)
       VALUES ($1, 'OPERATING', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [dateToUse, categoryToUse, amountNumeric, directionToUse, description,
       reference_type, reference_id, entity_type, entity_id, branch_id, incubator_id,
       fiscal_year, fiscal_period]
    );

    const operatingRow = await db.query(
      `INSERT INTO finance_cashflow_operating
       (entity_id, flow_type, amount, description, flow_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [resolveScopedEntityId(req, entity_id), flow_type || categoryToUse, signedAmount, description, dateToUse, req.headers['x-user-id'] || 'WEB']
    );
    
    res.status(201).json({
      success: true,
      cashflow: operatingRow.rows[0],
      ledger: result.rows[0]
    });
  } catch (error) {
    console.error('Error recording operating cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Operating Cash Flow
router.put('/operating/:flow_id', async (req, res) => {
  try {
    const { flow_id } = req.params;
    if (!flow_id) return res.status(400).json({ success: false, error: 'flow_id is required' });

    const signedAmount = req.body.amount !== undefined
      ? (req.body.flow_direction ? normalizeSignedAmount(req.body.amount, req.body.flow_direction) : parseFloat(req.body.amount))
      : null;

    if (req.body.amount !== undefined && (signedAmount === null || Number.isNaN(signedAmount))) {
      return res.status(400).json({ success: false, error: 'amount must be a number' });
    }

    const result = await db.query(
      `UPDATE finance_cashflow_operating SET
        flow_type = COALESCE($1, flow_type),
        amount = COALESCE($2, amount),
        description = COALESCE($3, description),
        flow_date = COALESCE($4, flow_date),
        created_by = COALESCE($5, created_by)
       WHERE flow_id = $6 AND (entity_id = COALESCE($7, entity_id))
       RETURNING *`,
      [
        req.body.flow_type || null,
        signedAmount,
        req.body.description || null,
        req.body.flow_date || null,
        req.body.created_by || null,
        flow_id,
        resolveScopedEntityId(req, req.body.entity_id)
      ]
    );

    if (!result.rowCount) return res.status(404).json({ success: false, error: 'لم يتم العثور على السجل' });
    res.json({ success: true, cashflow: result.rows[0] });
  } catch (error) {
    console.error('Error updating operating cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Operating Cash Flow
router.delete('/operating/:flow_id', async (req, res) => {
  try {
    const { flow_id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id || req.body?.entity_id);
    if (!flow_id) return res.status(400).json({ success: false, error: 'flow_id is required' });

    const result = await db.query(
      'DELETE FROM finance_cashflow_operating WHERE flow_id = $1 AND (entity_id = COALESCE($2::varchar, entity_id))',
      [flow_id, entityId || null]
    );

    if (!result.rowCount) return res.status(404).json({ success: false, error: 'لم يتم العثور على السجل' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting operating cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// 2. التدفقات الاستثمارية - Investing Cash Flow
// ========================================

// Get Investing Cash Flow
router.get('/investing', async (req, res) => {
  try {
    const { entity_id } = req.query;
    
    const result = await db.query(`
      SELECT * FROM finance_cashflow_investing 
      WHERE entity_id = $1
      ORDER BY flow_date DESC
    `, [resolveScopedEntityId(req, entity_id)]);
    
    const totalIn = result.rows.filter(r => r.amount > 0).reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const totalOut = Math.abs(result.rows.filter(r => r.amount < 0).reduce((sum, r) => sum + parseFloat(r.amount), 0));
    
    res.json({
      success: true,
      count: result.rows.length,
      summary: { inflow: totalIn, outflow: totalOut, net_flow: totalIn - totalOut },
      cashflows: result.rows
    });
  } catch (error) {
    console.error('Error fetching investing cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record Investing Cash Flow
router.post('/investing', async (req, res) => {
  try {
    const {
      transaction_date,
      flow_date,
      flow_type,
      flow_category, // 'ASSET_PURCHASE', 'ASSET_SALE', 'PLATFORM_INVESTMENT'
      amount,
      flow_direction,
      description,
      reference_type,
      reference_id,
      entity_type,
      entity_id,
      branch_id,
      incubator_id,
      fiscal_year,
      fiscal_period
    } = req.body;
    
    const dateToUse = transaction_date || flow_date || new Date().toISOString().split('T')[0];
    
    const categoryMap = {
      'asset_purchase': 'ASSET_PURCHASE',
      'asset_sale': 'ASSET_SALE',
      'platform_investment': 'PLATFORM_INVESTMENT',
      'equipment_purchase': 'ASSET_PURCHASE'
    };
    
    const categoryToUse = flow_category || categoryMap[flow_type] || 'ASSET_PURCHASE';
    const directionToUse = flow_direction || (flow_type === 'asset_sale' ? 'IN' : 'OUT');
    
    const amountNumeric = parseFloat(amount || 0);
    const signedAmount = directionToUse === 'OUT' ? -Math.abs(amountNumeric) : Math.abs(amountNumeric);

    const result = await db.query(
      `INSERT INTO finance_cashflow 
       (transaction_date, flow_type, flow_category, amount, flow_direction, description,
        reference_type, reference_id, entity_type, entity_id, branch_id, incubator_id,
        fiscal_year, fiscal_period)
       VALUES ($1, 'INVESTING', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [dateToUse, categoryToUse, amountNumeric, directionToUse, description,
       reference_type, reference_id, entity_type, entity_id, branch_id, incubator_id,
       fiscal_year, fiscal_period]
    );

    const investingRow = await db.query(
      `INSERT INTO finance_cashflow_investing
       (entity_id, flow_type, amount, description, flow_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [resolveScopedEntityId(req, entity_id), flow_type || categoryToUse, signedAmount, description, dateToUse, req.headers['x-user-id'] || 'WEB']
    );
    
    res.status(201).json({
      success: true,
      cashflow: investingRow.rows[0],
      ledger: result.rows[0]
    });
  } catch (error) {
    console.error('Error recording investing cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/investing/:flow_id', async (req, res) => {
  try {
    const { flow_id } = req.params;
    if (!flow_id) return res.status(400).json({ success: false, error: 'flow_id is required' });

    const signedAmount = req.body.amount !== undefined
      ? (req.body.flow_direction ? normalizeSignedAmount(req.body.amount, req.body.flow_direction) : parseFloat(req.body.amount))
      : null;

    if (req.body.amount !== undefined && (signedAmount === null || Number.isNaN(signedAmount))) {
      return res.status(400).json({ success: false, error: 'amount must be a number' });
    }

    const result = await db.query(
      `UPDATE finance_cashflow_investing SET
        flow_type = COALESCE($1, flow_type),
        amount = COALESCE($2, amount),
        description = COALESCE($3, description),
        flow_date = COALESCE($4, flow_date),
        created_by = COALESCE($5, created_by)
       WHERE flow_id = $6 AND (entity_id = COALESCE($7, entity_id))
       RETURNING *`,
      [
        req.body.flow_type || null,
        signedAmount,
        req.body.description || null,
        req.body.flow_date || null,
        req.body.created_by || null,
        flow_id,
        resolveScopedEntityId(req, req.body.entity_id)
      ]
    );

    if (!result.rowCount) return res.status(404).json({ success: false, error: 'لم يتم العثور على السجل' });
    res.json({ success: true, cashflow: result.rows[0] });
  } catch (error) {
    console.error('Error updating investing cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/investing/:flow_id', async (req, res) => {
  try {
    const { flow_id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id || req.body?.entity_id);
    if (!flow_id) return res.status(400).json({ success: false, error: 'flow_id is required' });

    const result = await db.query(
      'DELETE FROM finance_cashflow_investing WHERE flow_id = $1 AND (entity_id = COALESCE($2::varchar, entity_id))',
      [flow_id, entityId || null]
    );

    if (!result.rowCount) return res.status(404).json({ success: false, error: 'لم يتم العثور على السجل' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting investing cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// 3. التدفقات التمويلية - Financing Cash Flow
// ========================================

// Get Financing Cash Flow
router.get('/financing', async (req, res) => {
  try {
    const { entity_id } = req.query;
    
    const result = await db.query(`
      SELECT * FROM finance_cashflow_financing 
      WHERE entity_id = $1
      ORDER BY flow_date DESC
    `, [resolveScopedEntityId(req, entity_id)]);
    
    const totalIn = result.rows.filter(r => r.amount > 0).reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const totalOut = Math.abs(result.rows.filter(r => r.amount < 0).reduce((sum, r) => sum + parseFloat(r.amount), 0));
    
    res.json({
      success: true,
      count: result.rows.length,
      summary: { inflow: totalIn, outflow: totalOut, net_flow: totalIn - totalOut },
      cashflows: result.rows
    });
  } catch (error) {
    console.error('Error fetching financing cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record Financing Cash Flow
router.post('/financing', async (req, res) => {
  try {
    const {
      transaction_date,
      flow_date,
      flow_type,
      flow_category, // 'LOANS', 'LOAN_REPAYMENT', 'CAPITAL_INCREASE'
      amount,
      flow_direction,
      description,
      reference_type,
      reference_id,
      entity_type,
      entity_id,
      branch_id,
      incubator_id,
      fiscal_year,
      fiscal_period
    } = req.body;
    
    const dateToUse = transaction_date || flow_date || new Date().toISOString().split('T')[0];
    
    const categoryMap = {
      'bank_loan': 'LOANS',
      'loan_repayment': 'LOAN_REPAYMENT',
      'capital_increase': 'CAPITAL_INCREASE',
      'dividend_payment': 'DIVIDENDS'
    };
    
    const categoryToUse = flow_category || categoryMap[flow_type] || 'LOANS';
    const directionToUse = flow_direction || (flow_type?.includes('repayment') || flow_type?.includes('dividend') ? 'OUT' : 'IN');
    
    const amountNumeric = parseFloat(amount || 0);
    const signedAmount = directionToUse === 'OUT' ? -Math.abs(amountNumeric) : Math.abs(amountNumeric);

    const result = await db.query(
      `INSERT INTO finance_cashflow 
       (transaction_date, flow_type, flow_category, amount, flow_direction, description,
        reference_type, reference_id, entity_type, entity_id, branch_id, incubator_id,
        fiscal_year, fiscal_period)
       VALUES ($1, 'FINANCING', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [dateToUse, categoryToUse, amountNumeric, directionToUse, description,
       reference_type, reference_id, entity_type, entity_id, branch_id, incubator_id,
       fiscal_year, fiscal_period]
    );

    const financingRow = await db.query(
      `INSERT INTO finance_cashflow_financing
       (entity_id, flow_type, amount, description, flow_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [resolveScopedEntityId(req, entity_id), flow_type || categoryToUse, signedAmount, description, dateToUse, req.headers['x-user-id'] || 'WEB']
    );
    
    res.status(201).json({
      success: true,
      cashflow: financingRow.rows[0],
      ledger: result.rows[0]
    });
  } catch (error) {
    console.error('Error recording financing cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/financing/:flow_id', async (req, res) => {
  try {
    const { flow_id } = req.params;
    if (!flow_id) return res.status(400).json({ success: false, error: 'flow_id is required' });

    const signedAmount = req.body.amount !== undefined
      ? (req.body.flow_direction ? normalizeSignedAmount(req.body.amount, req.body.flow_direction) : parseFloat(req.body.amount))
      : null;

    if (req.body.amount !== undefined && (signedAmount === null || Number.isNaN(signedAmount))) {
      return res.status(400).json({ success: false, error: 'amount must be a number' });
    }

    const result = await db.query(
      `UPDATE finance_cashflow_financing SET
        flow_type = COALESCE($1, flow_type),
        amount = COALESCE($2, amount),
        description = COALESCE($3, description),
        flow_date = COALESCE($4, flow_date),
        created_by = COALESCE($5, created_by)
       WHERE flow_id = $6 AND (entity_id = COALESCE($7, entity_id))
       RETURNING *`,
      [
        req.body.flow_type || null,
        signedAmount,
        req.body.description || null,
        req.body.flow_date || null,
        req.body.created_by || null,
        flow_id,
        resolveScopedEntityId(req, req.body.entity_id)
      ]
    );

    if (!result.rowCount) return res.status(404).json({ success: false, error: 'لم يتم العثور على السجل' });
    res.json({ success: true, cashflow: result.rows[0] });
  } catch (error) {
    console.error('Error updating financing cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/financing/:flow_id', async (req, res) => {
  try {
    const { flow_id } = req.params;
    const entityId = resolveScopedEntityId(req, req.query.entity_id || req.body?.entity_id);
    if (!flow_id) return res.status(400).json({ success: false, error: 'flow_id is required' });

    const result = await db.query(
      'DELETE FROM finance_cashflow_financing WHERE flow_id = $1 AND (entity_id = COALESCE($2::varchar, entity_id))',
      [flow_id, entityId || null]
    );

    if (!result.rowCount) return res.status(404).json({ success: false, error: 'لم يتم العثور على السجل' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting financing cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// 4. التوقعات المستقبلية - AI Forecasting
// ========================================

// Get AI Cashflow Forecast
router.get('/forecasts', async (req, res) => {
  try {
    const { entity_id } = req.query;
    
    const result = await db.query(`
      SELECT * FROM finance_ai_forecasts 
      WHERE entity_id = $1
      ORDER BY created_at DESC
    `, [resolveScopedEntityId(req, entity_id)]);
    
    res.json({
      success: true,
      count: result.rows.length,
      forecasts: result.rows
    });
  } catch (error) {
    console.error('Error fetching AI forecasts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/forecast', async (req, res) => {
  try {
    const { entity_id } = req.query;
    
    const result = await db.query(`
      SELECT * FROM finance_ai_forecasts 
      WHERE entity_id = $1
      ORDER BY created_at DESC
    `, [resolveScopedEntityId(req, entity_id)]);
    
    res.json({
      success: true,
      count: result.rows.length,
      forecasts: result.rows
    });
  } catch (error) {
    console.error('Error fetching AI forecasts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create AI Cashflow Forecast (Basic - سيتم تطويره لاحقاً)
router.post('/forecast', async (req, res) => {
  try {
    const {
      forecast_type, // 'surplus', 'deficit' from frontend OR 'CASHFLOW', 'DEFICIT', 'SURPLUS'
      forecast_period, // 'MONTHLY', 'QUARTERLY', 'ANNUAL'
      forecast_date,
      start_date,
      end_date,
      predicted_amount, // from frontend
      forecasted_value, // backend format
      confidence_level,
      lower_bound,
      upper_bound,
      influencing_factors, // from frontend
      entity_type,
      entity_id,
      branch_id,
      incubator_id,
      model_version = 'v1.0',
      input_data,
      model_parameters
    } = req.body;
    
    // Convert frontend format to existing table format
    const typeToUse = forecast_type || 'surplus';
    const periodToUse = forecast_period || (forecast_date ? new Date(forecast_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'غير محدد');
    const amountToUse = forecast_amount || forecasted_value || predicted_amount || 0;
    const confidenceToUse = confidence_level;
    const modelToUse = model_version || 'Naiosh-AI v1';
    const insightsToUse = input_data || (influencing_factors ? { factors: influencing_factors } : null);

    const result = await db.query(
      `INSERT INTO finance_ai_forecasts 
       (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level, ai_model, ai_insights)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [resolveScopedEntityId(req, entity_id), periodToUse, typeToUse, amountToUse, confidenceToUse, modelToUse, insightsToUse]
    );
    
    res.status(201).json({
      success: true,
      forecast: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating AI forecast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// 5. Comprehensive Cashflow Report (All Three Types)
// ========================================

router.get('/comprehensive', async (req, res) => {
  try {
    const userEntity = req.userEntity || { type: 'HQ', id: 'HQ001' };
    const { from_date, to_date, fiscal_year } = req.query;
    
    let query = `
      SELECT 
        flow_type,
        flow_category,
        flow_direction,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM finance_cashflow
      WHERE ${getEntityFilter(userEntity)}
    `;
    
    const params = [];
    
    if (from_date) {
      params.push(from_date);
      query += ` AND transaction_date >= $${params.length}`;
    }
    
    if (to_date) {
      params.push(to_date);
      query += ` AND transaction_date <= $${params.length}`;
    }
    
    if (fiscal_year) {
      params.push(fiscal_year);
      query += ` AND fiscal_year = $${params.length}`;
    }
    
    query += ` GROUP BY flow_type, flow_category, flow_direction
               ORDER BY flow_type, flow_category`;
    
    const result = await db.query(query, params);
    
    // تنظيم النتائج حسب نوع التدفق
    const operating = result.rows.filter(r => r.flow_type === 'OPERATING');
    const investing = result.rows.filter(r => r.flow_type === 'INVESTING');
    const financing = result.rows.filter(r => r.flow_type === 'FINANCING');
    
    // حساب الإجماليات لكل نوع
    const calcNetFlow = (flows) => {
      const inflow = flows
        .filter(f => f.flow_direction === 'IN')
        .reduce((sum, f) => sum + parseFloat(f.total_amount), 0);
      const outflow = flows
        .filter(f => f.flow_direction === 'OUT')
        .reduce((sum, f) => sum + parseFloat(f.total_amount), 0);
      return { inflow, outflow, net: inflow - outflow };
    };
    
    const operatingNet = calcNetFlow(operating);
    const investingNet = calcNetFlow(investing);
    const financingNet = calcNetFlow(financing);
    
    const totalNetCashFlow = operatingNet.net + investingNet.net + financingNet.net;
    
    res.json({
      success: true,
      summary: {
        operating: operatingNet,
        investing: investingNet,
        financing: financingNet,
        total_net_cashflow: totalNetCashFlow
      },
      details: {
        operating: operating,
        investing: investing,
        financing: financing
      }
    });
  } catch (error) {
    console.error('Error fetching comprehensive cashflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Overview endpoint
router.get('/overview', async (req, res) => {
  try {
    const { entity_id } = req.query;
    
    // Operating
    const operating = await db.query(`SELECT * FROM finance_cashflow_operating WHERE entity_id = $1`, [resolveScopedEntityId(req, entity_id)]);
    const opIn = operating.rows.filter(r => r.amount > 0).reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const opOut = Math.abs(operating.rows.filter(r => r.amount < 0).reduce((sum, r) => sum + parseFloat(r.amount), 0));
    
    // Investing
    const investing = await db.query(`SELECT * FROM finance_cashflow_investing WHERE entity_id = $1`, [resolveScopedEntityId(req, entity_id)]);
    const invIn = investing.rows.filter(r => r.amount > 0).reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const invOut = Math.abs(investing.rows.filter(r => r.amount < 0).reduce((sum, r) => sum + parseFloat(r.amount), 0));
    
    // Financing
    const financing = await db.query(`SELECT * FROM finance_cashflow_financing WHERE entity_id = $1`, [resolveScopedEntityId(req, entity_id)]);
    const finIn = financing.rows.filter(r => r.amount > 0).reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const finOut = Math.abs(financing.rows.filter(r => r.amount < 0).reduce((sum, r) => sum + parseFloat(r.amount), 0));
    
    res.json({
      success: true,
      operating: { inflow: opIn, outflow: opOut, net_cashflow: opIn - opOut },
      investing: { inflow: invIn, outflow: invOut, net_cashflow: invIn - invOut },
      financing: { inflow: finIn, outflow: finOut, net_cashflow: finIn - finOut },
      total_net_cashflow: (opIn - opOut) + (invIn - invOut) + (finIn - finOut)
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
