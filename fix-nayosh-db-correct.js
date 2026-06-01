const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function fixNayoshToNaiosh() {
    try {
        await client.connect();
        console.log('🔗 Connected to database\n');

        // 1. Check current data
        console.log('📊 Checking current data with "Nayosh"...\n');
        const checkQuery = `
            SELECT id, name, type, status
            FROM entities 
            WHERE name ILIKE '%Nayosh%'
            LIMIT 10
        `;
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length > 0) {
            console.log(`Found ${checkResult.rows.length} records with "Nayosh":`);
            console.table(checkResult.rows);
        } else {
            console.log('✅ No records found with "Nayosh"\n');
        }

        // 2. Update name column - replace Nayosh with NAIOSH
        console.log('\n🔄 Updating entities table...');
        const updateQuery = `
            UPDATE entities 
            SET name = REPLACE(name, 'Nayosh', 'NAIOSH')
            WHERE name ILIKE '%Nayosh%'
            RETURNING id, name, type
        `;
        const updateResult = await client.query(updateQuery);
        console.log(`✅ Updated ${updateResult.rowCount} records`);
        if (updateResult.rows.length > 0) {
            console.log('\nUpdated records:');
            console.table(updateResult.rows);
        }

        // 3. Verify the changes
        console.log('\n✅ Verifying changes...\n');
        const verifyQuery = `
            SELECT id, name, type, status
            FROM entities 
            WHERE name ILIKE '%NAIOSH%'
            ORDER BY id
            LIMIT 10
        `;
        const verifyResult = await client.query(verifyQuery);
        if (verifyResult.rows.length > 0) {
            console.log('Records with "NAIOSH":');
            console.table(verifyResult.rows);
        }

        console.log('\n🎉 Update completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected from database');
    }
}

fixNayoshToNaiosh();
