const fs = require('fs');

const script = fs.readFileSync('./script.js', 'utf8');
const pages = fs.readFileSync('./education-incubators-pages.js', 'utf8');

let passed = 0;
let total = 0;

function test(name, ok) {
  total++;
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { console.log(`  ❌ ${name}`); }
}

console.log('\n🧪 اختبار حاضنات التعليم والتدريب\n');

test('قسم القائمة الجانبية', script.includes("id: 'education-training-incubators'") && script.includes("label: 'حاضنات التعليم والتدريب'"));
test('حاضنة السلامة والصحة المهنية', script.includes("id: 'eti-ohs'") && script.includes('حاضنة السلامة والصحة المهنية'));
test('حاضنة سلاسل الإمداد', script.includes("id: 'eti-supply-chain'"));
test('حضانة إدارة المرافق', script.includes("id: 'eti-facilities'"));
test('حاضنة اللوجستيات', script.includes("id: 'eti-logistics'"));
test('حاضنة إدارة المشاريع', script.includes("id: 'eti-project-management'"));
test('حاضنة HR', script.includes("id: 'eti-hr'"));
test('مسار loadRoute الرئيسي', script.includes("route === 'education-training-incubators'"));
test('مسار loadRoute الفرعي', script.includes("route.startsWith('eti-')"));
test('EducationIncubatorsPages', pages.includes('window.EducationIncubatorsPages'));
test('صفحة Hub بالبطاقات', pages.includes('renderHub') && pages.includes('data-eti-hub'));
test('6 بطاقات حاضنة', (pages.match(/HUB_CARDS/g) || []).length >= 1 && pages.includes('eti-ohs') && pages.includes('eti-hr'));
test('بيانات دسمة - 6 صفحات', Object.keys({
  'eti-ohs': 1, 'eti-supply-chain': 1, 'eti-facilities': 1,
  'eti-logistics': 1, 'eti-project-management': 1, 'eti-hr': 1
}).every((k) => pages.includes(`'${k}'`)));

console.log(`\n📊 ${passed}/${total} نجح\n`);
process.exit(passed === total ? 0 : 1);
