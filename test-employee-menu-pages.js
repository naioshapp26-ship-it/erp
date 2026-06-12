const fs = require('fs');
const script = fs.readFileSync('./script.js', 'utf8');
const server = fs.readFileSync('./server.js', 'utf8');

let passed = 0;
let total = 0;
function test(name, ok) {
  total++;
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { console.log(`  ❌ ${name}`); }
}

console.log('\n🧪 اختبار صفحات الموظف الجديدة\n');

test('الصفحات في القائمة بعد الطلبات', script.indexOf("label: 'الطلبات'") < script.indexOf("id: 'flexible-salary'"));
test('ليس في legacyHrRoutes', !script.includes("'flexible-salary',\n            'resignations'") || !/legacyHrRoutes[\s\S]*flexible-salary/.test(script));
test('renderFlexibleSalary غني', script.includes('مكونات الراتب المرن'));
test('renderResignations غني', script.includes('سجل الاستقالات'));
test('renderEmployeeSettlement غني', script.includes('تفاصيل التسوية'));
test('handleEmployeeMenuAction', script.includes('handleEmployeeMenuAction'));
test('مسارات /employee/', script.includes('/employee/flexible-salary'));
test('server routes', server.includes("app.get('/employee/:section'"));

console.log(`\n📊 ${passed}/${total} نجح\n`);
process.exit(passed === total ? 0 : 1);
