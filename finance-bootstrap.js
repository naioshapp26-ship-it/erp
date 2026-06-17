const fs = require('fs');
const path = require('path');
const db = require('./db');

const FINANCE_SQL_FILES = [
  'finance/database/init-finance-system.sql',
  'finance/database/create-cashflow-tables.sql',
  'finance/database/add-sales-settlements-table.sql',
  'finance/database/add-payroll-settlements-table.sql',
  'finance/database/add-customer-required-fields.sql'
];

const FINANCE_CORE_TABLES = [
  'finance_accounts',
  'finance_customers',
  'finance_invoices',
  'finance_payments',
  'finance_cashflow',
  'finance_ai_forecasts'
];

const DEFAULT_ENTITY_ID = 'HQ001';

function preprocessFinanceSql(relativePath, sql) {
  let output = sql.replace(/^\s*COMMIT\s*;?\s*$/gim, '');
  if (relativePath.includes('init-finance-system.sql')) {
    output = output
      .replace(/CREATE TABLE IF NOT EXISTS finance_ai_forecasts[\s\S]*?\n\);/m, '')
      .replace(/CREATE INDEX IF NOT EXISTS idx_ai_forecasts_date ON finance_ai_forecasts\(forecast_date\);\n?/g, '');
  }
  if (relativePath.includes('create-cashflow-tables.sql')) {
    output = output.replace(/CREATE TABLE IF NOT EXISTS finance_ai_forecasts[\s\S]*?\n\);/m, '');
  }
  return output;
}

async function ensureFinanceAiForecastsTable() {
  const columnCheck = await db.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_ai_forecasts'
      AND column_name = 'forecast_amount'
    LIMIT 1
  `);

  if (columnCheck.rows.length) return;

  await db.query('DROP TABLE IF EXISTS finance_ai_forecasts CASCADE');
  await db.query(`
    CREATE TABLE finance_ai_forecasts (
      forecast_id SERIAL PRIMARY KEY,
      entity_id VARCHAR(50) NOT NULL,
      forecast_period VARCHAR(100) NOT NULL,
      forecast_type VARCHAR(50) NOT NULL,
      forecast_amount DECIMAL(15,2) NOT NULL,
      confidence_level DECIMAL(5,4),
      ai_model VARCHAR(100),
      ai_insights JSONB,
      street_name VARCHAR(200),
      postal_code VARCHAR(20),
      building_number VARCHAR(20),
      city VARCHAR(100),
      district VARCHAR(100),
      national_address_number VARCHAR(50),
      short_address VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_forecasts_entity ON finance_ai_forecasts(entity_id);
    CREATE INDEX IF NOT EXISTS idx_ai_forecasts_period ON finance_ai_forecasts(forecast_period);
    CREATE INDEX IF NOT EXISTS idx_ai_forecasts_type ON finance_ai_forecasts(forecast_type);
  `);
}

async function seedFinanceSampleData() {
  const accountCount = await db.query('SELECT COUNT(*)::int AS count FROM finance_accounts');
  if (accountCount.rows[0].count === 0) {
    console.warn('[finance-bootstrap] finance_accounts is empty after schema init');
  }

  const forecastCount = await db.query(
    'SELECT COUNT(*)::int AS count FROM finance_ai_forecasts WHERE entity_id = $1',
    [DEFAULT_ENTITY_ID]
  );

  if (forecastCount.rows[0].count === 0) {
    const forecasts = [
      { period: 'مارس 2026', type: 'surplus', amount: 42000, confidence: 0.86, model: 'LSTM Neural Network', insights: { trend: 'تصاعدي', factors: ['تحصيلات العقود'], risks: ['منخفضة'] } },
      { period: 'أبريل 2026', type: 'surplus', amount: 38000, confidence: 0.78, model: 'LSTM Neural Network', insights: { trend: 'استقرار', factors: ['عوائد استثمار'], risks: ['منخفضة'] } },
      { period: 'مايو 2026', type: 'deficit', amount: 15000, confidence: 0.72, model: 'Prophet v2', insights: { trend: 'تنازلي مؤقت', factors: ['مصروفات رأسمالية'], risks: ['متوسطة'] } },
      { period: 'يونيو 2026', type: 'surplus', amount: 55000, confidence: 0.91, model: 'LSTM Neural Network', insights: { trend: 'تصاعدي قوي', factors: ['موسم ذروة'], risks: ['منخفضة جداً'] } },
      { period: '2026-Q2', type: 'cash_in', amount: 325000, confidence: 0.84, model: 'prophet-v2', insights: { drivers: ['تحصيلات العقود'], risk: 'منخفض' } },
      { period: '2026-Q2', type: 'cash_out', amount: 182000, confidence: 0.77, model: 'ops-v1', insights: { notes: 'مصاريف تشغيل + رواتب' } }
    ];

    for (const forecast of forecasts) {
      await db.query(
        `INSERT INTO finance_ai_forecasts
          (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level, ai_model, ai_insights, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [
          DEFAULT_ENTITY_ID,
          forecast.period,
          forecast.type,
          forecast.amount,
          forecast.confidence,
          forecast.model,
          JSON.stringify(forecast.insights)
        ]
      );
    }
  }

  const customerCount = await db.query(
    'SELECT COUNT(*)::int AS count FROM finance_customers WHERE entity_id = $1',
    [DEFAULT_ENTITY_ID]
  );

  if (customerCount.rows[0].count === 0) {
    await db.query(
      `INSERT INTO finance_customers
        (entity_id, customer_code, customer_name_ar, customer_name_en, email, phone, credit_limit, is_active)
       VALUES
        ($1, 'CUS-001', 'شركة المدار الذكية', 'Madar Smart Co.', 'client@madar.sa', '+966501042000', 100000, true),
        ($1, 'CUS-002', 'مؤسسة الحلول', 'Hulool Est.', 'info@hulool.sa', '+966502201111', 75000, true),
        ($1, 'CUS-003', 'مجموعة الريادة', 'Reyada Group', 'contact@reyada.sa', '+966503310222', 150000, true)
       ON CONFLICT (customer_code) DO NOTHING`,
      [DEFAULT_ENTITY_ID]
    );
  }

  const invoiceCount = await db.query(
    'SELECT COUNT(*)::int AS count FROM finance_invoices WHERE entity_id = $1',
    [DEFAULT_ENTITY_ID]
  );

  if (invoiceCount.rows[0].count === 0) {
    const customer = await db.query(
      'SELECT customer_id FROM finance_customers WHERE entity_id = $1 ORDER BY customer_id LIMIT 1',
      [DEFAULT_ENTITY_ID]
    );
    const customerId = customer.rows[0]?.customer_id;
    if (customerId) {
      await db.query(
        `INSERT INTO finance_invoices
          (entity_id, invoice_number, customer_id, invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, remaining_amount, status, payment_status)
         VALUES
          ($1, 'INV-FIN-001', $2, CURRENT_DATE - 15, CURRENT_DATE + 15, 50000, 7500, 57500, 20000, 37500, 'PARTIAL', 'PARTIAL'),
          ($1, 'INV-FIN-002', $2, CURRENT_DATE - 5, CURRENT_DATE + 25, 32000, 4800, 36800, 0, 36800, 'ISSUED', 'UNPAID')
         ON CONFLICT (invoice_number) DO NOTHING`,
        [DEFAULT_ENTITY_ID, customerId]
      );
    }
  }

  const cashflowCount = await db.query(
    'SELECT COUNT(*)::int AS count FROM finance_cashflow_operating WHERE entity_id = $1',
    [DEFAULT_ENTITY_ID]
  );

  if (cashflowCount.rows[0].count === 0) {
    await db.query(
      `INSERT INTO finance_cashflow_operating (entity_id, flow_type, amount, description, flow_date, created_by)
       VALUES
        ($1, 'customer_collection', 85000, 'تحصيل فواتير العملاء', CURRENT_DATE - 10, 'system'),
        ($1, 'salary_payment', 42000, 'رواتب الموظفين', CURRENT_DATE - 7, 'system'),
        ($1, 'supplier_payment', 18000, 'دفعة موردين', CURRENT_DATE - 3, 'system')`,
      [DEFAULT_ENTITY_ID]
    );
  }
}

async function verifyFinanceTables() {
  const result = await db.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
    `,
    [FINANCE_CORE_TABLES]
  );
  const found = new Set(result.rows.map((row) => row.table_name));
  const missing = FINANCE_CORE_TABLES.filter((tableName) => !found.has(tableName));
  if (missing.length) {
    throw new Error(`Missing finance tables: ${missing.join(', ')}`);
  }
}

async function ensureFinanceReady() {
  for (const relativePath of FINANCE_SQL_FILES) {
    const filePath = path.join(__dirname, relativePath);
    if (!fs.existsSync(filePath)) continue;
    const sql = preprocessFinanceSql(relativePath, fs.readFileSync(filePath, 'utf8'));
    if (!sql.trim()) continue;
    await db.query(sql);
  }

  await ensureFinanceAiForecastsTable();
  await seedFinanceSampleData();
  await verifyFinanceTables();
  console.log('✅ Finance system tables verified');
}

module.exports = {
  FINANCE_CORE_TABLES,
  FINANCE_SQL_FILES,
  ensureFinanceReady
};
