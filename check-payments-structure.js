const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkPaymentsTable() {
    try {
        await client.connect();
        
        const columns = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'payments'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 Payments Table Structure:');
        console.log('='.repeat(60));
        columns.rows.forEach(col => {
            const nullable = col.is_nullable === 'YES' ? '(NULL)' : '(NOT NULL)';
            console.log(`${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${nullable}`);
        });

        await client.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkPaymentsTable();
