const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'super-admin-api.js'), 'utf8');

const requiredPatterns = [
    { label: 'database-backed hero image persistence', pattern: /saveHomepagePersistentAsset/ },
    { label: 'public homepage media asset route helper', pattern: /serveHomepageMediaAsset/ },
    { label: 'persist homepage images through shared media helper', pattern: /persistHomepageImageFile/ },
    { label: 'hero image upload uses persistent storage', pattern: /storageWarning \|\| 'تم رفع صورة الـ Hero بنجاح — لن تختفي إلا عند حذفها من الإعدادات'/ },
    { label: 'public payload keeps database-backed media', pattern: /isDatabaseBackedHomepageMediaUrl\(item\.url\)/ }
];

let failed = 0;
for (const check of requiredPatterns) {
    if (!check.pattern.test(source)) {
        console.error(`FAIL: missing ${check.label}`);
        failed += 1;
    } else {
        console.log(`OK: ${check.label}`);
    }
}

const serverSource = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
if (!/app\.get\('\/api\/homepage-media\/asset\/:id', serveHomepageMediaAsset\)/.test(serverSource)) {
    console.error('FAIL: server.js missing public homepage media route');
    failed += 1;
} else {
    console.log('OK: server.js public homepage media route');
}

const homepageHtml = fs.readFileSync(path.join(__dirname, 'newhome', 'index.html'), 'utf8');
if (homepageHtml.includes('%D8%B5%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9.png')) {
    console.error('FAIL: newhome/index.html still references missing default tour image');
    failed += 1;
} else {
    console.log('OK: newhome/index.html tour fallback image fixed');
}

assert.strictEqual(failed, 0, `${failed} homepage media persistence checks failed`);
console.log('All homepage media persistence checks passed.');
