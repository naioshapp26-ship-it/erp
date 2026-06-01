const fs = require('fs');

console.log('📋 فحص صفحة المخطط التنفيذي...\n');

const html = fs.readFileSync('./finance/system-blueprint-execution.html', 'utf8');

const checks = [
    { name: 'زر إضافة عميل', pattern: 'إضافة عميل', function: 'addCustomer()' },
    { name: 'زر إضافة فاتورة', pattern: 'إضافة فاتورة', function: 'addInvoice()' },
    { name: 'زر إضافة مدفوعة', pattern: 'إضافة مدفوعة', function: 'addPayment()' },
    { name: 'زر إضافة خطة', pattern: 'إضافة خطة', function: 'addPlan()' },
    { name: 'وظيفة المعاينة', pattern: 'viewRecord', function: 'viewRecord' },
    { name: 'وظيفة التعديل', pattern: 'editRecord', function: 'editRecord' },
    { name: 'وظيفة الحذف', pattern: 'deleteRecord', function: 'deleteRecord' },
    { name: 'عمود الإجراءات', pattern: 'الإجراءات', function: '<th' },
    { name: 'أيقونة المعاينة', pattern: 'fa-eye', function: 'fas' },
    { name: 'أيقونة التعديل', pattern: 'fa-edit', function: 'fas' },
    { name: 'أيقونة الحذف', pattern: 'fa-trash', function: 'fas' },
    { name: 'ربط entity_id', pattern: 'getFinanceEntityId', function: 'window' },
    { name: 'ربط API_HEADERS', pattern: 'API_HEADERS', function: 'headers' }
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
    const exists = html.includes(check.pattern) && html.includes(check.function);
    if (exists) {
        console.log(`✅ ${check.name}`);
        passed++;
    } else {
        console.log(`❌ ${check.name}`);
        failed++;
    }
});

console.log(`\n📊 النتيجة: ${passed}/${checks.length} نجح`);

if (failed === 0) {
    console.log('✅ جميع الفحوصات نجحت!');
    process.exit(0);
} else {
    console.log(`⚠️  ${failed} فحص فشل`);
    process.exit(1);
}
