#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 اختبار نظام السلامة والصحة المهنية');
console.log('==========================================\n');

let totalTests = 0;
let passedTests = 0;

// بيانات الأقسام الفرعية
const subItems = [
    { id: 'occupational-safety', label: 'السلامة المهنية', icon: 'fa-shield-alt' },
    { id: 'international-standards', label: 'المعايير الدولية', icon: 'fa-globe' },
    { id: 'iso-standards', label: 'الايزو', icon: 'fa-certificate' },
    { id: 'risk-management', label: 'إدارة المخاطر', icon: 'fa-exclamation-triangle' },
    { id: 'consulting', label: 'الإستشارات', icon: 'fa-user-tie' },
    { id: 'specialized-courses', label: 'الدورات التخصصية', icon: 'fa-graduation-cap' },
    { id: 'evaluation', label: 'التقييم - شركات، مصانع، مشاريع', icon: 'fa-clipboard-check' },
    { id: 'data-analysis', label: 'تحليل البيانات', icon: 'fa-chart-bar' }
];

// اختبار 1: التحقق من وجود القسم الرئيسي في القائمة
console.log('📌 اختبار 1: القسم الرئيسي في القائمة الجانبية');
totalTests++;
try {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf-8');
    
    if (scriptContent.includes("id: 'occupational-health'") && 
        scriptContent.includes("label: 'السلامة والصحة المهنية'") &&
        scriptContent.includes("icon: 'fa-hard-hat'")) {
        console.log('  ✅ القسم الرئيسي موجود\n');
        passedTests++;
    } else {
        console.log('  ❌ القسم الرئيسي غير موجود\n');
    }
} catch (error) {
    console.log('  ❌ خطأ في قراءة الملف\n');
}

// اختبار 2: التحقق من الأقسام الفرعية
console.log('📌 اختبار 2: الأقسام الفرعية الـ 8');
const scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf-8');
let allSubItemsFound = true;

subItems.forEach(item => {
    totalTests++;
    if (scriptContent.includes(`id: '${item.id}'`) && 
        scriptContent.includes(`label: '${item.label}'`) &&
        scriptContent.includes(`icon: '${item.icon}'`)) {
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

// اختبار 3: التحقق من دوال العرض
console.log('📌 اختبار 3: دوال العرض (Render Functions)');
const renderFunctions = [
    'const renderOccupationalSafety = () => {',
    'const renderInternationalStandards = () => {',
    'const renderISOStandards = () => {',
    'const renderRiskManagement = () => {',
    'const renderConsulting = () => {',
    'const renderSpecializedCourses = () => {',
    'const renderOHSEvaluation = () => {',
    'const renderDataAnalysis = () => {'
];

let allFunctionsFound = true;
renderFunctions.forEach((func, index) => {
    totalTests++;
    if (scriptContent.includes(func)) {
        console.log(`  ✅ ${subItems[index].label} - موجودة`);
        passedTests++;
    } else {
        console.log(`  ❌ ${subItems[index].label} - غير موجودة`);
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
    "else if (route === 'occupational-safety')",
    "else if (route === 'international-standards')",
    "else if (route === 'iso-standards')",
    "else if (route === 'risk-management')",
    "else if (route === 'consulting')",
    "else if (route === 'specialized-courses')",
    "else if (route === 'evaluation')",
    "else if (route === 'data-analysis')"
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
const titles = [
    "'occupational-safety': 'السلامة المهنية'",
    "'international-standards': 'المعايير الدولية'",
    "'iso-standards': 'الايزو'",
    "'risk-management': 'إدارة المخاطر'",
    "'consulting': 'الإستشارات'",
    "'specialized-courses': 'الدورات التخصصية'",
    "'evaluation': 'التقييم - شركات، مصانع، مشاريع'",
    "'data-analysis': 'تحليل البيانات'"
];

let allTitlesFound = titles.every(title => scriptContent.includes(title));
if (allTitlesFound) {
    console.log('  ✅ جميع العناوين موجودة في getTitle\n');
    passedTests++;
} else {
    console.log('  ❌ بعض العناوين غير موجودة في getTitle\n');
}

// النتيجة النهائية
console.log('\n==========================================');
console.log(`📊 النتيجة النهائية: ${passedTests}/${totalTests} اختبار نجح`);
if (passedTests === totalTests) {
    console.log('✅ جميع الاختبارات نجحت!');
} else {
    console.log(`⚠️ ${totalTests - passedTests} اختبار فشل`);
}
console.log('==========================================\n');

process.exit(passedTests === totalTests ? 0 : 1);
