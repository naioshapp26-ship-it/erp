const fs = require('fs');
const path = require('path');
const db = require('./db');

async function ensurePayrollSettlementsTable() {
  console.log('\nEnsuring finance_payroll_settlements table exists...');

  const sqlPath = path.join(__dirname, 'finance/database/add-payroll-settlements-table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await db.query('BEGIN');
    await db.query(sql);

    const result = await db.query(
      `SELECT
         to_regclass('public.finance_payroll_settlements') AS table_name,
         (SELECT COUNT(*) FROM finance_payroll_settlements) AS row_count
       `
    );

    await db.query('COMMIT');

    const { table_name, row_count } = result.rows[0];
    console.log(`Table present: ${table_name}`);
    console.log(`Existing rows: ${row_count}`);
    console.log('Payroll settlements table is ready.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Failed to ensure payroll settlements table:', error.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

ensurePayrollSettlementsTable();
