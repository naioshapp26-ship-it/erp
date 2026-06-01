const fs = require('fs');

console.log('\n' + '='.repeat(60));
console.log('🧪 اختبار نظام الإنترنت والأتمتة');
console.log('='.repeat(60) + '\n');

// قراءة ملف script.js
const scriptContent = fs.readFileSync('./script.js', 'utf8');

let totalTests = 0;
let passedTests = 0;

// اختبار 1: التحقق من وجود قسم "الإنترنت والأتمتة" في القائمة الجانبية
console.log('📌 اختبار 1: التحقق من القسم الرئيسي في القائمة');
totalTests++;
if (scriptContent.includes("id: 'internet-automation'") && 
    scriptContent.includes("label: 'الإنترنت والأتمتة'") &&
    scriptContent.includes("icon: 'fa-robot'")) {
    console.log('  ✅ PASSED - قسم الإنترنت والأتمتة موجود في القائمة الجانبية\n');
    passedTests++;
} else {
    console.log('  ❌ FAILED - قسم الإنترنت والأتمتة غير موجود\n');
}

// اختبار 2: التحقق من الأقسام الفرعية العشرة
console.log('📌 اختبار 2: التحقق من الأقسام الفرعية (10 صفحات)');
const subItems = [
    { id: 'ai-integration', label: 'الذكاء الإصطناعي' },
    { id: 'governance', label: 'الحوكمة' },
    { id: 'compliance', label: 'الموائمة' },
    { id: 'iot', label: 'انترنت الأشياء' },
    { id: 'elearning', label: 'التعلم الإلكتروني' },
    { id: 'forum', label: 'المنتدى' },
    { id: 'etiquette', label: 'الإتيكيت وبروتوكولات التواصل' },
    { id: 'knowledge', label: 'المعرفة والتحليل' },
    { id: 'intellectual-property', label: 'الملكية الفكرية' },
    { id: 'visitor-chat', label: 'الدردشة مع الزوار' }
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
    'renderAIIntegration',
    'renderGovernance',
    'renderCompliance',
    'renderIOT',
    'renderELearning',
    'renderForum',
    'renderEtiquette',
    'renderKnowledge',
    'renderIntellectualProperty',
    'renderVisitorChat'
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
    "else if (route === 'ai-integration')",
    "else if (route === 'governance')",
    "else if (route === 'compliance')",
    "else if (route === 'iot')",
    "else if (route === 'elearning')",
    "else if (route === 'forum')",
    "else if (route === 'etiquette')",
    "else if (route === 'knowledge')",
    "else if (route === 'intellectual-property')",
    "else if (route === 'visitor-chat')"
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
if (scriptContent.includes("'ai-integration': 'الذكاء الإصطناعي'") &&
    scriptContent.includes("'governance': 'الحوكمة'") &&
    scriptContent.includes("'iot': 'انترنت الأشياء'") &&
    scriptContent.includes("'visitor-chat': 'الدردشة مع الزوار'")) {
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
console.log(`❌ اختبارات فشلت: ${totalTests - passedTests}/${totalTests}`);
console.log(`📈 نسبة النجاح: ${((passedTests/totalTests)*100).toFixed(1)}%`);
console.log('='.repeat(60));

if (passedTests === totalTests) {
    console.log('\n✨ جميع الاختبارات نجحت! نظام الإنترنت والأتمتة جاهز للاستخدام\n');
} else {
    console.log('\n⚠️  بعض الاختبارات فشلت. يرجى المراجعة.\n');
}

console.log('📋 التفاصيل:');
console.log('   - عدد الأقسام الفرعية: 10');
console.log('   - عدد الدوال: 10');
console.log('   - عدد المسارات: 10');
console.log('   - الأيقونة: fa-robot');
console.log('='.repeat(60));

process.exit(passedTests === totalTests ? 0 : 1);
