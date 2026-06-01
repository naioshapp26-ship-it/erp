const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
    ssl: false
});

async function check() {
    try {
        const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position");
        console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
        
        const data = await pool.query('SELECT * FROM users LIMIT 1');
        console.log('\nSample data:', data.rows[0]);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}
check();
