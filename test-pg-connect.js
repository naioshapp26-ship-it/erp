/**
 * اختبار بسيط لـ PostgreSQL بدون Pool (لتجنب core dump على بعض سيرفرات cPanel)
 * Usage: node test-pg-connect.js
 */
require('./load-env');
const { getDatabaseInfo } = require('./db');

const { Client } = require('pg');

const normalizeUrl = (url) => {
  if (!url) return url;
  return url.replace(/@localhost([:/])/gi, '@127.0.0.1$1');
};

const resolveSsl = (connectionString) => {
  const sslSetting = String(process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (sslSetting === 'true' || sslSetting === '1') {
    return { rejectUnauthorized: false };
  }
  if (sslSetting === 'false' || sslSetting === '0') {
    return false;
  }
  if (/\.(proxy\.rlwy\.net|railway\.internal)/i.test(connectionString) || process.env.RAILWAY_ENVIRONMENT) {
    return { rejectUnauthorized: false };
  }
  return false;
};

async function main() {
  const connectionString = normalizeUrl(
    process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || ''
  );
  if (!connectionString) {
    console.error('❌ DATABASE_URL غير مضبوط');
    process.exit(1);
  }

  const ssl = resolveSsl(connectionString);
  const dbInfo = getDatabaseInfo();
  console.log(`ℹ️  Target host: ${dbInfo.host}, ssl: ${ssl ? 'enabled' : 'disabled'}`);
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
