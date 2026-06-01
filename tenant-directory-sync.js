'use strict';

const db = require('./db');

const CENTRAL_TENANT_ACCOUNT_TYPE = 'TENANT';
const CENTRAL_TENANT_ENTITY_TYPE = 'PLATFORM';
const CENTRAL_TENANT_ENTITY_PREFIX = 'TEN';

function normalizeText(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

function buildCentralTenantEntityId(tenantId) {
  const normalizedTenantId = Number.parseInt(tenantId, 10);
  if (!Number.isInteger(normalizedTenantId) || normalizedTenantId <= 0) {
    throw new Error(`معرّف المستأجر غير صالح: ${tenantId}`);
  }
  return `${CENTRAL_TENANT_ENTITY_PREFIX}${String(normalizedTenantId).padStart(6, '0')}`;
}

function buildDirectoryEmail(tenantId, tenantUserId, email) {
  return normalizeEmail(email) || `tenant-user-${tenantId}-${tenantUserId}@internal.naiosh.local`;
}

function buildDisplayName(user) {
  const firstName = normalizeText(user.first_name || user.firstName);
  const lastName = normalizeText(user.last_name || user.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return fullName
    || normalizeText(user.name)
    || normalizeText(user.username)
    || normalizeEmail(user.email)
    || 'مستخدم مستأجر';
}

function buildJobTitle(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (normalizedRole === 'admin') return 'مدير المستأجر';
  if (normalizedRole === 'manager') return 'مدير';
  if (normalizedRole === 'readonly') return 'مستخدم للقراءة فقط';
  return 'موظف مستأجر';
}

async function ensureCentralEntity(client, tenant, entityId) {
  const companyName = normalizeText(tenant.company_name || tenant.companyName) || `Tenant ${tenant.id}`;
  const plan = String(tenant.subscription_plan || tenant.plan || 'basic').trim().toUpperCase();

  await client.query(
    `INSERT INTO entities (id, name, type, status, users_count, plan, created_at, updated_at)
     VALUES ($1, $2, $3, 'Active', 0, $4, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       status = EXCLUDED.status,
       plan = EXCLUDED.plan,
       updated_at = NOW()`,
    [entityId, companyName, CENTRAL_TENANT_ENTITY_TYPE, plan]
  );

  return companyName;
}

async function findExistingDirectoryUser(client, entityId, emailCandidates, allowEntityFallback = false) {
  const candidates = Array.from(new Set(emailCandidates.filter(Boolean).map(value => value.toLowerCase())));
  if (candidates.length) {
    const result = await client.query(
      `SELECT id, email
       FROM users
       WHERE entity_id = $1
         AND LOWER(COALESCE(email, '')) = ANY($2::text[])
       ORDER BY id ASC
       LIMIT 1`,
      [entityId, candidates]
    );

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  if (!allowEntityFallback) {
    return null;
  }

  const fallbackResult = await client.query(
    `SELECT id, email
     FROM users
     WHERE entity_id = $1
     ORDER BY created_at ASC NULLS LAST, id ASC
     LIMIT 1`,
    [entityId]
  );

  return fallbackResult.rows[0] || null;
}

async function resolveDirectoryEmail(client, entityId, preferredEmail, fallbackEmail, existingUserId) {
  if (!preferredEmail) {
    return fallbackEmail;
  }

  const duplicateResult = await client.query(
    `SELECT id, entity_id
     FROM users
     WHERE LOWER(email) = LOWER($1)
     ORDER BY id ASC
     LIMIT 1`,
    [preferredEmail]
  );

  if (!duplicateResult.rows.length) {
    return preferredEmail;
  }

  const duplicateUser = duplicateResult.rows[0];
  if (String(duplicateUser.id) === String(existingUserId) || duplicateUser.entity_id === entityId) {
    return preferredEmail;
  }

  return fallbackEmail;
}

async function refreshEntityUsersCount(client, entityId) {
  await client.query(
    `UPDATE entities
     SET users_count = (
       SELECT COUNT(*)::INTEGER
       FROM users
       WHERE entity_id = $1
     ),
     updated_at = NOW()
     WHERE id = $1`,
    [entityId]
  );
}

async function syncCentralTenantUserDirectoryEntry({ tenant, user, previousEmail = null, allowEntityFallback = false }) {
  if (!tenant || !user || !user.id) {
    return null;
  }

  const client = await db.pool.connect();
  const entityId = buildCentralTenantEntityId(tenant.id);
  const preferredEmail = normalizeEmail(user.email);
  const previousNormalizedEmail = normalizeEmail(previousEmail);
  const fallbackEmail = buildDirectoryEmail(tenant.id, user.id, null);
  const displayName = buildDisplayName(user);
  const requestedRole = normalizeText(user.role) || 'staff';
  const isActive = user.is_active !== false && user.isActive !== false;

  try {
    await client.query('BEGIN');

    const companyName = await ensureCentralEntity(client, tenant, entityId);
    const existingUser = await findExistingDirectoryUser(client, entityId, [
      preferredEmail,
      previousNormalizedEmail,
      fallbackEmail
    ], allowEntityFallback);
    const directoryEmail = await resolveDirectoryEmail(
      client,
      entityId,
      preferredEmail,
      fallbackEmail,
      existingUser?.id || null
    );

    if (existingUser) {
      await client.query(
        `UPDATE users
         SET name = $1,
             email = $2,
             role = $3,
             tenant_type = $4,
             entity_id = $5,
             entity_name = $6,
             is_active = $7,
             job_title = $8,
             updated_at = NOW()
         WHERE id = $9`,
        [
          displayName,
          directoryEmail,
          requestedRole,
          CENTRAL_TENANT_ACCOUNT_TYPE,
          entityId,
          companyName,
          isActive,
          buildJobTitle(requestedRole),
          existingUser.id
        ]
      );
    } else {
      await client.query(
        `INSERT INTO users (
          name, email, role, tenant_type, entity_id, entity_name, is_active, job_title
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          displayName,
          directoryEmail,
          requestedRole,
          CENTRAL_TENANT_ACCOUNT_TYPE,
          entityId,
          companyName,
          isActive,
          buildJobTitle(requestedRole)
        ]
      );
    }

    await refreshEntityUsersCount(client, entityId);
    await client.query('COMMIT');

    return { entityId, email: directoryEmail };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deactivateCentralTenantUserDirectoryEntry({ tenant, user, previousEmail = null }) {
  if (!tenant || !user || !user.id) {
    return null;
  }

  const client = await db.pool.connect();
  const entityId = buildCentralTenantEntityId(tenant.id);
  const preferredEmail = normalizeEmail(user.email);
  const previousNormalizedEmail = normalizeEmail(previousEmail);
  const fallbackEmail = buildDirectoryEmail(tenant.id, user.id, null);

  try {
    await client.query('BEGIN');

    const existingUser = await findExistingDirectoryUser(client, entityId, [
      preferredEmail,
      previousNormalizedEmail,
      fallbackEmail
    ]);

    if (existingUser) {
      await client.query(
        `UPDATE users
         SET is_active = false, updated_at = NOW()
         WHERE id = $1`,
        [existingUser.id]
      );
      await refreshEntityUsersCount(client, entityId);
    }

    await client.query('COMMIT');
    return existingUser;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  buildCentralTenantEntityId,
  buildDisplayName,
  syncCentralTenantUserDirectoryEntry,
  deactivateCentralTenantUserDirectoryEntry
};
