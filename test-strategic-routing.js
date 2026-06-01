const fs = require('fs');

console.log('🔍 فحص توجيه الصفحات الاستراتيجية\n');

// Read script.js
const scriptContent = fs.readFileSync('script.js', 'utf8');

// Extract route definitions
const routeToPathMatch = scriptContent.match(/const routeToPath = \{([^}]+)\}/s);
const pathToRouteMatch = scriptContent.match(/const pathToRoute = \{([^}]+)\}/s);

console.log('📌 التحقق من التوجيه (Routing):\n');

// Strategic routes we care about
const strategicRoutes = [
    'executive-management',
    'smart-systems',
    'subscription-management',
    'training-development',
    'quality-audit',
    'evaluation',
    'information-center'
];

strategicRoutes.forEach(route => {
    // Check if render function exists
    const renderFuncPattern = new RegExp(`(const|function)\\s+render${route.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`, 'i');
    const hasRenderFunc = renderFuncPattern.test(scriptContent);
    
    // Check if route is in loadRoute switch
    const loadRoutePattern = new RegExp(`route === '${route}'`, 'g');
    const inLoadRoute = loadRoutePattern.test(scriptContent);
    
    // Check if it's in sidebar menu
    const sidebarPattern = new RegExp(`id:\\s*'${route}'`, 'g');
    const inSidebar = sidebarPattern.test(scriptContent);
    
    console.log(`${route}:`);
    console.log(`  ✓ دالة الرندر: ${hasRenderFunc ? '✅ موجودة' : '❌ غير موجودة'}`);
    console.log(`  ✓ في loadRoute: ${inLoadRoute ? '✅ نعم' : '❌ لا'}`);
    console.log(`  ✓ في القائمة الجانبية: ${inSidebar ? '✅ نعم' : '❌ لا'}`);
    console.log('');
});

// Check for render function implementations
console.log('\n📝 فحص محتوى دوال الرندر:\n');

const renderChecks = [
    { route: 'executive-management', func: 'renderExecutiveManagement', apis: ['executive-kpis', 'executive-goals', 'executive-operations'] },
    { route: 'smart-systems', func: 'renderSmartSystems', apis: ['digital-marketing', 'community-marketing', 'event-marketing'] },
    { route: 'subscription-management', func: 'renderSubscriptionManagement', apis: ['training-courses', 'skills'] }
];

renderChecks.forEach(check => {
    const funcMatch = scriptContent.match(new RegExp(`const ${check.func}[^{]*{([\\s\\S]*?)}\\s*;\\s*const render`, 'm'));
    if (funcMatch) {
        const funcBody = funcMatch[1];
        console.log(`${check.route} (${check.func}):`);
        
        // Check which APIs are called
        check.apis.forEach(api => {
            const hasAPI = funcBody.includes(`'${api}'`) || funcBody.includes(`"${api}"`) || funcBody.includes(`\`${api}\``);
            console.log(`  API /${api}: ${hasAPI ? '✅' : '❌'}`);
        });
        
        // Check for proper title
        const hasCorrectTitle = funcBody.includes(check.route.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
        console.log(`  عنوان صحيح: ${hasCorrectTitle ? '✅' : '❌'}`);
        console.log('');
    }
});

console.log('✅ الفحص اكتمل');
