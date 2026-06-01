'use strict';

/**
 * run-central-schema.js
 * المرحلة 0 — تشغيل مخطط قاعدة البيانات المركزية (Control-Plane)
 *
 * الاستخدام:
 *   node run-central-schema.js
 */

const db = require('./db');
const fs = require('fs');
const path = require('path');

async function runCentralSchema() {
  console.log('🚀 بدء تطبيق مخطط قاعدة البيانات المركزية (Phase 0)...');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'central-schema.sql'), 'utf8');
    await db.query(sql);
    console.log('✅ تم تطبيق central-schema.sql بنجاح.');

    // التحقق من الجداول المُنشأة
    const res = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'tenants', 'provisioning_logs', 'subscriptions',
          'platform_payment_settings', 'platform_payment_transactions',
          'platform_email_settings', 'platform_seo_settings',
          'platform_branding_settings', 'platform_settings',
          'general_content', 'tenant_admins'
        )
      ORDER BY table_name
    `);

    const found = res.rows.map(r => r.table_name);
    const expected = [
      'general_content', 'platform_branding_settings', 'platform_email_settings',
      'platform_payment_settings', 'platform_payment_transactions', 'platform_seo_settings',
      'platform_settings', 'provisioning_logs', 'subscriptions', 'tenant_admins', 'tenants'
    ];

    console.log('\n📊 الجداول الموجودة:');
    expected.forEach(t => {
      const exists = found.includes(t);
      console.log(`   ${exists ? '✅' : '❌'} ${t}`);
    });

    const missing = expected.filter(t => !found.includes(t));
    if (missing.length > 0) {
      console.error('\n⚠️ جداول مفقودة:', missing.join(', '));
      process.exit(1);
    }

    console.log('\n🎉 قاعدة البيانات المركزية جاهزة!');
    process.exit(0);
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    console.error(err);
    process.exit(1);
  }
}

runCentralSchema();
