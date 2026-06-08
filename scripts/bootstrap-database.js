/**
 * Run ERP schema bootstrap and seed data against DATABASE_URL.
 * Usage: node scripts/bootstrap-database.js
 */
require('../load-env');

const { ensureDatabaseReady, REQUIRED_TABLES } = require('../database-bootstrap');
const { getDatabaseInfo } = require('../db');

async function main() {
  const info = getDatabaseInfo();
  console.log(`Bootstrapping ERP schema on ${info.host} (ssl: ${info.ssl ? 'on' : 'off'})...`);

  await ensureDatabaseReady();

  console.log(`✅ Database bootstrap complete (${REQUIRED_TABLES.length} required tables verified).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Database bootstrap failed:', error.message);
  process.exit(1);
});
