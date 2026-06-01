const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function initSmartCollectionSystem() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        console.log('📊 Creating Smart Collection System Tables...\n');
        console.log('='.repeat(70));

        // قراءة وتنفيذ ملف SQL
        const fs = require('fs');
        const sqlContent = fs.readFileSync('./create-smart-collection-system.sql', 'utf8');
        
        await client.query(sqlContent);
        console.log('✅ All tables created successfully!\n');

        // التحقق من إنشاء الجداول
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'invoice_types', 'invoice_statuses', 'invoices_enhanced', 
                'payments', 'installment_plans', 'installment_invoices',
                'installment_history', 'tax_rules', 'collection_rules',
                'collection_reminders', 'overdue_list'
            )
            ORDER BY table_name;
        `;
        
        const result = await client.query(tablesQuery);
        console.log('📋 Tables Created:');
        console.log('='.repeat(70));
        result.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.table_name}`);
        });

        console.log('\n✅ Smart Collection System tables created successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

initSmartCollectionSystem();
