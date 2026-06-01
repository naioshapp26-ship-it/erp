/**
 * فحص بنية جدول roles
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkRolesSchema() {
    try {
        // 1. فحص أعمدة جدول roles
        console.log('📋 فحص بنية جدول roles...\n');
        
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'roles'
            ORDER BY ordinal_position
        `);
        
        console.log('الأعمدة الموجودة في جدول roles:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '- مطلوب' : '- اختياري'}`);
        });
        
        console.log('\n');
        
        // 2. جلب بعض البيانات كمثال
        console.log('📊 عينة من البيانات:\n');
        const sampleData = await pool.query(`
            SELECT * FROM roles ORDER BY hierarchy_level LIMIT 3
        `);
        
        console.log('أول 3 أدوار:');
        sampleData.rows.forEach((role, index) => {
            console.log(`\n${index + 1}. البيانات:`);
            Object.keys(role).forEach(key => {
                console.log(`   ${key}: ${role[key]}`);
            });
        });
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkRolesSchema();
