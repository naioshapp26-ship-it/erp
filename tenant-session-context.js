'use strict';

const db = require('./db');
const { getTenantPool } = require('./tenant-connection-manager');
const { isValidTenantSubdomain } = require('./tenant-domain');

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.authToken || '';
}

async function loadActiveTenantBySubdomain(subdomain) {
  const result = await db.query(
    `SELECT * FROM tenants WHERE subdomain = $1 AND status = 'active' LIMIT 1`,
    [subdomain]
  );
  return result.rows[0] || null;
}

async function attachTenantFromSession(req) {
  if (req.tenant && req.tenantPool) {
    return req.tenant;
  }
  if (String(req.path || '').startsWith('/api/')) {
    return null;
  }

  let tenant = null;

  try {
    const headerSubdomain = String(req.headers['x-tenant-subdomain'] || '').trim().toLowerCase();
    if (headerSubdomain && isValidTenantSubdomain(headerSubdomain)) {
      tenant = await loadActiveTenantBySubdomain(headerSubdomain);
    }

    if (!tenant) {
      const token = getAuthToken(req);
      if (token) {
        const indexRes = await db.query(
          `SELECT t.*
           FROM tenant_session_index tsi
           JOIN tenants t ON t.id = tsi.tenant_id
           WHERE tsi.session_token = $1
             AND tsi.expires_at > NOW()
             AND t.status = 'active'
           LIMIT 1`,
          [token]
        ).catch(() => ({ rows: [] }));
        tenant = indexRes.rows[0] || null;
      }
    }

    if (tenant) {
      req.tenant = tenant;
      req.tenantPool = getTenantPool(tenant.subdomain, tenant.encrypted_db_url);
      req.tenantPathSubdomain = req.tenantPathSubdomain || tenant.subdomain;
      if (!req.tenantAccessMode || req.tenantAccessMode === 'central') {
        req.tenantAccessMode = 'path';
      }
    }
  } catch (error) {
    console.warn('[tenantSessionContext]', error.message);
  }

  return tenant;
}

module.exports = {
  parseCookies,
  getAuthToken,
  attachTenantFromSession
};
