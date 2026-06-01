const fs = require('fs');

console.log('🔍 التحقق من جميع الـ routes...\n');

// Read script.js
const scriptContent = fs.readFileSync('script.js', 'utf-8');

// 1. Find all route handlers (else if statements)
const routeHandlers = [];
const routeRegex = /else if \(route === '([^']+)'\)/g;
let match;
while ((match = routeRegex.exec(scriptContent)) !== null) {
    routeHandlers.push(match[1]);
}

console.log(`✅ وجدت ${routeHandlers.length} route handler\n`);

// 2. Check for duplicates
const duplicates = routeHandlers.filter((item, index) => routeHandlers.indexOf(item) !== index);
if (duplicates.length > 0) {
    console.log('❌ Routes مكررة:');
    duplicates.forEach(dup => console.log(`   - ${dup}`));
} else {
    console.log('✅ لا توجد routes مكررة');
}

// 3. Check Strategic Management routes
console.log('\n📊 Strategic Management Routes:');
const strategicRoutes = [
    'smart-systems',
    'subscription-management',
    'financial-approvals',
    'training-development',
    'quality-audit',
    'evaluation'
];

strategicRoutes.forEach(route => {
    const found = routeHandlers.includes(route);
    console.log(`   ${found ? '✅' : '❌'} ${route}`);
});

// 4. Check OHS routes
console.log('\n🏥 OHS Routes:');
const ohsRoutes = [
    'occupational-safety',
    'international-standards',
    'iso-standards',
    'risk-management',
    'consulting',
    'specialized-courses',
    'ohs-evaluation',
    'data-analysis'
];

ohsRoutes.forEach(route => {
    const found = routeHandlers.includes(route);
    console.log(`   ${found ? '✅' : '❌'} ${route}`);
});

// 5. Check sidebar menu items
console.log('\n📋 التحقق من القائمة الجانبية...');

// Find OHS submenu items
const ohsSubmenuMatch = scriptContent.match(/id: 'occupational-health'[\s\S]*?subItems: \[([\s\S]*?)\]/);
if (ohsSubmenuMatch) {
    const ohsSubItems = ohsSubmenuMatch[1];
    const itemRegex = /id: '([^']+)'/g;
    const ohsItems = [];
    while ((match = itemRegex.exec(ohsSubItems)) !== null) {
        ohsItems.push(match[1]);
    }
    
    console.log('   OHS Submenu Items:');
    ohsItems.forEach(item => {
        const hasHandler = routeHandlers.includes(item);
        console.log(`      ${hasHandler ? '✅' : '❌'} ${item}`);
    });
}

// Find Strategic Management submenu items
const strategicSubmenuMatch = scriptContent.match(/id: 'strategic-management'[\s\S]*?subItems: \[([\s\S]*?)\]/);
if (strategicSubmenuMatch) {
    const strategicSubItems = strategicSubmenuMatch[1];
    const itemRegex = /id: '([^']+)'/g;
    const strategicItems = [];
    while ((match = itemRegex.exec(strategicSubItems)) !== null) {
        strategicItems.push(match[1]);
    }
    
    console.log('\n   Strategic Management Submenu Items:');
    strategicItems.forEach(item => {
        const hasHandler = routeHandlers.includes(item);
        console.log(`      ${hasHandler ? '✅' : '❌'} ${item}`);
    });
}

// 6. Check for 'evaluation' conflicts
console.log('\n⚠️ فحص تعارض evaluation:');
const evaluationCount = routeHandlers.filter(r => r === 'evaluation').length;
const ohsEvaluationCount = routeHandlers.filter(r => r === 'ohs-evaluation').length;

console.log(`   - evaluation (Strategic): ${evaluationCount} ${evaluationCount === 1 ? '✅' : '❌'}`);
console.log(`   - ohs-evaluation (OHS): ${ohsEvaluationCount} ${ohsEvaluationCount === 1 ? '✅' : '❌'}`);

// 7. Check routeTitle map
console.log('\n📝 التحقق من routeTitle map...');
const routeTitleMatch = scriptContent.match(/const routeTitle = \(r\) => \{[\s\S]*?const map = \{([\s\S]*?)\};/);
if (routeTitleMatch) {
    const mapContent = routeTitleMatch[1];
    const hasEvaluation = mapContent.includes("'evaluation':");
    const hasOhsEvaluation = mapContent.includes("'ohs-evaluation':");
    
    console.log(`   ${hasEvaluation ? '✅' : '❌'} evaluation في routeTitle map`);
    console.log(`   ${hasOhsEvaluation ? '✅' : '❌'} ohs-evaluation في routeTitle map`);
}

console.log('\n✅ اكتمل الفحص!');
