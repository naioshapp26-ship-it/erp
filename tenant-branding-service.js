'use strict';

const db = require('./db');

const DEFAULT_PRIMARY = '#11165a';
const DEFAULT_SECONDARY = '#0c1048';
const SHARED_DB_MARKER = 'shared://central';
const LOGO_API_PATH = '/api/tenant-public/logo';
const HERO_IMAGE_API_PATH = '/api/tenant-public/hero-image';
const HERO_VIDEO_API_PATH = '/api/tenant-public/hero-video';
const NAIOSH_DEFAULT_HERO_IMAGE = '/newhome/naiosh-hero-default.jpg';
const MAX_LOGO_STORE_BYTES = 1.5 * 1024 * 1024;
const MAX_HERO_IMAGE_STORE_BYTES = 2 * 1024 * 1024;
const HERO_MODES = new Set(['gradient', 'image', 'video']);
const DEFAULT_ANNOUNCEMENT_TEXT = '🔥 خصومات على الخدمات 🔥 | 🚀 ابدأ الآن | 📢 عروض محدودة';

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeAnnouncementText(value, fallback = DEFAULT_ANNOUNCEMENT_TEXT) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, 600);
}

function sanitizeHeroMode(value, fallback = 'gradient') {
  const mode = String(value || '').trim().toLowerCase();
  return HERO_MODES.has(mode) ? mode : fallback;
}

function mapHeroFields(extra = {}, branding = {}) {
  const hero = (extra && typeof extra.hero === 'object' && extra.hero)
    || (branding && typeof branding.hero === 'object' && branding.hero)
    || {};
  const mode = sanitizeHeroMode(hero.mode, 'gradient');
  const hasImage = Boolean(hero.banner_image_data || hero.banner_image_disk_url);
  const hasVideo = Boolean(hero.banner_video_disk_url);
  return {
    hero_mode: mode,
    hero_banner_image_url: hasImage ? HERO_IMAGE_API_PATH : '',
    hero_banner_video_url: hasVideo ? HERO_VIDEO_API_PATH : '',
    hero_banner_image_disk_url: hero.banner_image_disk_url || '',
    hero_banner_video_disk_url: hero.banner_video_disk_url || ''
  };
}

function mergeHeroIntoExtra(existingExtra = {}, payload = {}) {
  const currentHero = (existingExtra && typeof existingExtra.hero === 'object' && existingExtra.hero) || {};
  const nextHero = { ...currentHero };
  if (payload.hero_mode != null) {
    nextHero.mode = sanitizeHeroMode(payload.hero_mode, currentHero.mode || 'gradient');
  }
  if (payload.hero_banner_image_disk_url != null) {
    nextHero.banner_image_disk_url = String(payload.hero_banner_image_disk_url || '').trim();
  }
  if (payload.hero_banner_video_disk_url != null) {
    nextHero.banner_video_disk_url = String(payload.hero_banner_video_disk_url || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'hero_clear_image') && payload.hero_clear_image) {
    delete nextHero.banner_image_data;
    delete nextHero.banner_image_mime;
    delete nextHero.banner_image_disk_url;
    if (nextHero.mode === 'image') nextHero.mode = 'gradient';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'hero_clear_video') && payload.hero_clear_video) {
    delete nextHero.banner_video_disk_url;
    delete nextHero.banner_video_mime;
    if (nextHero.mode === 'video') nextHero.mode = 'gradient';
  }
  return {
    ...existingExtra,
    hero: nextHero
  };
}

function mapAnnouncementFields(extra = {}, branding = {}) {
  const stored = (extra && typeof extra.announcementBar === 'object' && extra.announcementBar)
    || (branding && typeof branding.announcementBar === 'object' && branding.announcementBar)
    || null;
  if (!stored) {
    return {
      announcement_enabled: true,
      announcement_text: DEFAULT_ANNOUNCEMENT_TEXT,
      announcement_speed: 28,
      announcement_text_color: '#ffffff'
    };
  }
  const text = typeof stored.text === 'string'
    ? stored.text.trim().slice(0, 600)
    : DEFAULT_ANNOUNCEMENT_TEXT;
  return {
    announcement_enabled: stored.enabled !== false,
    announcement_text: text,
    announcement_speed: clampNumber(stored.speed, 10, 120, 28),
    announcement_text_color: sanitizeCssColor(stored.textColor, '#ffffff')
  };
}

function mergeAnnouncementIntoExtra(existingExtra = {}, payload = {}) {
  const current = (existingExtra && typeof existingExtra.announcementBar === 'object' && existingExtra.announcementBar) || {};
  const next = { ...current };

  if (Object.prototype.hasOwnProperty.call(payload, 'announcement_enabled')) {
    next.enabled = payload.announcement_enabled !== false;
  }
  if (payload.announcement_text != null) {
    next.text = sanitizeAnnouncementText(payload.announcement_text, '');
  }
  if (payload.announcement_speed != null) {
    next.speed = clampNumber(payload.announcement_speed, 10, 120, 28);
  }
  if (payload.announcement_text_color != null) {
    next.textColor = sanitizeCssColor(payload.announcement_text_color, '#ffffff');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'announcement_clear') && payload.announcement_clear) {
    next.enabled = false;
    next.text = '';
  }

  return {
    ...existingExtra,
    announcementBar: next
  };
}

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
    site_id: publicSite.site_name ? 1 : null,
    ...mapHeroFields(branding, branding),
    ...mapAnnouncementFields(branding, branding)
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
  const nextBranding = {
    ...(settings.branding || {}),
    logo_url: (logoUrl || settings.branding?.logo_data) ? LOGO_API_PATH : '',
    favicon_url: (faviconUrl || settings.branding?.logo_data) ? LOGO_API_PATH : (settings.branding?.favicon_url || ''),
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    font_family: fontFamily,
    setup_completed: setupCompleted
  };
  const mergedExtraLike = mergeHeroIntoExtra(nextBranding, payload);
  nextBranding.hero = mergedExtraLike.hero;
  const mergedAnnouncement = mergeAnnouncementIntoExtra(nextBranding, payload);
  nextBranding.announcementBar = mergedAnnouncement.announcementBar;
  const nextSettings = {
    ...settings,
    branding: nextBranding,
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
    site_id: site?.id || null,
    ...mapHeroFields(extra, branding),
    ...mapAnnouncementFields(extra, branding)
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
  const mergedExtra = mergeAnnouncementIntoExtra(mergeHeroIntoExtra({
    ...existingExtra,
    setup_completed: setupCompleted
  }, payload), payload);

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

async function saveHeroBannerAsset(tenantPool, tenant, {
  kind = 'image',
  buffer = null,
  mimeType = 'image/png',
  diskUrl = ''
} = {}) {
  const isVideo = kind === 'video';
  let imageData = null;
  if (!isVideo && buffer && buffer.length && buffer.length <= MAX_HERO_IMAGE_STORE_BYTES) {
    imageData = `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  if (isSharedTenant(tenant)) {
    const settings = parseTenantSettings(tenant);
    const branding = { ...(settings.branding || {}) };
    const hero = { ...(branding.hero || {}) };
    if (isVideo) {
      hero.mode = 'video';
      hero.banner_video_disk_url = diskUrl || hero.banner_video_disk_url || '';
      hero.banner_video_mime = mimeType || hero.banner_video_mime || 'video/mp4';
    } else {
      hero.mode = 'image';
      hero.banner_image_disk_url = diskUrl || hero.banner_image_disk_url || '';
      hero.banner_image_mime = mimeType || hero.banner_image_mime || 'image/png';
      if (imageData) hero.banner_image_data = imageData;
    }
    branding.hero = hero;
    const nextSettings = { ...settings, branding };
    await db.query(
      `UPDATE tenants SET settings = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [tenant.id, JSON.stringify(nextSettings)]
    );
    tenant.settings = nextSettings;
    return isVideo ? HERO_VIDEO_API_PATH : HERO_IMAGE_API_PATH;
  }

  const existing = await tenantPool.query('SELECT id, extra FROM branding_settings LIMIT 1');
  const existingExtra = normalizeExtra(existing.rows[0]?.extra);
  const hero = { ...(existingExtra.hero || {}) };
  if (isVideo) {
    hero.mode = 'video';
    hero.banner_video_disk_url = diskUrl || hero.banner_video_disk_url || '';
    hero.banner_video_mime = mimeType || hero.banner_video_mime || 'video/mp4';
  } else {
    hero.mode = 'image';
    hero.banner_image_disk_url = diskUrl || hero.banner_image_disk_url || '';
    hero.banner_image_mime = mimeType || hero.banner_image_mime || 'image/png';
    if (imageData) hero.banner_image_data = imageData;
  }
  const mergedExtra = { ...existingExtra, hero };

  if (existing.rows.length > 0) {
    await tenantPool.query(
      `UPDATE branding_settings
       SET extra = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(mergedExtra), existing.rows[0].id]
    );
  } else {
    await tenantPool.query(
      `INSERT INTO branding_settings (logo_url, primary_color, secondary_color, extra)
       VALUES ($1, '#11165a', '#0c1048', $2::jsonb)`,
      [null, JSON.stringify({ ...mergedExtra, setup_completed: false })]
    );
  }
  return isVideo ? HERO_VIDEO_API_PATH : HERO_IMAGE_API_PATH;
}

async function readHeroBinary(tenantPool, tenant = null, kind = 'image') {
  const isVideo = kind === 'video';
  let hero = {};
  if (isSharedTenant(tenant)) {
    hero = (parseTenantSettings(tenant).branding || {}).hero || {};
  } else if (tenantPool) {
    const result = await tenantPool.query('SELECT extra FROM branding_settings LIMIT 1');
    hero = normalizeExtra(result.rows[0]?.extra).hero || {};
  } else {
    return null;
  }

  if (!isVideo && hero.banner_image_data) {
    return {
      data: hero.banner_image_data,
      mime: hero.banner_image_mime || 'image/png',
      diskUrl: hero.banner_image_disk_url || ''
    };
  }
  const diskUrl = isVideo ? hero.banner_video_disk_url : hero.banner_image_disk_url;
  if (!diskUrl) return null;
  return {
    data: null,
    mime: isVideo ? (hero.banner_video_mime || 'video/mp4') : (hero.banner_image_mime || 'image/png'),
    diskUrl
  };
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
  HERO_IMAGE_API_PATH,
  HERO_VIDEO_API_PATH,
  NAIOSH_DEFAULT_HERO_IMAGE,
  DEFAULT_ANNOUNCEMENT_TEXT,
  sanitizeCssColor,
  sanitizeHeroMode,
  sanitizeAnnouncementText,
  clampNumber,
  mapAnnouncementFields,
  mergeAnnouncementIntoExtra,
  isSharedTenant,
  readIdentitySettings,
  saveIdentitySettings,
  saveLogoUrl,
  saveLogoAsset,
  saveHeroBannerAsset,
  readLogoBinary,
  readHeroBinary,
  ensureDefaultIdentitySettings
};
