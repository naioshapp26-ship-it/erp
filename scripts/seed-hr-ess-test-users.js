#!/usr/bin/env node
'use strict';

/**
 * Seed isolated HR ESS test users (employee + manager + hr_admin) with known passwords.
 * Safe for local/dev — does not touch production.
 */
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://vendowor_erp_user:vendowor_local_dev@127.0.0.1:5432/vendowor_erp';

const USERS = [
  {
    email: 'hr-employee@test.local',
    name: 'موظف اختبار الخدمة الذاتية',
    role: 'EMPLOYEE',
    tenant_type: 'HQ',
    entity_id: 'HQ001',
    password: 'Employee@123'
  },
  {
    email: 'hr-manager@test.local',
    name: 'مدير مباشر اختبار',
    role: 'MANAGER',
    tenant_type: 'HQ',
    entity_id: 'HQ001',
    password: 'Manager@123'
  },
  {
    email: 'hr-admin@test.local',
    name: 'مسؤول موارد بشرية اختبار',
    role: 'HR_MANAGER',
    tenant_type: 'HQ',
    entity_id: 'HQ001',
    password: 'HrAdmin@123'
  },
  {
    email: 'hr-company-admin@test.local',
    name: 'مسؤول شركة اختبار HR',
    role: 'company_admin',
    tenant_type: 'HQ',
    entity_id: 'HQ001',
    password: 'Company@123'
  }
];

async function upsertUser(pool, user) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
  let userId;
  if (existing.rows.length) {
    userId = existing.rows[0].id;
    await pool.query(
      `UPDATE users
       SET name = $1, role = $2, tenant_type = $3, entity_id = $4, is_active = true, updated_at = NOW()
       WHERE id = $5`,
      [user.name, user.role, user.tenant_type, user.entity_id, userId]
    );
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (name, email, role, tenant_type, entity_id, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [user.name, user.email, user.role, user.tenant_type, user.entity_id]
    );
    userId = inserted.rows[0].id;
  }

  const hash = await bcrypt.hash(user.password, 10);
  await pool.query(
    `INSERT INTO user_credentials (user_id, username, password_hash, is_active, failed_attempts)
     VALUES ($1, $2, $3, true, 0)
     ON CONFLICT (user_id) DO UPDATE
       SET username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           is_active = true,
           failed_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()`,
    [userId, user.email, hash]
  );

  return userId;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });
  try {
    for (const user of USERS) {
      const id = await upsertUser(pool, user);
      console.log(`ok ${user.email} id=${id} role=${user.role}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
