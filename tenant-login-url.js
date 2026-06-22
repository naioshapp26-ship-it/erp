'use strict';

/**
 * tenant-login-url.js
 * بناء روابط دخول المستأجرين — يدعم النطاق الفرعي ومسار /t/{subdomain}.
 */

const {
  TENANT_PATH_PREFIX,
  getPublicAppOrigin,
  buildTenantLoginUrl: buildSubdomainLoginUrl,
  getTenantDomainConfig,
  normalizeOrigin,
  shouldUsePathBasedTenantAccess
} = require('./tenant-domain');

function getPublicAppOriginFromEnv() {
  const fromEnv = normalizeOrigin(
    process.env.PUBLIC_APP_URL
    || process.env.APP_URL
    || process.env.RAILWAY_STATIC_URL
    || ''
  );
  if (fromEnv) return fromEnv;

  const railwayDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  if (railwayDomain) {
    return `https://${railwayDomain}`;
  }

  return '';
}

function isRailwayOrPlatformHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host.endsWith('.railway.app')
    || host.endsWith('.up.railway.app')
    || host.endsWith('.proxy.rlwy.net')
    || host.endsWith('.railway.internal');
}

function getRequestOrigin(req) {
  if (!req) return '';
  return getPublicAppOrigin(req);
}

function buildTenantLoginUrl(subdomain, req = null) {
  const normalizedSubdomain = String(subdomain || '').trim().toLowerCase();
  if (!normalizedSubdomain) return null;

  if (shouldUsePathBasedTenantAccess(req)) {
    const origin = getPublicAppOrigin(req) || getPublicAppOriginFromEnv() || 'http://localhost:3000';
    return `${origin.replace(/\/$/, '')}${TENANT_PATH_PREFIX}/${normalizedSubdomain}`;
  }

  return buildSubdomainLoginUrl(subdomain, req);
}

module.exports = {
  buildTenantLoginUrl,
  getPublicAppOrigin: getPublicAppOriginFromEnv,
  getRequestOrigin,
  isRailwayOrPlatformHost,
  normalizeOrigin,
  shouldUsePathBasedTenantAccess,
  getTenantDomainConfig
};
