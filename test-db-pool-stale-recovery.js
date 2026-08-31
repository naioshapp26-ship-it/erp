/**
 * Ensures the custom pool replaces clients after Postgres terminates the backend.
 */
require('./load-env');
const db = require('./db');

async function main() {
  const wrapper = await db.pool.connect();
  try {
    await wrapper.query('SELECT pg_terminate_backend(pg_backend_pid())');
    throw new Error('expected backend termination to fail the query');
  } catch (error) {
    if (!/connection error|not queryable|terminated|ECONNRESET|57P01|08006|08003/i.test(String(error.message))) {
      throw error;
    }
  } finally {
    wrapper.release();
  }

  const recovered = await db.query('SELECT 42 AS ok');
  if (Number(recovered.rows[0].ok) !== 42) {
    throw new Error('pool did not recover after terminated backend');
  }

  await db.pool.end();
  console.log('✅ db pool stale recovery test passed');
}

main().catch((error) => {
  console.error('❌', error.message);
  process.exit(1);
});
