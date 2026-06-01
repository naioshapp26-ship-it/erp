/**
 * اختبار db.js (Client pool) — نفس ما يستخدمه server.js
 */
require('dotenv').config();
const db = require('./db');

async function main() {
  console.log('🔄 اختبار db.pool...');
  const r = await db.query('SELECT current_database() AS db, NOW() AS now');
  console.log('✅ db.query:', r.rows[0]);

  const client = await db.pool.connect();
  try {
    const r2 = await client.query('SELECT COUNT(*)::int AS n FROM users');
    console.log('✅ pool.connect:', r2.rows[0]);
  } finally {
    client.release();
  }
  await db.pool.end();
  console.log('✅ انتهى');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
