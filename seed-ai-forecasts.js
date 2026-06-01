require('dotenv').config();
const db = require('./db');
const pool = db.pool;
const ENTITY_ID = process.env.SEED_ENTITY_ID || 'HQ001';

const forecasts = [
  { period: '2026-03', type: 'cash_in', amount: 325000, confidence: 0.84, model: 'prophet-v2', insights: { drivers: ['تحصيلات العقود', 'دفعات شهرية'], risk: 'منخفض' } },
  { period: '2026-04', type: 'cash_in', amount: 305000, confidence: 0.81, model: 'prophet-v2', insights: { drivers: ['عقود حكومية', 'دفعات متأخرة'], risk: 'متوسط' } },
  { period: '2026-05', type: 'cash_in', amount: 298000, confidence: 0.79, model: 'prophet-v2', insights: { drivers: ['خطط سداد جديدة'], risk: 'متوسط' } },
  { period: '2026-03', type: 'cash_out', amount: 182000, confidence: 0.77, model: 'ops-v1', insights: { notes: 'مصاريف تشغيل + رواتب' } },
  { period: '2026-04', type: 'cash_out', amount: 176500, confidence: 0.75, model: 'ops-v1', insights: { notes: 'دفعات مورّدين وتقليل تكاليف' } },
  { period: '2026-05', type: 'cash_out', amount: 171000, confidence: 0.74, model: 'ops-v1', insights: { notes: 'تراجع التكاليف المتغيرة' } }
];

async function seed() {
  try {
    console.log(`🚀 Seeding AI forecasts for entity ${ENTITY_ID}...`);
    await pool.query('BEGIN');
    await pool.query('DELETE FROM finance_ai_forecasts WHERE entity_id = $1', [ENTITY_ID]);

    for (const f of forecasts) {
      await pool.query(
        `INSERT INTO finance_ai_forecasts (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level, ai_model, ai_insights, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [ENTITY_ID, f.period, f.type, f.amount, f.confidence, f.model, JSON.stringify(f.insights)]
      );
    }

    await pool.query('COMMIT');
    console.log('✅ AI forecasts dataset ready.');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error seeding AI forecasts:', error.message);
    process.exitCode = 1;
  } finally {
  }
}

seed();
