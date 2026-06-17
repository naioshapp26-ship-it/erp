/**
 * Initialize finance module tables and sample data.
 * Usage: node scripts/bootstrap-finance.js
 */
require('../load-env');

const { ensureFinanceReady, FINANCE_CORE_TABLES } = require('../finance-bootstrap');
const { getDatabaseInfo } = require('../db');

async function main() {
  const info = getDatabaseInfo();
  console.log(`Bootstrapping finance module on ${info.host}...`);
  await ensureFinanceReady();
  console.log(`✅ Finance bootstrap complete (${FINANCE_CORE_TABLES.length} core tables verified).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Finance bootstrap failed:', error.message);
  process.exit(1);
});
