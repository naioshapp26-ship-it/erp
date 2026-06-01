console.log('🧪 Testing Strategic Pages Functions...\n');

const fs = require('fs');
const scriptContent = fs.readFileSync('script.js', 'utf8');

const requiredFunctions = [
    'renderSmartSystems',
    'renderSubscriptionManagement', 
    'renderFinancialApprovals',
    'renderTrainingDevelopment',
    'renderQualityAudit',
    'renderEvaluation'
];

let allFound = true;

requiredFunctions.forEach(func => {
    const pattern = new RegExp(`const ${func}\\s*=`);
    if (pattern.test(scriptContent)) {
        console.log(`✅ ${func} - found`);
    } else {
        console.log(`❌ ${func} - NOT FOUND`);
        allFound = false;
    }
});

console.log('\n' + '='.repeat(50));
if (allFound) {
    console.log('✅ All strategic page functions exist!');
} else {
    console.log('❌ Some functions are missing!');
}

// Check for duplicate routes
console.log('\n🔍 Checking for duplicate routes...\n');

const routePattern = /else if \(route === '([^']+)'\)/g;
const routes = {};
let match;

while ((match = routePattern.exec(scriptContent)) !== null) {
    const route = match[1];
    if (routes[route]) {
        routes[route]++;
        console.log(`⚠️  Duplicate route found: '${route}' (appears ${routes[route]} times)`);
    } else {
        routes[route] = 1;
    }
}

const duplicates = Object.entries(routes).filter(([_, count]) => count > 1);
if (duplicates.length === 0) {
    console.log('✅ No duplicate routes found!');
} else {
    console.log(`\n❌ Found ${duplicates.length} duplicate routes`);
}

console.log('\n✅ Test completed!');
