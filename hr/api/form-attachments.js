'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../../db');
const { resolveUploadsRootDir } = require('../../uploads-config');

const router = express.Router();
const DEFAULT_ENTITY = 'HQ001';

const uploadsRoot = path.join(resolveUploadsRootDir(), 'hr-form-attachments');
fs.mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const entity = String(_req.headers['x-entity-id'] || DEFAULT_ENTITY).trim() || DEFAULT_ENTITY;
    const dir = path.join(uploadsRoot, entity);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || 'file')
      .replace(/[^\w.\u0600-\u06FF-]+/g, '_')
      .slice(0, 120);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hr_form_attachments (
      id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL DEFAULT 'HQ001',
      page_path TEXT,
      form_id TEXT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes BIGINT DEFAULT 0,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_hr_form_att_entity ON hr_form_attachments(entity_id);
    CREATE INDEX IF NOT EXISTS idx_hr_form_att_page ON hr_form_attachments(page_path);
  `);
};

const readyPromise = ensureTable().catch((error) => {
  console.error('❌ hr_form_attachments init failed:', error.message);
});

const entityIdOf = (req) => String(req.userEntity?.id || req.headers['x-entity-id'] || DEFAULT_ENTITY).trim() || DEFAULT_ENTITY;

router.post('/', upload.single('file'), async (req, res) => {
  try {
    await readyPromise;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'لم يتم اختيار ملف' });
    }
    const entityId = entityIdOf(req);
    const url = `/uploads/hr-form-attachments/${encodeURIComponent(entityId)}/${encodeURIComponent(req.file.filename)}`;
    const pagePath = String(req.body?.page_path || '').slice(0, 300);
    const formId = String(req.body?.form_id || '').slice(0, 120);
    const inserted = await db.query(
      `INSERT INTO hr_form_attachments
        (entity_id, page_path, form_id, original_name, stored_name, mime_type, size_bytes, url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, original_name, mime_type, size_bytes, url, created_at`,
      [
        entityId,
        pagePath,
        formId,
        req.file.originalname,
        req.file.filename,
        req.file.mimetype || 'application/octet-stream',
        req.file.size || 0,
        url
      ]
    );
    const row = inserted.rows[0];
    res.status(201).json({
      success: true,
      file: {
        id: row.id,
        name: row.original_name,
        original_name: row.original_name,
        mime_type: row.mime_type,
        type: row.mime_type,
        size: Number(row.size_bytes) || 0,
        url: row.url,
        created_at: row.created_at
      }
    });
  } catch (error) {
    console.error('HR form attachment upload failed:', error);
    res.status(500).json({ success: false, error: error.message || 'تعذر رفع الملف' });
  }
});

router.get('/', async (req, res) => {
  try {
    await readyPromise;
    const entityId = entityIdOf(req);
    const pagePath = String(req.query.page_path || '').trim();
    const params = [entityId];
    let sql = `SELECT id, original_name, mime_type, size_bytes, url, page_path, form_id, created_at
               FROM hr_form_attachments WHERE entity_id = $1`;
    if (pagePath) {
      params.push(pagePath);
      sql += ` AND page_path = $2`;
    }
    sql += ' ORDER BY id DESC LIMIT 100';
    const result = await db.query(sql, params);
    res.json({
      success: true,
      files: result.rows.map((row) => ({
        id: row.id,
        name: row.original_name,
        original_name: row.original_name,
        mime_type: row.mime_type,
        size: Number(row.size_bytes) || 0,
        url: row.url,
        page_path: row.page_path,
        form_id: row.form_id,
        created_at: row.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
