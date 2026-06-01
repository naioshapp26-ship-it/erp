/**
 * فحص بنية جدول users
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkUsersTable() {
    try {
        const columnsResult = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        
        console.log('جدول users - الأعمدة:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        
        const sampleData = await pool.query('SELECT * FROM users LIMIT 1');
        console.log('\nعينة من البيانات:');
        if (sampleData.rows.length > 0) {
            Object.keys(sampleData.rows[0]).forEach(key => {
                console.log(`  ${key}: ${sampleData.rows[0][key]}`);
            });
        }
        
    } catch (error) {
        console.error('خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkUsersTable();
