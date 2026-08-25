(function () {
  'use strict';

  const DEFAULT_PRIMARY = '#11165a';
  const DEFAULT_SECONDARY = '#0c1048';
  const CACHE_PREFIX = 'tenant_identity_v1_';
  let lockedLogoUrl = '';
  let observerStarted = false;
  let observerTimer = null;

  function normalizeAssetUrl(url) {
    if (!url) return '';
    try {
      return new URL(url, window.location.origin).href;
    } catch (_) {
      return String(url);
    }
  }

  function isSameAssetUrl(left, right) {
    if (!left || !right) return false;
    return normalizeAssetUrl(left) === normalizeAssetUrl(right);
  }

  function getTenantSubdomain() {
    const pathMatch = String(window.location.pathname || '').match(/^\/t\/([a-z0-9][a-z0-9-]*)/i);
    if (pathMatch) return pathMatch[1].toLowerCase();
    try {
      const user = readStoredUser();
      const sub = user?.tenantSubdomain || user?.tenant_subdomain;
      return sub ? String(sub).toLowerCase() : '';
    } catch (_) {
      return '';
    }
  }

  function readStoredUser() {
    try {
      return JSON.parse(
        sessionStorage.getItem('user')
        || localStorage.getItem('user')
        || 'null'
      );
    } catch (_) {
      return null;
    }
  }

  function isTenantContext() {
    if (getTenantSubdomain()) return true;
    const user = readStoredUser();
    return user?.tenantType === 'TENANT' || user?.tenant_type === 'TENANT' || Boolean(user?.tenantId);
  }

  function getPublicApiUrl(path) {
    if (typeof window.getTenantScopedPath === 'function') {
      return window.getTenantScopedPath(path);
    }
    return path;
  }

  function readCachedIdentity() {
    const subdomain = getTenantSubdomain();
    if (!subdomain) return window.__TENANT_IDENTITY_BOOT__ || null;
    try {
      const raw = sessionStorage.getItem(`${CACHE_PREFIX}${subdomain}`);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return window.__TENANT_IDENTITY_BOOT__ || window.__TENANT_IDENTITY__ || null;
  }

  function writeCachedIdentity(identity) {
    const subdomain = getTenantSubdomain();
    if (!subdomain || !identity) return;
    try {
      sessionStorage.setItem(`${CACHE_PREFIX}${subdomain}`, JSON.stringify(identity));
    } catch (_) {}
  }

  function hexToRgbParts(hex) {
    const raw = String(hex || '').replace('#', '').trim();
    if (!raw) return null;
    const normalized = raw.length === 3
      ? raw.split('').map((part) => part + part).join('')
      : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
    const value = parseInt(normalized, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function shadeRgb(parts, factor) {
    return parts.map((part) => Math.max(0, Math.min(255, Math.round(part * factor))));
  }

  function resolveLogoSrc(logoUrl) {
    if (!logoUrl) return '';
    const raw = String(logoUrl);
    if (raw.includes('/api/tenant-public/logo')) {
      const scoped = getPublicApiUrl('/api/tenant-public/logo');
      return `${scoped}${scoped.includes('?') ? '&' : '?'}v=${Date.now()}`;
    }
    return raw;
  }

  function isBrandingSettingsPage() {
    return /tenant-branding-settings\.html$/i.test(window.location.pathname);
  }

  function hidePlatformMarks() {
    document.querySelectorAll('.hq-hero-logo, #branches-watermark h1').forEach((node) => {
      if (/نايو|NAIOSH/i.test(node.textContent || '') || node.matches('.hq-hero-logo')) {
        node.style.display = 'none';
      }
    });
    document.querySelectorAll('img[src*="naiosh-logo"]:not([data-tenant-brand="logo"])').forEach((img) => {
      if (!lockedLogoUrl) img.style.visibility = 'hidden';
    });
  }

  function applyBrandPalette(primary, secondary) {
    const primaryParts = hexToRgbParts(primary) || hexToRgbParts(DEFAULT_PRIMARY);
    const secondaryParts = hexToRgbParts(secondary) || hexToRgbParts(DEFAULT_SECONDARY);
    const root = document.documentElement;

    root.style.setProperty('--tenant-primary', primary);
    root.style.setProperty('--tenant-secondary', secondary);
    root.style.setProperty('--primary-red', primary);
    root.style.setProperty('--primary-red-dark', secondary);
    root.style.setProperty('--brand-red', primary);
    root.style.setProperty('--brand-black', secondary);

    if (primaryParts) {
      const light = shadeRgb(primaryParts, 1.15);
      const dark = shadeRgb(primaryParts, 0.72);
      root.style.setProperty('--brand-50', light.join(' '));
      root.style.setProperty('--brand-100', shadeRgb(primaryParts, 1.05).join(' '));
      root.style.setProperty('--brand-400', light.join(' '));
      root.style.setProperty('--brand-500', primaryParts.join(' '));
      root.style.setProperty('--brand-600', dark.join(' '));
      root.style.setProperty('--brand-800', shadeRgb(primaryParts, 0.45).join(' '));
      root.style.setProperty('--brand-900', shadeRgb(primaryParts, 0.28).join(' '));
    }

    if (secondaryParts) {
      root.style.setProperty('--ink', secondary);
      root.style.setProperty('--charcoal', secondary);
    }

    document.body?.classList.add('tenant-branded');
  }

  function applyLogo(logoUrl) {
    if (!logoUrl) return;
    const resolved = resolveLogoSrc(logoUrl);
    lockedLogoUrl = normalizeAssetUrl(resolved);
    const selector = isBrandingSettingsPage()
      ? 'img[data-tenant-brand="logo"], img[data-tenant-logo="1"]'
      : 'img[src*="naiosh-logo"], img[data-tenant-brand="logo"], img[data-tenant-logo="1"]';
    document.querySelectorAll(selector).forEach((img) => {
      if (!isSameAssetUrl(img.src, lockedLogoUrl)) img.src = lockedLogoUrl;
      img.setAttribute('data-tenant-logo', '1');
      img.style.visibility = 'visible';
      img.alt = img.alt && !/نايو|NAIOSH/i.test(img.alt) ? img.alt : 'شعار الشركة';
    });
    if (!isBrandingSettingsPage()) {
      ensureLogoObserver();
    }
  }

  function ensureLogoObserver() {
    if (observerStarted || !lockedLogoUrl || isBrandingSettingsPage()) return;
    observerStarted = true;
    const observer = new MutationObserver(() => {
      if (!lockedLogoUrl) return;
      if (observerTimer) return;
      observerTimer = window.setTimeout(() => {
        observerTimer = null;
        document.querySelectorAll('img[src*="naiosh-logo"], img[data-tenant-brand="logo"]').forEach((img) => {
          if (img.getAttribute('data-tenant-logo') === '1' && isSameAssetUrl(img.src, lockedLogoUrl)) return;
          img.src = lockedLogoUrl;
          img.setAttribute('data-tenant-logo', '1');
          img.style.visibility = 'visible';
        });
      }, 50);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    window.__tenantBrandingObserver = observer;
  }

  function applyFavicon(faviconUrl, logoUrl) {
    const href = faviconUrl || logoUrl;
    if (!href) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }

  function applySiteName(siteName, siteTagline) {
    if (!siteName) return;

    document.querySelectorAll('[data-tenant-brand="name"]').forEach((node) => {
      node.textContent = siteName;
    });

    const titleBase = siteTagline ? `${siteName} | ${siteTagline}` : siteName;
    if (isTenantContext()) {
      document.title = titleBase;
    } else if (/نايو|NAIOSH|نظام/i.test(document.title)) {
      document.title = document.title
        .replace(/نايوش|NAIOSH ERP|NAIOSH/gi, siteName)
        .replace(/نظام نايو/gi, siteName);
    }

    if (siteTagline) {
      document.querySelectorAll('[data-tenant-brand="tagline"]').forEach((node) => {
        node.textContent = siteTagline;
      });
    }
  }

  function applySidebarChrome(primary, secondary) {
    const gradientHeader = `linear-gradient(135deg, ${secondary} 0%, ${primary} 52%, ${secondary} 100%)`;
    const gradientSidebar = `linear-gradient(180deg, ${secondary} 0%, ${primary} 100%)`;

    document.querySelectorAll('[data-tenant-brand="header"]').forEach((el) => {
      el.style.setProperty('background', gradientHeader, 'important');
    });

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.style.setProperty('background', gradientSidebar, 'important');
    }

    document.querySelectorAll('[data-tenant-brand="footer"]').forEach((el) => {
      el.style.setProperty('background-color', secondary, 'important');
      el.style.setProperty('opacity', '0.92', 'important');
    });
  }

  function buildFinanceHubBrandingCss(primary, secondary) {
    const p = primary || DEFAULT_PRIMARY;
    const s = secondary || DEFAULT_SECONDARY;
    return `
    html[data-tenant-branding="active"].finance-home-theme,
    html[data-tenant-branding="active"] body.finance-home-theme,
    body.tenant-branded.finance-home-theme {
      background: #f9fafb !important;
    }
    html[data-tenant-branding="active"] .hero-section::before,
    body.tenant-branded .hero-section::before {
      display: none !important;
    }
    html[data-tenant-branding="active"] .hero-section,
    body.tenant-branded .hero-section {
      background: #ffffff !important;
      border-color: #e5e7eb !important;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06) !important;
    }
    html[data-tenant-branding="active"] .hero-section .text-white,
    html[data-tenant-branding="active"] .hero-section h2,
    body.tenant-branded .hero-section .text-white,
    body.tenant-branded .hero-section h2 {
      color: #0f172a !important;
    }
    html[data-tenant-branding="active"] .hero-section p.text-white\\/90,
    html[data-tenant-branding="active"] .hero-section .text-white\\/90,
    body.tenant-branded .hero-section p.text-white\\/90,
    body.tenant-branded .hero-section .text-white\\/90 {
      color: #334155 !important;
    }
    html[data-tenant-branding="active"] .hero-section .bg-white\\/20,
    body.tenant-branded .hero-section .bg-white\\/20 {
      background: rgba(255, 255, 255, 0.92) !important;
      border-color: #e2e8f0 !important;
      color: ${p} !important;
    }
    html[data-tenant-branding="active"] .hero-section .bg-white\\/10,
    body.tenant-branded .hero-section .bg-white\\/10 {
      background: #f8fafc !important;
    }
    html[data-tenant-branding="active"] .hero-cta-primary,
    body.tenant-branded .hero-cta-primary {
      background: linear-gradient(135deg, ${p}, ${s}) !important;
      color: #fff !important;
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12) !important;
    }
    html[data-tenant-branding="active"] .hero-cta-secondary:hover,
    body.tenant-branded .hero-cta-secondary:hover {
      border-color: ${p} !important;
      color: ${p} !important;
    }
    html[data-tenant-branding="active"] .floating-actions button,
    html[data-tenant-branding="active"] .floating-actions a,
    body.tenant-branded .floating-actions button,
    body.tenant-branded .floating-actions a {
      background: linear-gradient(135deg, ${p}, ${s}) !important;
      color: #fff !important;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.16) !important;
    }
    html[data-tenant-branding="active"] .finance-links > a > i:first-child,
    body.tenant-branded .finance-links > a > i:first-child {
      background: linear-gradient(135deg, ${p}, ${s}) !important;
      color: #fff !important;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12) !important;
    }
    html[data-tenant-branding="active"] body.finance-home-theme .finance-links > a > i:first-child,
    body.tenant-branded.finance-home-theme .finance-links > a > i:first-child {
      color: #fff !important;
    }
    html[data-tenant-branding="active"] .finance-links > a:hover,
    body.tenant-branded .finance-links > a:hover {
      border-color: ${p} !important;
    }
    html[data-tenant-branding="active"] .finance-links > a > i:last-child,
    body.tenant-branded .finance-links > a > i:last-child {
      color: ${p} !important;
    }
    html[data-tenant-branding="active"] .finance-help-button,
    body.tenant-branded .finance-help-button {
      border-color: ${p} !important;
      color: ${p} !important;
    }
    html[data-tenant-branding="active"] .finance-help-button:hover,
    body.tenant-branded .finance-help-button:hover {
      background: #f8fafc !important;
      border-color: ${p} !important;
      color: ${p} !important;
    }
    html[data-tenant-branding="active"] .global-back-button,
    html[data-tenant-branding="active"] .global-back-button--floating,
    html[data-tenant-branding="active"] header.top-nav .global-back-button--inline,
    body.tenant-branded .global-back-button,
    body.tenant-branded .global-back-button--floating,
    body.tenant-branded header.top-nav .global-back-button--inline {
      color: ${p} !important;
      border-color: rgba(15, 23, 42, 0.12) !important;
    }
    html[data-tenant-branding="active"] .global-back-button:hover,
    body.tenant-branded .global-back-button:hover {
      color: ${p} !important;
      border-color: rgba(15, 23, 42, 0.2) !important;
    }
  `;
  }

  function injectBrandingStyles(identity) {
    const styleId = 'tenant-branding-dynamic-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    const primary = identity.primary_color || DEFAULT_PRIMARY;
    const secondary = identity.secondary_color || DEFAULT_SECONDARY;
    style.textContent = `
      body.tenant-branded .bg-red-600,
      body.tenant-branded .bg-red-700,
      body.tenant-branded .from-red-600,
      body.tenant-branded .to-red-700,
      body.tenant-branded .from-red-900,
      body.tenant-branded .via-red-800,
      body.tenant-branded .to-red-950,
      body.tenant-branded .bg-red-950,
      body.tenant-branded .bg-red-950\\/50,
      body.tenant-branded button.bg-red-600,
      body.tenant-branded a.bg-red-600 {
        background-color: ${primary} !important;
      }
      body.tenant-branded .bg-gradient-to-b.from-red-950.to-red-900,
      body.tenant-branded .bg-gradient-to-br.from-red-900,
      body.tenant-branded #sidebar.bg-gradient-to-b,
      body.tenant-branded #sidebar {
        background: linear-gradient(180deg, ${secondary} 0%, ${primary} 100%) !important;
      }
      body.tenant-branded [data-tenant-brand="header"] {
        background: linear-gradient(135deg, ${secondary} 0%, ${primary} 52%, ${secondary} 100%) !important;
      }
      body.tenant-branded [data-tenant-brand="footer"] {
        background-color: ${secondary} !important;
      }
      body.tenant-branded .text-red-600,
      body.tenant-branded .text-red-700,
      body.tenant-branded #sidebar a .naiosh-brand-accent,
      body.tenant-branded .group-hover\\:text-red-700:hover {
        color: ${primary} !important;
      }
      body.tenant-branded .border-red-500,
      body.tenant-branded .hover\\:border-red-500:hover,
      body.tenant-branded .border-red-800 {
        border-color: ${primary} !important;
      }
      body.tenant-branded .bg-primary {
        background-color: ${primary} !important;
        background-image: linear-gradient(135deg, ${secondary}, ${primary}) !important;
      }
      body.tenant-branded img[src*="naiosh-logo"]:not([data-tenant-logo="1"]) {
        visibility: hidden !important;
      }
      ${buildFinanceHubBrandingCss(primary, secondary)}
    `;
  }

  function markBrandingReady() {
    document.documentElement.classList.remove('tenant-branding-pending');
    document.documentElement.setAttribute('data-tenant-brand-ready', '1');
  }

  function scheduleBrandingFailsafe() {
    window.setTimeout(() => {
      markBrandingReady();
    }, 1200);
  }

  function applyIdentity(identity, options = {}) {
    if (!identity) return;
    applyBrandPalette(identity.primary_color, identity.secondary_color);
    applyLogo(identity.logo_url);
    applyFavicon(identity.favicon_url, identity.logo_url);
    applySiteName(identity.site_name, identity.site_tagline);
    applySidebarChrome(identity.primary_color, identity.secondary_color);
    injectBrandingStyles(identity);
    hidePlatformMarks();
    window.__TENANT_IDENTITY__ = identity;
    if (!options.silent) {
      markBrandingReady();
      window.dispatchEvent(new CustomEvent('tenant-branding:ready', { detail: identity }));
    }
  }

  async function fetchIdentity() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(getPublicApiUrl('/api/tenant-public/identity'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'IDENTITY_FETCH_FAILED');
      }
      return payload.data || null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function maybeShowSetupBanner(identity) {
    if (identity.setup_completed !== false) return;
    if (typeof window.getTenantScopedPath !== 'function') return;
    const onSettingsPage = /tenant-branding-settings\.html$/i.test(window.location.pathname);
    const onLoginPage = /login-page\.html$/i.test(window.location.pathname);
    const role = readStoredUser()?.role;
    if (onSettingsPage || onLoginPage || !['admin', 'tenant_admin'].includes(role)) return;

    const bannerId = 'tenant-branding-setup-banner';
    if (document.getElementById(bannerId)) return;
    const banner = document.createElement('div');
    banner.id = bannerId;
    banner.style.cssText = 'position:fixed;inset-inline:16px;top:16px;z-index:9999;background:#111827;color:#fff;padding:14px 18px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;justify-content:space-between;';
    banner.innerHTML = `
      <div style="font-weight:700;">أكمل إعداد هوية نظام شركتك (الاسم، الشعار، الألوان)</div>
      <a href="${window.getTenantScopedPath('/tenant-branding-settings.html')}" style="background:#fff;color:#111827;padding:8px 14px;border-radius:10px;font-weight:800;text-decoration:none;">فتح الإعدادات</a>
    `;
    document.body.appendChild(banner);
  }

  async function applyTenantBranding(options = {}) {
    if (!isTenantContext()) return;

    const cached = readCachedIdentity();
    if (cached && !options.forceRemote) {
      applyIdentity(cached, { silent: true });
      markBrandingReady();
    }

    try {
      const identity = await fetchIdentity();
      if (!identity) {
        if (cached) maybeShowSetupBanner(cached);
        return;
      }
      writeCachedIdentity(identity);
      applyIdentity(identity);
      maybeShowSetupBanner(identity);
    } catch (error) {
      if (cached) {
        applyIdentity(cached);
        maybeShowSetupBanner(cached);
        return;
      }
      console.warn('Tenant branding apply skipped:', error.message);
      markBrandingReady();
    }
  }

  window.applyTenantBranding = applyTenantBranding;
  window.applyTenantIdentity = applyIdentity;

  const bootIdentity = readCachedIdentity();
  if (bootIdentity && isTenantContext()) {
    applyIdentity(bootIdentity, { silent: true });
    markBrandingReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleBrandingFailsafe();
      applyTenantBranding();
    });
  } else {
    scheduleBrandingFailsafe();
    applyTenantBranding();
  }

  window.addEventListener('pageshow', () => {
    const identity = window.__TENANT_IDENTITY__ || readCachedIdentity();
    if (identity) applyIdentity(identity);
  });
})();
