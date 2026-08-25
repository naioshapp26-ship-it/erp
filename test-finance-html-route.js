'use strict';

const assert = require('assert');

const getOriginalSearchParams = (req) => {
  const qs = String(req.originalUrl || req.url || '').split('?')[1] || '';
  return new URLSearchParams(qs);
};

const isFinanceDataQuery = (req) => {
  const params = getOriginalSearchParams(req);
  return params.has('entity_id')
    || params.has('fiscal_year')
    || params.has('payment_id')
    || params.has('budget_id');
};

const cases = [
  {
    name: 'tenant finance page without client query',
    req: {
      originalUrl: '/t/mam/finance/',
      url: '/finance/',
      query: { entity_id: 'TEN000015', entity_type: 'TENANT' }
    },
    expected: false
  },
  {
    name: 'finance api query keeps entity_id in original url',
    req: {
      originalUrl: '/finance/journal/entries?entity_id=HQ001&fiscal_year=2026',
      url: '/finance/journal/entries?entity_id=HQ001&fiscal_year=2026',
      query: { entity_id: 'HQ001', fiscal_year: '2026' }
    },
    expected: true
  },
  {
    name: 'finance html with only middleware-injected entity scope',
    req: {
      originalUrl: '/t/mam/finance',
      url: '/finance',
      query: { entity_id: 'TEN000015' }
    },
    expected: false
  }
];

cases.forEach(({ name, req, expected }) => {
  assert.strictEqual(isFinanceDataQuery(req), expected, name);
});

console.log('test-finance-html-route: ok');
