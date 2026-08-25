#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const loginHtml = fs.readFileSync(path.join(__dirname, 'login-page.html'), 'utf8');
const landingHtml = fs.readFileSync(path.join(__dirname, 'tenant-landing.html'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

const checks = [
  ['login allows next param on tenant login page', loginHtml.includes('onLoginPage') && loginHtml.includes("params.get('next')")],
  ['auth redirect uses login=1 and next', serverJs.includes('login=1&next=')],
  ['landing sidebar system links wired', landingHtml.includes('data-tenant-system-link="finance"') && landingHtml.includes('data-tenant-scope-skip')],
  ['landing sidebar explicit navigation', landingHtml.includes('window.location.href = url')]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('test-login-page-tenant-redirect failed:', failed.join(', '));
  process.exit(1);
}

console.log('test-login-page-tenant-redirect: ok');
