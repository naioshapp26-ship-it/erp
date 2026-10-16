'use strict';

/**
 * Phase 3 — lightweight provisioning safety checks (non-destructive).
 * Validates inputs before calling tenant-provisioner; does not drop data.
 */

const db = require('./db');

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

async function validateProvisionRequest(input = {}) {
  const errors = [];
  const subdomain = String(input.subdomain || '').trim().toLowerCase();
  const companyName = String(input.companyName || input.company_name || '').trim();
  const plan = String(input.plan || input.subscription_plan || 'basic').trim().toLowerCase();
  const adminEmail = String(input.adminEmail || input.admin_email || '').trim().toLowerCase();
  const adminPassword = String(input.adminPassword || input.admin_password || '');

  if (!subdomain || !SUBDOMAIN_RE.test(subdomain)) {
    errors.push('النطاق الفرعي غير صالح (أحرف صغيرة وأرقام وشرطات فقط).');
  }
  if (['www', 'api', 'admin', 'mail', 'ftp', 'localhost'].includes(subdomain)) {
    errors.push('النطاق الفرعي محجوز.');
  }
  if (!companyName || companyName.length < 2) {
    errors.push('اسم الشركة مطلوب.');
  }
  if (!adminEmail || !adminEmail.includes('@')) {
    errors.push('بريد مسؤول الشركة مطلوب.');
  }
  if (!adminPassword || adminPassword.length < 8) {
    errors.push('كلمة مرور المسؤول يجب ألا تقل عن 8 أحرف (تُمرَّر عند الإنشاء فقط).');
  }

  // Plan must exist when Platform Owner schema is available
  try {
    const owner = require('./platform-owner-service');
    await owner.ensureSchema();
    const planRow = await owner.getPlan(plan);
    if (!planRow || !planRow.is_active) {
      errors.push('الباقة غير موجودة أو غير مفعّلة.');
    }
  } catch {
    if (!['basic', 'pro', 'enterprise'].includes(plan)) {
      errors.push('خطة الاشتراك غير صالحة.');
    }
  }

  if (subdomain) {
    const existing = await db.query(
      `SELECT id, status FROM tenants WHERE subdomain = $1 AND status != 'deleted' LIMIT 1`,
      [subdomain]
    );
    if (existing.rows.length) {
      errors.push('النطاق الفرعي مستخدم بالفعل.');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      subdomain,
      companyName,
      plan,
      adminEmail,
      adminPassword,
      adminName: String(input.adminName || input.admin_name || 'Company Admin').trim()
    }
  };
}

/**
 * Soft preflight used by Platform Owner create-company path.
 * Never drops databases; never deletes tenant rows.
 */
async function safeProvisionTenant(input) {
  const check = await validateProvisionRequest(input);
  if (!check.ok) {
    const err = new Error(check.errors.join(' · '));
    err.status = 400;
    err.errors = check.errors;
    throw err;
  }
  const { provisionTenant } = require('./tenant-provisioner');
  return provisionTenant(check.normalized);
}

module.exports = {
  SUBDOMAIN_RE,
  validateProvisionRequest,
  safeProvisionTenant
};
