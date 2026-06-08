const { resolveDatabaseConfig, resolveSsl, getRuntimeEnvDiagnostics } = require('./database-config');

const { Client } = require('pg');

const startupDiagnostics = getRuntimeEnvDiagnostics();
console.log('📋 Database environment diagnostics:', JSON.stringify(startupDiagnostics, null, 2));

let resolvedConfig = null;
let configError = null;

try {
  resolvedConfig = resolveDatabaseConfig();
  console.log(
    `✅ Database configured (source: ${resolvedConfig.source}, host: ${resolvedConfig.host}, port: ${resolvedConfig.port}, db: ${resolvedConfig.database}, ssl: ${resolveSsl(resolvedConfig.databaseUrl) ? 'enabled' : 'disabled'})`
  );
  if (resolvedConfig.rejections.length > 0) {
    console.warn('⚠️ Skipped invalid database URL sources:', resolvedConfig.rejections);
  }
} catch (error) {
  configError = error;
  console.error(`❌ Database configuration failed: ${error.message}`);
  if (error.diagnostics) {
    console.error('📋 Failed database diagnostics:', JSON.stringify(error.diagnostics, null, 2));
  }
}

function buildClientConfig() {
  if (!resolvedConfig) return null;
  return {
    host: resolvedConfig.host,
    port: Number(resolvedConfig.port) || 5432,
    user: resolvedConfig.username,
    password: resolvedConfig.password,
    database: resolvedConfig.database,
    ssl: resolveSsl(resolvedConfig.databaseUrl)
  };
}

function rejectIfMisconfigured() {
  if (configError) {
    const err = new Error(configError.message);
    err.code = 'DB_CONFIG_ERROR';
    err.resolvedHost = configError.resolvedHost || null;
    err.diagnostics = configError.diagnostics || startupDiagnostics;
    throw err;
  }
}

/**
 * بديل pg.Pool — يستخدم Client فقط (أثبت على cPanel؛ Pool كان يسبب core dump).
 * Uses explicit host/port/user/password/database — never empty connectionString,
 * so node-postgres cannot silently fall back to PGHOST env var.
 */
function createClientPool() {
  const maxClients = Number(process.env.PG_POOL_MAX) || 4;
  const idleClients = [];
  let pendingConnects = 0;
  const clientConfig = buildClientConfig();

  const createConnectedClient = async () => {
    rejectIfMisconfigured();
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

  return {
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
      return this.connect().then(async (wrapper) => {
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
        this._errorHandler = handler;
      }
      return this;
    }
  };
}

const pool = createClientPool();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  isConfigured: () => Boolean(resolvedConfig),
  getConfigError: () => configError,
  getDatabaseInfo: () => {
    if (configError) {
      return {
        configured: false,
        host: configError.resolvedHost || null,
        error: configError.message,
        rejectedSources: configError.rejections || [],
        runtimeDiagnostics: configError.diagnostics || startupDiagnostics
      };
    }

    const clientConfig = buildClientConfig();
    return {
      configured: true,
      host: resolvedConfig.host,
      port: resolvedConfig.port,
      database: resolvedConfig.database,
      source: resolvedConfig.source,
      ssl: Boolean(clientConfig.ssl),
      hasDatabaseUrl: Boolean(resolvedConfig.databaseUrl),
      rejectedSources: resolvedConfig.rejections,
      runtimeDiagnostics: startupDiagnostics
    };
  }
};
