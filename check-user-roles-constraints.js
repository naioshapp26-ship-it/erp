/**
 * اختبار بنية جدول user_roles والـ constraints
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkUserRolesStructure() {
    try {
        console.log('📋 فحص بنية جدول user_roles...\n');
        
        // 1. الأعمدة
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'user_roles'
            ORDER BY ordinal_position
        `);
        
        console.log('الأعمدة:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '- مطلوب' : '- اختياري'} ${col.column_default ? `- Default: ${col.column_default}` : ''}`);
        });
        console.log('');
        
        // 2. المفاتيح والـ constraints
        const constraintsResult = await pool.query(`
            SELECT 
                conname as constraint_name,
                contype as constraint_type,
                pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'user_roles'::regclass
        `);
        
        console.log('Constraints:');
        constraintsResult.rows.forEach(c => {
            const types = {
                'p': 'PRIMARY KEY',
                'f': 'FOREIGN KEY',
                'u': 'UNIQUE',
                'c': 'CHECK'
            };
            console.log(`  - ${c.constraint_name} (${types[c.constraint_type]}): ${c.definition}`);
        });
        console.log('');
        
        // 3. الفهارس
        const indexesResult = await pool.query(`
            SELECT 
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename = 'user_roles'
        `);
        
        console.log('Indexes:');
        indexesResult.rows.forEach(idx => {
            console.log(`  - ${idx.indexname}`);
            console.log(`    ${idx.indexdef}`);
        });
        console.log('');
        
        // 4. عينة من البيانات
        const sampleResult = await pool.query(`
            SELECT ur.*, r.name, r.job_title_ar
            FROM user_roles ur
            LEFT JOIN roles r ON ur.role_id = r.id
            LIMIT 3
        `);
        
        console.log('عينة من البيانات:');
        sampleResult.rows.forEach((row, i) => {
            console.log(`\n${i + 1}.`);
            Object.keys(row).forEach(key => {
                console.log(`   ${key}: ${row[key]}`);
            });
        });
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

checkUserRolesStructure();
