const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';
const ENTITY_TYPE = process.env.SEED_ENTITY_TYPE || 'HQ';
const CREATED_BY = process.env.SEED_CREATED_BY || 'cashflow-seeder';

const flows = {
  operating: [
    { flow_type: 'customer_collection', direction: 'IN', amount: 120000, description: 'تحصيل عقود SaaS لشهر يناير', daysAgo: 5 },
    { flow_type: 'salary_payment', direction: 'OUT', amount: 85000, description: 'رواتب الفريق التشغيلي', daysAgo: 3 },
    { flow_type: 'rent_payment', direction: 'OUT', amount: 25000, description: 'إيجار المقر الرئيسي', daysAgo: 10 },
    { flow_type: 'customer_collection', direction: 'IN', amount: 60000, description: 'تحصيل اشتراكات العملاء السنوية', daysAgo: 12 },
    { flow_type: 'utilities_payment', direction: 'OUT', amount: 9000, description: 'فواتير الكهرباء والإنترنت', daysAgo: 7 }
  ],
  investing: [
    { flow_type: 'asset_purchase', direction: 'OUT', amount: 150000, description: 'شراء خوادم عالية الاعتمادية', daysAgo: 15 },
    { flow_type: 'asset_sale', direction: 'IN', amount: 45000, description: 'بيع معدات قديمة', daysAgo: 20 },
    { flow_type: 'platform_investment', direction: 'OUT', amount: 70000, description: 'استثمار في منصة ذكاء اصطناعي', daysAgo: 30 }
  ],
  financing: [
    { flow_type: 'bank_loan', direction: 'IN', amount: 500000, description: 'دفعة أولى من قرض تشغيلي', daysAgo: 40 },
    { flow_type: 'loan_repayment', direction: 'OUT', amount: 55000, description: 'قسط سداد قرض بنكي', daysAgo: 8 },
    { flow_type: 'dividend_payment', direction: 'OUT', amount: 30000, description: 'توزيع أرباح للمستثمرين', daysAgo: 60 }
  ]
};

const forecasts = [
  { period: 'فبراير 2026', type: 'surplus', amount: 180000, confidence: 0.72, insights: { trend: 'تصاعدي', factors: ['تحسن التحصيل', 'ضغط المصاريف'], risks: ['تقلب أسعار الفائدة'] } },
  { period: 'مارس 2026', type: 'surplus', amount: 95000, confidence: 0.64, insights: { trend: 'مستقر', factors: ['استقرار العقود طويلة الأجل'], risks: ['تأخر دفعات عميل رئيسي'] } },
  { period: 'أبريل 2026', type: 'deficit', amount: -45000, confidence: 0.58, insights: { trend: 'هابط طفيف', factors: ['مصاريف رأس مالية مجدولة'], risks: ['زيادة تكاليف الصيانة'] } }
];

function buildDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function signedAmount(amount, direction) {
  const numeric = parseFloat(amount || 0);
  if (Number.isNaN(numeric)) return 0;
  return direction && direction.toUpperCase() === 'OUT' ? -Math.abs(numeric) : Math.abs(numeric);
}

async function ensureCoreTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_cashflow_operating (
      flow_id SERIAL PRIMARY KEY,
      entity_id VARCHAR(50) NOT NULL,
      flow_type VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      flow_date DATE NOT NULL,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finance_cashflow_investing (
      flow_id SERIAL PRIMARY KEY,
      entity_id VARCHAR(50) NOT NULL,
      flow_type VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      flow_date DATE NOT NULL,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finance_cashflow_financing (
      flow_id SERIAL PRIMARY KEY,
      entity_id VARCHAR(50) NOT NULL,
      flow_type VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      flow_date DATE NOT NULL,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finance_ai_forecasts (
      forecast_id SERIAL PRIMARY KEY,
      entity_id VARCHAR(50) NOT NULL,
      forecast_period VARCHAR(100) NOT NULL,
      forecast_type VARCHAR(50) NOT NULL,
      forecast_amount DECIMAL(15,2) NOT NULL,
      confidence_level DECIMAL(5,4),
      ai_model VARCHAR(100),
      ai_insights JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function seedTable(table, rows) {
  await pool.query(`DELETE FROM ${table} WHERE entity_id = $1`, [ENTITY_ID]);
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ${table} (entity_id, flow_type, amount, description, flow_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ENTITY_ID, row.flow_type, signedAmount(row.amount, row.direction), row.description, buildDate(row.daysAgo), CREATED_BY]
    );
  }
  console.log(`✅ Seeded ${rows.length} rows into ${table} for entity ${ENTITY_ID}`);
}

async function seedForecasts() {
  await pool.query('DELETE FROM finance_ai_forecasts WHERE entity_id = $1', [ENTITY_ID]);
  for (const f of forecasts) {
    await pool.query(
      `INSERT INTO finance_ai_forecasts (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level, ai_model, ai_insights)
       VALUES ($1,$2,$3,$4,$5,$6,$7)` ,
      [ENTITY_ID, f.period, f.type, f.amount, f.confidence, 'LSTM Neural Network', f.insights]
    );
  }
  console.log(`✅ Seeded ${forecasts.length} AI forecast rows for entity ${ENTITY_ID}`);
}

async function main() {
  try {
    console.log(`🌱 Seeding cashflow & budgets engine data for ${ENTITY_ID} (${ENTITY_TYPE})...`);
    await ensureCoreTables();
    await seedTable('finance_cashflow_operating', flows.operating);
    await seedTable('finance_cashflow_investing', flows.investing);
    await seedTable('finance_cashflow_financing', flows.financing);
    await seedForecasts();
    console.log('🎉 Seeding complete.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
