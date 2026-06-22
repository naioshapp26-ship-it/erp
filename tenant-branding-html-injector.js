'use strict';

const { sanitizeCssColor } = require('./tenant-branding-service');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBootIdentity(identity = {}, tenant = null) {
  const siteName = String(identity.site_name || tenant?.company_name || '').trim();
  return {
    site_name: siteName,
    site_tagline: String(identity.site_tagline || '').trim(),
    logo_url: String(identity.logo_url || '').trim(),
    favicon_url: String(identity.favicon_url || identity.logo_url || '').trim(),
    primary_color: sanitizeCssColor(identity.primary_color),
    secondary_color: sanitizeCssColor(identity.secondary_color, '#1a1a1a'),
    setup_completed: identity.setup_completed !== false
  };
}

function buildCriticalBrandingBlock(identity, tenant = null) {
  const boot = buildBootIdentity(identity, tenant);
  const primary = boot.primary_color;
  const secondary = boot.secondary_color;
  const logoUrl = boot.logo_url;
  const siteName = boot.site_name;
  const bootJson = JSON.stringify(boot).replace(/</g, '\\u003c');

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
      #sidebar,
      body.tenant-branded #sidebar,
      [data-tenant-brand="header"] {
        background: linear-gradient(180deg, ${secondary} 0%, ${primary} 100%) !important;
      }
      [data-tenant-brand="header"] {
        background: linear-gradient(135deg, ${secondary} 0%, ${primary} 52%, ${secondary} 100%) !important;
      }
      [data-tenant-brand="footer"] {
        background-color: ${secondary} !important;
      }
      .bg-primary,
      body.tenant-branded .bg-primary {
        background-color: ${primary} !important;
        background-image: linear-gradient(135deg, ${secondary}, ${primary}) !important;
      }
      img[src*="naiosh-logo"] {
        visibility: hidden !important;
      }
      html[data-tenant-brand-ready="1"] #branches-watermark,
      html[data-tenant-brand-ready="1"] .fixed.inset-0.pointer-events-none h1.text-8xl {
        display: none !important;
      }
      html[data-tenant-brand-ready="1"] img[data-tenant-brand="logo"],
      html[data-tenant-brand-ready="1"] img[src*="tenant-branding"] {
        visibility: visible !important;
      }
    </style>
    <script id="tenant-branding-boot">
      (function () {
        var boot = ${bootJson};
        var sub = (location.pathname.match(/^\\/t\\/([a-z0-9][a-z0-9-]*)/i) || [])[1];
        if (sub) {
          try { sessionStorage.setItem('tenant_identity_v1_' + sub.toLowerCase(), JSON.stringify(boot)); } catch (_) {}
        }
        window.__TENANT_IDENTITY_BOOT__ = boot;
        window.__TENANT_IDENTITY__ = boot;
        function paintBoot() {
          var root = document.documentElement;
          var p = boot.primary_color || '#990e1e';
          var s = boot.secondary_color || '#1a1a1a';
          root.style.setProperty('--tenant-primary', p);
          root.style.setProperty('--tenant-secondary', s);
          root.style.setProperty('--brand-red', p);
          root.style.setProperty('--primary-red', p);
          if (boot.logo_url) {
            document.querySelectorAll('img[src*="naiosh-logo"], img[data-tenant-brand="logo"]').forEach(function (img) {
              img.src = boot.logo_url;
              img.style.visibility = 'visible';
            });
          }
          if (boot.site_name) {
            document.querySelectorAll('[data-tenant-brand="name"]').forEach(function (node) {
              node.textContent = boot.site_name;
            });
          }
          if (boot.site_tagline) {
            document.querySelectorAll('[data-tenant-brand="tagline"]').forEach(function (node) {
              node.textContent = boot.site_tagline;
            });
          }
          if (boot.favicon_url) {
            var link = document.querySelector('link[rel="icon"]');
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = boot.favicon_url;
          }
          document.documentElement.setAttribute('data-tenant-brand-ready', '1');
          if (document.body) document.body.classList.add('tenant-branded');
        }
        paintBoot();
        document.addEventListener('DOMContentLoaded', paintBoot);
      })();
    </script>`;
}

function replacePlatformBrandingInHtml(html, identity, tenant = null) {
  const boot = buildBootIdentity(identity, tenant);
  let next = String(html || '');

  if (boot.logo_url) {
    next = next.replace(/\/public\/naiosh-logo(?:-64)?\.png/gi, boot.logo_url);
  }

  if (boot.site_name) {
    const safeName = escapeHtml(boot.site_name);
    next = next.replace(/نظام نايوش/g, safeName);
    next = next.replace(/نايوش ERP/gi, safeName);
    next = next.replace(/إمبراطورية نايوش/g, safeName);
    next = next.replace(/\bNAIOSH\b/g, safeName);
    next = next.replace(/نايوش/g, safeName);
  }

  if (boot.site_tagline) {
    const safeTagline = escapeHtml(boot.site_tagline);
    next = next.replace(/منصة متعددة المستأجرين/g, safeTagline);
  }

  return next;
}

function injectTenantBrandingHtml(html, identity, tenant = null) {
  if (!identity || !tenant) return html;
  const boot = buildBootIdentity(identity, tenant);
  if (!boot.site_name && !boot.logo_url && !boot.primary_color) return html;

  let next = replacePlatformBrandingInHtml(html, boot, tenant);
  const block = buildCriticalBrandingBlock(boot, tenant);

  if (next.includes('id="tenant-branding-boot"')) {
    return next;
  }
  if (next.includes('<head>')) {
    next = next.replace('<head>', `<head>${block}`);
  } else if (next.includes('<head ')) {
    next = next.replace(/<head([^>]*)>/, `<head$1>${block}`);
  }
  return next;
}

module.exports = {
  buildBootIdentity,
  buildCriticalBrandingBlock,
  replacePlatformBrandingInHtml,
  injectTenantBrandingHtml
};
