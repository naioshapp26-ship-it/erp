'use strict';

const db = require('./db');

const DEFAULT_PRIMARY = '#11165a';
const DEFAULT_SECONDARY = '#0c1048';
const SHARED_DB_MARKER = 'shared://central';
const LOGO_API_PATH = '/api/tenant-public/logo';
const MAX_LOGO_STORE_BYTES = 1.5 * 1024 * 1024;

function sanitizeCssColor(color, fallback = DEFAULT_PRIMARY) {
  const safe = String(color || '').trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(safe)) return safe;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$/.test(safe)) return safe;
  if (/^hsla?\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/.test(safe)) return safe;
  if (/^[a-zA-Z]{1,30}$/.test(safe)) return safe;
  return fallback;
}

function normalizeExtra(extra) {
  if (!extra) return {};
  if (typeof extra === 'object') return extra;
  try {
    return JSON.parse(extra);
  } catch (_) {
    return {};
  }
}

function parseTenantSettings(tenant) {
  if (!tenant?.settings) return {};
  if (typeof tenant.settings === 'object' && !Array.isArray(tenant.settings)) {
    return tenant.settings;
  }
  if (typeof tenant.settings !== 'string') return {};
  try {
    return JSON.parse(tenant.settings);
  } catch (_) {
    return {};
  }
}

function isSharedTenant(tenant) {
  if (!tenant) return false;
  if (tenant.encrypted_db_url === SHARED_DB_MARKER) return true;
  const settings = parseTenantSettings(tenant);
  return Boolean(settings.sharedDb || settings.liteProvision);
}

function mapCentralIdentity(tenant) {
  const settings = parseTenantSettings(tenant);
  const branding = settings.branding || {};
  const publicSite = settings.publicSite || {};
  const hasStoredLogo = Boolean(branding.logo_data);
  return {
    site_name: publicSite.site_name || tenant.company_name || '',
    site_tagline: publicSite.site_tagline || '',
    logo_url: hasStoredLogo ? LOGO_API_PATH : '',
    favicon_url: hasStoredLogo ? LOGO_API_PATH : '',
    primary_color: branding.primary_color || DEFAULT_PRIMARY,
    secondary_color: branding.secondary_color || DEFAULT_SECONDARY,
    font_family: branding.font_family || '',
    setup_completed: Boolean(branding.setup_completed),
    branding_id: hasStoredLogo || branding.primary_color ? 1 : null,
    site_id: publicSite.site_name ? 1 : null
  };
}

async function saveCentralIdentity(tenant, payload = {}) {
  const siteName = String(payload.site_name || '').trim();
  const siteTagline = String(payload.site_tagline || '').trim();
  const logoUrl = payload.logo_url != null ? String(payload.logo_url).trim() : '';
  const faviconUrl = payload.favicon_url != null ? String(payload.favicon_url).trim() : '';
  const primaryColor = sanitizeCssColor(payload.primary_color, DEFAULT_PRIMARY);
  const secondaryColor = sanitizeCssColor(payload.secondary_color, DEFAULT_SECONDARY);
  const fontFamily = payload.font_family != null ? String(payload.font_family).trim() : '';
  const setupCompleted = payload.setup_completed !== false;

  if (!siteName) {
    const error = new Error('SITE_NAME_REQUIRED');
    error.code = 'SITE_NAME_REQUIRED';
    throw error;
  }

  const settings = parseTenantSettings(tenant);
  const nextSettings = {
    ...settings,
    branding: {
      ...(settings.branding || {}),
      logo_url: (logoUrl || settings.branding?.logo_data) ? LOGO_API_PATH : '',
      favicon_url: (faviconUrl || settings.branding?.logo_data) ? LOGO_API_PATH : (settings.branding?.favicon_url || ''),
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      font_family: fontFamily,
      setup_completed: setupCompleted
    },
    publicSite: {
      ...(settings.publicSite || {}),
      site_name: siteName,
      site_tagline: siteTagline
    }
  };

  await db.query(
    `UPDATE tenants
     SET settings = $2::jsonb,
         company_name = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [tenant.id, JSON.stringify(nextSettings), siteName]
  );

  tenant.settings = nextSettings;
  tenant.company_name = siteName;
  return mapCentralIdentity(tenant);
}

async function readIdentitySettings(tenantPool, tenant = null) {
  if (isSharedTenant(tenant)) {
    return mapCentralIdentity(tenant);
  }

  const [brandingResult, siteResult] = await Promise.all([
    tenantPool.query('SELECT * FROM branding_settings LIMIT 1'),
    tenantPool.query('SELECT * FROM public_site_settings LIMIT 1')
  ]);

  const branding = brandingResult.rows[0] || null;
  const site = siteResult.rows[0] || null;
  const extra = normalizeExtra(branding?.extra);
  const hasStoredLogo = Boolean(extra.logo_data);

  return {
    site_name: site?.site_name || tenant?.company_name || '',
    site_tagline: site?.site_tagline || '',
    logo_url: hasStoredLogo ? LOGO_API_PATH : '',
    favicon_url: hasStoredLogo ? LOGO_API_PATH : (branding?.favicon_url || ''),
    primary_color: branding?.primary_color || DEFAULT_PRIMARY,
    secondary_color: branding?.secondary_color || DEFAULT_SECONDARY,
    font_family: branding?.font_family || '',
    setup_completed: Boolean(extra.setup_completed),
    branding_id: branding?.id || null,
    site_id: site?.id || null
  };
}

async function saveIdentitySettings(tenantPool, tenant, payload = {}) {
  if (isSharedTenant(tenant)) {
    return saveCentralIdentity(tenant, payload);
  }

  const siteName = String(payload.site_name || '').trim();
  const siteTagline = String(payload.site_tagline || '').trim();
  const logoUrl = payload.logo_url != null ? String(payload.logo_url).trim() : null;
  const faviconUrl = payload.favicon_url != null ? String(payload.favicon_url).trim() : null;
  const primaryColor = sanitizeCssColor(payload.primary_color, DEFAULT_PRIMARY);
  const secondaryColor = sanitizeCssColor(payload.secondary_color, DEFAULT_SECONDARY);
  const fontFamily = payload.font_family != null ? String(payload.font_family).trim() : null;
  const setupCompleted = payload.setup_completed !== false;

  if (!siteName) {
    const error = new Error('SITE_NAME_REQUIRED');
    error.code = 'SITE_NAME_REQUIRED';
    throw error;
  }

  const existingBranding = await tenantPool.query('SELECT id, extra FROM branding_settings LIMIT 1');
  const existingExtra = normalizeExtra(existingBranding.rows[0]?.extra);
  const mergedExtra = {
    ...existingExtra,
    setup_completed: setupCompleted
  };

  if (existingBranding.rows.length > 0) {
    await tenantPool.query(
      `UPDATE branding_settings SET
         logo_url = COALESCE($1, logo_url),
         favicon_url = COALESCE($2, favicon_url),
         primary_color = $3,
         secondary_color = $4,
         font_family = COALESCE($5, font_family),
         extra = $6::jsonb,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        fontFamily,
        JSON.stringify(mergedExtra),
        existingBranding.rows[0].id
      ]
    );
  } else {
    await tenantPool.query(
      `INSERT INTO branding_settings
         (logo_url, favicon_url, primary_color, secondary_color, font_family, extra)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        fontFamily,
        JSON.stringify(mergedExtra)
      ]
    );
  }

  const existingSite = await tenantPool.query('SELECT id FROM public_site_settings LIMIT 1');
  if (existingSite.rows.length > 0) {
    await tenantPool.query(
      `UPDATE public_site_settings SET
         site_name = $1,
         site_tagline = COALESCE($2, site_tagline),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [siteName, siteTagline || null, existingSite.rows[0].id]
    );
  } else {
    await tenantPool.query(
      `INSERT INTO public_site_settings (site_name, site_tagline)
       VALUES ($1, $2)`,
      [siteName, siteTagline || null]
    );
  }

  if (tenant?.id) {
    await db.query(
      `UPDATE tenants
       SET company_name = $2, updated_at = NOW()
       WHERE id = $1`,
      [tenant.id, siteName]
    );
  }

  return readIdentitySettings(tenantPool, tenant);
}

async function saveLogoAsset(tenantPool, tenant, { buffer = null, mimeType = 'image/png', diskUrl = '' } = {}) {
  let logoData = null;
  if (buffer && buffer.length && buffer.length <= MAX_LOGO_STORE_BYTES) {
    logoData = `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  if (isSharedTenant(tenant)) {
    const settings = parseTenantSettings(tenant);
    const nextSettings = {
      ...settings,
      branding: {
        ...(settings.branding || {}),
        logo_url: LOGO_API_PATH,
        logo_data: logoData || settings.branding?.logo_data || null,
        logo_mime: mimeType || settings.branding?.logo_mime || 'image/png',
        logo_disk_url: diskUrl || settings.branding?.logo_disk_url || ''
      }
    };
    await db.query(
      `UPDATE tenants SET settings = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [tenant.id, JSON.stringify(nextSettings)]
    );
    tenant.settings = nextSettings;
    return LOGO_API_PATH;
  }

  const existing = await tenantPool.query('SELECT id, extra FROM branding_settings LIMIT 1');
  const existingExtra = normalizeExtra(existing.rows[0]?.extra);
  const mergedExtra = {
    ...existingExtra,
    logo_data: logoData || existingExtra.logo_data || null,
    logo_mime: mimeType || existingExtra.logo_mime || 'image/png',
    logo_disk_url: diskUrl || existingExtra.logo_disk_url || ''
  };

  if (existing.rows.length > 0) {
    await tenantPool.query(
      `UPDATE branding_settings
       SET logo_url = $1, extra = $2::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [LOGO_API_PATH, JSON.stringify(mergedExtra), existing.rows[0].id]
    );
  } else {
    await tenantPool.query(
      `INSERT INTO branding_settings (logo_url, primary_color, secondary_color, extra)
       VALUES ($1, '#11165a', '#0c1048', $2::jsonb)`,
      [LOGO_API_PATH, JSON.stringify({ ...mergedExtra, setup_completed: false })]
    );
  }
  return LOGO_API_PATH;
}

async function saveLogoUrl(tenantPool, tenant, logoUrl, options = {}) {
  if (options.buffer) {
    return saveLogoAsset(tenantPool, tenant, {
      buffer: options.buffer,
      mimeType: options.mimeType,
      diskUrl: logoUrl
    });
  }
  return saveLogoAsset(tenantPool, tenant, { diskUrl: logoUrl, mimeType: options.mimeType || 'image/png' });
}

async function readLogoBinary(tenantPool, tenant = null) {
  if (isSharedTenant(tenant)) {
    const settings = parseTenantSettings(tenant);
    const branding = settings.branding || {};
    if (branding.logo_data) {
      return { data: branding.logo_data, mime: branding.logo_mime || 'image/png' };
    }
    return null;
  }

  if (!tenantPool) return null;
  const result = await tenantPool.query('SELECT extra, logo_url FROM branding_settings LIMIT 1');
  const row = result.rows[0];
  if (!row) return null;
  const extra = normalizeExtra(row.extra);
  if (extra.logo_data) {
    return { data: extra.logo_data, mime: extra.logo_mime || 'image/png' };
  }
  return null;
}

async function ensureDefaultIdentitySettings(tenantPool, companyName = '', tenant = null) {
  const existing = await readIdentitySettings(tenantPool, tenant);
  if (existing.branding_id || existing.site_id || existing.site_name) {
    return existing;
  }

  await saveIdentitySettings(tenantPool, tenant, {
    site_name: companyName || 'شركتي',
    site_tagline: '',
    primary_color: DEFAULT_PRIMARY,
    secondary_color: DEFAULT_SECONDARY,
    setup_completed: false
  });

  return readIdentitySettings(tenantPool, tenant);
}

module.exports = {
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  LOGO_API_PATH,
  sanitizeCssColor,
  isSharedTenant,
  readIdentitySettings,
  saveIdentitySettings,
  saveLogoUrl,
  saveLogoAsset,
  readLogoBinary,
  ensureDefaultIdentitySettings
};
