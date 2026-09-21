'use strict';

const { buildFinanceHubBrandingCss } = require('./tenant-finance-hub-branding-css');

const { sanitizeCssColor } = require('./tenant-branding-service');

const TENANT_LANDING_SYSTEMS = [
  {
    key: 'hr',
    pageKey: 'hr',
    path: '/hr',
    label: 'نظام HR',
    description: 'إدارة الموظفين والطلبات والحضور والرواتب من مكان واحد.',
    iconClass: 'fas fa-users-gear'
  },
  {
    key: 'finance',
    pageKey: 'finance',
    path: '/finance',
    label: 'نظام المالية',
    description: 'متابعة الحسابات والمدفوعات والتقارير المالية بسهولة.',
    iconClass: 'fas fa-coins'
  },
  {
    key: 'archive',
    pageKey: 'records-archive-home',
    path: '/archive',
    label: 'نظام الارشيف',
    description: 'أرشفة المستندات والمرفقات مع بحث سريع وآمن.',
    iconClass: 'fas fa-box-archive'
  }
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeAllowedPages(pages) {
  if (!Array.isArray(pages)) return [];
  return [...new Set(pages.map((page) => String(page || '').trim()).filter(Boolean))];
}

function resolveAllowedLandingSystems(allowedPages) {
  const allowed = new Set(normalizeAllowedPages(allowedPages));
  if (!allowed.size) {
    // Fail closed for landing modules: never invent systems the tenant did not subscribe to.
    return [];
  }
  return TENANT_LANDING_SYSTEMS.filter((system) => allowed.has(system.pageKey));
}

function buildBootIdentity(identity = {}, tenant = null, options = {}) {
  const siteName = String(identity.site_name || tenant?.company_name || '').trim();
  const subdomain = String(tenant?.subdomain || '').toLowerCase();
  const allowedPages = normalizeAllowedPages(
    options.allowedPages
      || identity.allowed_pages
      || identity.allowedPages
      || []
  );
  const allowedSystems = resolveAllowedLandingSystems(allowedPages).map((system) => system.key);
  const scopeApi = (url) => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    // Idempotent: identity may already be scoped (buildBootIdentity can run twice).
    if (subdomain && raw.startsWith(`/t/${subdomain}/`)) return raw;
    if (subdomain && /^\/t\/[a-z0-9][a-z0-9-]*\//i.test(raw)) return raw;
    if (subdomain && raw.includes('/api/tenant-public/')) {
      return `/t/${subdomain}${raw.startsWith('/') ? raw : `/${raw}`}`;
    }
    return raw;
  };
  return {
    site_name: siteName,
    site_tagline: String(identity.site_tagline || '').trim(),
    logo_url: String(identity.logo_url || '').trim(),
    favicon_url: String(identity.favicon_url || identity.logo_url || '').trim(),
    primary_color: sanitizeCssColor(identity.primary_color),
    secondary_color: sanitizeCssColor(identity.secondary_color, '#1a1a1a'),
    setup_completed: identity.setup_completed !== false,
    hero_mode: String(identity.hero_mode || 'gradient').trim().toLowerCase() || 'gradient',
    hero_banner_image_url: scopeApi(identity.hero_banner_image_url || ''),
    hero_banner_video_url: scopeApi(identity.hero_banner_video_url || ''),
    announcement_enabled: identity.announcement_enabled !== false,
    announcement_text: String(identity.announcement_text || '').trim(),
    announcement_speed: Number(identity.announcement_speed) || 28,
    announcement_text_color: sanitizeCssColor(identity.announcement_text_color, '#ffffff'),
    allowed_pages: allowedPages,
    allowed_systems: allowedSystems,
    company_name: String(identity.company_name || tenant?.company_name || siteName || '').trim()
  };
}

function resolveScopedLogoUrl(logoUrl, subdomain) {
  const raw = String(logoUrl || '').trim();
  if (!raw) return '';
  if (subdomain && raw.startsWith(`/t/${subdomain}/`)) return raw;
  if (subdomain && /^\/t\/[a-z0-9][a-z0-9-]*\//i.test(raw)) return raw;
  if (raw.includes('/api/tenant-public/logo') && subdomain) {
    return `/t/${subdomain}/api/tenant-public/logo`;
  }
  return raw;
}

function buildSyncCacheBootScript() {
  return `<script id="tenant-branding-sync-boot">
(function () {
  function readUser() {
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
  function getSubdomain() {
    var pathMatch = String(location.pathname || '').match(/^\\/t\\/([a-z0-9][a-z0-9-]*)/i);
    if (pathMatch) return pathMatch[1].toLowerCase();
    var user = readUser();
    var sub = user && (user.tenantSubdomain || user.tenant_subdomain);
    return sub ? String(sub).toLowerCase() : '';
  }
  function scopedLogo(url, sub) {
    if (!url) return '';
    if (String(url).indexOf('/api/tenant-public/logo') !== -1 && sub) {
      return '/t/' + sub + '/api/tenant-public/logo?v=' + Date.now();
    }
    return url;
  }
  function paintBoot(boot, sub) {
    if (!boot) return;
    var root = document.documentElement;
    var primary = boot.primary_color || '#11165a';
    var secondary = boot.secondary_color || '#0c1048';
    root.setAttribute('data-tenant-branding', 'active');
    root.style.setProperty('--tenant-primary', primary);
    root.style.setProperty('--tenant-secondary', secondary);
    root.style.setProperty('--brand-red', primary);
    root.style.setProperty('--primary-red', primary);
    root.style.setProperty('--primary-red-dark', secondary);
    if (boot.logo_url) {
      var logoSrc = scopedLogo(boot.logo_url, sub);
      document.querySelectorAll('img[src*="naiosh-logo"], img[data-tenant-brand="logo"], .hq-hero-logo').forEach(function (img) {
        if (logoSrc) img.src = logoSrc;
        img.setAttribute('data-tenant-logo', '1');
        img.style.visibility = 'visible';
      });
    }
    if (boot.site_name) {
      document.querySelectorAll('[data-tenant-brand="name"], [data-landing-brand="name"]').forEach(function (node) {
        node.textContent = boot.site_name;
      });
      document.title = boot.site_name;
    }
    if (boot.site_tagline) {
      document.querySelectorAll('[data-tenant-brand="tagline"]').forEach(function (node) {
        node.textContent = boot.site_tagline;
      });
    }
    if (boot.favicon_url || boot.logo_url) {
      var faviconHref = scopedLogo(boot.favicon_url || boot.logo_url, sub);
      var link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconHref;
    }
    root.setAttribute('data-tenant-brand-ready', '1');
    if (document.body) document.body.classList.add('tenant-branded');
    window.__TENANT_IDENTITY_BOOT__ = boot;
    window.__TENANT_IDENTITY__ = boot;
    window.__TENANT_ALLOWED_PAGES__ = Array.isArray(boot.allowed_pages) ? boot.allowed_pages : [];
    window.__TENANT_ALLOWED_SYSTEMS__ = Array.isArray(boot.allowed_systems) ? boot.allowed_systems : [];
  }
  var sub = getSubdomain();
  if (!sub) return;
  document.documentElement.setAttribute('data-tenant-context', sub);
  if (window.__TENANT_IDENTITY_BOOT__) {
    paintBoot(window.__TENANT_IDENTITY_BOOT__, sub);
    return;
  }
  var boot = null;
  try {
    var raw = sessionStorage.getItem('tenant_identity_v1_' + sub);
    if (raw) boot = JSON.parse(raw);
  } catch (_) {}
  if (boot) {
    paintBoot(boot, sub);
    return;
  }
  var hide = document.createElement('style');
  hide.id = 'tenant-branding-hide-platform';
  hide.textContent = 'html[data-tenant-context] img[src*="naiosh-logo"]:not([data-tenant-logo="1"]),html[data-tenant-context] .hq-hero-logo{display:none!important}';
  document.head.appendChild(hide);
})();
</script>`;
}

function buildCriticalBrandingBlock(identity, tenant = null) {
  const boot = buildBootIdentity(identity, tenant);
  const primary = boot.primary_color;
  const secondary = boot.secondary_color;
  const subdomain = String(tenant?.subdomain || '').toLowerCase();
  const scopedLogo = resolveScopedLogoUrl(boot.logo_url, subdomain);
  const bootForClient = { ...boot, logo_url: scopedLogo || boot.logo_url };
  const bootJson = JSON.stringify(bootForClient).replace(/</g, '\\u003c');

  return `
    <meta name="tenant-branding" content="active">
    <style id="tenant-branding-critical">
      :root {
        --tenant-primary: ${primary};
        --tenant-secondary: ${secondary};
        --primary-red: ${primary};
        --primary-red-dark: ${secondary};
        --brand-red: ${primary};
        --brand-black: ${secondary};
      }
      html[data-tenant-branding="active"] .bg-primary,
      html[data-tenant-brand-ready="1"] .bg-primary,
      #sidebar,
      body.tenant-branded #sidebar,
      html[data-tenant-branding="active"] [data-tenant-brand="header"],
      [data-tenant-brand="header"] {
        background: linear-gradient(180deg, ${secondary} 0%, ${primary} 100%) !important;
      }
      html[data-tenant-branding="active"] [data-tenant-brand="header"],
      [data-tenant-brand="header"] {
        background: linear-gradient(135deg, ${secondary} 0%, ${primary} 52%, ${secondary} 100%) !important;
      }
      [data-tenant-brand="footer"] {
        background-color: ${secondary} !important;
      }
      html[data-tenant-branding="active"] .bg-primary,
      .bg-primary,
      body.tenant-branded .bg-primary {
        background-color: ${primary} !important;
        background-image: linear-gradient(135deg, ${secondary}, ${primary}) !important;
      }
      html[data-tenant-branding="active"] img[src*="naiosh-logo"]:not([data-tenant-logo="1"]),
      html[data-tenant-context] img[src*="naiosh-logo"]:not([data-tenant-logo="1"]) {
        visibility: hidden !important;
      }
      html[data-tenant-brand-ready="1"] #branches-watermark,
      html[data-tenant-brand-ready="1"] .fixed.inset-0.pointer-events-none h1.text-8xl {
        display: none !important;
      }
      html[data-tenant-brand-ready="1"] img[data-tenant-brand="logo"],
      html[data-tenant-brand-ready="1"] img[data-tenant-logo="1"],
      html[data-tenant-brand-ready="1"] img[src*="tenant-branding"],
      html[data-tenant-brand-ready="1"] img[src*="tenant-public/logo"] {
        visibility: visible !important;
      }
      ${buildFinanceHubBrandingCss(primary, secondary)}
    </style>
    <script id="tenant-branding-boot">
      (function () {
        var boot = ${bootJson};
        var sub = ${JSON.stringify(subdomain)} || ((location.pathname.match(/^\\/t\\/([a-z0-9][a-z0-9-]*)/i) || [])[1] || '').toLowerCase();
        if (sub) {
          try { sessionStorage.setItem('tenant_identity_v1_' + sub, JSON.stringify(boot)); } catch (_) {}
          document.documentElement.setAttribute('data-tenant-context', sub);
        }
        document.documentElement.setAttribute('data-tenant-branding', 'active');
        window.__TENANT_IDENTITY_BOOT__ = boot;
        window.__TENANT_IDENTITY__ = boot;
        window.__TENANT_ALLOWED_PAGES__ = Array.isArray(boot.allowed_pages) ? boot.allowed_pages : [];
        window.__TENANT_ALLOWED_SYSTEMS__ = Array.isArray(boot.allowed_systems) ? boot.allowed_systems : [];
        function scopedLogo(url) {
          if (!url) return '';
          if (String(url).indexOf('/api/tenant-public/logo') !== -1 && sub) {
            return '/t/' + sub + '/api/tenant-public/logo?v=' + Date.now();
          }
          return url;
        }
        function paintBoot() {
          var root = document.documentElement;
          var p = boot.primary_color || '#11165a';
          var s = boot.secondary_color || '#0c1048';
          root.style.setProperty('--tenant-primary', p);
          root.style.setProperty('--tenant-secondary', s);
          root.style.setProperty('--brand-red', p);
          root.style.setProperty('--primary-red', p);
          root.style.setProperty('--primary-red-dark', s);
          root.style.setProperty('--homepage-button-color', p);
          // Defer detailed light→navy hero gradient to landing paintBrandColors when available
          if (typeof window.__tenantLandingPaintBrandColors === 'function') {
            try { window.__tenantLandingPaintBrandColors(); } catch (_) {}
          } else {
            var hero = document.querySelector('body.homepage .hero, .hero');
            if (hero) {
              hero.style.setProperty('background-color', p, 'important');
              hero.style.setProperty(
                'background-image',
                'linear-gradient(135deg, ' + p + '99, ' + s + ')',
                'important'
              );
            }
          }
          if (boot.logo_url) {
            var logoSrc = scopedLogo(boot.logo_url);
            document.querySelectorAll('img[src*="naiosh-logo"], img[data-tenant-brand="logo"], .hq-hero-logo').forEach(function (img) {
              if (logoSrc) img.src = logoSrc;
              img.setAttribute('data-tenant-logo', '1');
              img.style.visibility = 'visible';
            });
          }
          if (boot.site_name) {
            document.querySelectorAll('[data-tenant-brand="name"], [data-landing-brand="name"]').forEach(function (node) {
              node.textContent = boot.site_name;
            });
            document.title = boot.site_name;
          }
          if (boot.site_tagline) {
            document.querySelectorAll('[data-tenant-brand="tagline"]').forEach(function (node) {
              node.textContent = boot.site_tagline;
            });
          }
          if (boot.favicon_url || boot.logo_url) {
            var faviconHref = scopedLogo(boot.favicon_url || boot.logo_url);
            var link = document.querySelector('link[rel="icon"]');
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = faviconHref;
          }
          root.setAttribute('data-tenant-brand-ready', '1');
          if (document.body) document.body.classList.add('tenant-branded');
        }
        paintBoot();
        document.addEventListener('DOMContentLoaded', paintBoot);
      })();
    </script>`;
}

function replaceOutsideScripts(html, replacer) {
  const parts = String(html || '').split(/(<script\b[^>]*>[\s\S]*?<\/script>)/gi);
  return parts.map((part, index) => {
    // Odd indexes are full <script>...</script> blocks from the capturing split.
    if (index % 2 === 1) return part;
    return replacer(part);
  }).join('');
}

function replacePlatformBrandingInHtml(html, identity, tenant = null) {
  const boot = buildBootIdentity(identity, tenant);
  const subdomain = String(tenant?.subdomain || '').toLowerCase();
  const logoUrl = resolveScopedLogoUrl(boot.logo_url, subdomain) || boot.logo_url;
  let next = String(html || '');

  if (logoUrl) {
    next = replaceOutsideScripts(next, (chunk) => chunk.replace(/\/public\/naiosh-logo(?:-64)?\.png/gi, logoUrl));
  }

  if (boot.site_name) {
    const safeName = escapeHtml(boot.site_name);
    next = replaceOutsideScripts(next, (chunk) => {
      let out = chunk;
      out = out.replace(/نظام نايوش/g, safeName);
      out = out.replace(/نايوش ERP/gi, safeName);
      out = out.replace(/إمبراطورية نايوش/g, safeName);
      out = out.replace(/\bNAIOSH\b/g, safeName);
      out = out.replace(/نايوش/g, safeName);
      out = out.replace(/poshahub360/gi, safeName);
      out = out.replace(/منصتي/g, safeName);
      out = out.replace(/<title>[^<]*<\/title>/i, `<title>${safeName}</title>`);
      out = out.replace(
        /(data-landing-brand="name"[^>]*>)([^<]*)(<\/)/gi,
        `$1${safeName}$3`
      );
      out = out.replace(
        /(data-tenant-brand="name"[^>]*>)([^<]*)(<\/)/gi,
        `$1${safeName}$3`
      );
      return out;
    });
  }

  if (boot.site_tagline) {
    const safeTagline = escapeHtml(boot.site_tagline);
    next = replaceOutsideScripts(next, (chunk) => chunk.replace(/منصة متعددة المستأجرين/g, safeTagline));
  }

  return next;
}

function injectTenantBrandingHtml(html, identity, tenant = null, options = {}) {
  if (!identity || !tenant) return html;
  const boot = buildBootIdentity(identity, tenant, options);
  if (!boot.site_name && !boot.logo_url && !boot.primary_color) return html;

  let next = replacePlatformBrandingInHtml(html, boot, tenant);
  const block = buildCriticalBrandingBlock(boot, tenant);

  if (next.includes('id="tenant-branding-boot"')) {
    return next;
  }
  if (/<meta\s+charset/i.test(next)) {
    next = next.replace(/(<meta\s+charset[^>]*>)/i, `$1${block}`);
  } else if (next.includes('<head>')) {
    next = next.replace('<head>', `<head>${block}`);
  } else if (next.includes('<head ')) {
    next = next.replace(/<head([^>]*)>/, `<head$1>${block}`);
  }
  return next;
}

function stripUnauthorizedLandingSystems(html, allowedSystems) {
  const allowed = new Set(
    (Array.isArray(allowedSystems) ? allowedSystems : [])
      .map((key) => String(key || '').trim().toLowerCase())
      .filter(Boolean)
  );

  let output = String(html || '');
  TENANT_LANDING_SYSTEMS.forEach((system) => {
    if (allowed.has(system.key)) return;
    const key = system.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const path = system.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(
      new RegExp(`<a\\b[^>]*data-tenant-system-link="${key}"[^>]*>[\\s\\S]*?<\\/a>`, 'gi'),
      ''
    );
    output = output.replace(
      new RegExp(`<a\\b[^>]*class="[^"]*card[^"]*"[^>]*href="(?:\\/t\\/[a-z0-9][a-z0-9-]*)${path}"[^>]*>[\\s\\S]*?<\\/a>`, 'gi'),
      ''
    );
    output = output.replace(
      new RegExp(`<a\\b[^>]*class="[^"]*card[^"]*"[^>]*href="${path}"[^>]*>[\\s\\S]*?<\\/a>`, 'gi'),
      ''
    );
  });
  return output;
}

function injectTenantLandingSystemLinks(html, tenant, allowedPages = null) {
  const subdomain = String(tenant?.subdomain || '').trim().toLowerCase();
  if (!html || !subdomain) return html;

  const allowedSystems = resolveAllowedLandingSystems(allowedPages);
  const allowedKeys = allowedSystems.map((system) => system.key);
  const scope = (targetPath) => `/t/${subdomain}${targetPath}`;
  let output = String(html);

  TENANT_LANDING_SYSTEMS.forEach((system) => {
    const targetPath = system.path;
    const scopedPath = scope(targetPath);
    output = output.replace(
      new RegExp(`(class="hero-sidebar-item"[^>]*href=")${targetPath.replace('/', '\\/')}(")`, 'g'),
      `$1${scopedPath}$2`
    );
    output = output.replace(
      new RegExp(`(data-tenant-system-link="[^"]+"[^>]*href=")${targetPath.replace('/', '\\/')}(")`, 'g'),
      `$1${scopedPath}$2`
    );
    output = output.replace(
      new RegExp(`(<a class="card" href=")${targetPath.replace('/', '\\/')}(")`, 'g'),
      `$1${scopedPath}$2`
    );
  });

  if (allowedPages != null) {
    output = stripUnauthorizedLandingSystems(output, allowedKeys);
  }

  return output;
}

module.exports = {
  TENANT_LANDING_SYSTEMS,
  normalizeAllowedPages,
  resolveAllowedLandingSystems,
  buildBootIdentity,
  buildSyncCacheBootScript,
  buildCriticalBrandingBlock,
  replacePlatformBrandingInHtml,
  injectTenantBrandingHtml,
  injectTenantLandingSystemLinks,
  stripUnauthorizedLandingSystems
};
