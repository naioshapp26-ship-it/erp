#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 اختبار نظام الخدمات');
console.log('==========================================\n');

let totalTests = 0;
let passedTests = 0;

// بيانات الأقسام الفرعية
const subItems = [
    { id: 'project-management-office', label: 'مكتب إدارة المشاريع', icon: 'fa-project-diagram' },
    { id: 'institutional-performance', label: 'إدارة الأداء المؤسسي', icon: 'fa-chart-line' },
    { id: 'operations-monitoring', label: 'متابعة العمليات', icon: 'fa-eye' },
    { id: 'ai-market-research', label: 'دراسة السوق عبر الذكاء الاصطناعي', icon: 'fa-brain' },
    { id: 'customer-service', label: 'خدمة العملاء', icon: 'fa-headset' },
    { id: 'client-admin-services', label: 'الخدمات الإدارية للعميل', icon: 'fa-user-cog' },
    { id: 'virtual-halls', label: 'القاعات الافتراضية', icon: 'fa-video' },
    { id: 'feasibility-studies', label: 'دراسات الجدوى', icon: 'fa-calculator' },
    { id: 'research', label: 'البحوث', icon: 'fa-search' },
    { id: 'consulting-training', label: 'الاستشارات والتدريب', icon: 'fa-chalkboard-teacher' }
];

// اختبار 1: التحقق من وجود القسم الرئيسي في القائمة
console.log('📌 اختبار 1: القسم الرئيسي في القائمة الجانبية');
totalTests++;
try {
    const scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf-8');
    
    if (scriptContent.includes("id: 'services'") && 
        scriptContent.includes("label: 'الخدمات'") &&
        scriptContent.includes("icon: 'fa-concierge-bell'")) {
        console.log('  ✅ القسم الرئيسي موجود\n');
        passedTests++;
    } else {
        console.log('  ❌ القسم الرئيسي غير موجود\n');
    }
} catch (error) {
    console.log('  ❌ خطأ في قراءة الملف\n');
}

// اختبار 2: التحقق من الأقسام الفرعية
console.log('📌 اختبار 2: الأقسام الفرعية الـ 10');
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
    'const renderProjectManagementOffice = () => {',
    'const renderInstitutionalPerformance = () => {',
    'const renderOperationsMonitoring = () => {',
    'const renderAIMarketResearch = () => {',
    'const renderCustomerService = () => {',
    'const renderClientAdminServices = () => {',
    'const renderVirtualHalls = () => {',
    'const renderFeasibilityStudies = () => {',
    'const renderResearch = () => {',
    'const renderConsultingTraining = () => {'
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
    "else if (route === 'project-management-office')",
    "else if (route === 'institutional-performance')",
    "else if (route === 'operations-monitoring')",
    "else if (route === 'ai-market-research')",
    "else if (route === 'customer-service')",
    "else if (route === 'client-admin-services')",
    "else if (route === 'virtual-halls')",
    "else if (route === 'feasibility-studies')",
    "else if (route === 'research')",
    "else if (route === 'consulting-training')"
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
    "'project-management-office': 'مكتب إدارة المشاريع'",
    "'institutional-performance': 'إدارة الأداء المؤسسي'",
    "'operations-monitoring': 'متابعة العمليات'",
    "'ai-market-research': 'دراسة السوق عبر الذكاء الاصطناعي'",
    "'customer-service': 'خدمة العملاء'",
    "'client-admin-services': 'الخدمات الإدارية للعميل'",
    "'virtual-halls': 'القاعات الافتراضية'",
    "'feasibility-studies': 'دراسات الجدوى'",
    "'research': 'البحوث'",
    "'consulting-training': 'الاستشارات والتدريب'"
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
