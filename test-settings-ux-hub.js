'use strict';

const { getCatalog, ALL_ENTRIES } = require('./enterprise-settings-catalog');
const { assertMappingCovers, UX_SECTIONS, resolveSearchAlias } = require('./enterprise-settings-ux');
const fs = require('fs');
const path = require('path');

const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  if (!cond) console.error('FAIL', name, detail || '');
  else console.log('PASS', name, detail || '');
}

const catalog = getCatalog();
const mapping = assertMappingCovers(ALL_ENTRIES.map((e) => e.id));

ok('ux-sections-8', UX_SECTIONS.length === 8);
ok('mapping-covers-47', mapping.ok && ALL_ENTRIES.length === 47, JSON.stringify(mapping));
ok('catalog-ux-present', !!catalog.ux && Array.isArray(catalog.ux.sections));
ok('catalog-by-ux-section', !!catalog.byUxSection && Object.keys(catalog.byUxSection).length === 8);
ok('catalog-mapping-ok', catalog.uxMappingOk === true);
ok('counts-unchanged', catalog.counts.total === 47 && catalog.counts.live === 47);

const summed = Object.values(catalog.byUxSection).reduce((n, arr) => n + arr.length, 0);
ok('sections-sum-47', summed === 47, String(summed));

ok('alias-logo', resolveSearchAlias('تغيير الشعار') === 'company-branding');
ok('alias-color', resolveSearchAlias('تغيير لون الموقع') === 'company-branding');
ok('alias-branch', resolveSearchAlias('إضافة فرع') === 'company-org');
ok('alias-payroll', resolveSearchAlias('إعدادات الرواتب') === 'module-hr-payroll');
ok('alias-perms', resolveSearchAlias('تعديل الصلاحيات') === 'platform-super-admin');
ok('alias-subs', resolveSearchAlias('تعديل الاشتراكات') === 'platform-subscriptions');

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
ok('hub-ux-sections-ui', script.includes('setEnterpriseSettingsSection') && script.includes('renderEnterpriseSettingsSectionsGrid'));
ok('hub-no-dump-default', script.includes('عرض كل الإعدادات دفعة واحدة'));
ok('hub-smart-search', script.includes('resolveEnterpriseSettingsAlias') && script.includes('handleEnterpriseSettingsSearchKey'));
ok('hub-friendly-copy', script.includes('دون مصطلحات تقنية'));
ok('engine-intact', script.includes('ensureEnterpriseSettingsCatalog') && script.includes('/api/enterprise-settings/catalog'));
ok('no-mock-save', script.includes('لا يوجد حفظ وهمي') || script.includes('لا يوجد منطق حفظ وهمي'));

// hrefs preserved for branding
const branding = catalog.entries.find((e) => e.id === 'company-branding');
ok('branding-href', branding && branding.href === '/tenant-branding-settings.html');
ok('branding-friendly', branding.displayTitleAr.includes('شعار'));

const failed = results.filter((r) => !r.pass);
console.log('\n=== Settings UX Hub ===');
console.log('passed:', results.length - failed.length, '/', results.length);
if (failed.length) {
  failed.forEach((f) => console.log(' -', f.name, f.detail));
  process.exit(1);
}
console.log('VERDICT: GO');
