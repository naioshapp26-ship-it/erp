#!/usr/bin/env node
/**
 * Local demo: serve injected tenant landings for isolation walkthrough (no DB).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  injectTenantBrandingHtml,
  injectTenantLandingSystemLinks
} = require('../tenant-branding-html-injector');

const PORT = 4177;
const template = fs.readFileSync(path.join(__dirname, '..', 'tenant-landing.html'), 'utf8');

const tenants = {
  tast: {
    tenant: { id: 31, subdomain: 'tast', company_name: 'تست' },
    identity: {
      site_name: 'تست',
      company_name: 'تست',
      primary_color: '#11165a',
      secondary_color: '#0c1048',
      hero_mode: 'gradient',
      announcement_enabled: true,
      announcement_text: '🔥 خصومات على الخدمات 🔥 | 🚀 ابدأ الآن | 📢 عروض محدودة'
    },
    pages: ['dashboard', 'hr', 'finance']
  },
  'tenant-b': {
    tenant: { id: 99, subdomain: 'tenant-b', company_name: 'Tenant B' },
    identity: {
      site_name: 'Tenant B',
      company_name: 'Tenant B',
      primary_color: '#0f766e',
      secondary_color: '#115e59',
      hero_mode: 'gradient',
      announcement_enabled: false
    },
    pages: ['dashboard', 'records-archive-home']
  }
};

function render(slug) {
  const cfg = tenants[slug];
  if (!cfg) return null;
  let html = injectTenantBrandingHtml(template, cfg.identity, cfg.tenant, { allowedPages: cfg.pages });
  html = injectTenantLandingSystemLinks(html, cfg.tenant, cfg.pages);
  return html;
}

const server = http.createServer((req, res) => {
  const url = String(req.url || '/').split('?')[0];
  const match = url.match(/^\/t\/([a-z0-9-]+)\/?$/i);
  if (match) {
    const html = render(match[1].toLowerCase());
    if (!html) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('tenant not found');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`tenant isolation demo on http://127.0.0.1:${PORT}/t/tast/`);
});
