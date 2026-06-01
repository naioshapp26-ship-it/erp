const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway Database
const railwayPool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: false
});

// Local Database (source)
const localPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'multi_tenant_db',
  user: 'postgres',
  password: 'password'
});

async function deployToRailway() {
  try {
    console.log('🚀 بدء نشر النظام المالي إلى Railway...\n');

    // Step 1: Create tables from SQL file
    console.log('📋 الخطوة 1: إنشاء الجداول...');
    const sqlFile = fs.readFileSync(
      path.join(__dirname, 'finance/database/init-finance-system.sql'),
      'utf8'
    );
    
    await railwayPool.query(sqlFile);
    console.log('✅ تم إنشاء جميع الجداول بنجاح\n');

    // Step 2: Copy Accounts
    console.log('📊 الخطوة 2: نقل شجرة الحسابات...');
    const accounts = await localPool.query(`
      SELECT * FROM finance_accounts WHERE entity_id = '1'
    `);
    
    for (const acc of accounts.rows) {
      await railwayPool.query(`
        INSERT INTO finance_accounts 
        (entity_id, account_code, account_name_ar, account_name_en, account_type, parent_account_id, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (entity_id, account_code) DO NOTHING
      `, [
        acc.entity_id, acc.account_code, acc.account_name_ar, acc.account_name_en,
        acc.account_type, acc.parent_account_id, acc.is_active, acc.created_at
      ]);
    }
    console.log(`✅ تم نقل ${accounts.rows.length} حساب\n`);

    // Step 3: Copy Operating Cashflows
    console.log('💰 الخطوة 3: نقل التدفقات التشغيلية...');
    const operating = await localPool.query(`
      SELECT * FROM finance_cashflow_operating WHERE entity_id = '1'
    `);
    
    for (const flow of operating.rows) {
      await railwayPool.query(`
        INSERT INTO finance_cashflow_operating 
        (entity_id, flow_type, amount, description, flow_date, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        flow.entity_id, flow.flow_type, flow.amount, flow.description,
        flow.flow_date, flow.created_by, flow.created_at
      ]);
    }
    console.log(`✅ تم نقل ${operating.rows.length} تدفق تشغيلي\n`);

    // Step 4: Copy Investing Cashflows
    console.log('🏗️ الخطوة 4: نقل التدفقات الاستثمارية...');
    const investing = await localPool.query(`
      SELECT * FROM finance_cashflow_investing WHERE entity_id = '1'
    `);
    
    for (const flow of investing.rows) {
      await railwayPool.query(`
        INSERT INTO finance_cashflow_investing 
        (entity_id, flow_type, amount, description, flow_date, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        flow.entity_id, flow.flow_type, flow.amount, flow.description,
        flow.flow_date, flow.created_by, flow.created_at
      ]);
    }
    console.log(`✅ تم نقل ${investing.rows.length} تدفق استثماري\n`);

    // Step 5: Copy Financing Cashflows
    console.log('🏦 الخطوة 5: نقل التدفقات التمويلية...');
    const financing = await localPool.query(`
      SELECT * FROM finance_cashflow_financing WHERE entity_id = '1'
    `);
    
    for (const flow of financing.rows) {
      await railwayPool.query(`
        INSERT INTO finance_cashflow_financing 
        (entity_id, flow_type, amount, description, flow_date, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        flow.entity_id, flow.flow_type, flow.amount, flow.description,
        flow.flow_date, flow.created_by, flow.created_at
      ]);
    }
    console.log(`✅ تم نقل ${financing.rows.length} تدفق تمويلي\n`);

    // Step 6: Copy AI Forecasts
    console.log('🤖 الخطوة 6: نقل التوقعات الذكية...');
    const forecasts = await localPool.query(`
      SELECT * FROM finance_ai_forecasts WHERE entity_id = '1'
    `);
    
    for (const forecast of forecasts.rows) {
      await railwayPool.query(`
        INSERT INTO finance_ai_forecasts 
        (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level, 
         ai_model, ai_insights, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        forecast.entity_id, forecast.forecast_period, forecast.forecast_type,
        forecast.forecast_amount, forecast.confidence_level, forecast.ai_model,
        forecast.ai_insights, forecast.created_at
      ]);
    }
    console.log(`✅ تم نقل ${forecasts.rows.length} توقع ذكي\n`);

    // Verify deployment
    console.log('🔍 التحقق من النشر...');
    const verification = await railwayPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM finance_accounts WHERE entity_id = '1') as accounts,
        (SELECT COUNT(*) FROM finance_cashflow_operating WHERE entity_id = '1') as operating,
        (SELECT COUNT(*) FROM finance_cashflow_investing WHERE entity_id = '1') as investing,
        (SELECT COUNT(*) FROM finance_cashflow_financing WHERE entity_id = '1') as financing,
        (SELECT COUNT(*) FROM finance_ai_forecasts WHERE entity_id = '1') as forecasts
    `);
    
    console.log('✅ تم النشر بنجاح!');
    console.log('\n📊 ملخص البيانات المنشورة:');
    console.log(`   - الحسابات: ${verification.rows[0].accounts}`);
    console.log(`   - التدفقات التشغيلية: ${verification.rows[0].operating}`);
    console.log(`   - التدفقات الاستثمارية: ${verification.rows[0].investing}`);
    console.log(`   - التدفقات التمويلية: ${verification.rows[0].financing}`);
    console.log(`   - التوقعات الذكية: ${verification.rows[0].forecasts}`);

  } catch (error) {
    console.error('❌ خطأ في النشر:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await railwayPool.end();
    await localPool.end();
  }
}

deployToRailway();
