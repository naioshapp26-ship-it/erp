'use strict';

/**
 * B1.c — Backend guards for posted journals / invoices / payments.
 * B1.d.2 readiness (D3/G3): invoice DELETE requires trusted entity ownership.
 * No migrations. Arabic error messages for protected mutations.
 */

const {
  REVERSAL_REF_TYPE,
  resolveActor,
  assertEntityOwns,
  PostingError
} = require('./finance-posting-service');

class GuardError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'GuardError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function isPostedEntry(row) {
  if (!row) return false;
  return row.is_posted === true || String(row.status || '').toUpperCase() === 'POSTED';
}

async function loadJournalEntry(client, entryId) {
  const r = await client.query(
    `SELECT entry_id, entry_number, status, is_posted, entry_type, reference_type, reference_id
     FROM finance_journal_entries WHERE entry_id = $1`,
    [entryId]
  );
  return r.rows[0] || null;
}

async function hasActiveReversal(client, entryId) {
  const r = await client.query(
    `SELECT entry_id FROM finance_journal_entries
     WHERE reference_type = $1 AND reference_id = $2
       AND is_posted = true AND status = 'POSTED'
     LIMIT 1`,
    [REVERSAL_REF_TYPE, entryId]
  );
  return r.rows.length > 0;
}

/**
 * Journal entry may be deleted/updated only when DRAFT and not a reversal and not reversed.
 */
async function assertJournalEntryMutable(client, entryId, { forDelete = false } = {}) {
  const entry = await loadJournalEntry(client, entryId);
  if (!entry) {
    throw new GuardError(404, 'NOT_FOUND', 'القيد المحاسبي غير موجود');
  }
  if (isPostedEntry(entry)) {
    throw new GuardError(
      409,
      'POSTED_DOCUMENT_LOCKED',
      forDelete
        ? 'لا يمكن حذف قيد مرحّل. استخدم مسار العكس المحاسبي المخصص.'
        : 'لا يمكن تعديل قيد مرحّل. البيانات المحاسبية مقفلة بعد الترحيل.'
    );
  }
  if (entry.entry_type === 'REVERSAL' || entry.reference_type === REVERSAL_REF_TYPE) {
    throw new GuardError(
      409,
      'REVERSAL_LOCKED',
      'لا يمكن حذف أو تعديل قيد عكسي محاسبي من هذا المسار.'
    );
  }
  if (await hasActiveReversal(client, entryId)) {
    throw new GuardError(
      409,
      'HAS_REVERSAL',
      'لا يمكن حذف أو تعديل قيد مرتبط بعكس محاسبي نشط.'
    );
  }
  return entry;
}

async function assertJournalLineParentMutable(client, entryId) {
  return assertJournalEntryMutable(client, entryId, { forDelete: false });
}

/**
 * Find posted journal linkage for an invoice even if journal_entry_id is null.
 */
async function findPostedJournalForInvoice(client, invoiceId) {
  const inv = await client.query(
    `SELECT invoice_id, invoice_number, journal_entry_id, status, entity_id
     FROM finance_invoices WHERE invoice_id = $1`,
    [invoiceId]
  );
  if (!inv.rows.length) return { invoice: null, links: [] };
  const invoice = inv.rows[0];
  const links = [];

  if (invoice.journal_entry_id) {
    const je = await loadJournalEntry(client, invoice.journal_entry_id);
    if (je && isPostedEntry(je)) {
      links.push({ via: 'journal_entry_id', entry: je });
    }
  }

  const byRef = await client.query(
    `SELECT entry_id, entry_number, status, is_posted, entry_type, reference_type, reference_id
     FROM finance_journal_entries
     WHERE reference_type = 'INVOICE'
       AND reference_id = $1
       AND is_posted = true
       AND status = 'POSTED'`,
    [invoiceId]
  );
  for (const row of byRef.rows) {
    if (!links.some((l) => Number(l.entry.entry_id) === Number(row.entry_id))) {
      links.push({ via: 'reference_type:INVOICE', entry: row });
    }
  }

  return { invoice, links };
}

/**
 * Invoice may be deleted only when:
 * 1) trusted actor owns the invoice entity (D3 / G3 — Admin/HQ do not bypass), and
 * 2) no posted journal linkage exists.
 * ctx: { req } or { trustedTestActor, actor } — same contract as posting service.
 */
async function assertInvoiceDeletable(client, invoiceId, ctx = {}) {
  const { invoice, links } = await findPostedJournalForInvoice(client, invoiceId);
  if (!invoice) {
    throw new GuardError(404, 'NOT_FOUND', 'الفاتورة غير موجودة');
  }

  const actor = resolveActor(ctx);
  try {
    assertEntityOwns(invoice.entity_id, actor, 'الفاتورة');
  } catch (err) {
    if (err instanceof PostingError) {
      throw new GuardError(err.status, err.code, err.message, err.extra || {});
    }
    throw err;
  }

  if (links.length) {
    throw new GuardError(
      409,
      'POSTED_DOCUMENT_LOCKED',
      'لا يمكن حذف فاتورة مرتبطة بقيد محاسبي مرحّل. ألغِ عبر العكس المحاسبي أولًا.',
      {
        invoice_id: invoice.invoice_id,
        linked_entries: links.map((l) => ({
          via: l.via,
          entry_id: l.entry.entry_id,
          entry_number: l.entry.entry_number
        }))
      }
    );
  }
  return invoice;
}

/**
 * Block financial mutation of invoices that already have posted JE links.
 * Does not change invoice status — only rejects the request.
 */
async function assertInvoiceMutable(client, invoiceId) {
  const { invoice, links } = await findPostedJournalForInvoice(client, invoiceId);
  if (!invoice) {
    throw new GuardError(404, 'NOT_FOUND', 'الفاتورة غير موجودة');
  }
  if (links.length) {
    throw new GuardError(
      409,
      'POSTED_DOCUMENT_LOCKED',
      'لا يمكن تعديل فاتورة مرتبطة بقيد محاسبي مرحّل.',
      {
        invoice_id: invoice.invoice_id,
        linked_entries: links.map((l) => ({
          via: l.via,
          entry_id: l.entry.entry_id,
          entry_number: l.entry.entry_number
        }))
      }
    );
  }
  return invoice;
}

async function findPostedJournalForPayment(client, paymentId) {
  const pay = await client.query(
    `SELECT payment_id, payment_number, journal_entry_id, status
     FROM finance_payments WHERE payment_id = $1`,
    [paymentId]
  );
  if (!pay.rows.length) return { payment: null, links: [] };
  const payment = pay.rows[0];
  const links = [];

  if (payment.journal_entry_id) {
    const je = await loadJournalEntry(client, payment.journal_entry_id);
    if (je && isPostedEntry(je)) {
      links.push({ via: 'journal_entry_id', entry: je });
    }
  }

  const byRef = await client.query(
    `SELECT entry_id, entry_number, status, is_posted, entry_type, reference_type, reference_id
     FROM finance_journal_entries
     WHERE reference_type = 'PAYMENT'
       AND reference_id = $1
       AND is_posted = true
       AND status = 'POSTED'`,
    [paymentId]
  );
  for (const row of byRef.rows) {
    if (!links.some((l) => Number(l.entry.entry_id) === Number(row.entry_id))) {
      links.push({ via: 'reference_type:PAYMENT', entry: row });
    }
  }

  return { payment, links };
}

async function assertPaymentMutable(client, paymentId, { forDelete = false } = {}) {
  const { payment, links } = await findPostedJournalForPayment(client, paymentId);
  if (!payment) {
    throw new GuardError(404, 'NOT_FOUND', 'الدفعة غير موجودة');
  }
  if (links.length) {
    throw new GuardError(
      409,
      'POSTED_DOCUMENT_LOCKED',
      forDelete
        ? 'لا يمكن حذف دفعة مرتبطة بقيد محاسبي مرحّل.'
        : 'لا يمكن تعديل دفعة مرتبطة بقيد محاسبي مرحّل.',
      {
        payment_id: payment.payment_id,
        linked_entries: links.map((l) => ({
          via: l.via,
          entry_id: l.entry.entry_id,
          entry_number: l.entry.entry_number
        }))
      }
    );
  }
  return payment;
}

function sendGuardError(res, err) {
  if (err instanceof GuardError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.extra || {})
    });
  }
  return null;
}

module.exports = {
  GuardError,
  isPostedEntry,
  assertJournalEntryMutable,
  assertJournalLineParentMutable,
  assertInvoiceDeletable,
  assertInvoiceMutable,
  assertPaymentMutable,
  findPostedJournalForInvoice,
  findPostedJournalForPayment,
  sendGuardError
};
