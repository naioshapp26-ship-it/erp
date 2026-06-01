const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: false
});

async function quickSetup() {
  try {
    console.log('🚀 إنشاء النظام المالي...\n');

    // 1. Create Tables
    console.log('📋 إنشاء الجداول...');
    await pool.query(`
      DROP TABLE IF EXISTS finance_cashflow_operating CASCADE;
      CREATE TABLE finance_cashflow_operating (
        flow_id SERIAL PRIMARY KEY,
        entity_id VARCHAR(50) NOT NULL,
        flow_type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        flow_date DATE NOT NULL,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      DROP TABLE IF EXISTS finance_cashflow_investing CASCADE;
      CREATE TABLE finance_cashflow_investing (
        flow_id SERIAL PRIMARY KEY,
        entity_id VARCHAR(50) NOT NULL,
        flow_type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        flow_date DATE NOT NULL,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      DROP TABLE IF EXISTS finance_cashflow_financing CASCADE;
      CREATE TABLE finance_cashflow_financing (
        flow_id SERIAL PRIMARY KEY,
        entity_id VARCHAR(50) NOT NULL,
        flow_type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        flow_date DATE NOT NULL,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      DROP TABLE IF EXISTS finance_ai_forecasts CASCADE;
      CREATE TABLE finance_ai_forecasts (
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
    console.log('✅ تم إنشاء الجداول\n');

    // 2. Add Operating Cashflows
    console.log('💰 إضافة التدفقات التشغيلية...');
    await pool.query(`
      INSERT INTO finance_cashflow_operating (entity_id, flow_type, amount, description, flow_date, created_by) VALUES
      ('1', 'customer_collection', 25000, 'تحصيل من العملاء', '2026-01-15', 'SYSTEM'),
      ('1', 'customer_collection', 30000, 'تحصيل من العملاء - الدفعة الثانية', '2026-01-20', 'SYSTEM'),
      ('1', 'customer_collection', 20000, 'تحصيل نقدي من عميل', '2026-01-25', 'SYSTEM'),
      ('1', 'supplier_payment', -15000, 'دفع للموردين', '2026-01-10', 'SYSTEM'),
      ('1', 'supplier_payment', -20000, 'دفع مستحقات موردين', '2026-01-18', 'SYSTEM'),
      ('1', 'salary_payment', -12000, 'دفع رواتب الموظفين', '2026-01-05', 'SYSTEM'),
      ('1', 'salary_payment', -8000, 'مكافآت ومزايا', '2026-01-22', 'SYSTEM'),
      ('1', 'other_operating', 5000, 'إيرادات تشغيلية متنوعة', '2026-01-12', 'SYSTEM')
    `);
    console.log('✅ تم إضافة 8 تدفقات تشغيلية\n');

    // 3. Add Investing Cashflows
    console.log('🏗️ إضافة التدفقات الاستثمارية...');
    await pool.query(`
      INSERT INTO finance_cashflow_investing (entity_id, flow_type, amount, description, flow_date, created_by) VALUES
      ('1', 'asset_purchase', -50000, 'شراء أثاث ومعدات مكتبية', '2026-01-08', 'SYSTEM'),
      ('1', 'asset_purchase', -80000, 'شراء سيارة للشركة', '2026-01-14', 'SYSTEM'),
      ('1', 'asset_purchase', -30000, 'شراء أجهزة كمبيوتر', '2026-01-19', 'SYSTEM'),
      ('1', 'investment', -40000, 'استثمار في شركة تابعة', '2026-01-11', 'SYSTEM'),
      ('1', 'investment', -10000, 'شراء أسهم استثمارية', '2026-01-23', 'SYSTEM'),
      ('1', 'other_investing', 5000, 'بيع أصول قديمة', '2026-01-17', 'SYSTEM')
    `);
    console.log('✅ تم إضافة 6 تدفقات استثمارية\n');

    // 4. Add Financing Cashflows
    console.log('🏦 إضافة التدفقات التمويلية...');
    await pool.query(`
      INSERT INTO finance_cashflow_financing (entity_id, flow_type, amount, description, flow_date, created_by) VALUES
      ('1', 'capital_injection', 500000, 'رأس المال الأولي', '2026-01-01', 'SYSTEM'),
      ('1', 'capital_injection', 100000, 'زيادة رأس المال', '2026-01-15', 'SYSTEM'),
      ('1', 'loan_received', 200000, 'قرض بنكي طويل الأجل', '2026-01-10', 'SYSTEM'),
      ('1', 'loan_payment', -5000, 'دفعة قرض شهرية', '2026-01-20', 'SYSTEM'),
      ('1', 'loan_payment', -3000, 'فوائد القرض', '2026-01-20', 'SYSTEM'),
      ('1', 'dividend_payment', -2000, 'توزيع أرباح', '2026-01-25', 'SYSTEM')
    `);
    console.log('✅ تم إضافة 6 تدفقات تمويلية\n');

    // 5. Add AI Forecasts
    console.log('🤖 إضافة التوقعات الذكية...');
    await pool.query(`
      INSERT INTO finance_ai_forecasts (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level, ai_model, ai_insights) VALUES
      ('1', 'فبراير 2026', 'surplus', 45000, 0.87, 'LSTM Neural Network', '{"trend": "تصاعدي", "factors": ["زيادة المبيعات", "تحسن التحصيل"], "risks": ["موسمية منخفضة"]}'),
      ('1', 'مارس 2026', 'surplus', 52000, 0.82, 'LSTM Neural Network', '{"trend": "تصاعدي", "factors": ["توسع في السوق"], "risks": ["منافسة محتملة"]}'),
      ('1', 'أبريل 2026', 'deficit', -8000, 0.65, 'LSTM Neural Network', '{"trend": "تنازلي مؤقت", "factors": ["استثمارات جديدة", "مصروفات رأسمالية"], "risks": ["نقص سيولة مؤقت"]}'),
      ('1', 'مايو 2026', 'surplus', 38000, 0.78, 'LSTM Neural Network', '{"trend": "استقرار", "factors": ["عوائد استثمار"], "risks": ["منخفضة"]}'),
      ('1', 'يونيو 2026', 'surplus', 55000, 0.91, 'LSTM Neural Network', '{"trend": "تصاعدي قوي", "factors": ["نهاية الربع الثاني", "موسم ذروة"], "risks": ["منخفضة جداً"]}')
    `);
    console.log('✅ تم إضافة 5 توقعات ذكية\n');

    // 6. Add Chart of Accounts
    console.log('📊 إضافة شجرة الحسابات...');
    await pool.query(`
      INSERT INTO finance_accounts (entity_id, account_code, account_name_ar, account_name_en, account_type, is_header, is_active) VALUES
      -- الأصول
      ('1', '1000', 'الأصول', 'Assets', 'ASSET', true, true),
      ('1', '1100', 'الأصول المتداولة', 'Current Assets', 'ASSET', true, true),
      ('1', '1110', 'النقدية وما في حكمها', 'Cash and Cash Equivalents', 'ASSET', false, true),
      ('1', '1111', 'الصندوق', 'Cash on Hand', 'ASSET', false, true),
      ('1', '1112', 'البنك', 'Bank', 'ASSET', false, true),
      ('1', '1120', 'العملاء والمدينون', 'Accounts Receivable', 'ASSET', false, true),
      ('1', '1121', 'حسابات العملاء', 'Customer Accounts', 'ASSET', false, true),
      ('1', '1122', 'أوراق القبض', 'Notes Receivable', 'ASSET', false, true),
      ('1', '1130', 'المخزون', 'Inventory', 'ASSET', false, true),
      ('1', '1131', 'مخزون البضائع', 'Merchandise Inventory', 'ASSET', false, true),
      ('1', '1132', 'مخزون المواد الخام', 'Raw Materials Inventory', 'ASSET', false, true),
      ('1', '1200', 'الأصول الثابتة', 'Fixed Assets', 'ASSET', true, true),
      ('1', '1210', 'الأراضي والمباني', 'Land and Buildings', 'ASSET', false, true),
      ('1', '1220', 'الأثاث والمعدات', 'Furniture and Equipment', 'ASSET', false, true),
      ('1', '1230', 'السيارات', 'Vehicles', 'ASSET', false, true),
      ('1', '1240', 'الأجهزة والمعدات', 'Machinery and Equipment', 'ASSET', false, true),
      ('1', '1250', 'مجمع الإهلاك', 'Accumulated Depreciation', 'ASSET', false, true),
      ('1', '1260', 'الأصول غير الملموسة', 'Intangible Assets', 'ASSET', false, true),
      
      -- الخصوم
      ('1', '2000', 'الخصوم', 'Liabilities', 'LIABILITY', true, true),
      ('1', '2100', 'الخصوم المتداولة', 'Current Liabilities', 'LIABILITY', true, true),
      ('1', '2110', 'الموردون والدائنون', 'Accounts Payable', 'LIABILITY', false, true),
      ('1', '2111', 'حسابات الموردين', 'Supplier Accounts', 'LIABILITY', false, true),
      ('1', '2112', 'أوراق الدفع', 'Notes Payable', 'LIABILITY', false, true),
      ('1', '2120', 'القروض قصيرة الأجل', 'Short-term Loans', 'LIABILITY', false, true),
      ('1', '2130', 'مصروفات مستحقة', 'Accrued Expenses', 'LIABILITY', false, true),
      ('1', '2200', 'الخصوم طويلة الأجل', 'Long-term Liabilities', 'LIABILITY', true, true),
      ('1', '2210', 'القروض طويلة الأجل', 'Long-term Loans', 'LIABILITY', false, true),
      ('1', '2220', 'التزامات أخرى', 'Other Liabilities', 'LIABILITY', false, true),
      
      -- حقوق الملكية
      ('1', '3000', 'حقوق الملكية', 'Equity', 'EQUITY', true, true),
      ('1', '3100', 'رأس المال', 'Capital', 'EQUITY', false, true),
      ('1', '3200', 'الأرباح المحتجزة', 'Retained Earnings', 'EQUITY', false, true),
      ('1', '3300', 'احتياطيات', 'Reserves', 'EQUITY', false, true),
      
      -- الإيرادات
      ('1', '4000', 'الإيرادات', 'Revenue', 'REVENUE', true, true),
      ('1', '4100', 'إيرادات المبيعات', 'Sales Revenue', 'REVENUE', false, true),
      ('1', '4110', 'مبيعات البضائع', 'Merchandise Sales', 'REVENUE', false, true),
      ('1', '4120', 'مبيعات الخدمات', 'Service Revenue', 'REVENUE', false, true),
      ('1', '4200', 'إيرادات أخرى', 'Other Revenue', 'REVENUE', false, true),
      ('1', '4210', 'إيرادات الفوائد', 'Interest Income', 'REVENUE', false, true),
      
      -- المصروفات
      ('1', '5000', 'المصروفات', 'Expenses', 'EXPENSE', true, true),
      ('1', '5100', 'تكلفة المبيعات', 'Cost of Sales', 'EXPENSE', false, true),
      ('1', '5110', 'تكلفة البضاعة المباعة', 'Cost of Goods Sold', 'EXPENSE', false, true),
      ('1', '5200', 'المصروفات التشغيلية', 'Operating Expenses', 'EXPENSE', true, true),
      ('1', '5210', 'الرواتب والأجور', 'Salaries and Wages', 'EXPENSE', false, true),
      ('1', '5220', 'الإيجارات', 'Rent', 'EXPENSE', false, true),
      ('1', '5230', 'الكهرباء والماء', 'Utilities', 'EXPENSE', false, true),
      ('1', '5240', 'الاتصالات', 'Communications', 'EXPENSE', false, true),
      ('1', '5250', 'مصروفات الصيانة', 'Maintenance Expenses', 'EXPENSE', false, true),
      ('1', '5260', 'القرطاسية', 'Stationery', 'EXPENSE', false, true),
      ('1', '5270', 'مصروفات السفر', 'Travel Expenses', 'EXPENSE', false, true),
      ('1', '5300', 'المصروفات الإدارية', 'Administrative Expenses', 'EXPENSE', true, true),
      ('1', '5310', 'مصروفات إدارية عامة', 'General Administrative', 'EXPENSE', false, true),
      ('1', '5320', 'الاستشارات والخدمات المهنية', 'Consulting and Professional Services', 'EXPENSE', false, true),
      ('1', '5400', 'مصروفات التمويل', 'Finance Costs', 'EXPENSE', true, true),
      ('1', '5410', 'فوائد القروض', 'Interest Expense', 'EXPENSE', false, true),
      ('1', '5420', 'رسوم بنكية', 'Bank Charges', 'EXPENSE', false, true),
      ('1', '5500', 'الإهلاك والاستهلاك', 'Depreciation and Amortization', 'EXPENSE', false, true),
      ('1', '5510', 'إهلاك الأصول الثابتة', 'Fixed Assets Depreciation', 'EXPENSE', false, true)
      ON CONFLICT (account_code) DO NOTHING
    `);
    console.log('✅ تم إضافة شجرة الحسابات\n');

    // Verify
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM finance_accounts WHERE entity_id = '1') as accounts,
        (SELECT COUNT(*) FROM finance_cashflow_operating WHERE entity_id = '1') as operating,
        (SELECT COUNT(*) FROM finance_cashflow_investing WHERE entity_id = '1') as investing,
        (SELECT COUNT(*) FROM finance_cashflow_financing WHERE entity_id = '1') as financing,
        (SELECT COUNT(*) FROM finance_ai_forecasts WHERE entity_id = '1') as forecasts
    `);

    console.log('\n✅ النظام جاهز!');
    console.log('\n📊 ملخص البيانات:');
    console.log(`   - الحسابات: ${result.rows[0].accounts}`);
    console.log(`   - التدفقات التشغيلية: ${result.rows[0].operating}`);
    console.log(`   - التدفقات الاستثمارية: ${result.rows[0].investing}`);
    console.log(`   - التدفقات التمويلية: ${result.rows[0].financing}`);
    console.log(`   - التوقعات الذكية: ${result.rows[0].forecasts}`);

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

quickSetup();
