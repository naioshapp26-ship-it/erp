const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function addContactColumns() {
    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Add phone column if not exists
        console.log('\n📞 Adding phone column to entities table...');
        await client.query(`
            ALTER TABLE entities 
            ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
        `);
        console.log('✅ Phone column added');

        // Add email column if not exists
        console.log('\n📧 Adding email column to entities table...');
        await client.query(`
            ALTER TABLE entities 
            ADD COLUMN IF NOT EXISTS email VARCHAR(255);
        `);
        console.log('✅ Email column added');

        // Update sample data with phone and email
        console.log('\n📝 Adding sample contact data...');
        
        // For HQ
        await client.query(`
            UPDATE entities 
            SET phone = '0114567890', email = 'hq@nayosh.com'
            WHERE id = 'HQ001';
        `);

        // For branches - add sample data with random-like numbers
        await client.query(`
            UPDATE entities 
            SET 
                phone = '0115' || LPAD((FLOOR(RANDOM() * 999999))::TEXT, 6, '0'),
                email = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) || '@nayosh.com'
            WHERE type IN ('BRANCH', 'INCUBATOR', 'PLATFORM', 'OFFICE') AND phone IS NULL;
        `);

        console.log('✅ Sample contact data added');

        // Verify
        const result = await client.query(`
            SELECT id, name, type, phone, email 
            FROM entities 
            LIMIT 10;
        `);
        
        console.log('\n📊 Sample data with new columns:');
        console.log('================================');
        result.rows.forEach(row => {
            console.log(`${row.id} | ${row.name} | ${row.phone} | ${row.email}`);
        });

        console.log('\n✅ Contact columns added successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

addContactColumns();
