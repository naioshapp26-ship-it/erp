require('./load-env');

const { Client } = require('pg');

const RAILWAY_HOST_PATTERN = /\.(proxy\.rlwy\.net|railway\.internal)(:|\/|$)/i;

const normalizeDatabaseUrl = (url) => {
  if (!url) return '';
  return String(url).trim().replace(/\s+/g, '').replace(/@localhost([:/])/gi, '@127.0.0.1$1');
};

const resolveDatabaseUrl = () => {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DATABASE_PUBLIC_URL,
    process.env.PGDATABASE_URL
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDatabaseUrl(candidate);
    if (normalized) return normalized;
  }

  return '';
};

const resolveSsl = (databaseUrl) => {
  const sslSetting = String(process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (sslSetting === 'true' || sslSetting === '1') {
    return { rejectUnauthorized: false };
  }
  if (sslSetting === 'false' || sslSetting === '0') {
    return false;
  }

  if (RAILWAY_HOST_PATTERN.test(databaseUrl) || process.env.RAILWAY_ENVIRONMENT) {
    return { rejectUnauthorized: false };
  }

  return false;
};

const buildDatabaseConfigError = () => {
  const hasEmptyDatabaseUrlVar = 'DATABASE_URL' in process.env && !String(process.env.DATABASE_URL || '').trim();
  const railwayHint = process.env.RAILWAY_ENVIRONMENT
    ? 'On Railway: open your ERP service → Variables → set DATABASE_URL to ${{Postgres.DATABASE_URL}} (reference your PostgreSQL service). Also set DATABASE_SSL=true.'
    : 'Create a .env file from .env.example and set DATABASE_URL to your PostgreSQL connection string.';

  if (hasEmptyDatabaseUrlVar) {
    return [
      'DATABASE_URL is defined but empty.',
      'An empty connection string makes node-postgres fall back to localhost (::1:5432), which causes ECONNREFUSED.',
      railwayHint
    ].join(' ');
  }

  return [
    'DATABASE_URL is not configured.',
    'Set DATABASE_URL in .env (local) or Railway service variables (production).',
    railwayHint
  ].join(' ');
};

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
  const message = buildDatabaseConfigError();
  console.error(`❌ ${message}`);
  throw new Error(message);
}

let parsedDatabaseHost = 'unknown';
try {
  parsedDatabaseHost = new URL(databaseUrl).hostname;
} catch (_) {
  throw new Error('DATABASE_URL is set but is not a valid PostgreSQL connection URL.');
}

const clientConfig = {
  connectionString: databaseUrl,
  ssl: resolveSsl(databaseUrl)
};

console.log(`✅ Database configured (host: ${parsedDatabaseHost}, ssl: ${clientConfig.ssl ? 'enabled' : 'disabled'})`);

/**
 * بديل pg.Pool — يستخدم Client فقط (أثبت على cPanel؛ Pool كان يسبب core dump).
 */
function createClientPool() {
  const maxClients = Number(process.env.PG_POOL_MAX) || 4;
  const idleClients = [];
  let pendingConnects = 0;

  const createConnectedClient = async () => {
    const client = new Client(clientConfig);
    await client.connect();
    return client;
  };

  const acquire = async () => {
    while (idleClients.length > 0) {
      const client = idleClients.pop();
      if (!client._broken) return client;
      try {
        await client.end();
      } catch (_) {
        /* ignore */
      }
    }
    if (pendingConnects >= maxClients) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return acquire();
    }
    pendingConnects += 1;
    try {
      return await createConnectedClient();
    } finally {
      pendingConnects -= 1;
    }
  };

  const release = (client) => {
    if (!client || client._broken) return;
    if (idleClients.length >= maxClients) {
      client.end().catch(() => {});
      return;
    }
    idleClients.push(client);
  };

  const pool = {
    async connect() {
      const client = await acquire();
      let released = false;
      return {
        query: (text, params) => client.query(text, params),
        release: () => {
          if (released) return;
          released = true;
          release(client);
        }
      };
    },
    query(text, params) {
      return pool.connect().then(async (wrapper) => {
        try {
          return await wrapper.query(text, params);
        } finally {
          wrapper.release();
        }
      });
    },
    async end() {
      const closing = idleClients.splice(0);
      await Promise.all(closing.map((c) => c.end().catch(() => {})));
    },
    on(event, handler) {
      if (event === 'error' && typeof handler === 'function') {
        pool._errorHandler = handler;
      }
      return pool;
    }
  };

  return pool;
}

const pool = createClientPool();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  getDatabaseInfo: () => ({
    host: parsedDatabaseHost,
    ssl: Boolean(clientConfig.ssl),
    hasDatabaseUrl: Boolean(databaseUrl)
  })
};
