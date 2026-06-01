const express = require('express');
const router = express.Router();
const db = require('../../db');
const { buildEntityScopeCondition } = require('../../entity-context');

const resolveEntity = (req) => {
  const entityId = req.body?.entity_id || req.query?.entity_id || req.headers['x-entity-id'];
  const entityType = req.body?.entity_type || req.query?.entity_type || req.headers['x-entity-type'];
  return { entityId, entityType: entityType || 'HQ' };
};

const ensureEntity = (req, res) => {
  const { entityId, entityType } = resolveEntity(req);
  if (!entityId) {
    res.status(400).json({ success: false, error: 'entity_id is required' });
    return null;
  }
  return { entityId, entityType };
};

const resolveAccount = async (client, { accountId, accountCode }) => {
  if (accountId) {
    const result = await client.query(
      'SELECT account_id, account_code FROM finance_accounts WHERE account_id = $1',
      [accountId]
    );
    return result.rows[0] || null;
  }
  if (accountCode) {
    const result = await client.query(
      'SELECT account_id, account_code FROM finance_accounts WHERE account_code = $1',
      [accountCode]
    );
    return result.rows[0] || null;
  }
  return null;
};

const getRunForEntity = async (client, runId, entityContext) => {
  const result = await client.query(
    `SELECT * FROM finance_payroll_runs
     WHERE run_id = $1 AND ${buildEntityScopeCondition(entityContext, 'entity_id', 2)}`,
    [runId, entityContext.id]
  );
  return result.rows[0] || null;
};

const toCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

// =========================
// Employees
// =========================

router.get('/employees', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { entityId } = context;
  const { employment_type, is_active, q } = req.query;

  try {
    const conditions = [buildEntityScopeCondition(context, 'entity_id', 1)];
    const values = [entityId];
    let idx = 2;

    if (employment_type) {
      conditions.push(`employment_type = $${idx}`);
      values.push(employment_type);
      idx++;
    }
    if (is_active !== undefined) {
      conditions.push(`is_active = $${idx}`);
      values.push(is_active === 'true');
      idx++;
    }
    if (q) {
      conditions.push(`(full_name_ar ILIKE $${idx} OR full_name_en ILIKE $${idx} OR employee_code ILIKE $${idx})`);
      values.push(`%${q}%`);
      idx++;
    }

    const result = await db.query(
      `SELECT * FROM finance_payroll_employees
       WHERE ${conditions.join(' AND ')}
       ORDER BY employee_id DESC`,
      values
    );

    res.json({ success: true, employees: result.rows });
  } catch (error) {
    console.error('Error fetching payroll employees:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/employees', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const {
    employee_code,
    full_name_ar,
    full_name_en,
    employment_type,
    hire_date,
    end_date,
    base_salary,
    bank_name,
    bank_iban,
    bank_account,
    social_insurance_number,
    insurance_number,
    branch_id,
    incubator_id,
    platform_id,
    office_id,
    is_active,
    notes,
    created_by
  } = req.body || {};

  if (!employee_code || !full_name_ar) {
    return res.status(400).json({ success: false, error: 'employee_code and full_name_ar are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO finance_payroll_employees (
        employee_code, full_name_ar, full_name_en, employment_type, hire_date, end_date, base_salary,
        bank_name, bank_iban, bank_account, social_insurance_number, insurance_number,
        entity_type, entity_id, branch_id, incubator_id, platform_id, office_id,
        is_active, notes, created_at, updated_at, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,
        $19,$20,NOW(),NOW(),$21
      ) RETURNING *`,
      [
        employee_code,
        full_name_ar,
        full_name_en || null,
        employment_type || 'EMPLOYEE',
        hire_date || null,
        end_date || null,
        base_salary || 0,
        bank_name || null,
        bank_iban || null,
        bank_account || null,
        social_insurance_number || null,
        insurance_number || null,
        context.entityType,
        context.entityId,
        branch_id || null,
        incubator_id || null,
        platform_id || null,
        office_id || null,
        is_active === undefined ? true : Boolean(is_active),
        notes || null,
        created_by || 'SYSTEM'
      ]
    );

    res.status(201).json({ success: true, employee: result.rows[0] });
  } catch (error) {
    console.error('Error creating payroll employee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/employees/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const payload = req.body || {};

  try {
    const existing = await db.query(
      'SELECT employee_id, entity_id FROM finance_payroll_employees WHERE employee_id = $1',
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن تعديل موظف لكيان آخر' });
    }

    const fields = [
      'employee_code', 'full_name_ar', 'full_name_en', 'employment_type', 'hire_date', 'end_date', 'base_salary',
      'bank_name', 'bank_iban', 'bank_account', 'social_insurance_number', 'insurance_number',
      'branch_id', 'incubator_id', 'platform_id', 'office_id', 'is_active', 'notes', 'updated_by'
    ];

    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const field of fields) {
      if (field in payload) {
        setClauses.push(`${field} = COALESCE($${idx}, ${field})`);
        values.push(payload[field]);
        idx++;
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await db.query(
      `UPDATE finance_payroll_employees SET ${setClauses.join(', ')} WHERE employee_id = $${idx} RETURNING *`,
      values
    );

    res.json({ success: true, employee: result.rows[0] });
  } catch (error) {
    console.error('Error updating payroll employee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/employees/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;

  try {
    const existing = await db.query(
      'SELECT employee_id, entity_id FROM finance_payroll_employees WHERE employee_id = $1',
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن حذف موظف لكيان آخر' });
    }

    await db.query('DELETE FROM finance_payroll_employees WHERE employee_id = $1', [id]);
    res.json({ success: true, message: 'تم حذف الموظف' });
  } catch (error) {
    console.error('Error deleting payroll employee:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================
// Payroll Components
// =========================

router.get('/components', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { entityId } = context;
  const { component_type, is_active, q } = req.query;

  try {
    const conditions = [buildEntityScopeCondition(context, 'entity_id', 1)];
    const values = [entityId];
    let idx = 2;

    if (component_type) {
      conditions.push(`component_type = $${idx}`);
      values.push(component_type);
      idx++;
    }
    if (is_active !== undefined) {
      conditions.push(`is_active = $${idx}`);
      values.push(is_active === 'true');
      idx++;
    }
    if (q) {
      conditions.push(`(component_name_ar ILIKE $${idx} OR component_name_en ILIKE $${idx} OR component_code ILIKE $${idx})`);
      values.push(`%${q}%`);
      idx++;
    }

    const result = await db.query(
      `SELECT * FROM finance_payroll_components
       WHERE ${conditions.join(' AND ')}
       ORDER BY component_id DESC`,
      values
    );

    res.json({ success: true, components: result.rows });
  } catch (error) {
    console.error('Error fetching payroll components:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/components', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const {
    component_code,
    component_name_ar,
    component_name_en,
    component_type,
    calculation_method,
    default_amount,
    is_taxable,
    is_active
  } = req.body || {};

  if (!component_code || !component_name_ar || !component_type) {
    return res.status(400).json({
      success: false,
      error: 'component_code, component_name_ar, and component_type are required'
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO finance_payroll_components (
        component_code, component_name_ar, component_name_en, component_type,
        calculation_method, default_amount, is_taxable, is_active,
        entity_type, entity_id, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING *`,
      [
        component_code,
        component_name_ar,
        component_name_en || null,
        component_type,
        calculation_method || 'FIXED',
        default_amount || 0,
        is_taxable === undefined ? false : Boolean(is_taxable),
        is_active === undefined ? true : Boolean(is_active),
        context.entityType,
        context.entityId
      ]
    );

    res.status(201).json({ success: true, component: result.rows[0] });
  } catch (error) {
    console.error('Error creating payroll component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/components/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const payload = req.body || {};

  try {
    const existing = await db.query(
      'SELECT component_id, entity_id FROM finance_payroll_components WHERE component_id = $1',
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن تعديل مكون لكيان آخر' });
    }

    const fields = [
      'component_code', 'component_name_ar', 'component_name_en', 'component_type',
      'calculation_method', 'default_amount', 'is_taxable', 'is_active'
    ];

    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const field of fields) {
      if (field in payload) {
        setClauses.push(`${field} = COALESCE($${idx}, ${field})`);
        values.push(payload[field]);
        idx++;
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await db.query(
      `UPDATE finance_payroll_components SET ${setClauses.join(', ')} WHERE component_id = $${idx} RETURNING *`,
      values
    );

    res.json({ success: true, component: result.rows[0] });
  } catch (error) {
    console.error('Error updating payroll component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/components/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;

  try {
    const existing = await db.query(
      'SELECT component_id, entity_id FROM finance_payroll_components WHERE component_id = $1',
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن حذف مكون لكيان آخر' });
    }

    await db.query('DELETE FROM finance_payroll_components WHERE component_id = $1', [id]);
    res.json({ success: true, message: 'تم حذف المكون' });
  } catch (error) {
    console.error('Error deleting payroll component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================
// Employee Components
// =========================

router.get('/employee-components', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { entityId } = context;
  const { employee_id, component_id, is_active } = req.query;

  try {
    const conditions = [
      'ec.employee_id = e.employee_id',
      'ec.component_id = c.component_id',
      buildEntityScopeCondition(context, 'e.entity_id', 1)
    ];
    const values = [entityId];
    let idx = 2;

    if (employee_id) {
      conditions.push(`ec.employee_id = $${idx}`);
      values.push(employee_id);
      idx++;
    }
    if (component_id) {
      conditions.push(`ec.component_id = $${idx}`);
      values.push(component_id);
      idx++;
    }
    if (is_active !== undefined) {
      conditions.push(`ec.is_active = $${idx}`);
      values.push(is_active === 'true');
      idx++;
    }

    const result = await db.query(
      `SELECT
         ec.*, e.employee_code, e.full_name_ar, e.full_name_en,
         c.component_code, c.component_name_ar, c.component_type
       FROM finance_payroll_employee_components ec
       JOIN finance_payroll_employees e ON ec.employee_id = e.employee_id
       JOIN finance_payroll_components c ON ec.component_id = c.component_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ec.employee_component_id DESC`,
      values
    );

    res.json({ success: true, employee_components: result.rows });
  } catch (error) {
    console.error('Error fetching employee components:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/employee-components', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { employee_id, component_id, amount, percentage, is_active, notes } = req.body || {};

  if (!employee_id || !component_id) {
    return res.status(400).json({ success: false, error: 'employee_id and component_id are required' });
  }

  try {
    const employee = await db.query(
      'SELECT employee_id, entity_id FROM finance_payroll_employees WHERE employee_id = $1',
      [employee_id]
    );
    if (!employee.rows.length) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (employee.rows[0].entity_id && employee.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن ربط مكون بموظف لكيان آخر' });
    }

    const component = await db.query(
      'SELECT component_id FROM finance_payroll_components WHERE component_id = $1',
      [component_id]
    );
    if (!component.rows.length) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }

    const result = await db.query(
      `INSERT INTO finance_payroll_employee_components (
        employee_id, component_id, amount, percentage, is_active, notes, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
      RETURNING *`,
      [
        employee_id,
        component_id,
        amount || 0,
        percentage || null,
        is_active === undefined ? true : Boolean(is_active),
        notes || null
      ]
    );

    res.status(201).json({ success: true, employee_component: result.rows[0] });
  } catch (error) {
    console.error('Error creating employee component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/employee-components/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const payload = req.body || {};

  try {
    const existing = await db.query(
      `SELECT ec.employee_component_id, e.entity_id
       FROM finance_payroll_employee_components ec
       JOIN finance_payroll_employees e ON ec.employee_id = e.employee_id
       WHERE ec.employee_component_id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Employee component not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن تعديل مكون موظف لكيان آخر' });
    }

    const fields = ['amount', 'percentage', 'is_active', 'notes'];
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const field of fields) {
      if (field in payload) {
        setClauses.push(`${field} = COALESCE($${idx}, ${field})`);
        values.push(payload[field]);
        idx++;
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE finance_payroll_employee_components
       SET ${setClauses.join(', ')}
       WHERE employee_component_id = $${idx}
       RETURNING *`,
      values
    );

    res.json({ success: true, employee_component: result.rows[0] });
  } catch (error) {
    console.error('Error updating employee component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/employee-components/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;

  try {
    const existing = await db.query(
      `SELECT ec.employee_component_id, e.entity_id
       FROM finance_payroll_employee_components ec
       JOIN finance_payroll_employees e ON ec.employee_id = e.employee_id
       WHERE ec.employee_component_id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Employee component not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن حذف مكون موظف لكيان آخر' });
    }

    await db.query('DELETE FROM finance_payroll_employee_components WHERE employee_component_id = $1', [id]);
    res.json({ success: true, message: 'تم حذف مكون الموظف' });
  } catch (error) {
    console.error('Error deleting employee component:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================
// Payroll Reports
// =========================

router.get('/reports/summary', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { entityId } = context;
  const { period_year, period_month, status } = req.query;

  try {
    const conditions = [buildEntityScopeCondition(context, 'entity_id', 1)];
    const values = [entityId];
    let idx = 2;

    if (period_year) {
      conditions.push(`period_year = $${idx}`);
      values.push(period_year);
      idx++;
    }
    if (period_month) {
      conditions.push(`period_month = $${idx}`);
      values.push(period_month);
      idx++;
    }
    if (status) {
      conditions.push(`status = $${idx}`);
      values.push(status);
      idx++;
    }

    const runsResult = await db.query(
      `SELECT run_id, run_number, period_year, period_month, run_date, status,
              total_gross, total_deductions, total_net, journal_entry_id
       FROM finance_payroll_runs
       WHERE ${conditions.join(' AND ')}
       ORDER BY period_year DESC, period_month DESC, run_id DESC`,
      values
    );

    const summary = runsResult.rows.reduce(
      (acc, run) => {
        acc.total_runs += 1;
        acc.total_gross += Number(run.total_gross || 0);
        acc.total_deductions += Number(run.total_deductions || 0);
        acc.total_net += Number(run.total_net || 0);
        acc.by_status[run.status] = (acc.by_status[run.status] || 0) + 1;
        return acc;
      },
      { total_runs: 0, total_gross: 0, total_deductions: 0, total_net: 0, by_status: {} }
    );

    res.json({ success: true, runs: runsResult.rows, summary });
  } catch (error) {
    console.error('Error building payroll summary report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/run-details', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { run_id } = req.query;
  if (!run_id) {
    return res.status(400).json({ success: false, error: 'run_id is required' });
  }

  try {
    const runResult = await db.query(
      `SELECT * FROM finance_payroll_runs
       WHERE run_id = $1 AND ${buildEntityScopeCondition(context, 'entity_id', 2)}`,
      [run_id, context.entityId]
    );
    if (!runResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Payroll run not found' });
    }

    const itemsResult = await db.query(
      `SELECT
         pi.*, e.employee_code, e.full_name_ar, e.full_name_en
       FROM finance_payroll_items pi
       JOIN finance_payroll_employees e ON pi.employee_id = e.employee_id
       WHERE pi.run_id = $1
       ORDER BY pi.item_id`,
      [run_id]
    );

    const items = itemsResult.rows;
    const itemIds = items.map((item) => item.item_id);
    const linesResult = itemIds.length
      ? await db.query(
          `SELECT * FROM finance_payroll_item_lines WHERE item_id = ANY($1) ORDER BY line_id`,
          [itemIds]
        )
      : { rows: [] };

    const totals = items.reduce(
      (acc, item) => {
        acc.total_gross += Number(item.gross_amount || 0);
        acc.total_deductions += Number(item.deductions_amount || 0);
        acc.total_net += Number(item.net_amount || 0);
        return acc;
      },
      { total_gross: 0, total_deductions: 0, total_net: 0 }
    );

    res.json({
      success: true,
      run: runResult.rows[0],
      totals,
      items,
      lines: linesResult.rows
    });
  } catch (error) {
    console.error('Error building payroll run detail report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================
// Bank Batches
// =========================

router.get('/bank-batches', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { entityId } = context;
  const { run_id, status } = req.query;

  try {
    const conditions = [buildEntityScopeCondition(context, 'r.entity_id', 1)];
    const values = [entityId];
    let idx = 2;

    if (run_id) {
      conditions.push(`b.run_id = $${idx}`);
      values.push(run_id);
      idx++;
    }
    if (status) {
      conditions.push(`b.status = $${idx}`);
      values.push(status);
      idx++;
    }

    const result = await db.query(
      `SELECT
         b.*, r.run_number, r.period_year, r.period_month
       FROM finance_payroll_bank_batches b
       JOIN finance_payroll_runs r ON b.run_id = r.run_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.batch_id DESC`,
      values
    );

    res.json({ success: true, batches: result.rows });
  } catch (error) {
    console.error('Error fetching payroll bank batches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/bank-batches', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { run_id, bank_name, file_reference } = req.body || {};

  if (!run_id) {
    return res.status(400).json({ success: false, error: 'run_id is required' });
  }

  try {
    const run = await db.query(
      'SELECT run_id, entity_id FROM finance_payroll_runs WHERE run_id = $1',
      [run_id]
    );
    if (!run.rows.length) {
      return res.status(404).json({ success: false, error: 'Payroll run not found' });
    }
    if (run.rows[0].entity_id && run.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن إنشاء دفعة لبنك لكيان آخر' });
    }

    const result = await db.query(
      `INSERT INTO finance_payroll_bank_batches (
        run_id, bank_name, file_reference, status, generated_at
      ) VALUES ($1,$2,$3,'GENERATED',NOW())
      RETURNING *`,
      [run_id, bank_name || null, file_reference || `BANK-${Date.now()}`]
    );

    res.status(201).json({ success: true, batch: result.rows[0] });
  } catch (error) {
    console.error('Error creating payroll bank batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/bank-batches/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const payload = req.body || {};

  try {
    const existing = await db.query(
      `SELECT b.batch_id, r.entity_id
       FROM finance_payroll_bank_batches b
       JOIN finance_payroll_runs r ON b.run_id = r.run_id
       WHERE b.batch_id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Bank batch not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن تعديل دفعة لبنك لكيان آخر' });
    }

    const fields = ['bank_name', 'file_reference', 'status', 'sent_at'];
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const field of fields) {
      if (field in payload) {
        setClauses.push(`${field} = COALESCE($${idx}, ${field})`);
        values.push(payload[field]);
        idx++;
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE finance_payroll_bank_batches
       SET ${setClauses.join(', ')}
       WHERE batch_id = $${idx}
       RETURNING *`,
      values
    );

    res.json({ success: true, batch: result.rows[0] });
  } catch (error) {
    console.error('Error updating payroll bank batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/bank-batches/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;

  try {
    const existing = await db.query(
      `SELECT b.batch_id, r.entity_id
       FROM finance_payroll_bank_batches b
       JOIN finance_payroll_runs r ON b.run_id = r.run_id
       WHERE b.batch_id = $1`,
      [id]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Bank batch not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن حذف دفعة لبنك لكيان آخر' });
    }

    const result = await db.query(
      'DELETE FROM finance_payroll_bank_batches WHERE batch_id = $1 RETURNING *',
      [id]
    );

    res.json({ success: true, batch: result.rows[0] });
  } catch (error) {
    console.error('Error deleting payroll bank batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bank-batches/:id/export', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;

  try {
    const batchResult = await db.query(
      `SELECT b.batch_id, b.run_id, b.bank_name, b.file_reference, b.generated_at,
              r.run_number, r.period_year, r.period_month, r.entity_id
       FROM finance_payroll_bank_batches b
       JOIN finance_payroll_runs r ON b.run_id = r.run_id
       WHERE b.batch_id = $1`,
      [id]
    );

    if (!batchResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Bank batch not found' });
    }

    const batch = batchResult.rows[0];
    if (batch.entity_id && batch.entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن تصدير دفعة لكيان آخر' });
    }

    const linesResult = await db.query(
      `SELECT
         e.employee_code,
         e.full_name_ar,
         e.full_name_en,
         e.bank_name,
         e.bank_iban,
         e.bank_account,
         pi.net_amount
       FROM finance_payroll_items pi
       JOIN finance_payroll_employees e ON pi.employee_id = e.employee_id
       WHERE pi.run_id = $1
       ORDER BY e.employee_code`,
      [batch.run_id]
    );

    const header = [
      'employee_code',
      'employee_name_ar',
      'employee_name_en',
      'bank_name',
      'bank_iban',
      'bank_account',
      'net_amount'
    ];

    const rows = linesResult.rows.map((line) => [
      line.employee_code,
      line.full_name_ar,
      line.full_name_en,
      line.bank_name,
      line.bank_iban,
      line.bank_account,
      Number(line.net_amount || 0).toFixed(2)
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(toCsvValue).join(','))
      .join('\n');

    const safeRef = batch.file_reference || `BANK-${batch.batch_id}`;
    const filename = `${safeRef}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting payroll bank batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================
// Overtime
// =========================

router.get('/overtime', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { entityId } = context;
  const { employee_id, status, from_date, to_date, payroll_run_id } = req.query;

  try {
    const conditions = [buildEntityScopeCondition(context, 'o.entity_id', 1)];
    const values = [entityId];
    let idx = 2;

    if (employee_id) {
      conditions.push(`o.employee_id = $${idx}`);
      values.push(employee_id);
      idx++;
    }
    if (status) {
      conditions.push(`o.status = $${idx}`);
      values.push(status);
      idx++;
    }
    if (from_date) {
      conditions.push(`o.work_date >= $${idx}`);
      values.push(from_date);
      idx++;
    }
    if (to_date) {
      conditions.push(`o.work_date <= $${idx}`);
      values.push(to_date);
      idx++;
    }
    if (payroll_run_id) {
      conditions.push(`o.payroll_run_id = $${idx}`);
      values.push(payroll_run_id);
      idx++;
    }

    const result = await db.query(
      `SELECT o.*, e.employee_code, e.full_name_ar, e.full_name_en
       FROM finance_payroll_overtime o
       JOIN finance_payroll_employees e ON o.employee_id = e.employee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.work_date DESC, o.overtime_id DESC`,
      values
    );

    res.json({ success: true, overtime: result.rows });
  } catch (error) {
    console.error('Error fetching overtime entries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/overtime', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const {
    employee_id,
    work_date,
    hours,
    rate,
    multiplier,
    amount,
    status,
    payroll_run_id
  } = req.body || {};

  if (!employee_id || !work_date) {
    return res.status(400).json({ success: false, error: 'employee_id and work_date are required' });
  }

  try {
    const employee = await db.query(
      'SELECT employee_id, entity_id FROM finance_payroll_employees WHERE employee_id = $1',
      [employee_id]
    );
    if (!employee.rows.length) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (employee.rows[0].entity_id && employee.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن إضافة عمل إضافي لكيان آخر' });
    }

    const computedAmount = amount || (Number(hours || 0) * Number(rate || 0) * Number(multiplier || 1));

    const result = await db.query(
      `INSERT INTO finance_payroll_overtime (
        employee_id, work_date, hours, rate, multiplier, amount, status, payroll_run_id,
        entity_type, entity_id, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      RETURNING *`,
      [
        employee_id,
        work_date,
        hours || 0,
        rate || 0,
        multiplier || 1,
        computedAmount,
        status || 'PENDING',
        payroll_run_id || null,
        context.entityType,
        context.entityId
      ]
    );

    res.status(201).json({ success: true, overtime: result.rows[0] });
  } catch (error) {
    console.error('Error creating overtime entry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/overtime/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const payload = req.body || {};

  try {
    const existing = await db.query(
      `SELECT o.overtime_id, e.entity_id
       FROM finance_payroll_overtime o
       JOIN finance_payroll_employees e ON o.employee_id = e.employee_id
       WHERE o.overtime_id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Overtime entry not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن تعديل عمل إضافي لكيان آخر' });
    }

    const fields = ['work_date', 'hours', 'rate', 'multiplier', 'amount', 'status', 'payroll_run_id'];
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const field of fields) {
      if (field in payload) {
        setClauses.push(`${field} = COALESCE($${idx}, ${field})`);
        values.push(payload[field]);
        idx++;
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE finance_payroll_overtime
       SET ${setClauses.join(', ')}
       WHERE overtime_id = $${idx}
       RETURNING *`,
      values
    );

    res.json({ success: true, overtime: result.rows[0] });
  } catch (error) {
    console.error('Error updating overtime entry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/overtime/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;

  try {
    const existing = await db.query(
      `SELECT o.overtime_id, e.entity_id
       FROM finance_payroll_overtime o
       JOIN finance_payroll_employees e ON o.employee_id = e.employee_id
       WHERE o.overtime_id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Overtime entry not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن حذف عمل إضافي لكيان آخر' });
    }

    await db.query('DELETE FROM finance_payroll_overtime WHERE overtime_id = $1', [id]);
    res.json({ success: true, message: 'تم حذف العمل الإضافي' });
  } catch (error) {
    console.error('Error deleting overtime entry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================
// Settlements
// =========================

router.get('/settlements', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { entityId } = context;
  const { employee_id, status, from_date, to_date, payroll_run_id } = req.query;

  try {
    const conditions = [buildEntityScopeCondition(context, 's.entity_id', 1)];
    const values = [entityId];
    let idx = 2;

    if (employee_id) {
      conditions.push(`s.employee_id = $${idx}`);
      values.push(employee_id);
      idx++;
    }
    if (status) {
      conditions.push(`s.status = $${idx}`);
      values.push(status);
      idx++;
    }
    if (from_date) {
      conditions.push(`s.settlement_date >= $${idx}`);
      values.push(from_date);
      idx++;
    }
    if (to_date) {
      conditions.push(`s.settlement_date <= $${idx}`);
      values.push(to_date);
      idx++;
    }
    if (payroll_run_id) {
      conditions.push(`s.payroll_run_id = $${idx}`);
      values.push(payroll_run_id);
      idx++;
    }

    const result = await db.query(
      `SELECT s.*, e.employee_code, e.full_name_ar, e.full_name_en
       FROM finance_payroll_settlements s
       JOIN finance_payroll_employees e ON s.employee_id = e.employee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.settlement_date DESC, s.settlement_id DESC`,
      values
    );

    res.json({ success: true, settlements: result.rows });
  } catch (error) {
    console.error('Error fetching payroll settlements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/settlements', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { employee_id, settlement_date, amount, reason, status, payroll_run_id } = req.body || {};

  if (!employee_id || !settlement_date || amount === undefined) {
    return res.status(400).json({
      success: false,
      error: 'employee_id, settlement_date, and amount are required'
    });
  }

  try {
    const employee = await db.query(
      'SELECT employee_id, entity_id FROM finance_payroll_employees WHERE employee_id = $1',
      [employee_id]
    );
    if (!employee.rows.length) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (employee.rows[0].entity_id && employee.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن إضافة تسوية لكيان آخر' });
    }

    const result = await db.query(
      `INSERT INTO finance_payroll_settlements (
        employee_id, settlement_date, amount, reason, status, payroll_run_id,
        entity_type, entity_id, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING *`,
      [
        employee_id,
        settlement_date,
        amount,
        reason || null,
        status || 'DRAFT',
        payroll_run_id || null,
        context.entityType,
        context.entityId
      ]
    );

    res.status(201).json({ success: true, settlement: result.rows[0] });
  } catch (error) {
    console.error('Error creating payroll settlement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/settlements/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const payload = req.body || {};

  try {
    const existing = await db.query(
      `SELECT s.settlement_id, e.entity_id
       FROM finance_payroll_settlements s
       JOIN finance_payroll_employees e ON s.employee_id = e.employee_id
       WHERE s.settlement_id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Settlement not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن تعديل تسوية لكيان آخر' });
    }

    const fields = ['settlement_date', 'amount', 'reason', 'status', 'payroll_run_id'];
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const field of fields) {
      if (field in payload) {
        setClauses.push(`${field} = COALESCE($${idx}, ${field})`);
        values.push(payload[field]);
        idx++;
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE finance_payroll_settlements
       SET ${setClauses.join(', ')}
       WHERE settlement_id = $${idx}
       RETURNING *`,
      values
    );

    res.json({ success: true, settlement: result.rows[0] });
  } catch (error) {
    console.error('Error updating payroll settlement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/settlements/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;

  try {
    const existing = await db.query(
      `SELECT s.settlement_id, e.entity_id
       FROM finance_payroll_settlements s
       JOIN finance_payroll_employees e ON s.employee_id = e.employee_id
       WHERE s.settlement_id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Settlement not found' });
    }
    if (existing.rows[0].entity_id && existing.rows[0].entity_id !== context.entityId) {
      return res.status(403).json({ success: false, error: 'لا يمكن حذف تسوية لكيان آخر' });
    }

    await db.query('DELETE FROM finance_payroll_settlements WHERE settlement_id = $1', [id]);
    res.json({ success: true, message: 'تم حذف التسوية' });
  } catch (error) {
    console.error('Error deleting payroll settlement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================
// Payroll Runs
// =========================

router.get('/runs', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { entityId } = context;
  const { period_year, period_month, status } = req.query;

  try {
    const conditions = [buildEntityScopeCondition(context, 'entity_id', 1)];
    const values = [entityId];
    let idx = 2;

    if (period_year) {
      conditions.push(`period_year = $${idx}`);
      values.push(period_year);
      idx++;
    }
    if (period_month) {
      conditions.push(`period_month = $${idx}`);
      values.push(period_month);
      idx++;
    }
    if (status) {
      conditions.push(`status = $${idx}`);
      values.push(status);
      idx++;
    }

    const result = await db.query(
      `SELECT * FROM finance_payroll_runs
       WHERE ${conditions.join(' AND ')}
       ORDER BY period_year DESC, period_month DESC, run_id DESC`,
      values
    );

    const totals = result.rows.reduce(
      (acc, run) => {
        acc.total_runs += 1;
        acc.total_gross += Number(run.total_gross || 0);
        acc.total_deductions += Number(run.total_deductions || 0);
        acc.total_net += Number(run.total_net || 0);
        return acc;
      },
      { total_runs: 0, total_gross: 0, total_deductions: 0, total_net: 0 }
    );

    res.json({ success: true, runs: result.rows, summary: totals });
  } catch (error) {
    console.error('Error fetching payroll runs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/runs', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const {
    period_year,
    period_month,
    run_date,
    run_number,
    branch_id,
    incubator_id,
    platform_id,
    office_id,
    created_by
  } = req.body || {};

  if (!period_year || !period_month) {
    return res.status(400).json({ success: false, error: 'period_year and period_month are required' });
  }

  try {
    const generatedRunNumber = run_number || `PR-${period_year}${String(period_month).padStart(2, '0')}-${Date.now()}`;

    const result = await db.query(
      `INSERT INTO finance_payroll_runs (
        run_number, period_year, period_month, run_date, status,
        entity_type, entity_id, branch_id, incubator_id, platform_id, office_id,
        created_at, updated_at, created_by
      ) VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,NOW(),NOW(),$11)
      RETURNING *`,
      [
        generatedRunNumber,
        period_year,
        period_month,
        run_date || new Date().toISOString().slice(0, 10),
        context.entityType,
        context.entityId,
        branch_id || null,
        incubator_id || null,
        platform_id || null,
        office_id || null,
        created_by || 'SYSTEM'
      ]
    );

    res.status(201).json({ success: true, run: result.rows[0] });
  } catch (error) {
    console.error('Error creating payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/runs/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const payload = req.body || {};

  try {
    const existing = await db.query(
      `SELECT run_id, status
       FROM finance_payroll_runs
       WHERE run_id = $1 AND ${buildEntityScopeCondition(context, 'entity_id', 2)}`,
      [id, context.entityId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Payroll run not found' });
    }

    const fields = ['period_year', 'period_month', 'run_date', 'run_number'];
    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const field of fields) {
      if (field in payload) {
        setClauses.push(`${field} = COALESCE($${idx}, ${field})`);
        values.push(payload[field]);
        idx++;
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE finance_payroll_runs
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE run_id = $${idx}
       RETURNING *`,
      values
    );

    res.json({ success: true, run: result.rows[0] });
  } catch (error) {
    console.error('Error updating payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/runs/:id', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;

  try {
    const existing = await db.query(
      `SELECT run_id, status
       FROM finance_payroll_runs
       WHERE run_id = $1 AND ${buildEntityScopeCondition(context, 'entity_id', 2)}`,
      [id, context.entityId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ success: false, error: 'Payroll run not found' });
    }

    await db.query('DELETE FROM finance_payroll_runs WHERE run_id = $1', [id]);
    res.json({ success: true, message: 'تم حذف الدورة' });
  } catch (error) {
    console.error('Error deleting payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/runs/:id/approve', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const { approved_by } = req.body || {};

  try {
    const result = await db.query(
      `UPDATE finance_payroll_runs
       SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE run_id = $2 AND ${buildEntityScopeCondition(context, 'entity_id', 3)}
       RETURNING *`,
      [approved_by || 'SYSTEM', id, context.entityId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Payroll run not found' });
    }

    res.json({ success: true, run: result.rows[0] });
  } catch (error) {
    console.error('Error approving payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/runs/:id/post', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { id } = req.params;
  const {
    debit_account_id,
    debit_account_code,
    credit_account_id,
    credit_account_code,
    deductions_account_id,
    deductions_account_code,
    posted_by
  } = req.body || {};

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const run = await getRunForEntity(client, id, context);
    if (!run) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Payroll run not found' });
    }

    const totalsResult = await client.query(
      `SELECT
         COALESCE(SUM(gross_amount), 0) AS total_gross,
         COALESCE(SUM(deductions_amount), 0) AS total_deductions,
         COALESCE(SUM(net_amount), 0) AS total_net
       FROM finance_payroll_items
       WHERE run_id = $1`,
      [id]
    );

    const totals = totalsResult.rows[0];
    const totalGross = Number(totals.total_gross || 0);
    const totalDeductions = Number(totals.total_deductions || 0);
    const totalNet = Number(totals.total_net || 0);

    if (totalGross <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Payroll run has no items to post' });
    }

    const debitAccount = await resolveAccount(client, {
      accountId: debit_account_id,
      accountCode: debit_account_code || '5100'
    });

    const creditAccount = await resolveAccount(client, {
      accountId: credit_account_id,
      accountCode: credit_account_code || '2150'
    });

    if (!debitAccount || !creditAccount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Debit and credit accounts are required and must exist'
      });
    }

    let deductionsAccount = null;
    if (totalDeductions > 0 && (deductions_account_id || deductions_account_code)) {
      deductionsAccount = await resolveAccount(client, {
        accountId: deductions_account_id,
        accountCode: deductions_account_code
      });
    }

    const entryNumber = `PR-${run.period_year}${String(run.period_month).padStart(2, '0')}-${Date.now()}`;

    const entryResult = await client.query(
      `INSERT INTO finance_journal_entries (
        entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
        status, is_posted, posted_at, posted_by,
        entity_type, entity_id, branch_id, incubator_id, platform_id, office_id,
        fiscal_year, fiscal_period, created_at, updated_at, created_by
      ) VALUES (
        $1, $2, 'PAYROLL', $3, $4, 'PAYROLL', $5,
        'POSTED', true, NOW(), $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, NOW(), NOW(), $15
      ) RETURNING *`,
      [
        entryNumber,
        run.run_date || new Date().toISOString().slice(0, 10),
        `Payroll run ${run.run_number}`,
        run.run_number,
        run.run_id,
        posted_by || 'SYSTEM',
        run.entity_type || context.entityType,
        run.entity_id || context.entityId,
        run.branch_id,
        run.incubator_id,
        run.platform_id,
        run.office_id,
        run.period_year,
        run.period_month,
        posted_by || 'SYSTEM'
      ]
    );

    const entry = entryResult.rows[0];
    const lines = [];

    lines.push({
      line_number: 1,
      account_id: debitAccount.account_id,
      account_code: debitAccount.account_code,
      debit_amount: totalGross,
      credit_amount: 0,
      description: 'Payroll expense'
    });

    if (deductionsAccount && totalDeductions > 0) {
      lines.push({
        line_number: 2,
        account_id: deductionsAccount.account_id,
        account_code: deductionsAccount.account_code,
        debit_amount: 0,
        credit_amount: totalDeductions,
        description: 'Payroll deductions'
      });
      lines.push({
        line_number: 3,
        account_id: creditAccount.account_id,
        account_code: creditAccount.account_code,
        debit_amount: 0,
        credit_amount: totalNet,
        description: 'Payroll payable'
      });
    } else {
      lines.push({
        line_number: 2,
        account_id: creditAccount.account_id,
        account_code: creditAccount.account_code,
        debit_amount: 0,
        credit_amount: totalGross,
        description: 'Payroll payable'
      });
    }

    for (const line of lines) {
      await client.query(
        `INSERT INTO finance_journal_lines (
          entry_id, line_number, account_id, account_code,
          debit_amount, credit_amount, description,
          entity_type, entity_id, branch_id, incubator_id, platform_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          entry.entry_id,
          line.line_number,
          line.account_id,
          line.account_code,
          line.debit_amount,
          line.credit_amount,
          line.description,
          run.entity_type || context.entityType,
          run.entity_id || context.entityId,
          run.branch_id,
          run.incubator_id,
          run.platform_id
        ]
      );
    }

    await client.query(
      `UPDATE finance_payroll_runs
       SET status = 'POSTED', total_gross = $1, total_deductions = $2, total_net = $3,
           journal_entry_id = $4, updated_at = NOW()
       WHERE run_id = $5`,
      [totalGross, totalDeductions, totalNet, entry.entry_id, run.run_id]
    );

    await client.query(
      `UPDATE finance_payroll_items
       SET status = 'POSTED'
       WHERE run_id = $1`,
      [run.run_id]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      run_id: run.run_id,
      journal_entry_id: entry.entry_id,
      totals: { total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error posting payroll run:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// =========================
// Payslips
// =========================

router.get('/payslips', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const { run_id } = req.query;
  if (!run_id) {
    return res.status(400).json({ success: false, error: 'run_id is required' });
  }

  try {
    const run = await db.query(
      `SELECT run_id FROM finance_payroll_runs
       WHERE run_id = $1 AND ${buildEntityScopeCondition(context, 'entity_id', 2)}`,
      [run_id, context.entityId]
    );
    if (!run.rows.length) {
      return res.status(404).json({ success: false, error: 'Payroll run not found' });
    }

    const itemsResult = await db.query(
      `SELECT
         pi.*, e.employee_code, e.full_name_ar, e.full_name_en
       FROM finance_payroll_items pi
       JOIN finance_payroll_employees e ON pi.employee_id = e.employee_id
       WHERE pi.run_id = $1
       ORDER BY pi.item_id`,
      [run_id]
    );

    const items = itemsResult.rows;
    if (!items.length) {
      return res.json({ success: true, items: [], lines: [] });
    }

    const itemIds = items.map((item) => item.item_id);
    const linesResult = await db.query(
      `SELECT * FROM finance_payroll_item_lines WHERE item_id = ANY($1) ORDER BY line_id`,
      [itemIds]
    );

    res.json({ success: true, items, lines: linesResult.rows });
  } catch (error) {
    console.error('Error fetching payslips:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/payslips', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const {
    run_id,
    employee_id,
    gross_amount,
    deductions_amount,
    net_amount,
    lines = [],
    notes,
    include_overtime = true,
    include_settlements = true
  } = req.body || {};

  if (!run_id || !employee_id) {
    return res.status(400).json({ success: false, error: 'run_id and employee_id are required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const run = await getRunForEntity(client, run_id, context);
    if (!run) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Payroll run not found' });
    }

    const overtimeIds = [];
    const settlementIds = [];
    const autoLines = [];

    if (include_overtime) {
      const overtimeResult = await client.query(
        `SELECT overtime_id, work_date, hours, rate, multiplier, amount
         FROM finance_payroll_overtime
         WHERE employee_id = $1
           AND status = 'APPROVED'
           AND (payroll_run_id IS NULL OR payroll_run_id = $2)`,
        [employee_id, run_id]
      );

      for (const row of overtimeResult.rows) {
        const computedAmount = Number(
          (Number(row.amount || 0) || (Number(row.hours || 0) * Number(row.rate || 0) * Number(row.multiplier || 1))).toFixed(2)
        );
        if (computedAmount > 0) {
          autoLines.push({
            component_id: null,
            line_type: 'EARNING',
            amount: computedAmount,
            description: `Overtime ${row.work_date}`
          });
          overtimeIds.push(row.overtime_id);
        }
      }
    }

    if (include_settlements) {
      const settlementsResult = await client.query(
        `SELECT settlement_id, settlement_date, amount, reason
         FROM finance_payroll_settlements
         WHERE employee_id = $1
           AND status = 'APPROVED'
           AND (payroll_run_id IS NULL OR payroll_run_id = $2)`,
        [employee_id, run_id]
      );

      for (const row of settlementsResult.rows) {
        const settlementAmount = Number(row.amount || 0);
        if (settlementAmount > 0) {
          autoLines.push({
            component_id: null,
            line_type: 'EARNING',
            amount: settlementAmount,
            description: row.reason || `Settlement ${row.settlement_date}`
          });
          settlementIds.push(row.settlement_id);
        }
      }
    }

    const mergedLines = [...lines, ...autoLines];
    const lineTotals = mergedLines.reduce(
      (acc, line) => {
        const amountValue = Number(line.amount || 0);
        if ((line.line_type || 'EARNING') === 'DEDUCTION') {
          acc.deductions += amountValue;
        } else {
          acc.gross += amountValue;
        }
        return acc;
      },
      { gross: 0, deductions: 0 }
    );
    const computedNet = Number((lineTotals.gross - lineTotals.deductions).toFixed(2));
    const hasGross = typeof gross_amount === 'number' && !Number.isNaN(gross_amount);
    const hasDeductions = typeof deductions_amount === 'number' && !Number.isNaN(deductions_amount);
    const hasNet = typeof net_amount === 'number' && !Number.isNaN(net_amount);
    const resolvedGross = hasGross ? gross_amount : lineTotals.gross;
    const resolvedDeductions = hasDeductions ? deductions_amount : lineTotals.deductions;
    const resolvedNet = hasNet ? net_amount : computedNet;

    const itemResult = await client.query(
      `INSERT INTO finance_payroll_items (
        run_id, employee_id, gross_amount, deductions_amount, net_amount, status, notes
      ) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6)
      RETURNING *`,
      [
        run_id,
        employee_id,
        resolvedGross || 0,
        resolvedDeductions || 0,
        resolvedNet || 0,
        notes || null
      ]
    );

    const item = itemResult.rows[0];

    for (const line of mergedLines) {
      await client.query(
        `INSERT INTO finance_payroll_item_lines (
          item_id, component_id, line_type, amount, description
        ) VALUES ($1,$2,$3,$4,$5)`,
        [
          item.item_id,
          line.component_id || null,
          line.line_type || 'EARNING',
          line.amount || 0,
          line.description || null
        ]
      );
    }

    if (overtimeIds.length) {
      await client.query(
        `UPDATE finance_payroll_overtime
         SET payroll_run_id = $1
         WHERE overtime_id = ANY($2)
           AND (payroll_run_id IS NULL OR payroll_run_id = $1)`,
        [run_id, overtimeIds]
      );
    }

    if (settlementIds.length) {
      await client.query(
        `UPDATE finance_payroll_settlements
         SET payroll_run_id = $1
         WHERE settlement_id = ANY($2)
           AND (payroll_run_id IS NULL OR payroll_run_id = $1)`,
        [run_id, settlementIds]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, item });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating payslip:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.put('/payslips/:itemId', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const itemId = Number(req.params.itemId);
  if (!itemId) {
    return res.status(400).json({ success: false, error: 'itemId is required' });
  }

  const {
    employee_id,
    gross_amount,
    deductions_amount,
    net_amount,
    status,
    notes,
    lines
  } = req.body || {};

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query(
      `SELECT pi.*, pr.status AS run_status
       FROM finance_payroll_items pi
       JOIN finance_payroll_runs pr ON pi.run_id = pr.run_id
       WHERE pi.item_id = $1
         AND ${buildEntityScopeCondition(context, 'pr.entity_id', 2)}`,
      [itemId, context.entityId]
    );

    if (!itemResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Payslip not found' });
    }

    const currentItem = itemResult.rows[0];
    if (currentItem.run_status === 'POSTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Cannot edit posted payroll run' });
    }

    const hasLines = Array.isArray(lines);
    const lineTotals = (hasLines ? lines : []).reduce(
      (acc, line) => {
        const amountValue = Number(line.amount || 0);
        if ((line.line_type || 'EARNING') === 'DEDUCTION') {
          acc.deductions += amountValue;
        } else {
          acc.gross += amountValue;
        }
        return acc;
      },
      { gross: 0, deductions: 0 }
    );
    const computedNet = Number((lineTotals.gross - lineTotals.deductions).toFixed(2));
    const hasGross = typeof gross_amount === 'number' && !Number.isNaN(gross_amount);
    const hasDeductions = typeof deductions_amount === 'number' && !Number.isNaN(deductions_amount);
    const hasNet = typeof net_amount === 'number' && !Number.isNaN(net_amount);
    const resolvedGross = hasGross ? gross_amount : (hasLines ? lineTotals.gross : currentItem.gross_amount || 0);
    const resolvedDeductions = hasDeductions ? deductions_amount : (hasLines ? lineTotals.deductions : currentItem.deductions_amount || 0);
    const resolvedNet = hasNet ? net_amount : (hasLines ? computedNet : currentItem.net_amount || 0);

    const updateResult = await client.query(
      `UPDATE finance_payroll_items
       SET employee_id = $1, gross_amount = $2, deductions_amount = $3, net_amount = $4,
           status = $5, notes = $6
       WHERE item_id = $7
       RETURNING *`,
      [
        employee_id || currentItem.employee_id,
        resolvedGross,
        resolvedDeductions,
        resolvedNet,
        status || currentItem.status,
        notes ?? currentItem.notes,
        itemId
      ]
    );

    if (hasLines) {
      await client.query(
        'DELETE FROM finance_payroll_item_lines WHERE item_id = $1',
        [itemId]
      );

      for (const line of lines) {
        await client.query(
          `INSERT INTO finance_payroll_item_lines (
            item_id, component_id, line_type, amount, description
          ) VALUES ($1,$2,$3,$4,$5)`,
          [
            itemId,
            line.component_id || null,
            line.line_type || 'EARNING',
            line.amount || 0,
            line.description || null
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, item: updateResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating payslip:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.delete('/payslips/:itemId', async (req, res) => {
  const context = ensureEntity(req, res);
  if (!context) return;

  const itemId = Number(req.params.itemId);
  if (!itemId) {
    return res.status(400).json({ success: false, error: 'itemId is required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query(
      `SELECT pi.item_id, pr.status AS run_status
       FROM finance_payroll_items pi
       JOIN finance_payroll_runs pr ON pi.run_id = pr.run_id
       WHERE pi.item_id = $1
         AND ${buildEntityScopeCondition(context, 'pr.entity_id', 2)}`,
      [itemId, context.entityId]
    );

    if (!itemResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Payslip not found' });
    }

    if (itemResult.rows[0].run_status === 'POSTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Cannot delete posted payroll run' });
    }

    await client.query('DELETE FROM finance_payroll_items WHERE item_id = $1', [itemId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting payslip:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
