/**
 * يتحقق أن الملفات الأساسية تُحمّل بدون تشغيل السيرفر
 */
require('dotenv').config();

const steps = [
  ['db.js', () => require('../db')],
  ['auth-api.js', () => require('../auth-api')],
  ['server.js syntax', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    if (!src.includes('listenPort')) throw new Error('listenPort missing in server.js');
  }]
];

(async () => {
  for (const [name, fn] of steps) {
    process.stdout.write(`→ ${name} ... `);
    await fn();
    console.log('OK');
  }
  console.log('\n✅ كل الوحدات تُحمّل — المشكلة غالباً Passenger أو التطبيق متوقف.');
})().catch((err) => {
  console.error('\n❌', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
