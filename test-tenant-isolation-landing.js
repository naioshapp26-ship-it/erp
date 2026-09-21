#!/usr/bin/env node
/**
 * Regression: tenant landing isolation — branding + modules must never leak across tenants.
 */
const assert = require('assert');
const {
  injectTenantBrandingHtml,
  injectTenantLandingSystemLinks,
  resolveAllowedLandingSystems,
  buildBootIdentity
} = require('./tenant-branding-html-injector');
const { ensureTenantCoreSystemPages } = require('./tenant-page-access-policy');

const TEMPLATE = `
<html><head><meta charset="utf-8"><title>poshahub360</title></head>
<body class="homepage">
  <span data-landing-brand="name">poshahub360</span>
  <h1 data-landing-brand="name">poshahub360</h1>
  <nav class="hero-sidebar">
    <a class="hero-sidebar-item" href="/hr" data-tenant-system-link="hr">نظام HR</a>
    <a class="hero-sidebar-item" href="/finance" data-tenant-system-link="finance">نظام المالية</a>
    <a class="hero-sidebar-item" href="/archive" data-tenant-system-link="archive">نظام الارشيف</a>
  </nav>
  <section id="main-sections-grid">
    <a class="card" href="/hr"><h3>نظام HR</h3></a>
    <a class="card" href="/finance"><h3>نظام المالية</h3></a>
    <a class="card" href="/archive"><h3>نظام الارشيف</h3></a>
  </section>
</body></html>
`;

function buildLanding(tenant, pages) {
  const identity = {
    site_name: tenant.company_name,
    company_name: tenant.company_name,
    primary_color: '#11165a',
    secondary_color: '#0c1048',
    allowed_pages: pages
  };
  let html = injectTenantBrandingHtml(TEMPLATE, identity, tenant, { allowedPages: pages });
  html = injectTenantLandingSystemLinks(html, tenant, pages);
  return html;
}

const tenantA = { id: 1, subdomain: 'tenant-a', company_name: 'Tenant A' };
const tenantB = { id: 2, subdomain: 'tenant-b', company_name: 'Tenant B' };

const htmlA = buildLanding(tenantA, ['dashboard', 'hr', 'finance']);
const htmlB = buildLanding(tenantB, ['dashboard', 'records-archive-home']);

assert.ok(htmlA.includes('Tenant A'), 'Tenant A landing must show Tenant A name');
assert.ok(!htmlA.includes('Tenant B'), 'Tenant A landing must not show Tenant B name');
assert.ok(!/site_name":"poshahub360"/.test(htmlA), 'Tenant A must not keep hardcoded poshahub360 in boot');
assert.ok(htmlA.includes('data-tenant-system-link="hr"'), 'Tenant A must show HR');
assert.ok(htmlA.includes('data-tenant-system-link="finance"'), 'Tenant A must show Finance');
assert.ok(!htmlA.includes('data-tenant-system-link="archive"'), 'Tenant A must not show Archive');
assert.ok(htmlA.includes('/t/tenant-a/hr'), 'Tenant A HR link must be scoped');
assert.ok(htmlA.includes('/t/tenant-a/finance'), 'Tenant A Finance link must be scoped');
assert.ok(!htmlA.includes('/t/tenant-a/archive'), 'Tenant A Archive link must be removed');

assert.ok(htmlB.includes('Tenant B'), 'Tenant B landing must show Tenant B name');
assert.ok(!htmlB.includes('Tenant A'), 'Tenant B landing must not show Tenant A name');
assert.ok(htmlB.includes('data-tenant-system-link="archive"'), 'Tenant B must show Archive');
assert.ok(!htmlB.includes('data-tenant-system-link="hr"'), 'Tenant B must not show HR');
assert.ok(!htmlB.includes('data-tenant-system-link="finance"'), 'Tenant B must not show Finance');
assert.ok(htmlB.includes('/t/tenant-b/archive'), 'Tenant B Archive link must be scoped');

assert.deepStrictEqual(
  resolveAllowedLandingSystems(['hr', 'finance']).map((s) => s.key),
  ['hr', 'finance']
);
assert.deepStrictEqual(
  resolveAllowedLandingSystems(['records-archive-home']).map((s) => s.key),
  ['archive']
);

const bootA = buildBootIdentity(
  { site_name: 'Tenant A', allowed_pages: ['hr', 'finance'] },
  tenantA
);
assert.strictEqual(bootA.site_name, 'Tenant A');
assert.deepStrictEqual(bootA.allowed_systems, ['hr', 'finance']);

assert.strictEqual(typeof ensureTenantCoreSystemPages, 'function');

console.log('✅ test-tenant-isolation-landing: ok');
