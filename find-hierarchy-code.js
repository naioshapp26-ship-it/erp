#!/usr/bin/env node

/**
 * Find hierarchy code in script.js
 */

const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf8');
const lines = content.split('\n');

console.log('🔍 البحث عن كود الـ Hierarchy في script.js...\n');

// Search patterns
const patterns = [
    { name: 'hierarchy route', regex: /route\s*===?\s*['"']hierarchy['"]/ },
    { name: 'renderHierarchy function', regex: /function\s+renderHierarchy|renderHierarchy\s*[:=]\s*(async\s*)?\(/ },
    { name: 'hierarchy header', regex: /الهيكل\s*الهرمي|Hierarchy/i },
    { name: 'branches display', regex: /forEach.*branch|map.*branch.*incubator/i }
];

patterns.forEach(pattern => {
    console.log(`📌 ${pattern.name}:`);
    let found = false;
    
    lines.forEach((line, index) => {
        if (pattern.regex.test(line)) {
            console.log(`   Line ${index + 1}: ${line.trim().substring(0, 80)}`);
            found = true;
        }
    });
    
    if (!found) {
        console.log(`   ❌ لم يتم العثور على تطابق`);
    }
    console.log('');
});

console.log('✅ انتهى البحث');
