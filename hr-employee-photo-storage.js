'use strict';
/**
 * Persistent employee photo storage (PostgreSQL BYTEA).
 * Survives process restart and container redeploy as long as the DB volume persists.
 * Disk under UPLOADS_ROOT_DIR is optional cache / legacy fallback only.
 */
const fs = require('fs');
const path = require('path');

const PHOTO_API_PREFIX = '/api/hr/employee-profile/';
const PHOTO_API_SUFFIX = '/photo';

let tableEnsured = false;

async function ensureHrEmployeePhotoAssetsTable(db) {
  if (tableEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS hr_employee_photo_assets (
      id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      mime_type VARCHAR(120) NOT NULL DEFAULT 'image/png',
      file_data BYTEA NOT NULL,
      byte_size INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (entity_id, employee_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_hr_emp_photo_assets_employee
      ON hr_employee_photo_assets (employee_id)
  `);
  tableEnsured = true;
}

function buildPersistentPhotoUrl(employeeId) {
  const id = String(employeeId || '').trim();
  if (!id) return null;
  return `${PHOTO_API_PREFIX}${encodeURIComponent(id)}${PHOTO_API_SUFFIX}`;
}

function isPersistentPhotoUrl(url) {
  const u = String(url || '');
  return u.startsWith(PHOTO_API_PREFIX) && u.endsWith(PHOTO_API_SUFFIX);
}

function isLegacyDiskPhotoUrl(url) {
  return String(url || '').startsWith('/uploads/hr-employee-360/');
}

async function upsertEmployeePhotoAsset(db, {
  entityId,
  employeeId,
  mimeType,
  fileData
}) {
  await ensureHrEmployeePhotoAssetsTable(db);
  const entity = String(entityId || '').trim();
  const emp = String(employeeId || '').trim();
  if (!entity || !emp) throw new Error('entity_id و employee_id مطلوبان لحفظ الصورة');
  if (!fileData || !fileData.length) throw new Error('بيانات الصورة فارغة');

  const result = await db.query(
    `INSERT INTO hr_employee_photo_assets
       (entity_id, employee_id, mime_type, file_data, byte_size, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (entity_id, employee_id) DO UPDATE SET
       mime_type = EXCLUDED.mime_type,
       file_data = EXCLUDED.file_data,
       byte_size = EXCLUDED.byte_size,
       updated_at = NOW()
     RETURNING id, byte_size, mime_type`,
    [entity, emp, mimeType || 'image/png', fileData, fileData.length]
  );
  return result.rows[0];
}

async function getEmployeePhotoAsset(db, { entityId, employeeId, allowHqCrossEntity = false }) {
  await ensureHrEmployeePhotoAssetsTable(db);
  const emp = String(employeeId || '').trim();
  if (!emp) return null;

  if (allowHqCrossEntity || !entityId) {
    const any = await db.query(
      `SELECT id, entity_id, employee_id, mime_type, file_data, byte_size
       FROM hr_employee_photo_assets
       WHERE employee_id = $1
       ORDER BY CASE WHEN entity_id = $2 THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 1`,
      [emp, String(entityId || '')]
    );
    return any.rows[0] || null;
  }

  const result = await db.query(
    `SELECT id, entity_id, employee_id, mime_type, file_data, byte_size
     FROM hr_employee_photo_assets
     WHERE employee_id = $1 AND entity_id = $2
     LIMIT 1`,
    [emp, String(entityId)]
  );
  return result.rows[0] || null;
}

async function deleteEmployeePhotoAsset(db, { entityId, employeeId }) {
  await ensureHrEmployeePhotoAssetsTable(db);
  const result = await db.query(
    `DELETE FROM hr_employee_photo_assets
     WHERE employee_id = $1 AND entity_id = $2
     RETURNING id`,
    [String(employeeId || '').trim(), String(entityId || '').trim()]
  );
  return result.rowCount > 0;
}

async function migrateDiskPhotoToDb(db, {
  entityId,
  employeeId,
  absolutePath,
  mimeType = 'image/png'
}) {
  if (!absolutePath || !fs.existsSync(absolutePath)) return null;
  const fileData = await fs.promises.readFile(absolutePath);
  if (!fileData.length) return null;
  const saved = await upsertEmployeePhotoAsset(db, {
    entityId,
    employeeId,
    mimeType,
    fileData
  });
  return saved;
}

function resolveLegacyDiskPath(uploadsRootDir, photoUrl) {
  if (!isLegacyDiskPhotoUrl(photoUrl)) return null;
  const rel = String(photoUrl).replace(/^\/uploads\//, '');
  return path.join(uploadsRootDir, rel);
}

module.exports = {
  ensureHrEmployeePhotoAssetsTable,
  buildPersistentPhotoUrl,
  isPersistentPhotoUrl,
  isLegacyDiskPhotoUrl,
  upsertEmployeePhotoAsset,
  getEmployeePhotoAsset,
  deleteEmployeePhotoAsset,
  migrateDiskPhotoToDb,
  resolveLegacyDiskPath
};
