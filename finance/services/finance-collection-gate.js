'use strict';

/**
 * B1.d.5a.3 — Collection safety gate: block PAYMENT JE for invoices without a valid posted ISSUE JE.
 * Read-only on historical documents (no backfill, no reverse, no auto-link).
 * Must run inside the caller's open transaction; does not BEGIN/COMMIT.
 *
 * Avoids hard circular require with finance-posting-service (lazy PostingError).
 */

const { roundMoney } = require('./finance-invoice-amounts');

const REVERSAL_REF_TYPE = 'JOURNAL_REVERSAL';
const REF_INVOICE = 'INVOICE';
const AMOUNT_TOLERANCE = 0.05;

class CollectionGateError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'CollectionGateError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function toPostingError(err) {
  if (err instanceof CollectionGateError) {
    // Lazy require avoids cycle at module load with finance-posting-service
    const { PostingError } = require('./finance-posting-service');
    return new PostingError(err.status, err.code, err.message, err.extra || {});
  }
  return err;
}

function entityKey(v) {
  return v == null ? '' : String(v);
}

function isCancelledInvoice(status) {
  const s = String(status || '').toUpperCase();
  return s === 'CANCELLED' || s === 'CANCELED' || s === 'VOID';
}

function isActivePostedIssueCandidate(row) {
  if (!row) return false;
  if (row.is_posted !== true) return false;
  if (String(row.status || '').toUpperCase() !== 'POSTED') return false;
  if (String(row.entry_type || '').toUpperCase() === 'REVERSAL') return false;
  if (String(row.reference_type || '') === REVERSAL_REF_TYPE) return false;
  if (String(row.reference_type || '') !== REF_INVOICE) return false;
  return true;
}

/**
 * Resolve invoice issue JE candidates for collection (read + row locks only).
 */
async function resolveInvoiceIssueForCollection(client, invoiceId) {
  const id = Number(invoiceId);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      invoice: null,
      activeEntries: [],
      decision: {
        outcome: 'REJECT',
        code: 'INVOICE_NOT_FOUND',
        message: 'الفاتورة غير موجودة',
        status: 404,
        extra: { invoice_id: invoiceId }
      }
    };
  }

  const invRes = await client.query(
    `SELECT invoice_id, invoice_number, journal_entry_id, status, entity_id,
            total_amount, paid_amount, remaining_amount, payment_status
     FROM finance_invoices
     WHERE invoice_id = $1
     FOR UPDATE`,
    [id]
  );
  const invoice = invRes.rows[0] || null;
  if (!invoice) {
    return {
      invoice: null,
      activeEntries: [],
      decision: {
        outcome: 'REJECT',
        code: 'INVOICE_NOT_FOUND',
        message: `فاتورة التخصيص غير موجودة: ${id}`,
        status: 404,
        extra: { invoice_id: id }
      }
    };
  }

  if (isCancelledInvoice(invoice.status)) {
    return {
      invoice,
      activeEntries: [],
      decision: {
        outcome: 'REJECT',
        code: 'INVOICE_NOT_COLLECTABLE',
        message: 'لا يمكن تحصيل فاتورة ملغاة أو باطلة',
        status: 422,
        extra: { invoice_id: id, outcome: 'REJECT', status: invoice.status }
      }
    };
  }

  const candidateIds = new Set();
  if (invoice.journal_entry_id != null) {
    candidateIds.add(Number(invoice.journal_entry_id));
  }
  const byRef = await client.query(
    `SELECT entry_id FROM finance_journal_entries
     WHERE reference_type = $1 AND reference_id = $2`,
    [REF_INVOICE, id]
  );
  for (const r of byRef.rows) candidateIds.add(Number(r.entry_id));

  const sortedIds = [...candidateIds].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const locked = [];
  for (const entryId of sortedIds) {
    const er = await client.query(
      `SELECT entry_id, entry_number, status, is_posted, entry_type, reference_type, reference_id, entity_id
       FROM finance_journal_entries
       WHERE entry_id = $1
       FOR UPDATE`,
      [entryId]
    );
    if (er.rows[0]) locked.push(er.rows[0]);
  }

  const activeEntries = [];
  for (const entry of locked) {
    if (!isActivePostedIssueCandidate(entry)) continue;
    if (Number(entry.reference_id) !== id) continue;
    const rev = await client.query(
      `SELECT entry_id FROM finance_journal_entries
       WHERE reference_type = $1 AND reference_id = $2
         AND is_posted = true AND UPPER(COALESCE(status,'')) = 'POSTED'
       LIMIT 1`,
      [REVERSAL_REF_TYPE, entry.entry_id]
    );
    if (rev.rows.length) continue;
    activeEntries.push(entry);
  }

  if (activeEntries.length === 0) {
    const hadPostedIssue = locked.some(
      (e) =>
        String(e.reference_type || '') === REF_INVOICE &&
        Number(e.reference_id) === id &&
        e.is_posted === true &&
        String(e.status || '').toUpperCase() === 'POSTED' &&
        String(e.entry_type || '').toUpperCase() !== 'REVERSAL'
    );
    if (hadPostedIssue) {
      return {
        invoice,
        activeEntries: [],
        decision: {
          outcome: 'REJECT',
          code: 'INVOICE_ISSUE_JE_REVERSED',
          message: 'قيد إصدار الفاتورة معكوس ولا يمكن التحصيل عليه',
          status: 422,
          extra: { invoice_id: id, outcome: 'REJECT' }
        }
      };
    }
    return {
      invoice,
      activeEntries: [],
      decision: {
        outcome: 'REJECT',
        code: 'INVOICE_ISSUE_JE_REQUIRED',
        message: 'لا يمكن تحصيل فاتورة بلا قيد إصدار محاسبي مرحّل وصحيح',
        status: 422,
        extra: {
          invoice_id: id,
          outcome: 'REJECT',
          journal_entry_id: invoice.journal_entry_id
        }
      }
    };
  }

  if (activeEntries.length > 1) {
    return {
      invoice,
      activeEntries,
      decision: {
        outcome: 'HUMAN_REVIEW',
        code: 'INVOICE_ISSUE_JE_AMBIGUOUS',
        message: 'أكثر من قيد إصدار مرحّل مرشّح لنفس الفاتورة — أوقف التحصيل للمراجعة',
        status: 409,
        extra: {
          invoice_id: id,
          outcome: 'HUMAN_REVIEW',
          entry_ids: activeEntries.map((e) => e.entry_id)
        }
      }
    };
  }

  const sole = activeEntries[0];

  if (invoice.journal_entry_id != null && Number(invoice.journal_entry_id) !== Number(sole.entry_id)) {
    return {
      invoice,
      activeEntries,
      decision: {
        outcome: 'HUMAN_REVIEW',
        code: 'INVOICE_ISSUE_JE_LINK_CONFLICT',
        message: 'تعارض بين journal_entry_id ومرجع قيد الإصدار — أوقف التحصيل للمراجعة',
        status: 409,
        extra: {
          invoice_id: id,
          outcome: 'HUMAN_REVIEW',
          journal_entry_id: invoice.journal_entry_id,
          active_entry_id: sole.entry_id
        }
      }
    };
  }

  if (entityKey(invoice.entity_id) !== entityKey(sole.entity_id)) {
    return {
      invoice,
      activeEntries,
      decision: {
        outcome: 'HUMAN_REVIEW',
        code: 'INVOICE_ISSUE_JE_ENTITY_MISMATCH',
        message: 'اختلاف كيان الفاتورة عن كيان قيد الإصدار — أوقف التحصيل للمراجعة',
        status: 409,
        extra: {
          invoice_id: id,
          outcome: 'HUMAN_REVIEW',
          invoice_entity_id: invoice.entity_id,
          journal_entity_id: sole.entity_id,
          entry_id: sole.entry_id
        }
      }
    };
  }

  const amtRes = await client.query(
    `SELECT COALESCE(SUM(debit_amount), 0)::float AS dr_1130
     FROM finance_journal_lines
     WHERE entry_id = $1 AND account_code = '1130'`,
    [sole.entry_id]
  );
  const dr1130 = roundMoney(amtRes.rows[0].dr_1130);
  const total = roundMoney(invoice.total_amount);
  if (Math.abs(dr1130 - total) > AMOUNT_TOLERANCE) {
    return {
      invoice,
      activeEntries,
      decision: {
        outcome: 'HUMAN_REVIEW',
        code: 'INVOICE_ISSUE_JE_AMOUNT_MISMATCH',
        message: 'مبلغ قيد الإصدار (مدين 1130) لا يطابق إجمالي الفاتورة — أوقف التحصيل للمراجعة',
        status: 409,
        extra: {
          invoice_id: id,
          outcome: 'HUMAN_REVIEW',
          entry_id: sole.entry_id,
          invoice_total: total,
          issue_je_dr_1130: dr1130
        }
      }
    };
  }

  return {
    invoice,
    activeEntries,
    decision: {
      outcome: 'ALLOW',
      code: 'INVOICE_ISSUE_JE_OK',
      message: 'قيد إصدار سليم',
      status: 200,
      extra: {
        invoice_id: id,
        outcome: 'ALLOW',
        entry_id: sole.entry_id,
        resolved_via:
          invoice.journal_entry_id != null ? 'journal_entry_id' : 'reference_type:INVOICE'
      }
    }
  };
}

/**
 * Throws PostingError on REJECT (422/404) or HUMAN_REVIEW (409). Returns ALLOW meta.
 * Does not open its own transaction.
 */
async function assertInvoiceIssueReadyForCollection(client, invoiceId) {
  const resolved = await resolveInvoiceIssueForCollection(client, invoiceId);
  const d = resolved.decision;
  if (d.outcome === 'ALLOW') {
    return {
      ok: true,
      invoice: resolved.invoice,
      entry: resolved.activeEntries[0],
      code: d.code,
      extra: d.extra
    };
  }
  throw toPostingError(
    new CollectionGateError(d.status || 422, d.code, d.message, {
      outcome: d.outcome,
      ...(d.extra || {})
    })
  );
}

module.exports = {
  assertInvoiceIssueReadyForCollection,
  resolveInvoiceIssueForCollection,
  CollectionGateError,
  AMOUNT_TOLERANCE,
  isCancelledInvoice,
  isActivePostedIssueCandidate,
  toPostingError
};
