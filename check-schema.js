const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function checkSchema() {
    try {
        console.log('========== جدول roles ==========');
        const rolesSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'roles'
            ORDER BY ordinal_position
        `);
        rolesSchema.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}`);
        });

        console.log('\n========== جدول role_permissions ==========');
        const permsSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'role_permissions'
            ORDER BY ordinal_position
        `);
        permsSchema.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}`);
        });

        console.log('\n========== عينة من جدول roles ==========');
        const rolesSample = await pool.query('SELECT * FROM roles LIMIT 3');
        console.log(rolesSample.rows);

        console.log('\n========== عينة من جدول role_permissions ==========');
        const permsSample = await pool.query('SELECT * FROM role_permissions LIMIT 5');
        console.log(permsSample.rows);

    } catch (error) {
        console.error('خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
