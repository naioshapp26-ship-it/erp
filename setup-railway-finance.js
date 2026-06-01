const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: false
});

async function setupFinanceSystem() {
  try {
    console.log('🚀 إعداد النظام المالي على Railway...\n');

    // Step 1: Create tables
    console.log('📋 الخطوة 1: إنشاء الجداول...');
    
    // Create finance_accounts table
    const mainSqlFile = fs.readFileSync(
      path.join(__dirname, 'finance/database/init-finance-system.sql'),
      'utf8'
    );
    await pool.query(mainSqlFile);
    
    // Create cashflow tables
    const cashflowSqlFile = fs.readFileSync(
      path.join(__dirname, 'finance/database/create-cashflow-tables.sql'),
      'utf8'
    );
    await pool.query(cashflowSqlFile);
    
    console.log('✅ تم إنشاء جميع الجداول بنجاح\n');

    // Step 2: Add Chart of Accounts
    console.log('📊 الخطوة 2: إضافة شجرة الحسابات...');
    
    const accounts = [
      // الأصول (Assets)
      { code: '1000', nameAr: 'الأصول', type: 'ASSET', isHeader: true },
      { code: '1100', nameAr: 'الأصول المتداولة', type: 'ASSET', parent: '1000', isHeader: true },
      { code: '1110', nameAr: 'النقدية وما في حكمها', type: 'ASSET', parent: '1100' },
      { code: '1111', nameAr: 'الصندوق', type: 'ASSET', parent: '1110' },
      { code: '1112', nameAr: 'البنك', type: 'ASSET', parent: '1110' },
      { code: '1120', nameAr: 'العملاء والمدينون', type: 'ASSET', parent: '1100' },
      { code: '1121', nameAr: 'حسابات العملاء', type: 'ASSET', parent: '1120' },
      { code: '1122', nameAr: 'أوراق القبض', type: 'ASSET', parent: '1120' },
      { code: '1130', nameAr: 'المخزون', type: 'ASSET', parent: '1100' },
      { code: '1131', nameAr: 'مخزون البضائع', type: 'ASSET', parent: '1130' },
      { code: '1132', nameAr: 'مخزون المواد الخام', type: 'ASSET', parent: '1130' },
      
      { code: '1200', nameAr: 'الأصول الثابتة', type: 'ASSET', parent: '1000', isHeader: true },
      { code: '1210', nameAr: 'الأراضي والمباني', type: 'ASSET', parent: '1200' },
      { code: '1220', nameAr: 'الأثاث والمعدات', type: 'ASSET', parent: '1200' },
      { code: '1230', nameAr: 'السيارات', type: 'ASSET', parent: '1200' },
      { code: '1240', nameAr: 'الأجهزة والمعدات', type: 'ASSET', parent: '1200' },
      { code: '1250', nameAr: 'مجمع الإهلاك', type: 'ASSET', parent: '1200' },
      { code: '1260', nameAr: 'الأصول غير الملموسة', type: 'ASSET', parent: '1200' },

      // الخصوم (Liabilities)
      { code: '2000', nameAr: 'الخصوم', type: 'LIABILITY', isHeader: true },
      { code: '2100', nameAr: 'الخصوم المتداولة', type: 'LIABILITY', parent: '2000', isHeader: true },
      { code: '2110', nameAr: 'الموردون والدائنون', type: 'LIABILITY', parent: '2100' },
      { code: '2111', nameAr: 'حسابات الموردين', type: 'LIABILITY', parent: '2110' },
      { code: '2112', nameAr: 'أوراق الدفع', type: 'LIABILITY', parent: '2110' },
      { code: '2120', nameAr: 'القروض قصيرة الأجل', type: 'LIABILITY', parent: '2100' },
      { code: '2130', nameAr: 'مصروفات مستحقة', type: 'LIABILITY', parent: '2100' },
      
      { code: '2200', nameAr: 'الخصوم طويلة الأجل', type: 'LIABILITY', parent: '2000', isHeader: true },
      { code: '2210', nameAr: 'القروض طويلة الأجل', type: 'LIABILITY', parent: '2200' },
      { code: '2220', nameAr: 'التزامات أخرى', type: 'LIABILITY', parent: '2200' },

      // حقوق الملكية (Equity)
      { code: '3000', nameAr: 'حقوق الملكية', type: 'EQUITY', isHeader: true },
      { code: '3100', nameAr: 'رأس المال', type: 'EQUITY', parent: '3000' },
      { code: '3200', nameAr: 'الأرباح المحتجزة', type: 'EQUITY', parent: '3000' },
      { code: '3300', nameAr: 'احتياطيات', type: 'EQUITY', parent: '3000' },

      // الإيرادات (Revenue)
      { code: '4000', nameAr: 'الإيرادات', type: 'REVENUE', isHeader: true },
      { code: '4100', nameAr: 'إيرادات المبيعات', type: 'REVENUE', parent: '4000' },
      { code: '4110', nameAr: 'مبيعات البضائع', type: 'REVENUE', parent: '4100' },
      { code: '4120', nameAr: 'مبيعات الخدمات', type: 'REVENUE', parent: '4100' },
      { code: '4200', nameAr: 'إيرادات أخرى', type: 'REVENUE', parent: '4000' },
      { code: '4210', nameAr: 'إيرادات الفوائد', type: 'REVENUE', parent: '4200' },

      // المصروفات (Expenses)
      { code: '5000', nameAr: 'المصروفات', type: 'EXPENSE', isHeader: true },
      { code: '5100', nameAr: 'تكلفة المبيعات', type: 'EXPENSE', parent: '5000' },
      { code: '5110', nameAr: 'تكلفة البضاعة المباعة', type: 'EXPENSE', parent: '5100' },
      
      { code: '5200', nameAr: 'المصروفات التشغيلية', type: 'EXPENSE', parent: '5000', isHeader: true },
      { code: '5210', nameAr: 'الرواتب والأجور', type: 'EXPENSE', parent: '5200' },
      { code: '5220', nameAr: 'الإيجارات', type: 'EXPENSE', parent: '5200' },
      { code: '5230', nameAr: 'الكهرباء والماء', type: 'EXPENSE', parent: '5200' },
      { code: '5240', nameAr: 'الاتصالات', type: 'EXPENSE', parent: '5200' },
      { code: '5250', nameAr: 'مصروفات الصيانة', type: 'EXPENSE', parent: '5200' },
      { code: '5260', nameAr: 'القرطاسية', type: 'EXPENSE', parent: '5200' },
      { code: '5270', nameAr: 'مصروفات السفر', type: 'EXPENSE', parent: '5200' },
      
      { code: '5300', nameAr: 'المصروفات الإدارية', type: 'EXPENSE', parent: '5000', isHeader: true },
      { code: '5310', nameAr: 'مصروفات إدارية عامة', type: 'EXPENSE', parent: '5300' },
      { code: '5320', nameAr: 'الاستشارات والخدمات المهنية', type: 'EXPENSE', parent: '5300' },
      
      { code: '5400', nameAr: 'مصروفات التمويل', type: 'EXPENSE', parent: '5000', isHeader: true },
      { code: '5410', nameAr: 'فوائد القروض', type: 'EXPENSE', parent: '5400' },
      { code: '5420', nameAr: 'رسوم بنكية', type: 'EXPENSE', parent: '5400' },
      
      { code: '5500', nameAr: 'الإهلاك والاستهلاك', type: 'EXPENSE', parent: '5000' },
      { code: '5510', nameAr: 'إهلاك الأصول الثابتة', type: 'EXPENSE', parent: '5500' },
    ];

    for (const acc of accounts) {
      const parentId = acc.parent ? 
        `(SELECT account_id FROM finance_accounts WHERE account_code = '${acc.parent}' AND entity_id = '1')` :
        'NULL';
      
      await pool.query(`
        INSERT INTO finance_accounts 
        (entity_id, account_code, account_name_ar, account_name_en, account_type, 
         parent_account_id, is_header, is_active, created_at)
        VALUES ('1', $1, $2, $3, $4, ${parentId}, $5, true, CURRENT_TIMESTAMP)
        ON CONFLICT (account_code) DO NOTHING
      `, [acc.code, acc.nameAr, acc.nameAr, acc.type, acc.isHeader || false]);
    }
    
    console.log(`✅ تم إضافة ${accounts.length} حساب\n`);

    // Step 3: Add Sample Operating Cashflows
    console.log('💰 الخطوة 3: إضافة التدفقات التشغيلية...');
    
    const operatingFlows = [
      { type: 'customer_collection', amount: 25000, desc: 'تحصيل من العملاء', date: '2026-01-15' },
      { type: 'customer_collection', amount: 30000, desc: 'تحصيل من العملاء - الدفعة الثانية', date: '2026-01-20' },
      { type: 'customer_collection', amount: 20000, desc: 'تحصيل نقدي من عميل', date: '2026-01-25' },
      { type: 'supplier_payment', amount: -15000, desc: 'دفع للموردين', date: '2026-01-10' },
      { type: 'supplier_payment', amount: -20000, desc: 'دفع مستحقات موردين', date: '2026-01-18' },
      { type: 'salary_payment', amount: -12000, desc: 'دفع رواتب الموظفين', date: '2026-01-05' },
      { type: 'salary_payment', amount: -8000, desc: 'مكافآت ومزايا', date: '2026-01-22' },
      { type: 'other_operating', amount: 5000, desc: 'إيرادات تشغيلية متنوعة', date: '2026-01-12' },
    ];

    for (const flow of operatingFlows) {
      await pool.query(`
        INSERT INTO finance_cashflow_operating 
        (entity_id, flow_type, amount, description, flow_date, created_by, created_at)
        VALUES ('1', $1, $2, $3, $4, 'SYSTEM', CURRENT_TIMESTAMP)
      `, [flow.type, flow.amount, flow.desc, flow.date]);
    }
    
    console.log(`✅ تم إضافة ${operatingFlows.length} تدفق تشغيلي\n`);

    // Step 4: Add Sample Investing Cashflows
    console.log('🏗️ الخطوة 4: إضافة التدفقات الاستثمارية...');
    
    const investingFlows = [
      { type: 'asset_purchase', amount: -50000, desc: 'شراء أثاث ومعدات مكتبية', date: '2026-01-08' },
      { type: 'asset_purchase', amount: -80000, desc: 'شراء سيارة للشركة', date: '2026-01-14' },
      { type: 'asset_purchase', amount: -30000, desc: 'شراء أجهزة كمبيوتر', date: '2026-01-19' },
      { type: 'investment', amount: -40000, desc: 'استثمار في شركة تابعة', date: '2026-01-11' },
      { type: 'investment', amount: -10000, desc: 'شراء أسهم استثمارية', date: '2026-01-23' },
      { type: 'other_investing', amount: 5000, desc: 'بيع أصول قديمة', date: '2026-01-17' },
    ];

    for (const flow of investingFlows) {
      await pool.query(`
        INSERT INTO finance_cashflow_investing 
        (entity_id, flow_type, amount, description, flow_date, created_by, created_at)
        VALUES ('1', $1, $2, $3, $4, 'SYSTEM', CURRENT_TIMESTAMP)
      `, [flow.type, flow.amount, flow.desc, flow.date]);
    }
    
    console.log(`✅ تم إضافة ${investingFlows.length} تدفق استثماري\n`);

    // Step 5: Add Sample Financing Cashflows
    console.log('🏦 الخطوة 5: إضافة التدفقات التمويلية...');
    
    const financingFlows = [
      { type: 'capital_injection', amount: 500000, desc: 'رأس المال الأولي', date: '2026-01-01' },
      { type: 'capital_injection', amount: 100000, desc: 'زيادة رأس المال', date: '2026-01-15' },
      { type: 'loan_received', amount: 200000, desc: 'قرض بنكي طويل الأجل', date: '2026-01-10' },
      { type: 'loan_payment', amount: -5000, desc: 'دفعة قرض شهرية', date: '2026-01-20' },
      { type: 'loan_payment', amount: -3000, desc: 'فوائد القرض', date: '2026-01-20' },
      { type: 'dividend_payment', amount: -2000, desc: 'توزيع أرباح', date: '2026-01-25' },
    ];

    for (const flow of financingFlows) {
      await pool.query(`
        INSERT INTO finance_cashflow_financing 
        (entity_id, flow_type, amount, description, flow_date, created_by, created_at)
        VALUES ('1', $1, $2, $3, $4, 'SYSTEM', CURRENT_TIMESTAMP)
      `, [flow.type, flow.amount, flow.desc, flow.date]);
    }
    
    console.log(`✅ تم إضافة ${financingFlows.length} تدفق تمويلي\n`);

    // Step 6: Add AI Forecasts
    console.log('🤖 الخطوة 6: إضافة التوقعات الذكية...');
    
    const forecasts = [
      { 
        period: 'فبراير 2026', 
        type: 'surplus', 
        amount: 45000, 
        confidence: 0.87,
        model: 'LSTM Neural Network',
        insights: JSON.stringify({
          trend: 'تصاعدي',
          factors: ['زيادة المبيعات', 'تحسن التحصيل'],
          risks: ['موسمية منخفضة']
        })
      },
      { 
        period: 'مارس 2026', 
        type: 'surplus', 
        amount: 52000, 
        confidence: 0.82,
        model: 'LSTM Neural Network',
        insights: JSON.stringify({
          trend: 'تصاعدي',
          factors: ['توسع في السوق'],
          risks: ['منافسة محتملة']
        })
      },
      { 
        period: 'أبريل 2026', 
        type: 'deficit', 
        amount: -8000, 
        confidence: 0.65,
        model: 'LSTM Neural Network',
        insights: JSON.stringify({
          trend: 'تنازلي مؤقت',
          factors: ['استثمارات جديدة', 'مصروفات رأسمالية'],
          risks: ['نقص سيولة مؤقت']
        })
      },
      { 
        period: 'مايو 2026', 
        type: 'surplus', 
        amount: 38000, 
        confidence: 0.78,
        model: 'LSTM Neural Network',
        insights: JSON.stringify({
          trend: 'استقرار',
          factors: ['عوائد استثمار'],
          risks: ['منخفضة']
        })
      },
      { 
        period: 'يونيو 2026', 
        type: 'surplus', 
        amount: 55000, 
        confidence: 0.91,
        model: 'LSTM Neural Network',
        insights: JSON.stringify({
          trend: 'تصاعدي قوي',
          factors: ['نهاية الربع الثاني', 'موسم ذروة'],
          risks: ['منخفضة جداً']
        })
      },
    ];

    for (const fc of forecasts) {
      await pool.query(`
        INSERT INTO finance_ai_forecasts 
        (entity_id, forecast_period, forecast_type, forecast_amount, confidence_level,
         ai_model, ai_insights, created_at)
        VALUES ('1', $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [fc.period, fc.type, fc.amount, fc.confidence, fc.model, fc.insights]);
    }
    
    console.log(`✅ تم إضافة ${forecasts.length} توقع ذكي\n`);

    // Verify
    console.log('🔍 التحقق من البيانات...');
    const verification = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM finance_accounts WHERE entity_id = '1') as accounts,
        (SELECT COUNT(*) FROM finance_cashflow_operating WHERE entity_id = '1') as operating,
        (SELECT COUNT(*) FROM finance_cashflow_investing WHERE entity_id = '1') as investing,
        (SELECT COUNT(*) FROM finance_cashflow_financing WHERE entity_id = '1') as financing,
        (SELECT COUNT(*) FROM finance_ai_forecasts WHERE entity_id = '1') as forecasts
    `);
    
    console.log('\n✅ تم إعداد النظام بنجاح!');
    console.log('\n📊 ملخص البيانات:');
    console.log(`   - شجرة الحسابات: ${verification.rows[0].accounts} حساب`);
    console.log(`   - التدفقات التشغيلية: ${verification.rows[0].operating} عملية`);
    console.log(`   - التدفقات الاستثمارية: ${verification.rows[0].investing} عملية`);
    console.log(`   - التدفقات التمويلية: ${verification.rows[0].financing} عملية`);
    console.log(`   - التوقعات الذكية: ${verification.rows[0].forecasts} توقع`);
    console.log('\n🎉 النظام المالي جاهز للاستخدام على Railway!');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupFinanceSystem();
