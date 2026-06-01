const { Pool } = require('pg');

const pool = new Pool({
    host: 'crossover.proxy.rlwy.net',
    port: 44255,
    database: 'railway',
    user: 'postgres',
    password: 'PddzJpAQYezqknsntSzmCUlQYuYJldcT',
    ssl: { rejectUnauthorized: false }
});

async function checkAccountBalancesStructure() {
    try {
        console.log('\n🔍 فحص بنية جدول finance_account_balances...\n');

        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'finance_account_balances'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('❌ الجدول finance_account_balances غير موجود!');
            
            // Check what tables we have
            const tables = await pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE 'finance%balance%'
                ORDER BY table_name;
            `);
            
            console.log('\n📋 الجداول المتعلقة بـ balance:');
            tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
            
            return;
        }

        console.log('✅ الجدول موجود\n');

        // Get table structure
        const structure = await pool.query(`
            SELECT 
                column_name, 
                data_type, 
                character_maximum_length,
                is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'finance_account_balances'
            ORDER BY ordinal_position;
        `);

        console.log('📊 بنية الجدول:\n');
        console.log('Column Name                | Data Type        | Nullable');
        console.log('---------------------------|------------------|----------');
        structure.rows.forEach(col => {
            const colName = col.column_name.padEnd(26);
            const dataType = col.data_type.padEnd(16);
            const nullable = col.is_nullable;
            console.log(`${colName} | ${dataType} | ${nullable}`);
        });

        // Get sample data
        const data = await pool.query(`
            SELECT * FROM finance_account_balances LIMIT 5;
        `);

        console.log(`\n📈 عدد السجلات: ${data.rows.length}`);
        
        if (data.rows.length > 0) {
            console.log('\n📋 عينة من البيانات:');
            console.log(JSON.stringify(data.rows[0], null, 2));
        }

        pool.end();

    } catch (error) {
        console.error('❌ خطأ:', error.message);
        pool.end();
    }
}

checkAccountBalancesStructure();
