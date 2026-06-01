const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:PddzJpAQYezqknsntSzmCUlQYuYJldcT@crossover.proxy.rlwy.net:44255/railway',
  ssl: false
});

pool.query(`
  SELECT COUNT(*) FROM finance_accounts WHERE entity_id = '1'
`).then(res => {
  console.log('Accounts:', res.rows[0].count);
  return pool.end();
}).catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
