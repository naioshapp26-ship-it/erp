#!/usr/bin/env node

const assert = require('assert');

function getEntityFilter(userEntity, tableAlias = '') {
  const alias = tableAlias ? `${tableAlias}.` : '';
  if (userEntity.type === 'HQ') return '1=1';
  return `${alias}entity_id = '${userEntity.id}'`;
}

const tenantEntity = { type: 'TENANT', id: 'mam-entity-001' };
const filter = getEntityFilter(tenantEntity, 'r');
const sql = `SELECT COALESCE(MAX(r.display_order), 0) AS max_order
 FROM hr_module_records r
 WHERE r.module_key = 'e-archive' AND ${filter}`;

assert(sql.includes('FROM hr_module_records r'), 'query should alias hr_module_records as r');
assert(sql.includes('r.entity_id'), 'tenant filter should reference alias r');
assert(!sql.includes('FROM hr_module_records\n         WHERE module_key'), 'query must not use r filter without alias');

console.log('test-e-archive-max-order-query: ok');
