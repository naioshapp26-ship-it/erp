'use strict';

/**
 * Accounting integration hub — links source documents to journals.
 * Reuses finance_journal_entries / finance_document_links / inventory account map.
 * Does not invent parallel ledgers.
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { resolveScopedEntityId } = require('./resolve-scoped-entity');
const {
  reverseEntry,
  PostingError,
  findActiveReversal
} = require('../services/finance-posting-service');

function entityOf(req) {
  return resolveScopedEntityId(req, (req.query && req.query.entity_id) || (req.body && req.body.entity_id));
}

function sendPostingError(res, error) {
  if (error instanceof PostingError) {
    return res.status(error.status).json({
      success: false,
      error: error.message,
      code: error.code,
      ...(error.extra || {})
    });
  }
  return null;
}

router.get('/overview', async (req, res) => {
  try {
    const entityId = entityOf(req);
    if (!entityId) return res.status(400).json({ success: false, error: 'الكيان مطلوب' });

    const [invoices, payments, expenses, journals, stock, map] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL)::int AS with_journal,
                COUNT(*) FILTER (WHERE journal_entry_id IS NULL AND UPPER(COALESCE(status,'')) NOT IN ('CANCELLED','DRAFT'))::int AS missing_journal
         FROM finance_invoices WHERE entity_id = $1`,
        [entityId]
      ).catch(() => ({ rows: [{ total: 0, with_journal: 0, missing_journal: 0 }] })),
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL)::int AS with_journal
         FROM finance_payments WHERE entity_id = $1`,
        [entityId]
      ).catch(() => ({ rows: [{ total: 0, with_journal: 0 }] })),
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL)::int AS with_journal
         FROM finance_expenses WHERE entity_id = $1`,
        [entityId]
      ).catch(() => ({ rows: [{ total: 0, with_journal: 0 }] })),
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE is_posted = true OR status = 'POSTED')::int AS posted,
                COUNT(*) FILTER (WHERE entry_type = 'REVERSAL' OR reference_type = 'JOURNAL_REVERSAL')::int AS reversals
         FROM finance_journal_entries WHERE entity_id = $1`,
        [entityId]
      ).catch(() => ({ rows: [{ total: 0, posted: 0, reversals: 0 }] })),
      db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL)::int AS with_journal
         FROM finance_stock_documents WHERE entity_id = $1`,
        [entityId]
      ).catch(() => ({ rows: [{ total: 0, with_journal: 0 }] })),
      db.query(
        `SELECT inventory_account_id, grni_account_id, cogs_account_id
         FROM finance_inventory_account_map WHERE entity_id = $1 LIMIT 1`,
        [entityId]
      ).catch(() => ({ rows: [] }))
    ]);

    const accountMap = map.rows[0] || null;
    res.json({
      success: true,
      entity_id: entityId,
      invoices: invoices.rows[0],
      payments: payments.rows[0],
      expenses: expenses.rows[0],
      journals: journals.rows[0],
      stock_documents: stock.rows[0],
      inventory_account_map: accountMap,
      inventory_map_ready: !!(accountMap && accountMap.inventory_account_id && accountMap.grni_account_id && accountMap.cogs_account_id),
      links: {
        journal: '/finance/journal.html',
        invoices: '/finance/invoices-budgets-master.html',
        payments: '/finance/payments.html',
        expenses: '/finance/expenses.html',
        inventory: '/finance/inventory.html#links',
        chart: '/finance/chart-of-accounts.html'
      }
    });
  } catch (error) {
    console.error('accounting overview', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/links', async (req, res) => {
  try {
    const entityId = entityOf(req);
    if (!entityId) return res.status(400).json({ success: false, error: 'الكيان مطلوب' });
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const rows = await db.query(
      `SELECT e.entry_id, e.entry_number, e.entry_date, e.entry_type, e.description,
              e.reference_type, e.reference_id, e.reference_number, e.status, e.is_posted,
              e.created_at, e.created_by,
              COALESCE((SELECT SUM(debit_amount) FROM finance_journal_lines l WHERE l.entry_id = e.entry_id),0)::float AS debit_total,
              COALESCE((SELECT SUM(credit_amount) FROM finance_journal_lines l WHERE l.entry_id = e.entry_id),0)::float AS credit_total,
              EXISTS (
                SELECT 1 FROM finance_journal_entries r
                WHERE r.reference_type = 'JOURNAL_REVERSAL' AND r.reference_id = e.entry_id
              ) AS is_reversed
       FROM finance_journal_entries e
       WHERE e.entity_id = $1
       ORDER BY e.entry_id DESC
       LIMIT $2`,
      [entityId, limit]
    );

    const items = [];
    for (const row of rows.rows) {
      const balanced = Math.abs(Number(row.debit_total) - Number(row.credit_total)) <= 0.01;
      const refMeta = await resolveDisplayReference(row);
      items.push({
        ...row,
        balanced,
        source_label: sourceLabel(row.reference_type),
        status_label: statusLabelAr(row.status, row.is_posted),
        ...refMeta,
        source_href: sourceHref(row.reference_type, row.reference_id),
        can_reverse: !!(row.is_posted || row.status === 'POSTED') && !row.is_reversed && row.entry_type !== 'REVERSAL' && row.reference_type !== 'JOURNAL_REVERSAL'
      });
    }

    res.json({ success: true, items, count: items.length });
  } catch (error) {
    console.error('accounting links', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function sourceLabel(type) {
  const map = {
    INVOICE: 'فاتورة مبيعات',
    PAYMENT: 'تحصيل / دفعة',
    EXPENSE: 'مصروف',
    STOCK_DOCUMENT: 'مستند مخزون',
    JOURNAL_REVERSAL: 'عكس قيد',
    AUTO: 'قيد آلي',
    MANUAL: 'قيد يدوي'
  };
  const key = String(type || '').toUpperCase();
  if (!key) return 'غير محدد';
  return map[key] || `مصدر غير معروف (${key})`;
}

function statusLabelAr(status, isPosted) {
  const raw = String(status || '').toUpperCase();
  if (isPosted || raw === 'POSTED') return 'مرحّل';
  const map = {
    APPROVED: 'معتمد',
    DRAFT: 'مسودة',
    PENDING: 'معلق',
    CANCELLED: 'ملغى',
    REVERSED: 'معكوس',
    POSTED: 'مرحّل'
  };
  return map[raw] || (status ? String(status) : '—');
}

function isBadReference(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return true;
  return /nan/i.test(s) || /undefined/i.test(s) || /null/i.test(s);
}

function sourceHref(type, id) {
  const key = String(type || '').toUpperCase();
  const num = Number(id);
  if (!Number.isFinite(num)) return null;
  if (key === 'INVOICE') return `/finance/invoices-budgets-master.html#invoice-${num}`;
  if (key === 'PAYMENT') return `/finance/payments.html#payment-${num}`;
  if (key === 'EXPENSE') return `/finance/expenses.html#expense-${num}`;
  if (key === 'STOCK_DOCUMENT') return `/finance/inventory.html#doc-${num}`;
  if (key === 'JOURNAL_REVERSAL') return `/finance/journal.html#entry-${num}`;
  return null;
}

async function resolveDisplayReference(row) {
  const type = String(row.reference_type || '').toUpperCase();
  const id = Number(row.reference_id);
  const stored = row.reference_number;
  if (!isBadReference(stored)) {
    return { display_reference: String(stored), reference_quality: 'ok' };
  }
  if (!Number.isFinite(id)) {
    return {
      display_reference: stored ? String(stored) : '—',
      reference_quality: 'missing',
      reference_issue: stored ? 'مرجع مخزّن غير صالح' : 'لا يوجد رقم مرجع'
    };
  }
  try {
    if (type === 'INVOICE') {
      const r = await db.query(
        `SELECT invoice_number FROM finance_invoices WHERE invoice_id = $1 LIMIT 1`,
        [id]
      );
      if (r.rows[0]?.invoice_number) {
        return {
          display_reference: r.rows[0].invoice_number,
          reference_quality: 'resolved',
          reference_issue: stored ? `المرجع المخزّن كان تالفًا (${stored})` : 'استُكمل من الفاتورة'
        };
      }
    } else if (type === 'PAYMENT') {
      const r = await db.query(
        `SELECT payment_number FROM finance_payments WHERE payment_id = $1 LIMIT 1`,
        [id]
      );
      if (r.rows[0]?.payment_number) {
        return {
          display_reference: r.rows[0].payment_number,
          reference_quality: 'resolved',
          reference_issue: stored ? `المرجع المخزّن كان تالفًا (${stored})` : 'استُكمل من الدفعة'
        };
      }
    } else if (type === 'EXPENSE') {
      const r = await db.query(
        `SELECT expense_number FROM finance_expenses WHERE expense_id = $1 LIMIT 1`,
        [id]
      );
      if (r.rows[0]?.expense_number) {
        return {
          display_reference: r.rows[0].expense_number,
          reference_quality: 'resolved',
          reference_issue: stored ? `المرجع المخزّن كان تالفًا (${stored})` : 'استُكمل من المصروف'
        };
      }
    } else if (type === 'JOURNAL_REVERSAL') {
      const r = await db.query(
        `SELECT entry_number FROM finance_journal_entries WHERE entry_id = $1 LIMIT 1`,
        [id]
      );
      if (r.rows[0]?.entry_number) {
        return {
          display_reference: r.rows[0].entry_number,
          reference_quality: 'resolved',
          reference_issue: 'مرجع قيد عكسي'
        };
      }
    }
  } catch (_) { /* keep honest missing state */ }

  return {
    display_reference: stored ? String(stored) : `معرف المصدر #${id}`,
    reference_quality: 'unresolved',
    reference_issue: stored ? `تعذر تصحيح المرجع التالف (${stored})` : 'تعذر إيجاد مستند المصدر'
  };
}

router.get('/source/:type/:id', async (req, res) => {
  try {
    const entityId = entityOf(req);
    const type = String(req.params.type || '').toUpperCase();
    const id = Number(req.params.id);
    if (!entityId || !Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'معاملات المصدر غير صالحة' });
    }

    let source = null;
    if (type === 'INVOICE') {
      const r = await db.query(
        `SELECT invoice_id AS id, invoice_number AS number, total_amount, status, journal_entry_id, customer_name, currency_code
         FROM finance_invoices WHERE invoice_id = $1 AND entity_id = $2`,
        [id, entityId]
      );
      source = r.rows[0] || null;
    } else if (type === 'PAYMENT') {
      const r = await db.query(
        `SELECT payment_id AS id, payment_number AS number, payment_amount AS total_amount, status, journal_entry_id,
                customer_name, payment_method, payment_date
         FROM finance_payments WHERE payment_id = $1 AND entity_id = $2`,
        [id, entityId]
      );
      source = r.rows[0] || null;
    } else if (type === 'EXPENSE') {
      const r = await db.query(
        `SELECT expense_id AS id, expense_number AS number, COALESCE(total_amount, amount) AS total_amount, status, journal_entry_id
         FROM finance_expenses WHERE expense_id = $1 AND entity_id = $2`,
        [id, entityId]
      ).catch(async () =>
        db.query(
          `SELECT expense_id AS id, expense_number AS number, amount AS total_amount, status, journal_entry_id
           FROM finance_expenses WHERE expense_id = $1 AND entity_id = $2`,
          [id, entityId]
        )
      );
      source = r.rows[0] || null;
    } else if (type === 'STOCK_DOCUMENT') {
      const r = await db.query(
        `SELECT document_id AS id, document_no AS number, movement_type AS status, journal_entry_id
         FROM finance_stock_documents WHERE document_id = $1 AND entity_id = $2`,
        [id, entityId]
      );
      source = r.rows[0] || null;
    } else {
      return res.status(400).json({ success: false, error: 'نوع مصدر غير مدعوم' });
    }

    if (!source) return res.status(404).json({ success: false, error: 'المصدر غير موجود في هذا الكيان' });

    const journals = await db.query(
      `SELECT entry_id, entry_number, entry_date, description, status, is_posted, reference_type, reference_id
       FROM finance_journal_entries
       WHERE entity_id = $1
         AND (
           (reference_type = $2 AND reference_id = $3)
           OR entry_id = $4
         )
       ORDER BY entry_id`,
      [entityId, type, id, source.journal_entry_id || 0]
    );

    res.json({
      success: true,
      source_type: type,
      source,
      journals: journals.rows,
      source_label: sourceLabel(type)
    });
  } catch (error) {
    console.error('accounting source', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/journals/:entryId', async (req, res) => {
  try {
    const entityId = entityOf(req);
    const entryId = Number(req.params.entryId);
    if (!entityId || !Number.isFinite(entryId)) {
      return res.status(400).json({ success: false, error: 'معرّف القيد أو الكيان غير صالح' });
    }
    const entryRes = await db.query(
      `SELECT * FROM finance_journal_entries WHERE entry_id = $1 AND entity_id = $2`,
      [entryId, entityId]
    );
    if (!entryRes.rows[0]) {
      return res.status(404).json({ success: false, error: 'القيد غير موجود في هذا الكيان' });
    }
    const entry = entryRes.rows[0];
    const linesRes = await db.query(
      `SELECT line_id, line_number, account_id, account_code, account_name,
              debit_amount, credit_amount, description
       FROM finance_journal_lines
       WHERE entry_id = $1
       ORDER BY line_number, line_id`,
      [entryId]
    ).catch(async () =>
      db.query(
        `SELECT line_id, line_number, account_id, account_code,
                debit_amount, credit_amount, description
         FROM finance_journal_lines WHERE entry_id = $1 ORDER BY line_number, line_id`,
        [entryId]
      )
    );
    const debit = linesRes.rows.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
    const credit = linesRes.rows.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
    const reversal = await findActiveReversal(db.pool, entryId).catch(() => []);
    const refMeta = await resolveDisplayReference(entry);
    res.json({
      success: true,
      entry,
      lines: linesRes.rows,
      debit_total: debit,
      credit_total: credit,
      balanced: Math.abs(debit - credit) <= 0.01,
      source_label: sourceLabel(entry.reference_type),
      status_label: statusLabelAr(entry.status, entry.is_posted),
      ...refMeta,
      source_href: sourceHref(entry.reference_type, entry.reference_id),
      reversals: reversal,
      can_reverse: !!(entry.is_posted || entry.status === 'POSTED')
        && !(reversal && reversal.length)
        && entry.entry_type !== 'REVERSAL'
        && entry.reference_type !== 'JOURNAL_REVERSAL',
      links: {
        journal: '/finance/journal.html',
        invoices: '/finance/invoices-budgets-master.html',
        payments: '/finance/payments.html',
        expenses: '/finance/expenses.html'
      }
    });
  } catch (error) {
    console.error('accounting journal detail', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/journals/:entryId/reverse', async (req, res) => {
  try {
    const entryId = Number(req.params.entryId);
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!Number.isFinite(entryId)) {
      return res.status(400).json({ success: false, error: 'معرّف القيد غير صالح' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, error: 'سبب العكس إلزامي', code: 'REASON_REQUIRED' });
    }

    const result = await reverseEntry(db.pool, entryId, {
      req,
      reason,
      manageTransaction: true
    });
    res.status(201).json({
      success: true,
      message: 'تم إنشاء قيد عكسي. القيد الأصلي بقي دون حذف.',
      reversal: result.entry || result.reversal || result,
      original_entry_id: entryId
    });
  } catch (error) {
    if (sendPostingError(res, error)) return;
    console.error('accounting reverse', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/journals/:entryId/reversal-status', async (req, res) => {
  try {
    const entryId = Number(req.params.entryId);
    const existing = await findActiveReversal(db.pool, entryId);
    res.json({
      success: true,
      reversed: existing.length > 0,
      reversals: existing
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
