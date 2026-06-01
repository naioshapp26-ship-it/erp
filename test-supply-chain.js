#!/usr/bin/env node
/**
 * اختبار نظام سلاسل التوريد
 * يتحقق من وجود جميع الدوال والمسارات المطلوبة
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 بدء اختبار نظام سلاسل التوريد...\n');

const scriptPath = path.join(__dirname, 'script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

let passedTests = 0;
let totalTests = 0;

// اختبار 1: التحقق من وجود القسم في القائمة الجانبية
console.log('📌 اختبار 1: التحقق من وجود قسم سلاسل التوريد في القائمة الجانبية');
totalTests++;
if (scriptContent.includes("id: 'supply-chain'") && 
    scriptContent.includes("label: 'سلاسل التوريد'") &&
    scriptContent.includes("icon: 'fa-truck-loading'")) {
    console.log('  ✅ PASSED - قسم سلاسل التوريد موجود في القائمة الجانبية\n');
    passedTests++;
} else {
    console.log('  ❌ FAILED - قسم سلاسل التوريد غير موجود\n');
}

// اختبار 2: التحقق من وجود جميع الأقسام الفرعية
console.log('📌 اختبار 2: التحقق من وجود جميع الأقسام الفرعية (11 قسم)');
const subItems = [
    { id: 'purchases', label: 'المشتريات' },
    { id: 'logistics', label: 'اللوجستيات والنقل والتوصيل' },
    { id: 'inventory', label: 'المخزون' },
    { id: 'suppliers', label: 'التعامل مع الموردين' },
    { id: 'orders-delivery', label: 'إدارة الطلبات والتسليم' },
    { id: 'smart-procurement', label: 'إدارة سلاسل التوريد والإمداد الذكي' },
    { id: 'manufacturing', label: 'التصنيع' },
    { id: 'product-lifecycle', label: 'حياة المنتج' },
    { id: 'maintenance', label: 'الصيانة' },
    { id: 'quality-control', label: 'مراقبة الجودة' },
    { id: 'safety', label: 'السلامة' }
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
    'renderPurchases',
    'renderLogistics',
    'renderInventory',
    'renderSuppliers',
    'renderOrdersDelivery',
    'renderSmartProcurement',
    'renderManufacturing',
    'renderProductLifecycle',
    'renderMaintenance',
    'renderQualityControl',
    'renderSafety'
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
    "else if (route === 'purchases')",
    "else if (route === 'logistics')",
    "else if (route === 'inventory')",
    "else if (route === 'suppliers')",
    "else if (route === 'orders-delivery')",
    "else if (route === 'smart-procurement')",
    "else if (route === 'manufacturing')",
    "else if (route === 'product-lifecycle')",
    "else if (route === 'maintenance')",
    "else if (route === 'quality-control')",
    "else if (route === 'safety')"
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
if (scriptContent.includes("'purchases': 'المشتريات'") &&
    scriptContent.includes("'logistics': 'اللوجستيات والنقل والتوصيل'") &&
    scriptContent.includes("'inventory': 'المخزون'")) {
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
    console.log('\n✨ جميع الاختبارات نجحت! نظام سلاسل التوريد جاهز للاستخدام.');
} else {
    console.log(`\n⚠️ ${totalTests - passedTests} اختبار(ات) فشل. يرجى مراجعة الكود.`);
}

console.log('\n' + '='.repeat(60));
console.log('📝 تفاصيل التطبيق:');
console.log('   - قسم رئيسي: سلاسل التوريد');
console.log('   - عدد الأقسام الفرعية: 11');
console.log('   - عدد الدوال: 11');
console.log('   - عدد المسارات: 11');
console.log('   - الأيقونة: fa-truck-loading');
console.log('='.repeat(60));

process.exit(passedTests === totalTests ? 0 : 1);
