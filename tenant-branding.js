(function () {
  'use strict';

  const DEFAULT_PRIMARY = '#990e1e';
  const DEFAULT_SECONDARY = '#1a1a1a';

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
    if (String(window.location.pathname || '').match(/^\/t\/[a-z0-9][a-z0-9-]*/i)) {
      return true;
    }
    const user = readStoredUser();
    return user?.tenantType === 'TENANT' || user?.tenant_type === 'TENANT' || Boolean(user?.tenantId);
  }

  function getPublicApiUrl(path) {
    if (typeof window.getTenantScopedPath === 'function') {
      return window.getTenantScopedPath(path);
    }
    return path;
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

    document.body.classList.add('tenant-branded');
  }

  function applyLogo(logoUrl) {
    if (!logoUrl) return;
    document.querySelectorAll('img[src*="naiosh-logo"], img[data-tenant-brand="logo"]').forEach((img) => {
      img.src = logoUrl;
      img.alt = img.alt || 'شعار الشركة';
    });
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

    if (siteName) {
      const titleBase = siteTagline ? `${siteName} | ${siteTagline}` : siteName;
      if (/نايو|NAIOSH|نظام/i.test(document.title)) {
        document.title = document.title
          .replace(/نايوش|NAIOSH ERP|NAIOSH/gi, siteName)
          .replace(/نظام نايو/gi, siteName);
      } else if (isTenantContext()) {
        document.title = titleBase;
      }
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
      body.tenant-branded #sidebar.bg-gradient-to-b {
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
      body.tenant-branded #sidebar {
        background: linear-gradient(180deg, ${secondary} 0%, ${primary} 100%) !important;
      }
      body.tenant-branded .bg-primary {
        background-color: ${primary} !important;
        background-image: linear-gradient(135deg, ${secondary}, ${primary}) !important;
      }
    `;
  }

  async function fetchIdentity() {
    const response = await fetch(getPublicApiUrl('/api/tenant-public/identity'), {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'IDENTITY_FETCH_FAILED');
    }
    return payload.data || null;
  }

  async function applyTenantBranding() {
    if (!isTenantContext()) return;

    try {
      const identity = await fetchIdentity();
      if (!identity) return;

      applyBrandPalette(identity.primary_color, identity.secondary_color);
      applyLogo(identity.logo_url);
      applyFavicon(identity.favicon_url, identity.logo_url);
      applySiteName(identity.site_name, identity.site_tagline);
      applySidebarChrome(identity.primary_color, identity.secondary_color);
      injectBrandingStyles(identity);

      window.__TENANT_IDENTITY__ = identity;
      window.dispatchEvent(new CustomEvent('tenant-branding:ready', { detail: identity }));

      if (identity.setup_completed === false && typeof window.getTenantScopedPath === 'function') {
        const onSettingsPage = /tenant-branding-settings\.html$/i.test(window.location.pathname);
        const onLoginPage = /login-page\.html$/i.test(window.location.pathname);
        if (!onSettingsPage && !onLoginPage && (readStoredUser()?.role === 'admin' || readStoredUser()?.role === 'tenant_admin')) {
          const bannerId = 'tenant-branding-setup-banner';
          if (!document.getElementById(bannerId)) {
            const banner = document.createElement('div');
            banner.id = bannerId;
            banner.style.cssText = 'position:fixed;inset-inline:16px;top:16px;z-index:9999;background:#111827;color:#fff;padding:14px 18px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;justify-content:space-between;';
            banner.innerHTML = `
              <div style="font-weight:700;">أكمل إعداد هوية نظام شركتك (الاسم، الشعار، الألوان)</div>
              <a href="${window.getTenantScopedPath('/tenant-branding-settings.html')}" style="background:#fff;color:#111827;padding:8px 14px;border-radius:10px;font-weight:800;text-decoration:none;">فتح الإعدادات</a>
            `;
            document.body.appendChild(banner);
          }
        }
      }
    } catch (error) {
      console.warn('Tenant branding apply skipped:', error.message);
    }
  }

  window.applyTenantBranding = applyTenantBranding;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTenantBranding);
  } else {
    applyTenantBranding();
  }
})();
