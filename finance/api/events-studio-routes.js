const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../../db');
const { getRequestEntityContext, buildEntityScopeCondition } = require('../../entity-context');
const { resolveUploadsRootDir } = require('../../uploads-config');

const router = express.Router();
const UPLOADS_ROOT = resolveUploadsRootDir();
const EVENTS_STUDIO_DIR = path.join(UPLOADS_ROOT, 'events-studio');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(EVENTS_STUDIO_DIR);

const resolveEntityId = (req) => getRequestEntityContext(req).id;

const mapEventRow = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  date: row.event_date ? String(row.event_date).slice(0, 10) : '',
  time: row.event_time || '',
  platform: row.platform || '',
  status: row.status || 'نشطة',
  type: row.event_type || '',
  speaker: row.speaker || '',
  duration: Number(row.duration || 0),
  campaignDepartment: row.department || ''
});

const mapRecordingRow = (row) => ({
  id: row.id,
  eventId: row.event_id,
  eventName: row.event_name || '',
  name: row.name || row.content_title || '',
  contentTitle: row.content_title || row.name || '',
  contentDescription: row.content_description || '',
  recordingDate: row.recording_date ? String(row.recording_date).slice(0, 10) : '',
  createdAt: row.created_at,
  duration: Number(row.duration || 0),
  owner: row.owner || '',
  fileType: row.file_type || '',
  mediaCategory: row.media_category || 'video',
  targetPlatform: row.target_platform || '',
  contentType: row.content_type || '',
  campaignDepartment: row.campaign_department || ''
});

const mapClipRow = (row) => ({
  id: row.id,
  recordingId: row.recording_id,
  name: row.name || '',
  videoName: row.video_name || '',
  duration: Number(row.duration || 0),
  status: row.status || 'جاهز',
  startAt: Number(row.start_at || 0),
  endAt: Number(row.end_at || 0)
});

const ensureEventsStudioTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS events_studio_events (
      id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      name TEXT NOT NULL,
      description TEXT,
      event_date DATE,
      event_time TEXT,
      platform TEXT,
      status TEXT NOT NULL DEFAULT 'نشطة',
      event_type TEXT,
      speaker TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      department TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events_studio_recordings (
      id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      event_id INTEGER REFERENCES events_studio_events(id) ON DELETE SET NULL,
      name TEXT,
      recording_date DATE,
      duration INTEGER NOT NULL DEFAULT 0,
      owner TEXT,
      content_title TEXT,
      content_description TEXT,
      target_platform TEXT,
      content_type TEXT,
      campaign_department TEXT,
      media_category TEXT NOT NULL DEFAULT 'video',
      file_type TEXT,
      mime_type TEXT,
      file_path TEXT,
      original_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events_studio_clips (
      id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      recording_id INTEGER REFERENCES events_studio_recordings(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_at INTEGER NOT NULL DEFAULT 0,
      end_at INTEGER NOT NULL DEFAULT 0,
      duration INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'جاهز',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events_studio_publications (
      id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      entity_type TEXT NOT NULL DEFAULT 'HQ',
      clip_id INTEGER REFERENCES events_studio_clips(id) ON DELETE SET NULL,
      platforms TEXT[] NOT NULL DEFAULT '{}',
      note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_events_studio_events_entity ON events_studio_events(entity_id);
    CREATE INDEX IF NOT EXISTS idx_events_studio_recordings_entity ON events_studio_recordings(entity_id);
    CREATE INDEX IF NOT EXISTS idx_events_studio_clips_entity ON events_studio_clips(entity_id);
    CREATE INDEX IF NOT EXISTS idx_events_studio_publications_entity ON events_studio_publications(entity_id);
  `);
};

ensureEventsStudioTables().catch((error) => {
  console.error('Failed to ensure events studio tables:', error.message);
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDir(EVENTS_STUDIO_DIR);
    cb(null, EVENTS_STUDIO_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.bin';
    cb(null, `recording-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(video\/|image\/)/i.test(file.mimetype || '');
    cb(allowed ? null : new Error('نوع الملف غير مدعوم.'), allowed);
  }
});

const entityFilter = (req, alias = '', paramIndex = 1) => {
  const column = alias ? `${alias}.entity_id` : 'entity_id';
  return {
    clause: buildEntityScopeCondition(getRequestEntityContext(req), column, paramIndex),
    value: resolveEntityId(req)
  };
};

router.get('/summary', async (req, res) => {
  try {
    const scope = entityFilter(req, 'p', 1);
    const publications = await db.query(
      `SELECT p.id, p.clip_id AS "clipId", p.platforms, p.note, p.created_at AS "createdAt"
       FROM events_studio_publications p
       WHERE ${scope.clause}
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [scope.value]
    );
    res.json({ summary: { publications: publications.rows } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/events', async (req, res) => {
  try {
    const scope = entityFilter(req, 'e', 1);
    const result = await db.query(
      `SELECT e.*
       FROM events_studio_events e
       WHERE ${scope.clause}
       ORDER BY e.event_date DESC NULLS LAST, e.created_at DESC`,
      [scope.value]
    );
    res.json({ events: result.rows.map(mapEventRow) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events', async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'اسم الحملة مطلوب.' });

    const context = getRequestEntityContext(req);
    const result = await db.query(
      `INSERT INTO events_studio_events
        (entity_id, entity_type, name, description, event_date, event_time, platform, status, event_type, speaker, duration, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        context.id,
        context.type,
        name,
        body.description || '',
        body.date || null,
        body.time || '',
        body.platform || '',
        body.status || 'نشطة',
        body.type || '',
        body.speaker || '',
        Number(body.duration || 0),
        body.campaignDepartment || body.department || ''
      ]
    );
    res.status(201).json({ event: mapEventRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const scope = entityFilter(req, 'e', 2);
    const result = await db.query(
      `UPDATE events_studio_events e SET
         name = COALESCE($1, e.name),
         description = COALESCE($2, e.description),
         event_date = COALESCE($3, e.event_date),
         event_time = COALESCE($4, e.event_time),
         platform = COALESCE($5, e.platform),
         status = COALESCE($6, e.status),
         event_type = COALESCE($7, e.event_type),
         speaker = COALESCE($8, e.speaker),
         duration = COALESCE($9, e.duration),
         department = COALESCE($10, e.department),
         updated_at = NOW()
       WHERE e.id = $11 AND ${scope.clause}
       RETURNING *`,
      [
        body.name || null,
        body.description || null,
        body.date || null,
        body.time || null,
        body.platform || null,
        body.status || null,
        body.type || null,
        body.speaker || null,
        body.duration != null ? Number(body.duration) : null,
        body.campaignDepartment || body.department || null,
        id,
        scope.value
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'الحملة غير موجودة.' });
    res.json({ event: mapEventRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    const scope = entityFilter(req, 'e', 2);
    const result = await db.query(
      `DELETE FROM events_studio_events e WHERE e.id = $1 AND ${scope.clause} RETURNING id`,
      [req.params.id, scope.value]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'الحملة غير موجودة.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recordings', async (req, res) => {
  try {
    const scope = entityFilter(req, 'r', 1);
    const result = await db.query(
      `SELECT r.*, e.name AS event_name
       FROM events_studio_recordings r
       LEFT JOIN events_studio_events e ON e.id = r.event_id
       WHERE ${scope.clause}
       ORDER BY r.created_at DESC`,
      [scope.value]
    );
    res.json({ recordings: result.rows.map(mapRecordingRow) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recordings/upload', (req, res) => {
  upload.single('media')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'فشل رفع الملف.' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار ملف.' });

    try {
      const eventId = Number(req.body.eventId || 0) || null;
      const context = getRequestEntityContext(req);
      const mime = req.file.mimetype || '';
      const mediaCategory = /^image\//i.test(mime) ? 'image' : 'video';
      const extension = path.extname(req.file.originalname || req.file.filename).replace('.', '').toLowerCase();
      const relativePath = path.relative(path.join(__dirname, '../..'), req.file.path);

      const result = await db.query(
        `INSERT INTO events_studio_recordings
          (entity_id, entity_type, event_id, name, recording_date, duration, owner, content_title, content_description,
           target_platform, content_type, campaign_department, media_category, file_type, mime_type, file_path, original_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [
          context.id,
          context.type,
          eventId,
          req.body.name || req.body.contentTitle || req.file.originalname,
          req.body.recordingDate || new Date().toISOString().slice(0, 10),
          Number(req.body.duration || 0),
          req.body.owner || '',
          req.body.contentTitle || req.body.name || '',
          req.body.contentDescription || '',
          req.body.targetPlatform || '',
          req.body.contentType || '',
          req.body.campaignDepartment || '',
          mediaCategory,
          extension,
          mime,
          relativePath,
          req.file.originalname || req.file.filename
        ]
      );

      const recording = mapRecordingRow({ ...result.rows[0], event_name: '' });
      if (eventId) {
        const eventRes = await db.query('SELECT name FROM events_studio_events WHERE id = $1', [eventId]);
        recording.eventName = eventRes.rows[0]?.name || '';
      }
      res.status(201).json({ recording });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

const getRecordingFile = async (req, res, disposition) => {
  try {
    const scope = entityFilter(req, 'r', 2);
    const result = await db.query(
      `SELECT r.file_path, r.original_name, r.mime_type
       FROM events_studio_recordings r
       WHERE r.id = $1 AND ${scope.clause}`,
      [req.params.id, scope.value]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'الملف غير موجود.' });
    const row = result.rows[0];
    const absolutePath = path.isAbsolute(row.file_path)
      ? row.file_path
      : path.join(__dirname, '../..', row.file_path);
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'ملف التسجيل غير متوفر على الخادم.' });
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(row.original_name || 'recording')}"`);
    return res.sendFile(path.resolve(absolutePath));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

router.get('/recordings/:id/view', (req, res) => getRecordingFile(req, res, 'inline'));
router.get('/recordings/:id/download', (req, res) => getRecordingFile(req, res, 'attachment'));

router.delete('/recordings/:id', async (req, res) => {
  try {
    const scope = entityFilter(req, 'r', 2);
    const result = await db.query(
      `SELECT r.file_path FROM events_studio_recordings r WHERE r.id = $1 AND ${scope.clause}`,
      [req.params.id, scope.value]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'التسجيل غير موجود.' });
    const filePath = result.rows[0].file_path;
    await db.query('DELETE FROM events_studio_recordings WHERE id = $1', [req.params.id]);
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '../..', filePath);
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/clips', async (req, res) => {
  try {
    const scope = entityFilter(req, 'c', 1);
    const result = await db.query(
      `SELECT c.*, COALESCE(r.content_title, r.name) AS video_name
       FROM events_studio_clips c
       LEFT JOIN events_studio_recordings r ON r.id = c.recording_id
       WHERE ${scope.clause}
       ORDER BY c.created_at DESC`,
      [scope.value]
    );
    res.json({ clips: result.rows.map(mapClipRow) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/clips', async (req, res) => {
  try {
    const body = req.body || {};
    const recordingId = Number(body.recordingId || 0);
    const name = String(body.name || '').trim();
    const startAt = Number(body.startAt || 0);
    const endAt = Number(body.endAt || 0);
    if (!recordingId) return res.status(400).json({ error: 'يجب اختيار فيديو مصدر.' });
    if (!name) return res.status(400).json({ error: 'اسم المقطع مطلوب.' });
    if (endAt <= startAt) return res.status(400).json({ error: 'نطاق المقطع غير صالح.' });

    const scope = entityFilter(req, 'r', 2);
    const recordingCheck = await db.query(
      `SELECT id FROM events_studio_recordings r WHERE r.id = $1 AND ${scope.clause}`,
      [recordingId, scope.value]
    );
    if (!recordingCheck.rows.length) return res.status(404).json({ error: 'الفيديو المصدر غير موجود.' });

    const context = getRequestEntityContext(req);
    const duration = Math.max(1, endAt - startAt);
    const result = await db.query(
      `INSERT INTO events_studio_clips
        (entity_id, entity_type, recording_id, name, start_at, end_at, duration, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'جاهز')
       RETURNING *`,
      [context.id, context.type, recordingId, name, startAt, endAt, duration]
    );
    const clip = mapClipRow({ ...result.rows[0], video_name: '' });
    const videoRes = await db.query(
      'SELECT COALESCE(content_title, name) AS video_name FROM events_studio_recordings WHERE id = $1',
      [recordingId]
    );
    clip.videoName = videoRes.rows[0]?.video_name || '';
    res.status(201).json({ clip });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/clips/:id', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'اسم المقطع مطلوب.' });
    const scope = entityFilter(req, 'c', 3);
    const result = await db.query(
      `UPDATE events_studio_clips c SET name = $1, updated_at = NOW()
       WHERE c.id = $2 AND ${scope.clause}
       RETURNING *`,
      [name, req.params.id, scope.value]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'المقطع غير موجود.' });
    res.json({ clip: mapClipRow(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/clips/:id', async (req, res) => {
  try {
    const scope = entityFilter(req, 'c', 2);
    const result = await db.query(
      `DELETE FROM events_studio_clips c WHERE c.id = $1 AND ${scope.clause} RETURNING id`,
      [req.params.id, scope.value]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'المقطع غير موجود.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/publish', async (req, res) => {
  try {
    const body = req.body || {};
    const clipId = Number(body.clipId || 0);
    const platforms = Array.isArray(body.platforms) ? body.platforms.filter(Boolean) : [];
    if (!clipId) return res.status(400).json({ error: 'يجب اختيار مقطع للنشر.' });
    if (!platforms.length) return res.status(400).json({ error: 'اختر منصة واحدة على الأقل.' });

    const scope = entityFilter(req, 'c', 2);
    const clipCheck = await db.query(
      `SELECT id FROM events_studio_clips c WHERE c.id = $1 AND ${scope.clause}`,
      [clipId, scope.value]
    );
    if (!clipCheck.rows.length) return res.status(404).json({ error: 'المقطع غير موجود.' });

    const context = getRequestEntityContext(req);
    const result = await db.query(
      `INSERT INTO events_studio_publications (entity_id, entity_type, clip_id, platforms, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, clip_id AS "clipId", platforms, note, created_at AS "createdAt"`,
      [context.id, context.type, clipId, platforms, body.note || '']
    );

    await db.query(
      `UPDATE events_studio_clips SET status = 'تم التجهيز للنشر', updated_at = NOW() WHERE id = $1`,
      [clipId]
    );

    res.status(201).json({ publication: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
