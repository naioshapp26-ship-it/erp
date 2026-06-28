'use strict';

/**
 * tenant-domain.js
 * أدوات مشتركة لبناء روابط دخول المستأجرين واكتشاف النطاق الفرعي.
 *
 * يدعم وضعين:
 *  1. نطاق فرعي حقيقي: acme.example.com (يتطلب wildcard DNS)
 *  2. مسار بديل: example.com/t/acme (للاستضافة بدون wildcard مثل Railway)
 */

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'saas']);
const TENANT_PATH_PREFIX = '/t';
const SUBDOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;

function getConfiguredBaseDomain() {
  return String(process.env.BASE_DOMAIN || '').trim().toLowerCase();
}

function getConfiguredPublicAppUrl() {
  return String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
}

function getRequestHostname(req) {
  if (!req) return '';
  const forwardedHost = req.headers['x-forwarded-host'];
  const rawHost = forwardedHost || req.headers.host || req.hostname || '';
  return String(rawHost).split(',')[0].trim().split(':')[0].toLowerCase();
}

function normalizeOrigin(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_) {
    return '';
  }
}

function getPublicAppOrigin(req) {
  const configured = getConfiguredPublicAppUrl();
  if (configured) return configured;

  if (!req) return '';

  const hostname = getRequestHostname(req);
  if (!hostname) return '';

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const protocol = forwardedProto || (req.secure ? 'https' : 'http');
  return `${protocol}://${hostname}`;
}

function hostnameSupportsWildcardSubdomains(hostname, baseDomain = getConfiguredBaseDomain()) {
  const host = String(hostname || '').toLowerCase();
  const base = String(baseDomain || '').toLowerCase();
  if (!host || !base) return false;
  return host === base || host === `www.${base}` || host.endsWith(`.${base}`);
}

function extractSubdomainFromHostname(hostname, baseDomain = getConfiguredBaseDomain()) {
  const host = String(hostname || '').split(':')[0].toLowerCase();
  const base = String(baseDomain || '').toLowerCase();
  if (!base) return null;
  if (host === base || host === `www.${base}`) return null;
  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, host.length - base.length - 1);
    if (!sub.includes('.')) return sub;
  }
  return null;
}

function isValidTenantSubdomain(subdomain) {
  const normalized = String(subdomain || '').trim().toLowerCase();
  return SUBDOMAIN_PATTERN.test(normalized) && !RESERVED_SUBDOMAINS.has(normalized);
}

function extractSubdomainFromPath(requestPath = '') {
  const pathOnly = String(requestPath || '').split('?')[0];
  const match = pathOnly.match(new RegExp(`^${TENANT_PATH_PREFIX}/([a-z0-9][a-z0-9-]*)(?:/|$)`, 'i'));
  if (!match) return null;
  const subdomain = match[1].toLowerCase();
  return isValidTenantSubdomain(subdomain) ? subdomain : null;
}

function stripTenantPathPrefix(requestPath = '', subdomain) {
  const pathOnly = String(requestPath || '').split('?')[0];
  const normalizedSubdomain = String(subdomain || '').toLowerCase();
  const prefix = `${TENANT_PATH_PREFIX}/${normalizedSubdomain}`;
  if (pathOnly === prefix) return '/';
  if (pathOnly.startsWith(`${prefix}/`)) {
    return pathOnly.slice(prefix.length) || '/';
  }
  return pathOnly;
}

function rewriteRequestPath(req, newPath) {
  const queryIndex = req.url.indexOf('?');
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
  const normalizedPath = newPath.startsWith('/') ? newPath : `/${newPath}`;
  req.url = `${normalizedPath}${query}`;
  // Express derives req.path from req.url; clear any cached parse so routing/auth see the rewritten path.
  if (req._parsedUrl) {
    delete req._parsedUrl;
  }
}

function resolveTenantAccessMode(req) {
  const baseDomain = getConfiguredBaseDomain();
  const hostname = getRequestHostname(req);
  const pathSubdomain = extractSubdomainFromPath(req.path);

  if (pathSubdomain) {
    return {
      mode: 'path',
      subdomain: pathSubdomain,
      baseDomain,
      publicOrigin: getPublicAppOrigin(req)
    };
  }

  if (baseDomain) {
    const hostSubdomain = extractSubdomainFromHostname(hostname, baseDomain);
    if (hostSubdomain !== null) {
      return {
        mode: hostSubdomain ? 'subdomain' : 'central',
        subdomain: hostSubdomain || null,
        baseDomain,
        publicOrigin: getPublicAppOrigin(req)
      };
    }
  }

  return {
    mode: 'central',
    subdomain: null,
    baseDomain,
    publicOrigin: getPublicAppOrigin(req)
  };
}

function buildTenantLoginUrl(subdomain, req = null) {
  const normalizedSubdomain = String(subdomain || '').trim().toLowerCase();
  if (!normalizedSubdomain) return null;

  const baseDomain = getConfiguredBaseDomain();
  if (baseDomain && baseDomain !== 'localhost') {
    return `https://${normalizedSubdomain}.${baseDomain}`;
  }

  const origin = getPublicAppOrigin(req) || 'http://localhost:3000';
  return `${origin.replace(/\/$/, '')}${TENANT_PATH_PREFIX}/${normalizedSubdomain}`;
}

function isRailwayOrPlatformHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host.endsWith('.railway.app')
    || host.endsWith('.up.railway.app')
    || host.endsWith('.proxy.rlwy.net')
    || host.endsWith('.railway.internal');
}

function getRuntimePublicHostname(req = null) {
  const hostname = getRequestHostname(req);
  if (hostname) return hostname;

  const publicOrigin = getConfiguredPublicAppUrl();
  if (publicOrigin) {
    try {
      return new URL(publicOrigin).hostname.toLowerCase();
    } catch (_) {
      // ignore invalid PUBLIC_APP_URL
    }
  }

  const railwayDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim().toLowerCase();
  return railwayDomain;
}

function shouldUsePathBasedTenantAccess(req = null) {
  const baseDomain = getConfiguredBaseDomain();
  if (!baseDomain || baseDomain === 'localhost') return true;

  const runtimeHost = getRuntimePublicHostname(req);
  if (isRailwayOrPlatformHost(runtimeHost)) return true;

  if (runtimeHost && !hostnameSupportsWildcardSubdomains(runtimeHost, baseDomain)) {
    return true;
  }

  return false;
}

function getTenantDomainConfig(req) {
  const baseDomain = getConfiguredBaseDomain();
  const publicOrigin = getPublicAppOrigin(req);
  const usePathMode = shouldUsePathBasedTenantAccess(req);

  return {
    baseDomain: baseDomain || null,
    publicOrigin: publicOrigin || null,
    accessMode: usePathMode ? 'path' : 'subdomain',
    tenantPathPrefix: TENANT_PATH_PREFIX,
    subdomainSuffix: !usePathMode && baseDomain ? `.${baseDomain}` : null,
    subdomainPreview: !usePathMode && baseDomain
      ? `your-company.${baseDomain}`
      : `${publicOrigin || 'https://your-app.com'}${TENANT_PATH_PREFIX}/your-company`,
    loginUrlExample: !usePathMode && baseDomain
      ? `https://acme.${baseDomain}`
      : `${publicOrigin || 'https://your-app.com'}${TENANT_PATH_PREFIX}/acme`
  };
}

module.exports = {
  RESERVED_SUBDOMAINS,
  TENANT_PATH_PREFIX,
  SUBDOMAIN_PATTERN,
  normalizeOrigin,
  getConfiguredBaseDomain,
  getConfiguredPublicAppUrl,
  getRequestHostname,
  getPublicAppOrigin,
  hostnameSupportsWildcardSubdomains,
  extractSubdomainFromHostname,
  extractSubdomainFromPath,
  stripTenantPathPrefix,
  rewriteRequestPath,
  isValidTenantSubdomain,
  resolveTenantAccessMode,
  buildTenantLoginUrl,
  getTenantDomainConfig,
  isRailwayOrPlatformHost,
  shouldUsePathBasedTenantAccess
};
