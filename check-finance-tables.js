const { Pool } = require('pg');

const pool = new Pool({
    host: 'crossover.proxy.rlwy.net',
    port: 44255,
    user: 'postgres',
    password: 'PddzJpAQYezqknsntSzmCUlQYuYJldcT',
    database: 'railway'
});

async function checkFinanceTables() {
    const client = await pool.connect();
    
    try {
        console.log('📊 فحص جميع جداول النظام المالي');
        console.log('='.repeat(60));
        
        // Get all finance tables
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'finance_%'
            ORDER BY table_name
        `);
        
        console.log(`\n🗃️  عدد الجداول المالية: ${tables.rows.length}\n`);
        
        for (const table of tables.rows) {
            const tableName = table.table_name;
            
            // Get count
            const count = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            
            // Get columns
            const columns = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);
            
            console.log(`📋 ${tableName}`);
            console.log(`   السجلات: ${count.rows[0].count}`);
            console.log(`   الأعمدة: ${columns.rows.map(c => c.column_name).join(', ')}`);
            console.log('');
        }
        
        console.log('='.repeat(60));
        console.log('✅ تم الفحص بنجاح');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkFinanceTables();
