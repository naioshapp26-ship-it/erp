#!/usr/bin/env node
/**
 * Print all database-related environment variables and resolved host.
 * Usage: node scripts/print-db-env.js
 */
const { getRuntimeEnvDiagnostics, resolveDatabaseConfig } = require('../database-config');

const diagnostics = getRuntimeEnvDiagnostics();
console.log(JSON.stringify(diagnostics, null, 2));

try {
  const config = resolveDatabaseConfig();
  console.log('\nResolved configuration:');
  console.log(JSON.stringify({
    source: config.source,
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username
  }, null, 2));
} catch (error) {
  console.error('\nResolution failed:', error.message);
  process.exit(1);
}
