const { resolveDatabaseConfig, resolveSsl } = require('./database-config');

const { Client } = require('pg');

let resolvedConfig;
try {
  resolvedConfig = resolveDatabaseConfig();
} catch (error) {
  console.error(`❌ ${error.message}`);
  throw error;
}

const {
  databaseUrl,
  host: parsedDatabaseHost,
  port: parsedDatabasePort,
  database: parsedDatabaseName,
  source: databaseUrlSource,
  rejections: databaseUrlRejections
} = resolvedConfig;

const clientConfig = {
  connectionString: databaseUrl,
  ssl: resolveSsl(databaseUrl)
};

console.log(
  `✅ Database configured (source: ${databaseUrlSource}, host: ${parsedDatabaseHost}, port: ${parsedDatabasePort}, db: ${parsedDatabaseName}, ssl: ${clientConfig.ssl ? 'enabled' : 'disabled'})`
);

if (databaseUrlRejections.length > 0) {
  console.warn('⚠️ Skipped invalid database URL sources:', databaseUrlRejections);
}

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
    port: parsedDatabasePort,
    database: parsedDatabaseName,
    source: databaseUrlSource,
    ssl: Boolean(clientConfig.ssl),
    hasDatabaseUrl: Boolean(databaseUrl),
    rejectedSources: databaseUrlRejections
  })
};
