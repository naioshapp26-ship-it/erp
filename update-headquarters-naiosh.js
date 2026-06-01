const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function updateHeadquarters() {
    try {
        await client.connect();
        console.log('🔗 Connected to database\n');

        // Update headquarters table
        console.log('🔄 Updating headquarters.name...');
        const updateQuery = `
            UPDATE headquarters 
            SET name = 'NAIOSH Global HQ'
            WHERE name = 'Nayosh Global HQ'
            RETURNING *
        `;
        const updateResult = await client.query(updateQuery);
        console.log(`✅ Updated ${updateResult.rowCount} record(s)\n`);
        if (updateResult.rows.length > 0) {
            console.table(updateResult.rows);
        }

        // Verify
        console.log('\n✅ Verifying...');
        const verifyQuery = `SELECT id, name, code, description FROM headquarters WHERE code = 'HQ-001'`;
        const verifyResult = await client.query(verifyQuery);
        console.table(verifyResult.rows);

        console.log('\n🎉 Update completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected');
    }
}

updateHeadquarters();
