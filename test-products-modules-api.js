#!/usr/bin/env node

const assert = require('assert');
const { buildProductsModulesBundle } = require('./products-modules-builder');

function hasArabicText(value) {
  return /[\u0600-\u06FF]/.test(String(value || ''));
}

const bundle = buildProductsModulesBundle();
const systems = ['services', 'payment-system', 'supply-chain'];

systems.forEach((systemId) => {
  const modules = bundle.modulesBySystem[systemId];
  assert(Array.isArray(modules) && modules.length > 0, `${systemId} should expose modules`);
  modules.forEach((entry) => {
    assert(entry.href && entry.href !== '/home', `${systemId} module should have a real href: ${JSON.stringify(entry)}`);
    assert(hasArabicText(entry.name), `${systemId} module name should be Arabic: ${JSON.stringify(entry)}`);
  });
});

const services = bundle.modulesBySystem.services;
assert(
  services.some((entry) => entry.href === '/services/project-management-office'),
  'services should link to dashboard service pages'
);

console.log('test-products-modules-api: ok');
