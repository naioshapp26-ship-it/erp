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
  PostingError,
  roundMoney
} = require('./finance-posting-service');

/** Advisory lock namespace for payment-allocation CRUD (distinct from payment post 11012). */
const ALLOC_CRUD_LOCK_NS = 11013;

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

async function findPostedJournalForPayment(client, paymentId, { forUpdate = false } = {}) {
  // SELECT * keeps slim isolated schemas (may omit entity_type) working
  const pay = await client.query(
    `SELECT * FROM finance_payments WHERE payment_id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
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

/**
 * B1.d.3.e — Payment may be updated/deleted only when:
 * 1) trusted actor owns the payment entity (Admin/HQ do not bypass), and
 * 2) no posted journal linkage exists (journal_entry_id or reference_type=PAYMENT).
 * ctx: { req } or { trustedTestActor, actor } — same contract as posting service.
 * forUpdate: lock payment row (caller should be inside a transaction).
 */
async function assertPaymentMutable(client, paymentId, { forDelete = false, ctx = null, forUpdate = false } = {}) {
  if (forUpdate) {
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [ALLOC_CRUD_LOCK_NS + 1, Number(paymentId)]);
  }

  const { payment, links } = await findPostedJournalForPayment(client, paymentId, { forUpdate });
  if (!payment) {
    throw new GuardError(404, 'NOT_FOUND', 'الدفعة غير موجودة');
  }

  if (ctx != null) {
    const actor = resolveActor(ctx);
    if (!actor.authenticated) {
      throw new GuardError(401, 'AUTH_REQUIRED', 'يجب تسجيل الدخول قبل تعديل أو حذف الدفعة');
    }
    try {
      assertEntityOwns(payment.entity_id, actor, 'الدفعة');
    } catch (err) {
      mapOwnershipError(err);
    }
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

/**
 * B1.d.3.e — delete gate (entity + posted). Alias for clarity at call sites.
 */
async function assertPaymentDeletable(client, paymentId, ctx = {}) {
  return assertPaymentMutable(client, paymentId, { forDelete: true, ctx, forUpdate: true });
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

function mapOwnershipError(err) {
  if (err instanceof PostingError) {
    throw new GuardError(err.status, err.code, err.message, err.extra || {});
  }
  throw err;
}

function assertActorAuthenticated(actor) {
  if (!actor || !actor.authenticated) {
    throw new GuardError(401, 'AUTH_REQUIRED', 'يجب تسجيل الدخول قبل إدارة تخصيصات المدفوعات');
  }
}

/**
 * B1.d.3.b — Payment allocation CRUD guards (create/update/delete).
 * Does NOT update invoice paid/remaining balances (preserves prior CRUD semantics).
 * Does NOT ban unallocated payments (ADVANCE/deposit remain documenting-only in this slice).
 *
 * Caller must run inside an open transaction on `client`.
 *
 * @param {object} client - pg client in a transaction
 * @param {object} opts
 * @param {'create'|'update'|'delete'} opts.mode
 * @param {object} opts.actor - from resolveActor({ req }) or trusted test actor
 * @param {number|string} [opts.allocationId]
 * @param {number|string} [opts.paymentId]
 * @param {number|string} [opts.invoiceId]
 * @param {number|string} [opts.allocatedAmount]
 * @param {object} [opts.address] - optional address columns
 */
async function mutatePaymentAllocationInTx(client, opts = {}) {
  const mode = opts.mode;
  const actor = opts.actor;
  assertActorAuthenticated(actor);

  if (!['create', 'update', 'delete'].includes(mode)) {
    throw new GuardError(400, 'INVALID_MODE', 'وضع تخصيص غير معروف');
  }

  let allocationId = opts.allocationId != null ? Number(opts.allocationId) : null;
  let paymentId = opts.paymentId != null ? Number(opts.paymentId) : null;
  let invoiceId = opts.invoiceId != null ? Number(opts.invoiceId) : null;
  let allocatedAmount =
    opts.allocatedAmount != null && opts.allocatedAmount !== ''
      ? roundMoney(opts.allocatedAmount)
      : null;

  let existing = null;
  if (mode === 'update' || mode === 'delete') {
    if (!allocationId || Number.isNaN(allocationId)) {
      throw new GuardError(400, 'ALLOCATION_ID_REQUIRED', 'allocation_id مطلوب');
    }
    const allocRes = await client.query(
      `SELECT * FROM finance_payment_allocations WHERE allocation_id = $1 FOR UPDATE`,
      [allocationId]
    );
    existing = allocRes.rows[0] || null;
    if (!existing) {
      throw new GuardError(404, 'NOT_FOUND', 'التخصيص غير موجود');
    }
    paymentId = paymentId || Number(existing.payment_id);
    if (mode === 'delete') {
      invoiceId = Number(existing.invoice_id);
    } else {
      invoiceId = invoiceId != null ? invoiceId : Number(existing.invoice_id);
      if (allocatedAmount == null) {
        allocatedAmount = roundMoney(existing.allocated_amount);
      }
    }
  }

  if (mode === 'create') {
    if (!paymentId || Number.isNaN(paymentId) || !invoiceId || Number.isNaN(invoiceId)) {
      throw new GuardError(400, 'FIELDS_REQUIRED', 'payment_id و invoice_id و allocated_amount مطلوبة');
    }
    if (allocatedAmount == null || !(allocatedAmount > 0)) {
      throw new GuardError(400, 'INVALID_AMOUNT', 'allocated_amount يجب أن يكون أكبر من صفر');
    }
  }

  if (mode === 'update') {
    if (!paymentId || !invoiceId || allocatedAmount == null) {
      throw new GuardError(400, 'FIELDS_REQUIRED', 'payment_id و invoice_id و allocated_amount مطلوبة');
    }
    if (!(allocatedAmount > 0)) {
      throw new GuardError(400, 'INVALID_AMOUNT', 'allocated_amount يجب أن يكون أكبر من صفر');
    }
  }

  // Serialize mutations on the payment (and lock payment row).
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [ALLOC_CRUD_LOCK_NS, Number(paymentId)]);

  const payRes = await client.query(
    `SELECT payment_id, payment_number, payment_amount, entity_id, journal_entry_id, status
     FROM finance_payments WHERE payment_id = $1 FOR UPDATE`,
    [paymentId]
  );
  const payment = payRes.rows[0];
  if (!payment) {
    throw new GuardError(404, 'PAYMENT_NOT_FOUND', 'الدفعة غير موجودة');
  }

  try {
    assertEntityOwns(payment.entity_id, actor, 'الدفعة');
  } catch (err) {
    mapOwnershipError(err);
  }

  const { links } = await findPostedJournalForPayment(client, paymentId);
  if (links.length) {
    throw new GuardError(
      409,
      'POSTED_DOCUMENT_LOCKED',
      mode === 'delete'
        ? 'لا يمكن حذف تخصيص تابع لدفعة مرحّلة.'
        : mode === 'create'
          ? 'لا يمكن إضافة تخصيص إلى دفعة مرحّلة خارج عملية محاسبية مصرح بها.'
          : 'لا يمكن تعديل تخصيص تابع لدفعة مرحّلة.',
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

  if (mode === 'delete') {
    const del = await client.query(
      `DELETE FROM finance_payment_allocations WHERE allocation_id = $1 RETURNING allocation_id`,
      [allocationId]
    );
    return { deleted: del.rows[0].allocation_id, payment_id: paymentId };
  }

  const invRes = await client.query(
    `SELECT invoice_id, invoice_number, entity_id, total_amount, paid_amount, remaining_amount,
            status, payment_status, journal_entry_id
     FROM finance_invoices WHERE invoice_id = $1 FOR UPDATE`,
    [invoiceId]
  );
  const invoice = invRes.rows[0];
  if (!invoice) {
    throw new GuardError(404, 'INVOICE_NOT_FOUND', 'فاتورة التخصيص غير موجودة');
  }

  try {
    assertEntityOwns(invoice.entity_id, actor, 'الفاتورة');
  } catch (err) {
    mapOwnershipError(err);
  }

  if (String(invoice.entity_id) !== String(payment.entity_id)) {
    throw new GuardError(
      403,
      'ALLOCATION_ENTITY_MISMATCH',
      'تخصيص دفعة لفاتورة من كيان مختلف مرفوض',
      {
        payment_entity_id: String(payment.entity_id),
        invoice_entity_id: String(invoice.entity_id)
      }
    );
  }

  // Duplicate (payment_id, invoice_id) — application-level (no migration UNIQUE yet).
  const dup = await client.query(
    `SELECT allocation_id FROM finance_payment_allocations
     WHERE payment_id = $1 AND invoice_id = $2
       AND ($3::int IS NULL OR allocation_id <> $3)
     FOR UPDATE`,
    [paymentId, invoiceId, mode === 'update' ? allocationId : null]
  );
  if (dup.rows.length) {
    throw new GuardError(
      409,
      'DUPLICATE_ALLOCATION',
      'تخصيص مكرر لنفس الدفعة والفاتورة مرفوض',
      { existing_allocation_id: dup.rows[0].allocation_id }
    );
  }

  // Payment capacity: sum of allocations (excluding self on update) + new amount <= payment_amount.
  // Intentional: sum may be LESS than payment_amount (unallocated remainder / ADVANCE) — not banned.
  const sumRes = await client.query(
    `SELECT COALESCE(SUM(allocated_amount), 0)::float AS s
     FROM finance_payment_allocations
     WHERE payment_id = $1
       AND ($2::int IS NULL OR allocation_id <> $2)`,
    [paymentId, mode === 'update' ? allocationId : null]
  );
  const otherSum = roundMoney(sumRes.rows[0].s);
  const paymentAmount = roundMoney(payment.payment_amount);
  const newTotal = roundMoney(otherSum + allocatedAmount);
  if (newTotal > paymentAmount + 0.01) {
    throw new GuardError(
      409,
      'OVER_ALLOCATION_PAYMENT',
      'مجموع التخصيصات يتجاوز مبلغ الدفعة',
      {
        payment_amount: paymentAmount,
        other_allocations: otherSum,
        requested: allocatedAmount,
        would_be: newTotal
      }
    );
  }

  const remaining = roundMoney(
    invoice.remaining_amount != null
      ? invoice.remaining_amount
      : Number(invoice.total_amount) - Number(invoice.paid_amount || 0)
  );
  if (allocatedAmount > remaining + 0.01) {
    throw new GuardError(
      409,
      'OVER_ALLOCATION_INVOICE',
      'التخصيص يتجاوز المبلغ المتبقي للفاتورة',
      {
        invoice_id: invoice.invoice_id,
        remaining,
        requested: allocatedAmount
      }
    );
  }

  const address = opts.address || {};
  const addressVals = [
    address.street_name ?? null,
    address.postal_code ?? null,
    address.building_number ?? null,
    address.city ?? null,
    address.district ?? null,
    address.national_address_number ?? null,
    address.short_address ?? null
  ];
  const wantsAddress = addressVals.some((v) => v != null && String(v).trim() !== '');
  let hasAddressCols = false;
  if (wantsAddress) {
    const colCheck = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = ANY (current_schemas(false))
           AND table_name = 'finance_payment_allocations'
           AND column_name = 'street_name'
       ) AS ok`
    );
    hasAddressCols = colCheck.rows[0]?.ok === true;
  }

  if (mode === 'create') {
    let ins;
    if (hasAddressCols) {
      ins = await client.query(
        `INSERT INTO finance_payment_allocations
           (payment_id, invoice_id, allocated_amount,
            street_name, postal_code, building_number, city, district,
            national_address_number, short_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [paymentId, invoiceId, allocatedAmount, ...addressVals]
      );
    } else {
      ins = await client.query(
        `INSERT INTO finance_payment_allocations (payment_id, invoice_id, allocated_amount)
         VALUES ($1,$2,$3)
         RETURNING *`,
        [paymentId, invoiceId, allocatedAmount]
      );
    }
    return {
      allocation: ins.rows[0],
      balances_touched: false,
      note: 'CRUD لا يحدّث paid/remaining — الترحيل المحاسبي عبر مسار التحصيل المصرح'
    };
  }

  // update
  let upd;
  if (hasAddressCols) {
    upd = await client.query(
      `UPDATE finance_payment_allocations
       SET payment_id = $1,
           invoice_id = $2,
           allocated_amount = $3,
           street_name = $4,
           postal_code = $5,
           building_number = $6,
           city = $7,
           district = $8,
           national_address_number = $9,
           short_address = $10
       WHERE allocation_id = $11
       RETURNING *`,
      [paymentId, invoiceId, allocatedAmount, ...addressVals, allocationId]
    );
  } else {
    upd = await client.query(
      `UPDATE finance_payment_allocations
       SET payment_id = $1,
           invoice_id = $2,
           allocated_amount = $3
       WHERE allocation_id = $4
       RETURNING *`,
      [paymentId, invoiceId, allocatedAmount, allocationId]
    );
  }
  return {
    allocation: upd.rows[0],
    balances_touched: false,
    note: 'CRUD لا يحدّث paid/remaining — الترحيل المحاسبي عبر مسار التحصيل المصرح'
  };
}

function isPgPool(db) {
  if (!db || typeof db.connect !== 'function') return false;
  if (typeof db.release === 'function') return false;
  return db.totalCount !== undefined || db.constructor?.name === 'Pool';
}

/**
 * Convenience: BEGIN → mutate → COMMIT/ROLLBACK on a pool or client.
 */
async function mutatePaymentAllocation(poolOrClient, opts = {}) {
  const fromPool = isPgPool(poolOrClient);
  const client = fromPool ? await poolOrClient.connect() : poolOrClient;
  const manageTx = opts.manageTransaction !== false;
  try {
    if (manageTx) await client.query('BEGIN');
    const result = await mutatePaymentAllocationInTx(client, opts);
    if (manageTx) await client.query('COMMIT');
    return result;
  } catch (err) {
    if (manageTx) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* */
      }
    }
    throw err;
  } finally {
    if (fromPool) client.release();
  }
}

module.exports = {
  GuardError,
  isPostedEntry,
  assertJournalEntryMutable,
  assertJournalLineParentMutable,
  assertInvoiceDeletable,
  assertInvoiceMutable,
  assertPaymentMutable,
  assertPaymentDeletable,
  findPostedJournalForInvoice,
  findPostedJournalForPayment,
  mutatePaymentAllocationInTx,
  mutatePaymentAllocation,
  sendGuardError,
  ALLOC_CRUD_LOCK_NS
};
