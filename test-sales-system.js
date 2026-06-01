#!/usr/bin/env node
/**
 * اختبار نظام البيع
 * يتحقق من وجود جميع الدوال والمسارات المطلوبة
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 بدء اختبار نظام البيع...\n');

const scriptPath = path.join(__dirname, 'script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

let passedTests = 0;
let totalTests = 0;

// اختبار 1: التحقق من وجود القسم في القائمة الجانبية
console.log('📌 اختبار 1: التحقق من وجود قسم البيع في القائمة الجانبية');
totalTests++;
if (scriptContent.includes("id: 'sales'") && 
    scriptContent.includes("label: 'البيع'") &&
    scriptContent.includes("icon: 'fa-chart-line'")) {
    console.log('  ✅ PASSED - قسم البيع موجود في القائمة الجانبية\n');
    passedTests++;
} else {
    console.log('  ❌ FAILED - قسم البيع غير موجود\n');
}

// اختبار 2: التحقق من وجود جميع الأقسام الفرعية
console.log('📌 اختبار 2: التحقق من وجود جميع الأقسام الفرعية (6 أقسام)');
const subItems = [
    { id: 'crm', label: 'نظام إدارة علاقات العملاء CRM' },
    { id: 'sales-operations', label: 'إدارة عمليات البيع' },
    { id: 'pos', label: 'نظام نقاط البيع التشابكي' },
    { id: 'quotes-contracts', label: 'العروض والعقود' },
    { id: 'commissions', label: 'نظام العمولات' },
    { id: 'order-tracking', label: 'تتبع الطلبات والشحنات' }
];

let allSubItemsFound = true;
subItems.forEach((item) => {
    totalTests++;
    if (scriptContent.includes(`id: '${item.id}'`) && scriptContent.includes(item.label)) {
        console.log(`  ✅ ${item.label} - موجود`);
        passedTests++;
    } else {
        console.log(`  ❌ ${item.label} - غير موجود`);
        allSubItemsFound = false;
    }
});

if (allSubItemsFound) {
    console.log('  ✅ جميع الأقسام الفرعية موجودة\n');
} else {
    console.log('  ⚠️ بعض الأقسام الفرعية غير موجودة\n');
}

// اختبار 3: التحقق من وجود دوال العرض
console.log('📌 اختبار 3: التحقق من وجود دوال العرض');
const renderFunctions = [
    'renderCRM',
    'renderSalesOperations',
    'renderPOS',
    'renderQuotesContracts',
    'renderCommissions',
    'renderOrderTracking'
];

let allFunctionsFound = true;
renderFunctions.forEach((func) => {
    totalTests++;
    if (scriptContent.includes(`const ${func} = () => {`) || scriptContent.includes(`function ${func}()`)) {
        console.log(`  ✅ ${func}() - موجودة`);
        passedTests++;
    } else {
        console.log(`  ❌ ${func}() - غير موجودة`);
        allFunctionsFound = false;
    }
});

if (allFunctionsFound) {
    console.log('  ✅ جميع دوال العرض موجودة\n');
} else {
    console.log('  ⚠️ بعض دوال العرض غير موجودة\n');
}

// اختبار 4: التحقق من المسارات في loadRoute
console.log('📌 اختبار 4: التحقق من المسارات في loadRoute');
const routes = [
    "else if (route === 'crm')",
    "else if (route === 'sales-operations')",
    "else if (route === 'pos')",
    "else if (route === 'quotes-contracts')",
    "else if (route === 'commissions')",
    "else if (route === 'order-tracking')"
];

let allRoutesFound = true;
routes.forEach((route, index) => {
    totalTests++;
    if (scriptContent.includes(route)) {
        console.log(`  ✅ مسار ${subItems[index].label} - موجود`);
        passedTests++;
    } else {
        console.log(`  ❌ مسار ${subItems[index].label} - غير موجود`);
        allRoutesFound = false;
    }
});

if (allRoutesFound) {
    console.log('  ✅ جميع المسارات موجودة في loadRoute\n');
} else {
    console.log('  ⚠️ بعض المسارات غير موجودة\n');
}

// اختبار 5: التحقق من العناوين في getTitle
console.log('📌 اختبار 5: التحقق من العناوين في getTitle');
totalTests++;
if (scriptContent.includes("'crm': 'نظام إدارة علاقات العملاء CRM'") &&
    scriptContent.includes("'sales-operations': 'إدارة عمليات البيع'") &&
    scriptContent.includes("'pos': 'نظام نقاط البيع التشابكي'")) {
    console.log('  ✅ PASSED - العناوين موجودة في getTitle\n');
    passedTests++;
} else {
    console.log('  ❌ FAILED - بعض العناوين غير موجودة\n');
}

// النتيجة النهائية
console.log('\n' + '='.repeat(60));
console.log('📊 ملخص الاختبار');
console.log('='.repeat(60));
console.log(`✅ اختبارات نجحت: ${passedTests}/${totalTests}`);
console.log(`${passedTests === totalTests ? '🎉' : '⚠️'} نسبة النجاح: ${((passedTests/totalTests) * 100).toFixed(2)}%`);

if (passedTests === totalTests) {
    console.log('\n✨ جميع الاختبارات نجحت! نظام البيع جاهز للاستخدام.');
} else {
    console.log(`\n⚠️ ${totalTests - passedTests} اختبار(ات) فشل. يرجى مراجعة الكود.`);
}

console.log('\n' + '='.repeat(60));
console.log('📝 تفاصيل التطبيق:');
console.log('   - قسم رئيسي: البيع');
console.log('   - عدد الأقسام الفرعية: 6');
console.log('   - عدد الدوال: 6');
console.log('   - عدد المسارات: 6');
console.log('   - الأيقونة: fa-chart-line');
console.log('='.repeat(60));

process.exit(passedTests === totalTests ? 0 : 1);
