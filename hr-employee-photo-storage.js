'use strict';
/**
 * Persistent employee photo storage (PostgreSQL BYTEA).
 * Survives process restart and container redeploy as long as the DB volume persists.
 * Disk under UPLOADS_ROOT_DIR is optional cache / legacy fallback only.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

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

/**
 * Soft-optimize photos when larger than ~400KB: max edge 1600px, JPEG q=85 / PNG optimize.
 * Keeps original when optimization fails or would not help. Hard upload cap remains 5MB.
 */
function optimizeEmployeePhotoBuffer(fileData, mimeType = 'image/png') {
  const input = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData || []);
  if (!input.length) return { buffer: input, mimeType, optimized: false };
  if (input.length < 400 * 1024) {
    return { buffer: input, mimeType: mimeType || 'image/png', optimized: false };
  }
  const tmpIn = path.join(os.tmpdir(), `e360-in-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const tmpOut = path.join(os.tmpdir(), `e360-out-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    fs.writeFileSync(tmpIn, input);
    const isPng = String(mimeType || '').includes('png');
    const script = `
from PIL import Image
import sys
src, dst, is_png = sys.argv[1], sys.argv[2], sys.argv[3] == '1'
im = Image.open(src)
im = im.convert('RGBA' if is_png else 'RGB')
max_edge = 1600
w, h = im.size
scale = min(1.0, max_edge / float(max(w, h)))
if scale < 1.0:
    im = im.resize((max(1, int(w*scale)), max(1, int(h*scale))), Image.Resampling.LANCZOS)
if is_png:
    im.save(dst, 'PNG', optimize=True)
else:
    im.save(dst, 'JPEG', quality=85, optimize=True)
`;
    const py = spawnSync('python3', ['-c', script, tmpIn, tmpOut, isPng ? '1' : '0'], {
      encoding: 'utf8',
      timeout: 20000
    });
    if (py.status !== 0 || !fs.existsSync(tmpOut)) {
      return { buffer: input, mimeType: mimeType || 'image/png', optimized: false };
    }
    const out = fs.readFileSync(tmpOut);
    if (!out.length || out.length >= input.length) {
      return { buffer: input, mimeType: mimeType || 'image/png', optimized: false };
    }
    return {
      buffer: out,
      mimeType: isPng ? 'image/png' : 'image/jpeg',
      optimized: true
    };
  } catch (_err) {
    return { buffer: input, mimeType: mimeType || 'image/png', optimized: false };
  } finally {
    fs.unlink(tmpIn, () => {});
    fs.unlink(tmpOut, () => {});
  }
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

  const optimized = optimizeEmployeePhotoBuffer(fileData, mimeType);
  const payload = optimized.buffer;
  const storedMime = optimized.mimeType || mimeType || 'image/png';

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
    [entity, emp, storedMime, payload, payload.length]
  );
  const row = result.rows[0] || {};
  row.optimized = optimized.optimized;
  return row;
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
  optimizeEmployeePhotoBuffer,
  upsertEmployeePhotoAsset,
  getEmployeePhotoAsset,
  deleteEmployeePhotoAsset,
  migrateDiskPhotoToDb,
  resolveLegacyDiskPath
};
