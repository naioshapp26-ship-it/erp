const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: { rejectUnauthorized: false }
});

async function executeSQL() {
    try {
        await client.connect();
        console.log('✅ تم الاتصال بقاعدة البيانات');

        // قراءة وتنفيذ ملف إنشاء الجداول
        console.log('\n📋 تنفيذ إنشاء الجداول...');
        const createTablesSQL = fs.readFileSync('create-strategic-management-tables.sql', 'utf8');
        await client.query(createTablesSQL);
        console.log('✅ تم إنشاء جميع الجداول بنجاح');

        // قراءة وتنفيذ ملف إدخال البيانات
        console.log('\n📋 تنفيذ إدخال البيانات...');
        const insertDataSQL = fs.readFileSync('insert-strategic-management-data.sql', 'utf8');
        await client.query(insertDataSQL);
        console.log('✅ تم إدخال جميع البيانات بنجاح');

        // عرض إحصائيات
        console.log('\n📊 إحصائيات البيانات المدخلة:');
        console.log('===========================================');
        
        const tables = [
            'executive_kpis',
            'executive_goals',
            'executive_operations',
            'digital_marketing_campaigns',
            'community_marketing',
            'event_marketing',
            'training_courses',
            'skills_registry',
            'kpi_evaluations',
            'daily_operations',
            'operational_monitoring',
            'financial_policies',
            'financial_operating_manual',
            'financial_news',
            'development_programs',
            'training_evaluations',
            'quality_standards',
            'quality_audits',
            'general_evaluations',
            'evaluation_criteria',
            'information_repository',
            'knowledge_base'
        ];

        for (const table of tables) {
            const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`${table}: ${result.rows[0].count} سجل`);
        }

        console.log('===========================================');
        console.log('\n✅ اكتملت جميع العمليات بنجاح!');

    } catch (error) {
        console.error('❌ خطأ:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

executeSQL();
