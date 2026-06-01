const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function searchAllTables() {
    try {
        await client.connect();
        console.log('🔗 Connected to database\n');

        // Get all tables
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;
        const tablesResult = await client.query(tablesQuery);
        console.log(`Found ${tablesResult.rows.length} tables\n`);

        // Search each table for text columns containing "Nayosh"
        for (const tableRow of tablesResult.rows) {
            const tableName = tableRow.table_name;
            
            // Get text columns for this table
            const columnsQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 
                AND data_type IN ('character varying', 'text', 'char')
            `;
            const columnsResult = await client.query(columnsQuery, [tableName]);
            
            // Search in each text column
            for (const colRow of columnsResult.rows) {
                const columnName = colRow.column_name;
                
                try {
                    const searchQuery = `
                        SELECT '${tableName}' as table_name, '${columnName}' as column_name, * 
                        FROM ${tableName} 
                        WHERE ${columnName}::text ILIKE '%Nayosh%'
                        LIMIT 3
                    `;
                    const searchResult = await client.query(searchQuery);
                    
                    if (searchResult.rows.length > 0) {
                        console.log(`\n🔍 Found in ${tableName}.${columnName}:`);
                        console.table(searchResult.rows);
                    }
                } catch (err) {
                    // Skip columns that can't be searched
                }
            }
        }

        console.log('\n✅ Search completed');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected');
    }
}

searchAllTables();
