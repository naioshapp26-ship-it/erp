const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkSystem() {
    try {
        // فحص بنية جدول users
        console.log('========== بنية جدول users ==========\n');
        const usersSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        
        console.log('أعمدة جدول users:');
        usersSchema.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        // عرض عينة من المستخدمين
        console.log('\n========== عينة من المستخدمين ==========\n');
        const users = await pool.query('SELECT * FROM users LIMIT 3');
        console.log(users.rows);

        // البحث عن جداول القائمة
        console.log('\n========== البحث عن جداول القائمة ==========\n');
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (
                table_name LIKE '%menu%' OR 
                table_name LIKE '%sidebar%' OR 
                table_name LIKE '%navigation%' OR
                table_name LIKE '%item%'
            )
        `);
        
        if (tables.rows.length > 0) {
            console.log('جداول متعلقة بالقائمة:');
            tables.rows.forEach(table => {
                console.log(`  - ${table.table_name}`);
            });
        } else {
            console.log('❌ لا توجد جداول للقائمة');
        }

    } catch (error) {
        console.error('خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkSystem();
