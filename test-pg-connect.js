/**
 * اختبار بسيط لـ PostgreSQL بدون Pool (لتجنب core dump على بعض سيرفرات cPanel)
 * Usage: node test-pg-connect.js
 */
require('dotenv').config();

const { Client } = require('pg');

const normalizeUrl = (url) => {
  if (!url) return url;
  return url.replace(/@localhost([:/])/gi, '@127.0.0.1$1');
};

async function main() {
  const connectionString = normalizeUrl(process.env.DATABASE_URL);
  if (!connectionString) {
    console.error('❌ DATABASE_URL غير مضبوط');
    process.exit(1);
  }

  const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });

  console.log('🔄 اتصال بـ PostgreSQL (Client واحد)...');
  await client.connect();
  const r = await client.query('SELECT current_database() AS db, current_user AS usr, NOW() AS now');
  console.log('✅ نجح:', r.rows[0]);
  await client.end();
  console.log('✅ تم إغلاق الاتصال');
}

main().catch((err) => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
