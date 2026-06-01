const express = require('express');
const router = express.Router();
const db = require('../../db');

const ensureRelatedDetailsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS finance_related_details (
        id SERIAL PRIMARY KEY,
        page_key TEXT NOT NULL,
        record_id TEXT NOT NULL,
        title TEXT,
        notes TEXT,
        tags TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fin_related_details_record ON finance_related_details(page_key, record_id);
      CREATE INDEX IF NOT EXISTS idx_fin_related_details_created ON finance_related_details(created_at);
    `);
    console.log('✅ finance_related_details table ready');
  } catch (error) {
    console.error('❌ Failed to ensure finance_related_details table:', error);
  }
};

ensureRelatedDetailsTable();

router.get('/', async (req, res) => {
  try {
    const { page_key: pageKey, record_id: recordId } = req.query;

    if (!pageKey && !recordId) {
      return res.status(400).json({ success: false, error: 'Missing page_key or record_id' });
    }

    let query = 'SELECT * FROM finance_related_details WHERE 1=1';
    const params = [];

    if (pageKey) {
      params.push(pageKey);
      query += ` AND page_key = $${params.length}`;
    }

    if (recordId) {
      params.push(recordId);
      query += ` AND record_id = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC, id DESC';

    const result = await db.query(query, params);

    res.json({ success: true, count: result.rows.length, details: result.rows });
  } catch (error) {
    console.error('Error fetching related details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      page_key: pageKey,
      record_id: recordId,
      title = '',
      notes = '',
      tags = ''
    } = req.body;

    if (!pageKey || !recordId) {
      return res.status(400).json({ success: false, error: 'Missing page_key or record_id' });
    }

    if (!title.trim() && !notes.trim()) {
      return res.status(400).json({ success: false, error: 'Missing title or notes' });
    }

    const result = await db.query(
      `INSERT INTO finance_related_details (page_key, record_id, title, notes, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [pageKey, recordId, title.trim(), notes.trim(), tags.trim()]
    );

    res.status(201).json({ success: true, detail: result.rows[0] });
  } catch (error) {
    console.error('Error creating related detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
