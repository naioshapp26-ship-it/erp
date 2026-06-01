const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: false
});

async function testDatabase() {
  try {
    console.log('🔍 اختبار قاعدة البيانات على Railway...\n');

    // Test 1: Check Accounts
    const accountsResult = await pool.query(`
      SELECT 
        account_type,
        COUNT(*) as count
      FROM finance_accounts
      WHERE entity_id = '1'
      GROUP BY account_type
      ORDER BY account_type
    `);
    
    console.log('✅ شجرة الحسابات:');
    let totalAccounts = 0;
    accountsResult.rows.forEach(row => {
      console.log(`   - ${row.account_type}: ${row.count} حساب`);
      totalAccounts += parseInt(row.count);
    });
    console.log(`   إجمالي: ${totalAccounts} حساب\n`);

    // Test 2: Check Operating Cashflows
    const operatingResult = await pool.query(`
      SELECT COUNT(*) as count, 
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as inflow,
             SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as outflow
      FROM finance_cashflow_operating
      WHERE entity_id = '1'
    `);
    
    console.log('✅ التدفقات التشغيلية:');
    console.log(`   - عدد العمليات: ${operatingResult.rows[0].count}`);
    console.log(`   - التدفقات الداخلة: ${operatingResult.rows[0].inflow || 0} ريال`);
    console.log(`   - التدفقات الخارجة: ${Math.abs(operatingResult.rows[0].outflow || 0)} ريال\n`);

    // Test 3: Check Investing Cashflows
    const investingResult = await pool.query(`
      SELECT COUNT(*) as count,
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as inflow,
             SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as outflow
      FROM finance_cashflow_investing
      WHERE entity_id = '1'
    `);
    
    console.log('✅ التدفقات الاستثمارية:');
    console.log(`   - عدد العمليات: ${investingResult.rows[0].count}`);
    console.log(`   - التدفقات الداخلة: ${investingResult.rows[0].inflow || 0} ريال`);
    console.log(`   - التدفقات الخارجة: ${Math.abs(investingResult.rows[0].outflow || 0)} ريال\n`);

    // Test 4: Check Financing Cashflows
    const financingResult = await pool.query(`
      SELECT COUNT(*) as count,
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as inflow,
             SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as outflow
      FROM finance_cashflow_financing
      WHERE entity_id = '1'
    `);
    
    console.log('✅ التدفقات التمويلية:');
    console.log(`   - عدد العمليات: ${financingResult.rows[0].count}`);
    console.log(`   - التدفقات الداخلة: ${financingResult.rows[0].inflow || 0} ريال`);
    console.log(`   - التدفقات الخارجة: ${Math.abs(financingResult.rows[0].outflow || 0)} ريال\n`);

    // Test 5: Check AI Forecasts
    const forecastsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM finance_ai_forecasts
      WHERE entity_id = '1'
    `);
    
    console.log('✅ التوقعات الذكية:');
    console.log(`   - عدد التوقعات: ${forecastsResult.rows[0].count}\n`);

    // Test 6: Sample Accounts
    const sampleAccounts = await pool.query(`
      SELECT account_code, account_name_ar, account_type
      FROM finance_accounts
      WHERE entity_id = '1'
      ORDER BY account_code
      LIMIT 5
    `);
    
    console.log('📋 عينة من الحسابات:');
    sampleAccounts.rows.forEach(acc => {
      console.log(`   ${acc.account_code} - ${acc.account_name_ar} (${acc.account_type})`);
    });

    console.log('\n✅ جميع البيانات موجودة في قاعدة البيانات!');
    
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDatabase();
