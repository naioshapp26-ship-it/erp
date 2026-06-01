const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function checkContactInfo() {
    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Check all tables
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `;
        
        const result = await client.query(tablesQuery);
        console.log('\n📋 All Tables:');
        console.log('==========================');
        result.rows.forEach(table => {
            console.log(table.table_name);
        });

        // Check if there are contact-related columns
        const contactQuery = `
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE column_name LIKE '%phone%' 
               OR column_name LIKE '%email%'
               OR column_name LIKE '%mobile%'
               OR column_name LIKE '%contact%'
            ORDER BY table_name, column_name;
        `;
        
        const contactResult = await client.query(contactQuery);
        console.log('\n📞 Contact-related Columns:');
        console.log('==========================');
        contactResult.rows.forEach(col => {
            console.log(`${col.table_name}.${col.column_name} (${col.data_type})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

checkContactInfo();
