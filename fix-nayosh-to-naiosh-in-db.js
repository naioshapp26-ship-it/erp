const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function fixNayoshToNaiosh() {
    try {
        await client.connect();
        console.log('🔗 Connected to database\n');

        // 1. Check current data
        console.log('📊 Checking current data...\n');
        const checkQuery = `
            SELECT id, name, name_ar 
            FROM entities 
            WHERE name ILIKE '%Nayosh%' OR name_ar ILIKE '%نيوش%'
        `;
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length > 0) {
            console.log('Found records with "Nayosh":');
            console.table(checkResult.rows);
        } else {
            console.log('✅ No records found with "Nayosh"\n');
        }

        // 2. Update English names
        console.log('\n🔄 Updating entities table (English names)...');
        const updateEnQuery = `
            UPDATE entities 
            SET name = REPLACE(name, 'Nayosh', 'NAIOSH')
            WHERE name ILIKE '%Nayosh%'
            RETURNING id, name
        `;
        const updateEnResult = await client.query(updateEnQuery);
        console.log(`✅ Updated ${updateEnResult.rowCount} records (English)`);
        if (updateEnResult.rows.length > 0) {
            console.table(updateEnResult.rows);
        }

        // 3. Update Arabic names
        console.log('\n🔄 Updating entities table (Arabic names)...');
        const updateArQuery = `
            UPDATE entities 
            SET name_ar = REPLACE(name_ar, 'نيوش', 'نايوش')
            WHERE name_ar ILIKE '%نيوش%'
            RETURNING id, name_ar
        `;
        const updateArResult = await client.query(updateArQuery);
        console.log(`✅ Updated ${updateArResult.rowCount} records (Arabic)`);
        if (updateArResult.rows.length > 0) {
            console.table(updateArResult.rows);
        }

        // 4. Verify
        console.log('\n✅ Verifying changes...\n');
        const verifyQuery = `
            SELECT id, name, name_ar, code
            FROM entities 
            WHERE code = 'HQ-001' OR name ILIKE '%NAIOSH%'
            ORDER BY id
        `;
        const verifyResult = await client.query(verifyQuery);
        console.log('Updated records:');
        console.table(verifyResult.rows);

        console.log('\n🎉 Update completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected from database');
    }
}

fixNayoshToNaiosh();
