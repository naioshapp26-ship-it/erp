require('./load-env');

const RAILWAY_HOST_PATTERN = /\.(proxy\.rlwy\.net|railway\.internal)(:|\/|$)/i;
const UNRESOLVED_TEMPLATE_PATTERN = /\$\{\{[^}]+\}\}/;

const PLACEHOLDER_HOSTS = new Set([
  'base',
  'db',
  'database',
  'postgres',
  'localhost',
  '127.0.0.1',
  '::1'
]);

const normalizeDatabaseUrl = (url) => {
  if (!url) return '';
  return String(url).trim().replace(/\s+/g, '').replace(/@localhost([:/])/gi, '@127.0.0.1$1');
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
      reason: ''
    };
  } catch (error) {
    return { normalized, valid: false, host: '', reason: error.message };
  }
};

const isPlaceholderHost = (host) => {
  const normalizedHost = String(host || '').trim().toLowerCase();
  if (!normalizedHost) return true;
  if (PLACEHOLDER_HOSTS.has(normalizedHost)) return true;
  if (normalizedHost === 'base') return true;
  return false;
};

const isUsableDatabaseHost = (host) => {
  const normalizedHost = String(host || '').trim().toLowerCase();
  if (!normalizedHost) return false;

  if (['base', 'db', 'database'].includes(normalizedHost)) return false;

  if (RAILWAY_HOST_PATTERN.test(normalizedHost) || normalizedHost.endsWith('.railway.internal')) {
    return true;
  }

  if (!process.env.RAILWAY_ENVIRONMENT) {
    return true;
  }

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

const resolveDatabaseConfig = () => {
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
        reason: `placeholder or invalid host "${parsed.host}" — use Railway proxy host like zephyr.proxy.rlwy.net`
      });
      continue;
    }

    return {
      databaseUrl: parsed.normalized,
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      source,
      rejections
    };
  }

  const firstParsed = candidates[0]?.parsed;
  const message = [
    'No usable PostgreSQL connection URL found.',
    firstParsed?.host ? `Resolved host from DATABASE_URL: "${firstParsed.host}"` : null,
    firstParsed?.host === 'base'
      ? 'DATABASE_URL points to host "base", which is not a real Railway hostname. Replace it with ${{Postgres.DATABASE_URL}} or ${{Postgres.DATABASE_PUBLIC_URL}}.'
      : null,
    process.env.RAILWAY_ENVIRONMENT
      ? 'Railway fix: ERP service → Variables → DATABASE_URL = ${{Postgres.DATABASE_URL}} and DATABASE_SSL=true.'
      : 'Local fix: copy .env.example to .env and set DATABASE_URL to your PostgreSQL connection string.',
    rejections.length ? `Rejected sources: ${rejections.map((r) => `${r.source}(${r.host}: ${r.reason})`).join('; ')}` : null
  ].filter(Boolean).join(' ');

  const error = new Error(message);
  error.rejections = rejections;
  error.resolvedHost = firstParsed?.host || null;
  throw error;
};

const resolveSsl = (databaseUrl) => {
  if (RAILWAY_HOST_PATTERN.test(databaseUrl) || String(databaseUrl).includes('.railway.internal')) {
    return { rejectUnauthorized: false };
  }

  const sslSetting = String(process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (sslSetting === 'true' || sslSetting === '1') {
    return { rejectUnauthorized: false };
  }
  if (sslSetting === 'false' || sslSetting === '0') {
    return false;
  }

  if (process.env.RAILWAY_ENVIRONMENT) {
    return { rejectUnauthorized: false };
  }

  return false;
};

module.exports = {
  RAILWAY_HOST_PATTERN,
  normalizeDatabaseUrl,
  parseDatabaseUrl,
  isPlaceholderHost,
  isUsableDatabaseHost,
  buildUrlFromPgVars,
  collectDatabaseCandidates,
  resolveDatabaseConfig,
  resolveSsl
};
