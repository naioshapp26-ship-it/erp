const { Pool } = require('pg');

const pool = new Pool({
    host: 'crossover.proxy.rlwy.net',
    port: 44255,
    database: 'railway',
    user: 'postgres',
    password: 'PddzJpAQYezqknsntSzmCUlQYuYJldcT',
    ssl: { rejectUnauthorized: false }
});

async function checkBalanceSheetData() {
    try {
        console.log('\n📊 فحص بيانات الميزانية العمومية\n');
        console.log('='.repeat(80));

        // Check finance_balance_sheet table
        const balanceSheetQuery = `
            SELECT * FROM finance_balance_sheet LIMIT 5;
        `;
        const balanceSheet = await pool.query(balanceSheetQuery);
        console.log(`\n1️⃣ جدول finance_balance_sheet: ${balanceSheet.rows.length} سجل`);
        if (balanceSheet.rows.length > 0) {
            console.log('   أعمدة الجدول:', Object.keys(balanceSheet.rows[0]).join(', '));
            console.log('   عينة:', JSON.stringify(balanceSheet.rows[0], null, 2));
        }

        // Check finance_assets table
        const assetsQuery = `
            SELECT * FROM finance_assets ORDER BY asset_id LIMIT 5;
        `;
        const assets = await pool.query(assetsQuery);
        console.log(`\n2️⃣ جدول finance_assets: ${assets.rows.length} سجل`);
        if (assets.rows.length > 0) {
            console.log('   أعمدة الجدول:', Object.keys(assets.rows[0]).join(', '));
            console.log('   عينة:', JSON.stringify(assets.rows[0], null, 2));
        }

        // Get total assets
        const totalAssetsQuery = `SELECT COUNT(*) as count, SUM(CAST(amount AS DECIMAL)) as total FROM finance_assets;`;
        const totalAssets = await pool.query(totalAssetsQuery);
        console.log(`\n   📈 إجمالي الأصول: ${totalAssets.rows[0].count} أصل بقيمة ${totalAssets.rows[0].total || 0} ر.س`);

        // Check finance_liabilities table
        const liabilitiesQuery = `
            SELECT * FROM finance_liabilities ORDER BY liability_id LIMIT 5;
        `;
        const liabilities = await pool.query(liabilitiesQuery);
        console.log(`\n3️⃣ جدول finance_liabilities: ${liabilities.rows.length} سجل`);
        if (liabilities.rows.length > 0) {
            console.log('   أعمدة الجدول:', Object.keys(liabilities.rows[0]).join(', '));
            console.log('   عينة:', JSON.stringify(liabilities.rows[0], null, 2));
        }

        // Get total liabilities
        const totalLiabilitiesQuery = `SELECT COUNT(*) as count, SUM(CAST(amount AS DECIMAL)) as total FROM finance_liabilities;`;
        const totalLiabilities = await pool.query(totalLiabilitiesQuery);
        console.log(`\n   📊 إجمالي الالتزامات: ${totalLiabilities.rows[0].count} التزام بقيمة ${totalLiabilities.rows[0].total || 0} ر.س`);

        // Check finance_equity table
        const equityQuery = `
            SELECT * FROM finance_equity ORDER BY equity_id LIMIT 5;
        `;
        const equity = await pool.query(equityQuery);
        console.log(`\n4️⃣ جدول finance_equity: ${equity.rows.length} سجل`);
        if (equity.rows.length > 0) {
            console.log('   أعمدة الجدول:', Object.keys(equity.rows[0]).join(', '));
            console.log('   عينة:', JSON.stringify(equity.rows[0], null, 2));
        }

        // Get total equity
        const totalEquityQuery = `SELECT COUNT(*) as count, SUM(CAST(amount AS DECIMAL)) as total FROM finance_equity;`;
        const totalEquity = await pool.query(totalEquityQuery);
        console.log(`\n   💰 إجمالي حقوق الملكية: ${totalEquity.rows[0].count} بند بقيمة ${totalEquity.rows[0].total || 0} ر.س`);

        console.log('\n' + '='.repeat(80));
        console.log('\n✅ البيانات جاهزة لإنشاء صفحة الميزانية العمومية!\n');

        pool.end();
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        pool.end();
    }
}

checkBalanceSheetData();
