'use strict';

/**
 * tenant-login-url.js
 * بناء روابط دخول المستأجرين عبر النطاق الفرعي الخاص بكل شركة.
 */

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

function getPublicAppOrigin() {
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
  const host = String(req.get?.('host') || req.headers?.host || '').trim();
  if (!host) return '';

  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = req.secure || forwardedProto === 'https' ? 'https' : (req.protocol || 'https');
  return normalizeOrigin(`${protocol}://${host}`);
}

function buildTenantLoginUrl(subdomain) {
  const normalizedSubdomain = String(subdomain || '').trim().toLowerCase();
  if (!normalizedSubdomain) return null;

  const baseDomain = String(process.env.BASE_DOMAIN || 'localhost').trim().toLowerCase();
  if (!baseDomain || baseDomain === 'localhost') {
    const origin = getPublicAppOrigin() || 'http://localhost:3000';
    return `${origin}/login-page.html?tenant=${encodeURIComponent(normalizedSubdomain)}`;
  }

  return `https://${normalizedSubdomain}.${baseDomain}`;
}

module.exports = {
  buildTenantLoginUrl,
  getPublicAppOrigin,
  getRequestOrigin,
  isRailwayOrPlatformHost,
  normalizeOrigin
};
