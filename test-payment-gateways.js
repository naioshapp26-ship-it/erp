const fs = require('fs');
const path = require('path');

const files = {
  bootstrap: fs.readFileSync(path.join(__dirname, 'payment/bootstrap.js'), 'utf8'),
  envSeed: fs.readFileSync(path.join(__dirname, 'payment/env-seed.js'), 'utf8'),
  routes: fs.readFileSync(path.join(__dirname, 'payment/routes.js'), 'utf8'),
  confirm: fs.readFileSync(path.join(__dirname, 'payment/confirm-service.js'), 'utf8'),
  webhooks: fs.readFileSync(path.join(__dirname, 'payment/webhooks.js'), 'utf8'),
  creditTopup: fs.readFileSync(path.join(__dirname, 'credit-topup.html'), 'utf8'),
  tenantSettings: fs.readFileSync(path.join(__dirname, 'tenant-payment-settings.html'), 'utf8'),
};

const checks = [
  { name: 'env seed module exists', ok: files.envSeed.includes('seedPlatformPaymentFromEnv') },
  { name: 'bootstrap calls env seed', ok: files.bootstrap.includes('seedPlatformPaymentFromEnv') },
  { name: 'stripe env vars supported', ok: /PLATFORM_STRIPE_PUBLIC_KEY/.test(files.envSeed) },
  { name: 'paypal env vars supported', ok: /PLATFORM_PAYPAL_CLIENT_ID/.test(files.envSeed) },
  { name: 'paymob env vars supported', ok: /PLATFORM_PAYMOB_PUBLIC_KEY/.test(files.envSeed) },
  { name: 'confirm session route', ok: /credits\/confirm-session/.test(files.routes) },
  { name: 'confirm demo route', ok: /credits\/confirm-demo/.test(files.routes) },
  { name: 'gateways list route', ok: /router\.get\('\/gateways'/.test(files.routes) },
  { name: 'demo checkout fallback', ok: files.routes.includes('demo-${Date.now()}') },
  { name: 'confirm service stripe', ok: files.confirm.includes('confirmStripeSession') },
  { name: 'confirm service paypal', ok: files.confirm.includes('confirmPayPalOrder') },
  { name: 'paypal webhook credit topup', ok: files.webhooks.includes("metadata.payment_type === 'credit_topup'") },
  { name: 'paymob webhook credit topup', ok: files.webhooks.includes('platform_payment_transactions') },
  { name: 'credit topup confirm session UI', ok: files.creditTopup.includes('confirm-session') },
  { name: 'credit topup demo box', ok: files.creditTopup.includes('confirmDemoPayment') },
  { name: 'tenant settings test buttons', ok: files.tenantSettings.includes('testTenant') },
  { name: 'all three gateways in credit topup', ok: ['stripe', 'paypal', 'paymob'].every((p) => files.creditTopup.includes(p)) },
];

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error('❌ Payment gateway validation failed');
  failed.forEach((c) => console.error(`   Missing: ${c.name}`));
  process.exit(1);
}

console.log(`✅ Payment gateway validation passed (${checks.length} checks)`);
