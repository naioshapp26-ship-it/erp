/**
 * Restore the full NAIOSH ERP database from the main SQL dump.
 *
 * Primary data file: /workspace/NaioshERP.sql (~5,300 entities, full hierarchy, RBAC, finance)
 *
 * Usage:
 *   node scripts/restore-full-database.js
 *   node scripts/restore-full-database.js --file NaioshERP-fixed.sql
 *
 * Requirements:
 *   - DATABASE_URL must be set (Railway Postgres or local)
 *   - Recommended for empty or development databases
 */
require('../load-env');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const db = require('../db');

const DEFAULT_DUMP = path.join(__dirname, '..', 'NaioshERP.sql');

function preprocessDump(sql) {
  return sql
    .replace(/^\\restrict.*$/gm, '')
    .replace(/^SET transaction_timeout = .*;$/gm, '')
    .replace(/^\\connect.*$/gm, '')
    .replace(/^\\unrestrict.*$/gm, '');
}

function writePreprocessedDump(dumpFile) {
  const sql = preprocessDump(fs.readFileSync(dumpFile, 'utf8'));
  const tempFile = path.join(__dirname, '..', '.restore-temp.sql');
  fs.writeFileSync(tempFile, sql);
  return tempFile;
}

function resolveDumpFile() {
  const fileArgIndex = process.argv.indexOf('--file');
  if (fileArgIndex >= 0 && process.argv[fileArgIndex + 1]) {
    return path.resolve(process.cwd(), process.argv[fileArgIndex + 1]);
  }
  return DEFAULT_DUMP;
}

async function restoreWithPsql(dumpFile) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const preparedFile = writePreprocessedDump(dumpFile);
  console.log('📦 Restoring via psql (quiet mode — logs suppressed)...');
  const startedAt = Date.now();

  const result = spawnSync(
    'psql',
    [databaseUrl, '-q', '-X', '-v', 'ON_ERROR_STOP=0', '-f', preparedFile],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  try {
    fs.unlinkSync(preparedFile);
  } catch (_) {
    /* ignore */
  }

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(`⏱️ psql finished in ${elapsedSec}s (exit ${result.status ?? 'unknown'})`);

  const stderr = (result.stderr || '').toString().trim();
  if (stderr) {
    const preview = stderr.length > 1500 ? `${stderr.slice(0, 1500)}…` : stderr;
    console.warn(`psql warnings/errors:\n${preview}`);
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`psql exited with code ${result.status}`);
  }
}

async function restoreWithNode(dumpFile) {
  const sql = preprocessDump(fs.readFileSync(dumpFile, 'utf8'));
  console.log(`📦 Restoring via node-pg (${Math.round(sql.length / 1024)} KB, no verbose output)...`);
  const startedAt = Date.now();
  await db.query(sql);
  console.log(`⏱️ node-pg restore finished in ${Math.round((Date.now() - startedAt) / 1000)}s`);
}

async function verifyRestore() {
  const checks = [
    ['entities', 'SELECT COUNT(*)::int AS count FROM entities'],
    ['headquarters', 'SELECT COUNT(*)::int AS count FROM headquarters'],
    ['branches', 'SELECT COUNT(*)::int AS count FROM branches'],
    ['roles', 'SELECT COUNT(*)::int AS count FROM roles'],
    ['users', 'SELECT COUNT(*)::int AS count FROM users']
  ];

  console.log('\n📊 Restore verification:');
  for (const [label, query] of checks) {
    try {
      const result = await db.query(query);
      console.log(`   - ${label}: ${result.rows[0].count}`);
    } catch (error) {
      console.log(`   - ${label}: unavailable (${error.message})`);
    }
  }
}

async function main() {
  const dumpFile = resolveDumpFile();
  if (!fs.existsSync(dumpFile)) {
    console.error(`❌ Dump file not found: ${dumpFile}`);
    console.error('   Expected main data file: NaioshERP.sql in project root');
    process.exit(1);
  }

  const info = (() => {
    try {
      return require('../db').getDatabaseInfo();
    } catch (_) {
      return { host: 'unknown' };
    }
  })();

  console.log(`🚀 Restoring NAIOSH ERP database from:\n   ${dumpFile}`);
  console.log(`   Target host: ${info.host}`);

  if (!process.argv.includes('--yes')) {
    console.log('\n⚠️  This imports the full production snapshot. Re-run with --yes to continue.');
    process.exit(0);
  }

  try {
    await restoreWithPsql(dumpFile);
  } catch (psqlError) {
    console.warn(`psql unavailable (${psqlError.message}), falling back to node-pg...`);
    await restoreWithNode(dumpFile);
  }

  await verifyRestore();
  console.log('\n✅ Full database restore completed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Restore failed:', error.message);
  process.exit(1);
});
