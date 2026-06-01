const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkColumns() {
    try {
        await client.connect();
        
        const query = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entities'
            ORDER BY ordinal_position
        `;
        const result = await client.query(query);
        console.log('Entities table columns:');
        console.table(result.rows);
        
        // Also check current data
        const dataQuery = `SELECT * FROM entities WHERE code = 'HQ-001' OR name ILIKE '%nayosh%' LIMIT 5`;
        const dataResult = await client.query(dataQuery);
        console.log('\nCurrent data:');
        console.table(dataResult.rows);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

checkColumns();
