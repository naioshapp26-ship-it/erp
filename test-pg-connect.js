/**
 * اختبار بسيط لـ PostgreSQL بدون Pool (لتجنب core dump على بعض سيرفرات cPanel)
 * Usage: node test-pg-connect.js
 */
require('./load-env');
const db = require('./db');

async function main() {
  const dbInfo = db.getDatabaseInfo();
  console.log(`ℹ️  Resolved database host: ${dbInfo.host} (source: ${dbInfo.source}, ssl: ${dbInfo.ssl ? 'enabled' : 'disabled'})`);

  console.log('🔄 اتصال بـ PostgreSQL (Client واحد)...');
  const r = await db.query('SELECT current_database() AS db, current_user AS usr, NOW() AS now');
  console.log('✅ نجح:', r.rows[0]);
  await db.pool.end();
  console.log('✅ تم إغلاق الاتصال');
}

main().catch((err) => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
