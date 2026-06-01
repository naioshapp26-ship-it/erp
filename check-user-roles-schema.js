/**
 * فحص بنية جدول user_roles
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkUserRolesSchema() {
    try {
        console.log('📋 فحص بنية جدول user_roles...\n');
        
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'user_roles'
            ORDER BY ordinal_position
        `);
        
        console.log('الأعمدة الموجودة في جدول user_roles:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '- مطلوب' : '- اختياري'}`);
        });
        
        console.log('\n');
        
        // جلب عينة من البيانات
        console.log('📊 عينة من البيانات:\n');
        const sampleData = await pool.query(`
            SELECT * FROM user_roles LIMIT 3
        `);
        
        console.log('أول 3 سجلات:');
        sampleData.rows.forEach((ur, index) => {
            console.log(`\n${index + 1}. البيانات:`);
            Object.keys(ur).forEach(key => {
                console.log(`   ${key}: ${ur[key]}`);
            });
        });
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkUserRolesSchema();
