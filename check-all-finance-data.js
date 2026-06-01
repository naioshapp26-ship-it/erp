const { Pool } = require('pg');

const pool = new Pool({
    host: 'crossover.proxy.rlwy.net',
    port: 44255,
    user: 'postgres',
    password: 'PddzJpAQYezqknsntSzmCUlQYuYJldcT',
    database: 'railway'
});

async function checkAllFinanceData() {
    const client = await pool.connect();
    
    try {
        console.log('📊 فحص جميع البيانات المالية في قاعدة البيانات');
        console.log('='.repeat(60));
        console.log('');

        // 1. Check accounts
        const accounts = await client.query("SELECT COUNT(*) as count FROM finance_accounts WHERE entity_id = '1'");
        console.log(`1️⃣ الحسابات المالية: ${accounts.rows[0].count} حساب`);

        // 2. Check operating cashflows
        const operating = await client.query("SELECT COUNT(*) as count, SUM(amount) as total FROM finance_cashflow_operating WHERE entity_id = '1'");
        console.log(`2️⃣ التدفقات التشغيلية: ${operating.rows[0].count} معاملة | الإجمالي: ${operating.rows[0].total} ر.س`);

        // 3. Check investing cashflows
        const investing = await client.query("SELECT COUNT(*) as count, SUM(amount) as total FROM finance_cashflow_investing WHERE entity_id = '1'");
        console.log(`3️⃣ التدفقات الاستثمارية: ${investing.rows[0].count} معاملة | الإجمالي: ${investing.rows[0].total} ر.س`);

        // 4. Check financing cashflows
        const financing = await client.query("SELECT COUNT(*) as count, SUM(amount) as total FROM finance_cashflow_financing WHERE entity_id = '1'");
        console.log(`4️⃣ التدفقات التمويلية: ${financing.rows[0].count} معاملة | الإجمالي: ${financing.rows[0].total} ر.س`);

        // 5. Check AI forecasts
        const forecasts = await client.query("SELECT COUNT(*) as count FROM finance_ai_forecasts WHERE entity_id = '1'");
        console.log(`5️⃣ التوقعات الذكية: ${forecasts.rows[0].count} توقع`);

        console.log('');
        console.log('='.repeat(60));
        
        // Total
        const totalTransactions = parseInt(operating.rows[0].count) + 
                                 parseInt(investing.rows[0].count) + 
                                 parseInt(financing.rows[0].count);
        const totalAmount = parseFloat(operating.rows[0].total || 0) + 
                          parseFloat(investing.rows[0].total || 0) + 
                          parseFloat(financing.rows[0].total || 0);
        
        console.log(`📈 إجمالي المعاملات: ${totalTransactions}`);
        console.log(`💰 الرصيد الصافي: ${totalAmount.toLocaleString()} ر.س`);
        console.log('');

        // Show sample transactions
        console.log('📋 عينة من المعاملات:');
        console.log('-'.repeat(60));
        
        const sampleOperating = await client.query(`
            SELECT flow_id, flow_type, amount, description, flow_date 
            FROM finance_cashflow_operating 
            WHERE entity_id = '1' 
            ORDER BY flow_date DESC 
            LIMIT 3
        `);
        
        console.log('\n🔵 التشغيلية:');
        sampleOperating.rows.forEach(row => {
            console.log(`   ${row.flow_id} | ${row.flow_type} | ${row.amount} ر.س | ${row.description}`);
        });

        const sampleInvesting = await client.query(`
            SELECT flow_id, flow_type, amount, description, flow_date 
            FROM finance_cashflow_investing 
            WHERE entity_id = '1' 
            ORDER BY flow_date DESC 
            LIMIT 3
        `);
        
        console.log('\n🟣 الاستثمارية:');
        sampleInvesting.rows.forEach(row => {
            console.log(`   ${row.flow_id} | ${row.flow_type} | ${row.amount} ر.س | ${row.description}`);
        });

        const sampleFinancing = await client.query(`
            SELECT flow_id, flow_type, amount, description, flow_date 
            FROM finance_cashflow_financing 
            WHERE entity_id = '1' 
            ORDER BY flow_date DESC 
            LIMIT 3
        `);
        
        console.log('\n🟢 التمويلية:');
        sampleFinancing.rows.forEach(row => {
            console.log(`   ${row.flow_id} | ${row.flow_type} | ${row.amount} ر.س | ${row.description}`);
        });

        console.log('');
        console.log('✅ تم فحص جميع البيانات بنجاح');

    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkAllFinanceData();
