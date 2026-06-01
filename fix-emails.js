const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function fixEmails() {
    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Fix emails using a simpler approach
        console.log('\n📧 Fixing email addresses...');
        
        const entities = await client.query('SELECT id, name FROM entities');
        
        for (const entity of entities.rows) {
            // Create clean email from name
            const cleanName = entity.name
                .replace(/\s+/g, '')  // Remove spaces
                .replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '');  // Keep only Arabic, English, and numbers
            
            const email = `${entity.id.toLowerCase().replace(/[^a-z0-9]/g, '_')}@nayosh.com`;
            
            await client.query('UPDATE entities SET email = $1 WHERE id = $2', [email, entity.id]);
        }

        console.log('✅ Emails fixed');

        // Verify
        const result = await client.query(`
            SELECT id, name, type, phone, email 
            FROM entities 
            LIMIT 15;
        `);
        
        console.log('\n📊 Updated data:');
        console.log('================================');
        result.rows.forEach(row => {
            console.log(`${row.id.padEnd(15)} | ${row.name.padEnd(25)} | ${row.phone} | ${row.email}`);
        });

        console.log('\n✅ All emails updated successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

fixEmails();
