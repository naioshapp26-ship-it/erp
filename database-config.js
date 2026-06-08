require('./load-env');

const RAILWAY_HOST_PATTERN = /\.(proxy\.rlwy\.net|railway\.internal)(:|\/|$)/i;
const UNRESOLVED_TEMPLATE_PATTERN = /\$\{\{[^}]+\}\}/;

const DB_ENV_KEYS = [
  'DATABASE_URL',
  'DATABASE_PUBLIC_URL',
  'DATABASE_SSL',
  'PGHOST',
  'PGPORT',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'BASE_DOMAIN',
  'RAILWAY_ENVIRONMENT',
  'RAILWAY_SERVICE_NAME',
  'NODE_ENV'
];

const PLACEHOLDER_HOSTS = new Set(['base', 'db', 'database', 'postgres', 'localhost', '127.0.0.1', '::1']);

const normalizeDatabaseUrl = (url) => {
  if (!url) return '';
  return String(url).trim().replace(/\s+/g, '').replace(/@localhost([:/])/gi, '@127.0.0.1$1');
};

const redactDatabaseUrl = (url) => {
  const normalized = normalizeDatabaseUrl(url);
  if (!normalized) return '(empty)';

  try {
    const parsed = new URL(normalized);
    const hasPassword = Boolean(parsed.password);
    if (hasPassword) parsed.password = '***';
    return parsed.toString();
  } catch (_) {
    return normalized.includes('@') ? normalized.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@') : normalized;
  }
};

const parseDatabaseUrl = (url) => {
  const normalized = normalizeDatabaseUrl(url);
  if (!normalized) {
    return { normalized: '', valid: false, host: '', reason: 'empty' };
  }

  if (UNRESOLVED_TEMPLATE_PATTERN.test(normalized)) {
    return {
      normalized,
      valid: false,
      host: '',
      reason: 'unresolved Railway template — use ${{Postgres.DATABASE_URL}} reference, not a literal string'
    };
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      return { normalized, valid: false, host: '', reason: `unsupported protocol: ${parsed.protocol}` };
    }

    const host = parsed.hostname || '';
    if (!host) {
      return { normalized, valid: false, host: '', reason: 'missing hostname in DATABASE_URL' };
    }

    return {
      normalized,
      valid: true,
      host,
      port: parsed.port || '5432',
      database: (parsed.pathname || '/').replace(/^\//, '') || 'postgres',
      username: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      reason: ''
    };
  } catch (error) {
    return { normalized, valid: false, host: '', reason: error.message };
  }
};

const isUsableDatabaseHost = (host) => {
  const normalizedHost = String(host || '').trim().toLowerCase();
  if (!normalizedHost) return false;
  if (['base', 'db', 'database'].includes(normalizedHost)) return false;
  if (RAILWAY_HOST_PATTERN.test(normalizedHost) || normalizedHost.endsWith('.railway.internal')) return true;
  if (!process.env.RAILWAY_ENVIRONMENT) return true;
  return !['127.0.0.1', 'localhost', '::1', 'postgres'].includes(normalizedHost);
};

const buildUrlFromPgVars = () => {
  const host = String(process.env.PGHOST || '').trim();
  const port = String(process.env.PGPORT || '5432').trim();
  const user = String(process.env.PGUSER || process.env.POSTGRES_USER || 'postgres').trim();
  const password = String(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '').trim();
  const database = String(process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway').trim();

  if (!host || !password) return '';

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
};

const collectDatabaseCandidates = () => {
  const entries = [
    { source: 'DATABASE_URL', value: process.env.DATABASE_URL },
    { source: 'DATABASE_PUBLIC_URL', value: process.env.DATABASE_PUBLIC_URL },
    { source: 'PGHOST+PGPORT', value: buildUrlFromPgVars() }
  ];

  return entries
    .map((entry) => ({ ...entry, parsed: parseDatabaseUrl(entry.value) }))
    .filter((entry) => entry.parsed.normalized);
};

const getPgImplicitFallbackHost = () => {
  return String(process.env.PGHOST || '').trim() || null;
};

const getRuntimeEnvDiagnostics = () => {
  const candidates = [
    { source: 'DATABASE_URL', value: process.env.DATABASE_URL },
    { source: 'DATABASE_PUBLIC_URL', value: process.env.DATABASE_PUBLIC_URL },
    { source: 'PGHOST+PGPORT', value: buildUrlFromPgVars() }
  ].map((entry) => ({
    source: entry.source,
    set: Boolean(normalizeDatabaseUrl(entry.value)),
    redacted: entry.source === 'PGHOST+PGPORT'
      ? (entry.value ? redactDatabaseUrl(entry.value) : '(empty)')
      : redactDatabaseUrl(entry.value),
    parsedHost: parseDatabaseUrl(entry.value).host || null,
    parsedValid: parseDatabaseUrl(entry.value).valid
  }));

  const pgHost = getPgImplicitFallbackHost();
  const databaseUrlEmpty = !normalizeDatabaseUrl(process.env.DATABASE_URL)
    && !normalizeDatabaseUrl(process.env.DATABASE_PUBLIC_URL);

  return {
    environment: {
      NODE_ENV: process.env.NODE_ENV || null,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || null,
      RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME || null,
      BASE_DOMAIN: process.env.BASE_DOMAIN || null,
      DATABASE_SSL: process.env.DATABASE_SSL || null
    },
    postgresVars: {
      PGHOST: pgHost,
      PGPORT: process.env.PGPORT || null,
      PGUSER: process.env.PGUSER || null,
      PGDATABASE: process.env.PGDATABASE || null,
      hasPGPASSWORD: Boolean(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD)
    },
    candidates,
    pgImplicitFallback: {
      active: databaseUrlEmpty && Boolean(pgHost),
      host: pgHost,
      warning: databaseUrlEmpty && pgHost === 'base'
        ? 'node-postgres silently uses PGHOST=base when DATABASE_URL is empty. This is the source of getaddrinfo ENOTFOUND base.'
        : databaseUrlEmpty && pgHost
          ? `node-postgres would silently use PGHOST=${pgHost} because DATABASE_URL and DATABASE_PUBLIC_URL are empty at runtime.`
          : null
    }
  };
};

const resolveDatabaseConfig = () => {
  const diagnostics = getRuntimeEnvDiagnostics();
  const candidates = collectDatabaseCandidates();
  const rejections = [];

  for (const candidate of candidates) {
    const { parsed, source } = candidate;

    if (!parsed.valid) {
      rejections.push({ source, host: parsed.host || '(invalid)', reason: parsed.reason });
      continue;
    }

    if (!isUsableDatabaseHost(parsed.host)) {
      rejections.push({
        source,
        host: parsed.host,
        reason: `placeholder or invalid host "${parsed.host}"`
      });
      continue;
    }

    return {
      databaseUrl: parsed.normalized,
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      username: parsed.username,
      password: parsed.password,
      source,
      rejections,
      diagnostics
    };
  }

  const pgHost = getPgImplicitFallbackHost();
  const message = [
    'No usable PostgreSQL connection URL found.',
    diagnostics.pgImplicitFallback.warning,
    pgHost === 'base'
      ? 'Root cause: PGHOST is set to "base". When DATABASE_URL is empty at runtime, node-postgres (pg) silently falls back to PGHOST. Remove PGHOST=base from Railway variables and set DATABASE_URL=${{Postgres.DATABASE_URL}}.'
      : null,
    process.env.RAILWAY_ENVIRONMENT
      ? 'Railway fix: ERP service → Variables → DATABASE_URL=${{Postgres.DATABASE_URL}}, remove manual PGHOST=base if present.'
      : 'Local fix: set DATABASE_URL in .env.',
    rejections.length ? `Rejected: ${rejections.map((r) => `${r.source}(${r.host}: ${r.reason})`).join('; ')}` : null
  ].filter(Boolean).join(' ');

  const error = new Error(message);
  error.rejections = rejections;
  error.resolvedHost = pgHost === 'base' ? 'base (from PGHOST env var)' : (candidates[0]?.parsed?.host || pgHost || null);
  error.diagnostics = diagnostics;
  throw error;
};

const resolveSsl = (databaseUrl) => {
  if (RAILWAY_HOST_PATTERN.test(databaseUrl) || String(databaseUrl).includes('.railway.internal')) {
    return { rejectUnauthorized: false };
  }

  const sslSetting = String(process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (sslSetting === 'true' || sslSetting === '1') return { rejectUnauthorized: false };
  if (sslSetting === 'false' || sslSetting === '0') return false;
  if (process.env.RAILWAY_ENVIRONMENT) return { rejectUnauthorized: false };
  return false;
};

module.exports = {
  DB_ENV_KEYS,
  normalizeDatabaseUrl,
  redactDatabaseUrl,
  parseDatabaseUrl,
  isUsableDatabaseHost,
  buildUrlFromPgVars,
  collectDatabaseCandidates,
  getRuntimeEnvDiagnostics,
  getPgImplicitFallbackHost,
  resolveDatabaseConfig,
  resolveSsl
};
