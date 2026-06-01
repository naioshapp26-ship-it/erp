const db = require('./db');

const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';
const ENTITY_TYPE = process.env.SEED_ENTITY_TYPE || 'HQ';

const componentSeeds = [
  {
    component_code: 'BASIC',
    component_name_ar: 'الراتب الاساسي',
    component_name_en: 'Basic Salary',
    component_type: 'EARNING',
    calculation_method: 'FIXED',
    default_amount: 0,
    is_taxable: true
  },
  {
    component_code: 'HOUSING',
    component_name_ar: 'بدل سكن',
    component_name_en: 'Housing Allowance',
    component_type: 'EARNING',
    calculation_method: 'PERCENTAGE',
    default_amount: 25,
    is_taxable: true
  },
  {
    component_code: 'TRANSPORT',
    component_name_ar: 'بدل نقل',
    component_name_en: 'Transport Allowance',
    component_type: 'EARNING',
    calculation_method: 'PERCENTAGE',
    default_amount: 10,
    is_taxable: false
  },
  {
    component_code: 'BONUS',
    component_name_ar: 'مكافاة الاداء',
    component_name_en: 'Performance Bonus',
    component_type: 'EARNING',
    calculation_method: 'FIXED',
    default_amount: 0,
    is_taxable: true
  },
  {
    component_code: 'GOSI',
    component_name_ar: 'خصم التامينات',
    component_name_en: 'Social Insurance',
    component_type: 'DEDUCTION',
    calculation_method: 'PERCENTAGE',
    default_amount: 9,
    is_taxable: false
  },
  {
    component_code: 'LOAN',
    component_name_ar: 'قسط سلفه',
    component_name_en: 'Loan Deduction',
    component_type: 'DEDUCTION',
    calculation_method: 'FIXED',
    default_amount: 0,
    is_taxable: false
  },
  {
    component_code: 'ABSENCE',
    component_name_ar: 'خصم غياب',
    component_name_en: 'Absence Deduction',
    component_type: 'DEDUCTION',
    calculation_method: 'FIXED',
    default_amount: 0,
    is_taxable: false
  }
];

const runSeeds = [
  {
    run_number: 'PR-HQ001-2025-12',
    period_year: 2025,
    period_month: 12,
    run_date: '2025-12-31',
    status: 'APPROVED'
  },
  {
    run_number: 'PR-HQ001-2026-01',
    period_year: 2026,
    period_month: 1,
    run_date: '2026-01-31',
    status: 'DRAFT'
  }
];

const STATUS_CYCLE = ['APPROVED', 'PAID', 'DRAFT', 'REJECTED'];

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function upsertComponent(client, component) {
  const result = await client.query(
    `INSERT INTO finance_payroll_components (
      component_code, component_name_ar, component_name_en, component_type,
      calculation_method, default_amount, is_taxable, is_active,
      entity_type, entity_id, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,NOW(),NOW())
    ON CONFLICT (component_code) DO UPDATE SET
      component_name_ar = EXCLUDED.component_name_ar,
      component_name_en = EXCLUDED.component_name_en,
      component_type = EXCLUDED.component_type,
      calculation_method = EXCLUDED.calculation_method,
      default_amount = EXCLUDED.default_amount,
      is_taxable = EXCLUDED.is_taxable,
      is_active = true,
      entity_type = EXCLUDED.entity_type,
      entity_id = EXCLUDED.entity_id,
      updated_at = NOW()
    RETURNING component_id`,
    [
      component.component_code,
      component.component_name_ar,
      component.component_name_en,
      component.component_type,
      component.calculation_method,
      component.default_amount,
      component.is_taxable,
      ENTITY_TYPE,
      ENTITY_ID
    ]
  );
  return result.rows[0].component_id;
}

async function upsertRun(client, run) {
  const result = await client.query(
    `INSERT INTO finance_payroll_runs (
      run_number, period_year, period_month, run_date, status,
      entity_type, entity_id, created_at, updated_at, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW(),'SEED')
    ON CONFLICT (run_number) DO UPDATE SET
      period_year = EXCLUDED.period_year,
      period_month = EXCLUDED.period_month,
      run_date = EXCLUDED.run_date,
      status = EXCLUDED.status,
      entity_type = EXCLUDED.entity_type,
      entity_id = EXCLUDED.entity_id,
      updated_at = NOW()
    RETURNING run_id`,
    [
      run.run_number,
      run.period_year,
      run.period_month,
      run.run_date,
      run.status,
      ENTITY_TYPE,
      ENTITY_ID
    ]
  );
  return result.rows[0].run_id;
}

async function itemExists(client, runId, employeeId) {
  const result = await client.query(
    'SELECT item_id FROM finance_payroll_items WHERE run_id = $1 AND employee_id = $2',
    [runId, employeeId]
  );
  return result.rows[0];
}

async function hasLines(client, itemId) {
  const result = await client.query(
    'SELECT 1 FROM finance_payroll_item_lines WHERE item_id = $1 LIMIT 1',
    [itemId]
  );
  return result.rows.length > 0;
}

async function seedPayrollPayslips() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const componentMap = new Map();
    for (const component of componentSeeds) {
      const componentId = await upsertComponent(client, component);
      componentMap.set(component.component_code, componentId);
    }

    const runMap = new Map();
    for (const run of runSeeds) {
      const runId = await upsertRun(client, run);
      runMap.set(run.run_number, runId);
    }

    const employeesResult = await client.query(
      `SELECT employee_id, employee_code, full_name_ar, base_salary
       FROM finance_payroll_employees
       WHERE entity_id = $1 AND is_active = true
       ORDER BY employee_id`,
      [ENTITY_ID]
    );
    const employees = employeesResult.rows;

    if (!employees.length) {
      throw new Error('No active payroll employees found. Run add-payroll-employees.js first.');
    }

    for (const [runIndex, run] of runSeeds.entries()) {
      const runId = runMap.get(run.run_number);
      const sliceCount = runIndex === 0 ? Math.min(8, employees.length) : Math.min(6, employees.length);
      const selectedEmployees = employees.slice(0, sliceCount);

      for (const [index, employee] of selectedEmployees.entries()) {
        const existing = await itemExists(client, runId, employee.employee_id);
        const status = STATUS_CYCLE[index % STATUS_CYCLE.length];

        const baseSalary = round2(employee.base_salary || 0);
        const housing = round2(baseSalary * 0.25);
        const transport = round2(baseSalary * 0.1);
        const bonus = baseSalary >= 14000 ? 900 : baseSalary >= 11000 ? 600 : 350;
        const gosi = round2(baseSalary * 0.09);
        const loan = index % 3 === 0 ? 450 : 0;
        const absence = index % 4 === 1 ? 220 : 0;

        const earningLines = [
          {
            component_id: componentMap.get('BASIC'),
            line_type: 'EARNING',
            amount: baseSalary,
            description: 'Base salary'
          },
          {
            component_id: componentMap.get('HOUSING'),
            line_type: 'EARNING',
            amount: housing,
            description: 'Housing allowance'
          },
          {
            component_id: componentMap.get('TRANSPORT'),
            line_type: 'EARNING',
            amount: transport,
            description: 'Transport allowance'
          },
          {
            component_id: componentMap.get('BONUS'),
            line_type: 'EARNING',
            amount: round2(bonus),
            description: 'Performance bonus'
          }
        ];

        const deductionLines = [
          {
            component_id: componentMap.get('GOSI'),
            line_type: 'DEDUCTION',
            amount: gosi,
            description: 'Social insurance'
          }
        ];

        if (loan > 0) {
          deductionLines.push({
            component_id: componentMap.get('LOAN'),
            line_type: 'DEDUCTION',
            amount: loan,
            description: 'Loan installment'
          });
        }

        if (absence > 0) {
          deductionLines.push({
            component_id: componentMap.get('ABSENCE'),
            line_type: 'DEDUCTION',
            amount: absence,
            description: 'Absence deduction'
          });
        }

        const lines = [...earningLines, ...deductionLines];
        const gross = round2(earningLines.reduce((sum, line) => sum + line.amount, 0));
        const deductions = round2(deductionLines.reduce((sum, line) => sum + line.amount, 0));
        const net = round2(gross - deductions);

        let itemId = existing ? existing.item_id : null;

        if (!existing) {
          const insertResult = await client.query(
            `INSERT INTO finance_payroll_items (
              run_id, employee_id, gross_amount, deductions_amount, net_amount, status, notes, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
            RETURNING item_id`,
            [
              runId,
              employee.employee_id,
              gross,
              deductions,
              net,
              status,
              `Seeded payslip for ${employee.employee_code}`
            ]
          );
          itemId = insertResult.rows[0].item_id;
        }

        if (itemId && !(await hasLines(client, itemId))) {
          for (const line of lines) {
            await client.query(
              `INSERT INTO finance_payroll_item_lines (
                item_id, component_id, line_type, amount, description
              ) VALUES ($1,$2,$3,$4,$5)`,
              [itemId, line.component_id, line.line_type, line.amount, line.description]
            );
          }
        }
      }

      const totalsResult = await client.query(
        `SELECT
           COALESCE(SUM(gross_amount), 0) AS total_gross,
           COALESCE(SUM(deductions_amount), 0) AS total_deductions,
           COALESCE(SUM(net_amount), 0) AS total_net
         FROM finance_payroll_items
         WHERE run_id = $1`,
        [runId]
      );
      const totals = totalsResult.rows[0];
      await client.query(
        `UPDATE finance_payroll_runs
         SET total_gross = $1, total_deductions = $2, total_net = $3, updated_at = NOW()
         WHERE run_id = $4`,
        [totals.total_gross, totals.total_deductions, totals.total_net, runId]
      );
    }

    const overtimeSeeds = [
      { employee_index: 0, work_date: '2025-12-22', hours: 6, rate: 120, multiplier: 1.5, status: 'APPROVED', run_number: runSeeds[0].run_number },
      { employee_index: 1, work_date: '2025-12-20', hours: 4, rate: 95, multiplier: 1.25, status: 'PAID', run_number: runSeeds[0].run_number },
      { employee_index: 2, work_date: '2025-12-18', hours: 3.5, rate: 110, multiplier: 1, status: 'APPROVED', run_number: runSeeds[0].run_number },
      { employee_index: 3, work_date: '2025-12-15', hours: 5.25, rate: 130, multiplier: 1.5, status: 'PENDING', run_number: runSeeds[0].run_number },
      { employee_index: 4, work_date: '2025-12-12', hours: 2.75, rate: 150, multiplier: 2, status: 'APPROVED', run_number: runSeeds[0].run_number },
      { employee_index: 5, work_date: '2025-12-10', hours: 7, rate: 105, multiplier: 1.25, status: 'PAID', run_number: runSeeds[0].run_number },
      { employee_index: 0, work_date: '2026-01-05', hours: 3, rate: 140, multiplier: 1.25, status: 'APPROVED', run_number: runSeeds[1].run_number },
      { employee_index: 1, work_date: '2026-01-07', hours: 6.5, rate: 115, multiplier: 1.5, status: 'PENDING', run_number: runSeeds[1].run_number },
      { employee_index: 2, work_date: '2026-01-09', hours: 4.25, rate: 125, multiplier: 1.75, status: 'APPROVED', run_number: runSeeds[1].run_number },
      { employee_index: 3, work_date: '2026-01-11', hours: 2.5, rate: 135, multiplier: 1.25, status: 'PAID', run_number: runSeeds[1].run_number },
      { employee_index: 4, work_date: '2026-01-13', hours: 5.75, rate: 118, multiplier: 1.5, status: 'APPROVED', run_number: runSeeds[1].run_number },
      { employee_index: 5, work_date: '2026-01-15', hours: 8, rate: 102, multiplier: 1.5, status: 'PENDING', run_number: runSeeds[1].run_number }
    ];

    for (const seed of overtimeSeeds) {
      const employee = Number.isInteger(seed.employee_index)
        ? employees[seed.employee_index]
        : employees.find((row) => row.employee_code === seed.employee_code);
      if (!employee) continue;

      const runId = seed.run_number ? runMap.get(seed.run_number) : runMap.get(runSeeds[0].run_number);
      const workDate = seed.work_date || '2025-12-22';
      const amount = round2(seed.hours * seed.rate * seed.multiplier);
      const existing = await client.query(
        `SELECT overtime_id FROM finance_payroll_overtime
         WHERE employee_id = $1 AND work_date = $2 AND payroll_run_id = $3`,
        [employee.employee_id, workDate, runId]
      );
      if (existing.rows.length) continue;
      await client.query(
        `INSERT INTO finance_payroll_overtime (
          employee_id, work_date, hours, rate, multiplier, amount, status, payroll_run_id,
          entity_type, entity_id, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
        [
          employee.employee_id,
          workDate,
          seed.hours,
          seed.rate,
          seed.multiplier,
          amount,
          seed.status,
          runId,
          ENTITY_TYPE,
          ENTITY_ID
        ]
      );
    }

    const settlementSeeds = [
      { employee_code: employees[3]?.employee_code, amount: 950, reason: 'Back pay adjustment', status: 'APPROVED' },
      { employee_code: employees[4]?.employee_code, amount: 650, reason: 'Final reimbursement', status: 'DRAFT' },
      { employee_code: employees[5]?.employee_code, amount: 1200, reason: 'Special allowance', status: 'APPROVED' }
    ];

    for (const seed of settlementSeeds) {
      if (!seed.employee_code) continue;
      const employee = employees.find((row) => row.employee_code === seed.employee_code);
      if (!employee) continue;
      const runId = runMap.get(runSeeds[0].run_number);
      const settleDate = '2025-12-25';
      const existing = await client.query(
        `SELECT settlement_id FROM finance_payroll_settlements
         WHERE employee_id = $1 AND settlement_date = $2 AND payroll_run_id = $3`,
        [employee.employee_id, settleDate, runId]
      );
      if (existing.rows.length) continue;
      await client.query(
        `INSERT INTO finance_payroll_settlements (
          employee_id, settlement_date, amount, reason, status, payroll_run_id,
          entity_type, entity_id, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        [
          employee.employee_id,
          settleDate,
          seed.amount,
          seed.reason,
          seed.status,
          runId,
          ENTITY_TYPE,
          ENTITY_ID
        ]
      );
    }

    await client.query('COMMIT');
    console.log('Seeded payroll runs, components, payslips, overtime, and settlements.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed payroll data:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

seedPayrollPayslips();
