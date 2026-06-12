const fs = require('fs');
const script = fs.readFileSync('./script.js', 'utf8');
const branches = fs.readFileSync('./branches-pages.js', 'utf8');
const server = fs.readFileSync('./server.js', 'utf8');

let passed = 0;
let total = 0;
function test(name, ok) {
  total++;
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { console.log(`  ❌ ${name}`); }
}

const pages = [
  ['br-daily-operations', 'العمليات اليومية'],
  ['br-sales', 'المبيعات'],
  ['br-subscriptions', 'الاشتراكات'],
  ['br-training', 'التدريب'],
  ['br-customer-service', 'خدمة العملاء'],
  ['br-operational-reports', 'التقارير التشغيلية'],
  ['br-local-hr', 'الموارد البشرية المحلية'],
  ['br-operational-finance', 'المالية التشغيلية']
];

console.log('\n🧪 اختبار قسم الفروع\n');
test('قسم الفروع في القائمة', script.includes("id: 'branches-hub'") && script.includes("label: 'الفروع'"));
test('BranchesPages', branches.includes('window.BranchesPages'));
pages.forEach(([id, label]) => {
  test(`${label}`, script.includes(`id: '${id}'`) && branches.includes(`'${id}'`));
});
test('loadRoute br-', script.includes("route.startsWith('br-')") && script.includes('BranchesPages'));
test('مسارات /branches/', script.includes('/branches/daily-operations'));
test('server routes', server.includes("app.get('/branches/:section'"));

console.log(`\n📊 ${passed}/${total} نجح\n`);
process.exit(passed === total ? 0 : 1);
