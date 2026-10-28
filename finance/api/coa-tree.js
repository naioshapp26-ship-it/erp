'use strict';

/**
 * Hierarchical chart-of-accounts tree for Finance 360.
 * Reuses finance_accounts + balances. Additive audit only.
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { denyUnless } = require('../services/hr-finance-authz');
const { resolveScopedEntityId } = require('./resolve-scoped-entity');
const { getDocSettings } = require('../services/page-document-settings');

let ready = false;

async function ensureSchema() {
  if (ready) return;
  await db.query(`
    ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS currency_code TEXT;
  `);
  ready = true;
}

function entityOf(req, body) {
  return resolveScopedEntityId(req, (body && body.entity_id) || req.query.entity_id || req.headers['x-entity-id']) || 'HQ001';
}

function actorLabel(req) {
  return req.hrFinanceActor?.userName || req.authUser?.email || 'ui';
}

function audit(action, by, extra = {}) {
  return { action, by, at: new Date().toISOString(), ...extra };
}

function buildTree(rows) {
  const map = new Map();
  rows.forEach((r) => map.set(r.account_id, { ...r, children: [] }));
  const roots = [];
  for (const node of map.values()) {
    if (node.parent_account_id && map.has(node.parent_account_id)) {
      map.get(node.parent_account_id).children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list) => {
    list.sort((a, b) => String(a.account_code).localeCompare(String(b.account_code), 'en'));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

async function wouldCreateCycle(client, accountId, newParentId) {
  if (!newParentId) return false;
  if (Number(newParentId) === Number(accountId)) return true;
  let current = Number(newParentId);
  const seen = new Set();
  while (current) {
    if (Number(current) === Number(accountId)) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    const r = await client.query(`SELECT parent_account_id FROM finance_accounts WHERE account_id = $1`, [current]);
    current = r.rows[0]?.parent_account_id || null;
  }
  return false;
}

async function accountInUse(client, accountId) {
  const jl = await client.query(
    `SELECT 1 FROM finance_journal_lines WHERE account_id = $1 LIMIT 1`,
    [accountId]
  ).catch(() => ({ rows: [] }));
  if (jl.rows.length) return 'مستخدم في قيود يومية';
  const children = await client.query(
    `SELECT 1 FROM finance_accounts WHERE parent_account_id = $1 LIMIT 1`,
    [accountId]
  );
  if (children.rows.length) return 'له حسابات فرعية';
  return null;
}

router.get('/tree', async (req, res) => {
  try {
    if (denyUnless(req, res, 'coa_view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const settings = (await getDocSettings('coa-tree').catch(() => null))?.value || {};
    const showInactive = req.query.show_inactive === '1' || settings.show_inactive === true;
    const r = await db.query(
      `SELECT a.account_id, a.account_code, a.account_name_ar, a.account_name_en, a.account_type,
              a.parent_account_id, a.level, a.is_active, a.is_header, a.normal_balance,
              a.currency_code, a.description, a.notes, a.audit_log,
              COALESCE(b.total_debit, 0) AS total_debit,
              COALESCE(b.total_credit, 0) AS total_credit,
              COALESCE(b.balance, 0) AS balance
       FROM finance_accounts a
       LEFT JOIN finance_account_balances b
         ON b.account_id = a.account_id AND (b.entity_id = $1 OR b.entity_id IS NULL)
       WHERE (a.entity_id = $1 OR a.entity_id IS NULL)
         ${showInactive ? '' : 'AND COALESCE(a.is_active, true) = true'}
       ORDER BY a.account_code`,
      [eid]
    );
    const q = String(req.query.q || '').trim().toLowerCase();
    let rows = r.rows;
    if (q) {
      rows = rows.filter((row) =>
        `${row.account_code} ${row.account_name_ar || ''} ${row.account_name_en || ''} ${row.account_type || ''}`
          .toLowerCase().includes(q)
      );
    }
    if (req.query.account_type) {
      rows = rows.filter((row) => String(row.account_type).toUpperCase() === String(req.query.account_type).toUpperCase());
    }
    res.json({
      success: true,
      accounts: rows,
      tree: buildTree(rows),
      count: rows.length,
      settings
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/accounts', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'coa_edit')) return;
    await ensureSchema();
    const b = req.body || {};
    const eid = entityOf(req, b);
    if (!b.account_code || !b.account_name_ar || !b.account_type) {
      return res.status(400).json({ success: false, error: 'الكود والاسم والنوع إلزامية' });
    }
    const type = String(b.account_type).toUpperCase();
    if (!['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ success: false, error: 'نوع الحساب غير معروف' });
    }
    let level = 1;
    if (b.parent_account_id) {
      const parent = await client.query(
        `SELECT * FROM finance_accounts WHERE account_id = $1 AND (entity_id = $2 OR entity_id IS NULL)`,
        [b.parent_account_id, eid]
      );
      if (!parent.rows[0]) return res.status(404).json({ success: false, error: 'الحساب الأب غير موجود' });
      level = Number(parent.rows[0].level || 1) + 1;
    }
    const normal = b.normal_balance || (['ASSET', 'EXPENSE'].includes(type) ? 'DEBIT' : 'CREDIT');
    const by = actorLabel(req);
    const ins = await client.query(
      `INSERT INTO finance_accounts (
         account_code, account_name_ar, account_name_en, account_type, parent_account_id, level,
         is_active, is_header, normal_balance, entity_id, entity_type, currency_code, description, notes,
         created_by, audit_log, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'HQ',$11,$12,$13,$14,$15::jsonb,NOW(),NOW())
       RETURNING *`,
      [
        String(b.account_code).trim(),
        String(b.account_name_ar).trim(),
        b.account_name_en || null,
        type,
        b.parent_account_id || null,
        level,
        b.is_active !== false,
        b.is_header === true,
        normal,
        eid,
        b.currency_code || null,
        b.description || null,
        b.notes || null,
        by,
        JSON.stringify([audit('create', by)])
      ]
    );
    res.status(201).json({ success: true, account: ins.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, error: 'رمز الحساب مكرر', code: 'DUPLICATE_CODE' });
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.put('/accounts/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'coa_edit')) return;
    await ensureSchema();
    const settings = (await getDocSettings('coa-tree').catch(() => null))?.value || {};
    if (settings.require_approval_for_edit) {
      if (denyUnless(req, res, 'coa_approve')) return;
    }
    const eid = entityOf(req, req.body);
    const b = req.body || {};
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT * FROM finance_accounts WHERE account_id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'الحساب غير موجود' });
    }
    if (existing.rows[0].entity_id && String(existing.rows[0].entity_id) !== String(eid)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'خارج نطاق الكيان' });
    }
    if (b.parent_account_id !== undefined) {
      if (await wouldCreateCycle(client, req.params.id, b.parent_account_id)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: 'دورة هرمية غير مسموحة', code: 'CYCLE' });
      }
    }
    const by = actorLabel(req);
    const updated = await client.query(
      `UPDATE finance_accounts SET
         account_name_ar = COALESCE($2, account_name_ar),
         account_name_en = COALESCE($3, account_name_en),
         account_type = COALESCE($4, account_type),
         parent_account_id = CASE WHEN $5::boolean THEN $6 ELSE parent_account_id END,
         is_active = COALESCE($7, is_active),
         is_header = COALESCE($8, is_header),
         normal_balance = COALESCE($9, normal_balance),
         currency_code = COALESCE($10, currency_code),
         description = COALESCE($11, description),
         notes = COALESCE($12, notes),
         audit_log = COALESCE(audit_log, '[]'::jsonb) || $13::jsonb,
         updated_by = $14,
         updated_at = NOW()
       WHERE account_id = $1
         AND (entity_id = $15 OR entity_id IS NULL)
       RETURNING *`,
      [
        req.params.id,
        b.account_name_ar || null,
        b.account_name_en != null ? b.account_name_en : null,
        b.account_type || null,
        b.parent_account_id !== undefined,
        b.parent_account_id || null,
        b.is_active != null ? !!b.is_active : null,
        b.is_header != null ? !!b.is_header : null,
        b.normal_balance || null,
        b.currency_code != null ? b.currency_code : null,
        b.description != null ? b.description : null,
        b.notes != null ? b.notes : null,
        JSON.stringify([audit('update', by)]),
        by,
        eid
      ]
    );
    await client.query('COMMIT');
    res.json({ success: true, account: updated.rows[0] });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.post('/accounts/:id/deactivate', async (req, res) => {
  try {
    if (denyUnless(req, res, 'coa_edit')) return;
    await ensureSchema();
    const by = actorLabel(req);
    const updated = await db.query(
      `UPDATE finance_accounts
       SET is_active = false, updated_at = NOW(), updated_by = $2,
           audit_log = COALESCE(audit_log, '[]'::jsonb) || $3::jsonb
       WHERE account_id = $1 RETURNING *`,
      [req.params.id, by, JSON.stringify([audit('deactivate', by)])]
    );
    if (!updated.rows[0]) return res.status(404).json({ success: false, error: 'غير موجود' });
    res.json({ success: true, account: updated.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    if (denyUnless(req, res, 'coa_edit')) return;
    await ensureSchema();
    await client.query('BEGIN');
    const existing = await client.query(`SELECT * FROM finance_accounts WHERE account_id = $1 FOR UPDATE`, [req.params.id]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'غير موجود' });
    }
    const reason = await accountInUse(client, req.params.id);
    if (reason) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `لا يُحذف الحساب: ${reason}. عطّله بدل الحذف.`,
        code: 'IN_USE'
      });
    }
    await client.query(`DELETE FROM finance_accounts WHERE account_id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'حُذف الحساب غير المستخدم' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* */ }
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

router.get('/export.csv', async (req, res) => {
  try {
    if (denyUnless(req, res, 'coa_view')) return;
    await ensureSchema();
    const eid = entityOf(req);
    const r = await db.query(
      `SELECT account_code, account_name_ar, account_name_en, account_type, level, is_header, is_active, normal_balance
       FROM finance_accounts
       WHERE entity_id = $1 OR entity_id IS NULL
       ORDER BY account_code`,
      [eid]
    );
    const header = 'code,name_ar,name_en,type,level,header,active,normal_balance\n';
    const body = r.rows.map((row) =>
      [row.account_code, row.account_name_ar, row.account_name_en, row.account_type, row.level, row.is_header, row.is_active, row.normal_balance]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="coa-tree.csv"');
    res.send('\uFEFF' + header + body);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/export.xlsx', async (req, res) => {
  try {
    if (denyUnless(req, res, 'coa_view')) return;
    await ensureSchema();
    const XLSX = require('xlsx');
    const eid = entityOf(req);
    const r = await db.query(
      `SELECT account_code AS "الكود", account_name_ar AS "الاسم عربي", account_name_en AS "الاسم إنجليزي",
              account_type AS "النوع", level AS "المستوى", is_header AS "تجميعي", is_active AS "نشط",
              normal_balance AS "طبيعة الرصيد"
       FROM finance_accounts
       WHERE entity_id = $1 OR entity_id IS NULL
       ORDER BY account_code`,
      [eid]
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(r.rows);
    XLSX.utils.book_append_sheet(wb, ws, 'COA');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="coa-tree.xlsx"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
module.exports.ensureSchema = ensureSchema;
module.exports.buildTree = buildTree;
