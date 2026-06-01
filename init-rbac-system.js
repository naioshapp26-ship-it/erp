const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway'
});

async function createRBACSystem() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        console.log('📊 Creating RBAC System Tables...\n');
        console.log('='.repeat(60));

        // قراءة وتنفيذ ملف SQL
        const fs = require('fs');
        const sqlContent = fs.readFileSync('./create-rbac-system.sql', 'utf8');
        
        await client.query(sqlContent);
        console.log('✅ All tables created successfully!\n');

        // التحقق من إنشاء الجداول
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('roles', 'permissions', 'role_permissions', 'user_roles', 'audit_logs', 'governance_rules', 'approval_log')
            ORDER BY table_name;
        `;
        
        const result = await client.query(tablesQuery);
        console.log('📋 Tables Created:');
        console.log('='.repeat(60));
        result.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.table_name}`);
        });

        console.log('\n✅ RBAC System tables created successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

createRBACSystem();
