/**
 * اختبار تسجيل الدخول محلياً على السيرفر (يتجاوز Apache/Betacademy)
 * Usage: node test-login-local.js [email] [password]
 */
require('dotenv').config();
const http = require('http');

const email = process.argv[2] || 'ahmed@nayosh.com';
const password = process.argv[3] || 'test123';
const port = Number(process.env.PORT) || 3000;
const body = JSON.stringify({ email, password });

const req = http.request(
  {
    hostname: '127.0.0.1',
    port,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('HTTP', res.statusCode);
      console.log('X-Auth-Api-Build:', res.headers['x-auth-api-build'] || '(none)');
      console.log('X-Naiosh-Api:', res.headers['x-naiosh-api'] || '(none)');
      console.log(data.slice(0, 800));
    });
  }
);

req.on('error', (err) => {
  console.error('❌ لا يمكن الاتصال بالمنفذ', port, '- هل Node شغال؟', err.message);
  console.error('   جرّب: grep "نظام نايوش يعمل" stderr.log');
  process.exit(1);
});

req.write(body);
req.end();
