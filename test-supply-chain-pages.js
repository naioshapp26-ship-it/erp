const fs = require('fs');
const script = fs.readFileSync('./script.js', 'utf8');

let passed = 0;
let total = 0;

function test(name, ok) {
  total++;
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { console.log(`  ❌ ${name}`); }
}

console.log('\n🧪 اختبار صفحات سلاسل التوريد الجديدة\n');

test('مواصفات ومقايس في القائمة', script.includes("id: 'specs-estimates'") && script.includes('مواصفات ومقايس'));
test('تخليص جمركي في القائمة', script.includes("id: 'customs-clearance'") && script.includes('تخليص جمركي'));
test('renderSpecsEstimates', script.includes('const renderSpecsEstimates = () =>'));
test('renderCustomsClearance', script.includes('const renderCustomsClearance = () =>'));
test('مسار loadRoute مواصفات', script.includes("route === 'specs-estimates'"));
test('مسار loadRoute جمركي', script.includes("route === 'customs-clearance'"));
test('officeRouteParents', script.includes("'specs-estimates': 'supply-chain'") && script.includes("'customs-clearance': 'supply-chain'"));
test('pathToRoute', script.includes("'/supply-chain/specs-estimates'") && script.includes("'/supply-chain/customs-clearance'"));
test('أزرار مواصفات شغالة', script.includes("handleSupplyChainAction('specs-estimates'"));
test('أزرار جمركي شغالة', script.includes("handleSupplyChainAction('customs-clearance'"));
test('حقول نموذج مواصفات', script.includes("section === 'specs-estimates'"));
test('حقول نموذج جمركي', script.includes("section === 'customs-clearance'"));

console.log(`\n📊 ${passed}/${total} نجح\n`);
process.exit(passed === total ? 0 : 1);
