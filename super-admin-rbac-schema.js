'use strict';

const DEFAULT_SUPER_ADMIN_ROLES = [
  {
    name: 'SUPER_ADMIN',
    name_ar: 'المسؤول العام',
    description: 'Full platform super administrator',
    level: 'HQ',
    hierarchy_level: 0,
    job_title_ar: 'المسؤول العام',
    job_title_en: 'Super Admin',
    is_system: true
  },
  {
    name: 'BRANCH_MANAGER',
    name_ar: 'مدير فرع',
    description: 'Branch Manager',
    level: 'BRANCH',
    hierarchy_level: 1,
    job_title_ar: 'مدير فرع',
    job_title_en: 'Branch Manager',
    is_system: true
  },
  {
    name: 'INCUBATOR_MANAGER',
    name_ar: 'مدير حاضنة',
    description: 'Incubator Manager',
    level: 'INCUBATOR',
    hierarchy_level: 2,
    job_title_ar: 'مدير حاضنة',
    job_title_en: 'Incubator Manager',
    is_system: true
  },
  {
    name: 'PLATFORM_MANAGER',
    name_ar: 'مدير منصة',
    description: 'Platform Manager',
    level: 'PLATFORM',
    hierarchy_level: 3,
    job_title_ar: 'مدير منصة',
    job_title_en: 'Platform Manager',
    is_system: true
  },
  {
    name: 'EXECUTIVE_OFFICE_MANAGER',
    name_ar: 'مسؤول تنفيذي مكاتب',
    description: 'Executive Office Manager',
    level: 'OFFICE',
    hierarchy_level: 4,
    job_title_ar: 'مسؤول تنفيذي مكاتب',
    job_title_en: 'Executive Office Manager',
    is_system: true
  },
  {
    name: 'EMPLOYEE',
    name_ar: 'موظف',
    description: 'Regular Employee',
    level: 'OFFICE',
    hierarchy_level: 4,
    job_title_ar: 'موظف',
    job_title_en: 'Employee',
    is_system: true
  }
];

async function ensureSuperAdminRbacSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      name_ar VARCHAR(100),
      description TEXT,
      level VARCHAR(20),
      hierarchy_level INTEGER DEFAULT 0,
      job_title_ar VARCHAR(200),
      job_title_en VARCHAR(200),
      min_approval_limit NUMERIC(15,2) DEFAULT 0,
      max_approval_limit NUMERIC(15,2),
      approval_notes_ar TEXT,
      approval_notes_en TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      is_system BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS name_ar VARCHAR(100)`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS level VARCHAR(20)`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS job_title_ar VARCHAR(200)`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS job_title_en VARCHAR(200)`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS min_approval_limit NUMERIC(15,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS max_approval_limit NUMERIC(15,2)`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS approval_notes_ar TEXT`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS approval_notes_en TEXT`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      entity_id VARCHAR(120),
      granted_by INTEGER REFERENCES users(id),
      granted_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(user_id, role_id, entity_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER,
      system_code VARCHAR(50),
      permission_level VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS system_code VARCHAR(50)`);
  await pool.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS permission_level VARCHAR(50)`);
  await pool.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS role_code VARCHAR(50)`);

  for (const role of DEFAULT_SUPER_ADMIN_ROLES) {
    await pool.query(
      `INSERT INTO roles (
         name, name_ar, description, level, hierarchy_level,
         job_title_ar, job_title_en, is_active, is_system
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
       ON CONFLICT (name) DO UPDATE SET
         name_ar = EXCLUDED.name_ar,
         description = EXCLUDED.description,
         level = EXCLUDED.level,
         hierarchy_level = EXCLUDED.hierarchy_level,
         job_title_ar = EXCLUDED.job_title_ar,
         job_title_en = EXCLUDED.job_title_en,
         is_active = true,
         is_system = EXCLUDED.is_system,
         updated_at = NOW()`,
      [
        role.name,
        role.name_ar,
        role.description,
        role.level,
        role.hierarchy_level,
        role.job_title_ar,
        role.job_title_en,
        role.is_system
      ]
    );
  }
}

module.exports = {
  DEFAULT_SUPER_ADMIN_ROLES,
  ensureSuperAdminRbacSchema
};
