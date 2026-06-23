'use strict';

function buildFinanceHubBrandingCss(primary, secondary) {
  const p = primary || '#990e1e';
  const s = secondary || '#1a1a1a';

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

module.exports = { buildFinanceHubBrandingCss };
