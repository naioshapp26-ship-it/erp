'use strict';

/**
 * FinancePostingService — B1.b + B1.c auth + B1.d.1 helpers + B1.d.2 readiness (D1/D2) + B1.d.3.c payment JE meta.
 * Still does NOT wire POST /finance/payments (or invoice flag enablement outside isolated tests).
 * D1: journal amounts from stored invoice after roundMoney (2dp) — no invoice↔JE drift.
 * D2: invoice JE metadata matches legacy POST /finance/invoices (prefix JE-, descriptions, reference_number).
 * B1.d.3.c: payment JE metadata matches legacy POST /finance/payments (JE-, وصف قيد آلي، reference_number،
 *   أوصاف الأسطر، بلا posted_at/posted_by كالمسار الحالي). Amounts/accounts unchanged.
 * Entity ownership is mandatory (including HQ): cross-entity requires explicit session grant.
 * No schema migrations: duplicate prevention is application-level (locks + lookups) until UNIQUE approved.
 */

const {
  roundMoney,
  journalAmountsFromStoredInvoice,
  buildLegacyInvoiceJournalLines,
  legacyInvoiceJournalDescription
} = require('./finance-invoice-amounts');
const {
  legacyPaymentJournalDescription,
  buildLegacyPaymentJournalLines
} = require('./finance-payment-journal-meta');
const {
  assertInvoiceIssueReadyForCollection
} = require('./finance-collection-gate');

const REVERSAL_REF_TYPE = 'JOURNAL_REVERSAL';
const ENTRY_TYPE_REVERSAL = 'REVERSAL';
const REF_INVOICE = 'INVOICE';
const REF_PAYMENT = 'PAYMENT';

class PostingError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'PostingError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function round2(n) {
  return roundMoney(n);
}

function parsePermissions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return String(raw)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeEntityIdList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  return String(raw)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Trusted actor from server session only (req.authUser set by auth middleware).
 * Client headers x-user-role / x-finance-permissions / x-entity-id are IGNORED for authz.
 * Cross-entity: only authUser.allow_cross_entity + allowed_entity_ids from session (never request body).
 * Tests may pass ctx.actor with ctx.trustedTestActor=true.
 */
function resolveActor(reqOrCtx = {}) {
  if (reqOrCtx.actor && reqOrCtx.trustedTestActor === true) {
    const a = reqOrCtx.actor;
    return {
      ...a,
      authenticated: true,
      trustSource: 'test',
      entityId: a.entityId != null ? String(a.entityId) : null,
      entityType: a.entityType || null,
      allowCrossEntity: a.allowCrossEntity === true,
      allowedEntityIds: normalizeEntityIdList(a.allowedEntityIds)
    };
  }
  const req = reqOrCtx.req || reqOrCtx;
  const headers = req.headers || {};
  const authUser = req.authUser || null;
  const entityCtx = req.authenticatedEntityContext || req.userEntity || null;
  if (authUser && (authUser.id || authUser.role || authUser.email)) {
    return {
      userId: authUser.id || null,
      userName: authUser.name || authUser.email || null,
      role: authUser.role || null,
      permissions: parsePermissions(authUser.permissions || authUser.financePermissions),
      ip: headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: headers['user-agent'] || null,
      // Entity scope from server-resolved context only (not spoofable x-entity-id alone without session)
      entityId: entityCtx?.id != null ? String(entityCtx.id) : null,
      entityType: entityCtx?.type || null,
      allowCrossEntity: authUser.allow_cross_entity === true || authUser.allowCrossEntity === true,
      allowedEntityIds: normalizeEntityIdList(
        authUser.allowed_entity_ids || authUser.allowedEntityIds || entityCtx?.allowedEntityIds
      ),
      authenticated: true,
      trustSource: 'session'
    };
  }
  return {
    userId: null,
    userName: null,
    role: null,
    permissions: [],
    ip: headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
    userAgent: headers['user-agent'] || null,
    entityId: null,
    entityType: null,
    allowCrossEntity: false,
    allowedEntityIds: [],
    authenticated: false,
    trustSource: 'none'
  };
}

function permissionNameForAction(action) {
  if (action === 'reverse') return 'journals.reverse';
  if (action === 'invoice_post') return 'invoices.post';
  if (action === 'payment_post') return 'payments.post';
  return 'journals.post';
}

/**
 * Backend permission gate — default deny.
 * Admin role grants post/reverse/invoice_post/payment_post but NEVER bypasses entity ownership.
 */
function assertPermission(actor, action) {
  if (!actor || !actor.authenticated) {
    return {
      ok: false,
      mode: 'unauthenticated',
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'يجب تسجيل الدخول بصلاحية خادمية موثوقة قبل الترحيل أو العكس'
    };
  }
  const perm = permissionNameForAction(action);
  if (actor.permissions.includes('*') || actor.permissions.includes(perm)) {
    return { ok: true, mode: 'explicit_permission' };
  }
  // invoices.post / payments.post also accept journals.post as broader finance posting right
  if (
    (action === 'invoice_post' || action === 'payment_post') &&
    actor.permissions.includes('journals.post')
  ) {
    return { ok: true, mode: 'explicit_permission' };
  }
  const role = String(actor.role || '').trim();
  const roleNorm = role.toLowerCase();
  const isAdminRole =
    /^(admin|administrator|super_admin|company_admin|system_admin)$/i.test(roleNorm) ||
    role === 'مسؤول النظام' ||
    /مسؤول/.test(role);
  if (isAdminRole) {
    return { ok: true, mode: 'role_admin' };
  }
  if ((action === 'post' || action === 'invoice_post' || action === 'payment_post') &&
      /^(manager|hr_manager)$/i.test(roleNorm)) {
    return { ok: true, mode: 'role_manager' };
  }
  return {
    ok: false,
    mode: 'denied',
    status: 403,
    code: 'PERMISSION_DENIED',
    message: `مطلوب صلاحية ${perm} من جلسة مصادقة موثوقة`
  };
}

/**
 * Strict entity ownership. HQ/admin roles do not bypass.
 * Cross-entity only when session carries allowCrossEntity + allowedEntityIds (server-set).
 */
function assertEntityOwns(resourceEntityId, actor, resourceLabel = 'المستند') {
  if (!actor || !actor.authenticated) {
    throw new PostingError(401, 'AUTH_REQUIRED', 'يجب تسجيل الدخول قبل الوصول للمستند');
  }
  if (!actor.entityId) {
    throw new PostingError(
      403,
      'ENTITY_SCOPE_REQUIRED',
      'جلسة المستخدم بلا كيان موثوق — مرفوض'
    );
  }
  const resEnt =
    resourceEntityId === undefined || resourceEntityId === null || String(resourceEntityId).trim() === ''
      ? null
      : String(resourceEntityId).trim();
  if (!resEnt) {
    throw new PostingError(
      403,
      'ENTITY_MISSING_ON_RESOURCE',
      `${resourceLabel} بلا entity_id — لا يمكن ترحيله بأمان`
    );
  }
  if (resEnt === String(actor.entityId)) {
    return { mode: 'same_entity', entityId: resEnt };
  }
  if (actor.allowCrossEntity === true && (actor.allowedEntityIds || []).map(String).includes(resEnt)) {
    return { mode: 'explicit_cross_entity_grant', entityId: resEnt };
  }
  throw new PostingError(
    403,
    'CROSS_ENTITY_DENIED',
    `رفض الوصول العابر للكيانات: ${resourceLabel} يتبع كيانًا آخر`,
    {
      actor_entity_id: String(actor.entityId),
      resource_entity_id: resEnt,
      allow_cross_entity: actor.allowCrossEntity === true,
      note: 'دور admin/HQ لا يكفي — يلزم تفويض خادمي صريح allowed_entity_ids'
    }
  );
}

async function writeAudit(client, {
  actor,
  action,
  resourceType,
  resourceId,
  oldValue,
  newValue,
  reason,
  status = 'SUCCESS'
}) {
  // Soft-fail audit must never abort the caller's posting transaction (PG 25P02).
  // Use SAVEPOINT when already inside a txn; plain INSERT when autocommit (no txn).
  const params = [
    Number.isFinite(Number(actor.userId)) ? Number(actor.userId) : null,
    actor.userName
      ? String(actor.userName).slice(0, 100)
      : String(actor.userId || '').slice(0, 100) || null,
    actor.entityId ? String(actor.entityId).slice(0, 20) : null,
    String(action).slice(0, 50),
    String(resourceType || 'journal_entry').slice(0, 50),
    String(resourceId || '').slice(0, 100) || null,
    oldValue != null
      ? String(typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)).slice(0, 4000)
      : null,
    newValue != null
      ? String(typeof newValue === 'string' ? newValue : JSON.stringify(newValue)).slice(0, 4000)
      : null,
    actor.ip ? String(actor.ip).slice(0, 45) : null,
    actor.userAgent ? String(actor.userAgent).slice(0, 500) : null,
    reason || null,
    status
  ];
  const insertSql = `INSERT INTO audit_logs
       (user_id, user_name, entity_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;

  let spOpen = false;
  try {
    await client.query('SAVEPOINT finance_audit_write');
    spOpen = true;
  } catch {
    /* not in a transaction block — insert in autocommit below */
  }

  try {
    await client.query(insertSql, params);
    if (spOpen) await client.query('RELEASE SAVEPOINT finance_audit_write');
  } catch (err) {
    if (spOpen) {
      try {
        await client.query('ROLLBACK TO SAVEPOINT finance_audit_write');
      } catch {
        /* */
      }
    }
    console.warn('finance audit_logs write skipped:', err.message);
  }
}

async function advisoryLock(client, namespace, id) {
  // Two-int advisory lock: namespace hash + entry id
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [namespace, Number(id)]);
}

async function generateEntryNumber(client, prefix = 'JE') {
  // Match legacy generateNextNumber('JE'): JE-0001 style; ignore other prefixes like JE-INV-
  const result = await client.query(
    `SELECT entry_number FROM finance_journal_entries
     WHERE entry_number ~ ('^' || $1 || '-[0-9]+$')
     ORDER BY entry_number DESC
     LIMIT 1`,
    [prefix]
  );
  const lastNumber = result.rows[0]?.entry_number || '';
  const numericMatches = String(lastNumber).match(/\d+/g) || [];
  const lastNumeric = numericMatches.length ? parseInt(numericMatches[numericMatches.length - 1], 10) || 0 : 0;
  const nextNum = lastNumeric + 1;
  const padded = nextNum < 10000 ? String(nextNum).padStart(4, '0') : String(nextNum);
  return `${prefix}-${padded}`;
}

async function loadEntryForUpdate(client, entryId) {
  const result = await client.query(
    `SELECT * FROM finance_journal_entries WHERE entry_id = $1 FOR UPDATE`,
    [entryId]
  );
  return result.rows[0] || null;
}

async function loadLines(client, entryId) {
  const result = await client.query(
    `SELECT * FROM finance_journal_lines WHERE entry_id = $1 ORDER BY line_number ASC, line_id ASC`,
    [entryId]
  );
  return result.rows;
}

function assertBalanced(lines) {
  if (!lines.length) {
    throw new PostingError(422, 'NO_LINES', 'لا توجد بنود للقيد');
  }
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += Number(line.debit_amount || 0);
    credit += Number(line.credit_amount || 0);
  }
  debit = round2(debit);
  credit = round2(credit);
  if (Math.abs(debit - credit) > 0.01) {
    throw new PostingError(422, 'UNBALANCED', 'المدين والدائن غير متوازنين', { totalDebit: debit, totalCredit: credit });
  }
  if (debit <= 0) {
    throw new PostingError(422, 'ZERO_AMOUNT', 'مبلغ القيد يجب أن يكون أكبر من صفر', { totalDebit: debit, totalCredit: credit });
  }
  return { totalDebit: debit, totalCredit: credit };
}

async function assertAccountsValid(client, lines) {
  for (const line of lines) {
    const code = line.account_code;
    const id = line.account_id;
    if (!code && !id) {
      throw new PostingError(422, 'ACCOUNT_REQUIRED', 'كل بند يحتاج حسابًا');
    }
    let row;
    if (id) {
      row = await client.query(
        `SELECT account_id, account_code, COALESCE(is_active, true) AS is_active, COALESCE(is_header, false) AS is_header
         FROM finance_accounts WHERE account_id = $1`,
        [id]
      );
    } else {
      row = await client.query(
        `SELECT account_id, account_code, COALESCE(is_active, true) AS is_active, COALESCE(is_header, false) AS is_header
         FROM finance_accounts WHERE account_code = $1`,
        [code]
      );
    }
    if (!row.rows.length) {
      throw new PostingError(422, 'ACCOUNT_NOT_FOUND', `حساب غير موجود: ${code || id}`);
    }
    const acc = row.rows[0];
    if (acc.is_active === false) {
      throw new PostingError(422, 'ACCOUNT_INACTIVE', `حساب غير نشط: ${acc.account_code}`);
    }
    if (acc.is_header === true) {
      throw new PostingError(422, 'ACCOUNT_HEADER', `لا يمكن الترحيل على حساب رئيسي: ${acc.account_code}`);
    }
  }
}

async function findActiveReversal(client, originalEntryId) {
  const result = await client.query(
    `SELECT entry_id, entry_number, status, is_posted
     FROM finance_journal_entries
     WHERE reference_type = $1
       AND reference_id = $2
       AND is_posted = true
       AND status = 'POSTED'
     ORDER BY entry_id ASC`,
    [REVERSAL_REF_TYPE, originalEntryId]
  );
  return result.rows;
}

/**
 * Post a DRAFT manual journal entry.
 * Preserves API semantics: already-posted / missing → not found style via code ALREADY_POSTED / NOT_FOUND.
 */
function isPool(db) {
  if (!db || typeof db.connect !== 'function') return false;
  // pg.Pool exposes totalCount; a connected Client must not be treated as a pool.
  if (typeof db.release === 'function') return false;
  return db.totalCount !== undefined || db.constructor?.name === 'Pool';
}

async function postManualEntry(poolOrClient, entryId, ctx = {}) {
  const actor = resolveActor(ctx);
  const perm = assertPermission(actor, 'post');
  if (!perm.ok) {
    throw new PostingError(perm.status, perm.code, perm.message);
  }

  const fromPool = isPool(poolOrClient);
  const client = fromPool ? await poolOrClient.connect() : poolOrClient;
  const manageTx = ctx.manageTransaction !== false;

  try {
    if (manageTx) await client.query('BEGIN');

    await advisoryLock(client, 11001, entryId);
    const entry = await loadEntryForUpdate(client, entryId);
    if (!entry) {
      throw new PostingError(404, 'NOT_FOUND', 'Journal entry not found or already posted');
    }
    const entityGate = assertEntityOwns(entry.entity_id, actor, 'القيد المحاسبي');
    if (entry.is_posted === true || entry.status === 'POSTED') {
      // Preserve prior contract: 404 when already posted
      throw new PostingError(404, 'ALREADY_POSTED', 'Journal entry not found or already posted');
    }
    if (entry.status !== 'DRAFT') {
      throw new PostingError(409, 'INVALID_STATUS', `لا يمكن ترحيل قيد بحالة ${entry.status}`);
    }

    const lines = await loadLines(client, entryId);
    const totals = assertBalanced(lines);
    await assertAccountsValid(client, lines);

    const result = await client.query(
      `UPDATE finance_journal_entries
       SET status = 'POSTED', is_posted = true, posted_at = NOW(), posted_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE entry_id = $2 AND status = 'DRAFT' AND COALESCE(is_posted, false) = false
       RETURNING *`,
      [String(actor.userId), entryId]
    );
    if (!result.rows.length) {
      throw new PostingError(409, 'CONFLICT', 'تعذر الترحيل بسبب تعارض متزامن');
    }

    await writeAudit(client, {
      actor,
      action: 'JOURNAL_POST',
      resourceId: String(entryId),
      oldValue: { status: entry.status, is_posted: entry.is_posted },
      newValue: {
        status: 'POSTED',
        totals,
        permission_mode: perm.mode,
        entity_gate: entityGate.mode
      },
      reason: ctx.reason || null,
      status: 'SUCCESS'
    });

    if (manageTx) await client.query('COMMIT');
    return {
      success: true,
      entry: result.rows[0],
      message: 'Journal entry posted successfully',
      meta: { permission_mode: perm.mode, totals, entity_gate: entityGate.mode }
    };
  } catch (err) {
    if (manageTx) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
    }
    throw err;
  } finally {
    if (fromPool) client.release();
  }
}

/**
 * Reverse a POSTED entry by creating a new linked REVERSAL entry.
 * Does NOT update/delete the original posted row (link lives on the new entry).
 * Double-reverse blocked by advisory lock + SELECT of existing JOURNAL_REVERSAL rows.
 * Without a UNIQUE migration, protection is transactional+advisory (documented residual risk under lock bypass).
 */
async function reverseEntry(poolOrClient, entryId, ctx = {}) {
  const actor = resolveActor(ctx);
  const perm = assertPermission(actor, 'reverse');
  if (!perm.ok) {
    throw new PostingError(perm.status, perm.code, perm.message);
  }
  const reason = (ctx.reason || ctx.req?.body?.reason || '').trim();
  if (!reason) {
    throw new PostingError(400, 'REASON_REQUIRED', 'سبب العكس إلزامي');
  }

  const fromPool = isPool(poolOrClient);
  const client = fromPool ? await poolOrClient.connect() : poolOrClient;
  const manageTx = ctx.manageTransaction !== false;

  try {
    if (manageTx) await client.query('BEGIN');

    await advisoryLock(client, 11002, entryId);
    const original = await loadEntryForUpdate(client, entryId);
    if (!original) {
      throw new PostingError(404, 'NOT_FOUND', 'القيد الأصلي غير موجود');
    }
    const entityGate = assertEntityOwns(original.entity_id, actor, 'القيد المحاسبي');
    if (!(original.is_posted === true || original.status === 'POSTED')) {
      throw new PostingError(409, 'NOT_POSTED', 'لا يمكن عكس قيد غير مرحّل');
    }
    if (original.entry_type === ENTRY_TYPE_REVERSAL || original.reference_type === REVERSAL_REF_TYPE) {
      throw new PostingError(409, 'CANNOT_REVERSE_REVERSAL', 'لا يُسمح بعكس قيد عكسي في B1.b');
    }

    const existing = await findActiveReversal(client, entryId);
    if (existing.length) {
      throw new PostingError(409, 'ALREADY_REVERSED', 'تم عكس هذا القيد مسبقًا', {
        reversal_entry_id: existing[0].entry_id,
        reversal_entry_number: existing[0].entry_number
      });
    }

    const lines = await loadLines(client, entryId);
    assertBalanced(lines);
    await assertAccountsValid(client, lines);

    const entryNumber = await generateEntryNumber(client, 'JE-REV');
    const description = `عكس القيد ${original.entry_number} — ${reason}`.slice(0, 2000);

    const ins = await client.query(
      `INSERT INTO finance_journal_entries
       (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
        entity_type, entity_id, branch_id, incubator_id, platform_id, office_id,
        fiscal_year, fiscal_period, status, is_posted, posted_at, posted_by, created_by, attachments)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7,
               $8, $9, $10, $11, $12, $13,
               $14, $15, 'POSTED', true, NOW(), $16, $16,
               $17::jsonb)
       RETURNING *`,
      [
        entryNumber,
        original.entry_date,
        ENTRY_TYPE_REVERSAL,
        description,
        original.entry_number,
        REVERSAL_REF_TYPE,
        original.entry_id,
        original.entity_type || null,
        original.entity_id || null,
        original.branch_id || null,
        original.incubator_id || null,
        original.platform_id || null,
        original.office_id || null,
        original.fiscal_year || null,
        original.fiscal_period || null,
        String(actor.userId),
        JSON.stringify({
          reversal_of_entry_id: original.entry_id,
          reversal_of_entry_number: original.entry_number,
          reason,
          created_by_service: 'FinancePostingService'
        })
      ]
    );
    const reversal = ins.rows[0];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      await client.query(
        `INSERT INTO finance_journal_lines
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description,
          entity_type, entity_id, branch_id, incubator_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          reversal.entry_id,
          i + 1,
          line.account_id,
          line.account_code,
          line.credit_amount || 0, // flipped
          line.debit_amount || 0,
          `عكس: ${line.description || ''}`.trim(),
          line.entity_type || original.entity_type || null,
          line.entity_id || original.entity_id || null,
          line.branch_id || original.branch_id || null,
          line.incubator_id || original.incubator_id || null
        ]
      );
    }

    // Re-check after insert (belt): another reversal must not exist besides ours
    const after = await findActiveReversal(client, entryId);
    if (after.length !== 1 || Number(after[0].entry_id) !== Number(reversal.entry_id)) {
      throw new PostingError(409, 'REVERSE_RACE', 'تعارض أثناء إنشاء العكس');
    }

    await writeAudit(client, {
      actor,
      action: 'JOURNAL_REVERSE',
      resourceId: String(entryId),
      oldValue: { entry_id: original.entry_id, entry_number: original.entry_number },
      newValue: {
        reversal_entry_id: reversal.entry_id,
        reversal_entry_number: reversal.entry_number,
        link: { reference_type: REVERSAL_REF_TYPE, reference_id: original.entry_id },
        permission_mode: perm.mode,
        entity_gate: entityGate.mode
      },
      reason,
      status: 'SUCCESS'
    });

    if (manageTx) await client.query('COMMIT');
    return {
      success: true,
      entry: reversal,
      original_entry_id: original.entry_id,
      message: 'Journal entry reversed successfully',
      meta: { permission_mode: perm.mode, entity_gate: entityGate.mode }
    };
  } catch (err) {
    if (manageTx) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
    }
    throw err;
  } finally {
    if (fromPool) client.release();
  }
}

async function findActivePostedByReference(client, referenceType, referenceId) {
  const result = await client.query(
    `SELECT entry_id, entry_number, status, is_posted, entry_type, reference_type, reference_id
     FROM finance_journal_entries
     WHERE reference_type = $1
       AND reference_id = $2
       AND is_posted = true
       AND status = 'POSTED'
       AND COALESCE(entry_type, '') <> $3
     ORDER BY entry_id ASC`,
    [referenceType, referenceId, ENTRY_TYPE_REVERSAL]
  );
  return result.rows;
}

async function resolveAccountByCode(client, code) {
  const r = await client.query(
    `SELECT account_id, account_code FROM finance_accounts
     WHERE account_code = $1 AND COALESCE(is_active, true) = true AND COALESCE(is_header, false) = false
     LIMIT 1`,
    [code]
  );
  if (!r.rows.length) {
    throw new PostingError(422, 'ACCOUNT_NOT_FOUND', `حساب غير موجود أو غير قابل للترحيل: ${code}`);
  }
  return r.rows[0];
}

/**
 * B1.d.1 helper — post invoice issue JE (NOT wired to HTTP routes yet).
 * Application-level duplicate guard; DB UNIQUE still requires separate approval.
 */
async function postInvoiceIssue(poolOrClient, invoiceId, ctx = {}) {
  const actor = resolveActor(ctx);
  const perm = assertPermission(actor, 'invoice_post');
  if (!perm.ok) throw new PostingError(perm.status, perm.code, perm.message);

  const fromPool = isPool(poolOrClient);
  const client = fromPool ? await poolOrClient.connect() : poolOrClient;
  const manageTx = ctx.manageTransaction !== false;

  try {
    if (manageTx) await client.query('BEGIN');
    await advisoryLock(client, 11011, invoiceId);

    const invRes = await client.query(
      `SELECT * FROM finance_invoices WHERE invoice_id = $1 FOR UPDATE`,
      [invoiceId]
    );
    const invoice = invRes.rows[0];
    if (!invoice) throw new PostingError(404, 'NOT_FOUND', 'الفاتورة غير موجودة');

    const entityGate = assertEntityOwns(invoice.entity_id, actor, 'الفاتورة');

    if (invoice.journal_entry_id) {
      const existing = await loadEntryForUpdate(client, invoice.journal_entry_id);
      if (existing && (existing.is_posted === true || existing.status === 'POSTED')) {
        throw new PostingError(409, 'ALREADY_POSTED', 'الفاتورة مرحّلة مسبقًا', {
          journal_entry_id: existing.entry_id
        });
      }
    }
    const byRef = await findActivePostedByReference(client, REF_INVOICE, invoiceId);
    if (byRef.length) {
      throw new PostingError(409, 'ALREADY_POSTED', 'يوجد قيد مرحّل لنفس الفاتورة (مرجع)', {
        journal_entry_id: byRef[0].entry_id,
        protection: 'application_lookup_only_until_unique_index'
      });
    }

    // D1: stored invoice amounts (2dp) are the only JE source — no unrounded JS drift
    const amounts = journalAmountsFromStoredInvoice(invoice);
    if (amounts.total_amount <= 0) {
      throw new PostingError(422, 'ZERO_AMOUNT', 'مبلغ الفاتورة غير صالح للترحيل');
    }
    const rebuilt = roundMoney(amounts.net + amounts.tax_amount);
    if (Math.abs(rebuilt - amounts.total_amount) > 0.01) {
      throw new PostingError(
        422,
        'INVOICE_AMOUNT_INCONSISTENT',
        'مجموع صافي الفاتورة والضريبة لا يطابق الإجمالي المخزّن',
        { ...amounts, rebuilt }
      );
    }

    const a1130 = await resolveAccountByCode(client, '1130');
    const a4100 = await resolveAccountByCode(client, '4100');
    const a2140 = amounts.tax_amount > 0 ? await resolveAccountByCode(client, '2140') : null;

    // D2: legacy metadata/descriptions expected by current reports & integrations
    const lineSpecs = buildLegacyInvoiceJournalLines(invoice, amounts);
    const lines = lineSpecs.map((spec) => {
      let account_id = a1130.account_id;
      if (spec.account_code === '4100') account_id = a4100.account_id;
      if (spec.account_code === '2140') account_id = a2140.account_id;
      return { ...spec, account_id };
    });
    const totals = assertBalanced(lines);

    // Assert JE amounts === invoice stored (no residual drift)
    if (
      Math.abs(totals.totalDebit - amounts.total_amount) > 0.001 ||
      Math.abs(roundMoney(amounts.net + amounts.tax_amount) - amounts.total_amount) > 0.001
    ) {
      throw new PostingError(500, 'JE_INVOICE_DRIFT', 'تعارض داخلي بين مبالغ الفاتورة والقيد');
    }

    const entryNumber = await generateEntryNumber(client, 'JE');
    const ins = await client.query(
      `INSERT INTO finance_journal_entries
       (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
        entity_type, entity_id, branch_id, incubator_id, status, is_posted, created_by)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), 'AUTO', $3, $4, $5, $6,
               $7, $8, $9, $10, 'POSTED', true, $11)
       RETURNING *`,
      [
        entryNumber,
        invoice.invoice_date,
        legacyInvoiceJournalDescription(invoice.invoice_number),
        invoice.invoice_number,
        REF_INVOICE,
        invoice.invoice_id,
        invoice.entity_type || actor.entityType || null,
        invoice.entity_id,
        invoice.branch_id || null,
        invoice.incubator_id || null,
        String(actor.userId)
      ]
    );
    const entry = ins.rows[0];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // D2: legacy journal_lines insert has no entity_id column usage (entry carries entity)
      await client.query(
        `INSERT INTO finance_journal_lines
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          entry.entry_id,
          i + 1,
          line.account_id,
          line.account_code,
          line.debit_amount,
          line.credit_amount,
          line.description
        ]
      );
    }

    // Avoid depending on optional updated_at (slim isolated schemas may omit it)
    await client.query(
      `UPDATE finance_invoices SET journal_entry_id = $1 WHERE invoice_id = $2`,
      [entry.entry_id, invoiceId]
    );

    // Belt: re-read duplicates
    const again = await findActivePostedByReference(client, REF_INVOICE, invoiceId);
    if (again.length !== 1 || Number(again[0].entry_id) !== Number(entry.entry_id)) {
      throw new PostingError(409, 'POST_RACE', 'تعارض ترحيل فاتورة متزامن');
    }

    await writeAudit(client, {
      actor,
      action: 'INVOICE_POST',
      resourceType: 'invoice',
      resourceId: String(invoiceId),
      newValue: {
        journal_entry_id: entry.entry_id,
        totals,
        permission_mode: perm.mode,
        entity_gate: entityGate.mode,
        duplicate_protection: 'application_only'
      },
      status: 'SUCCESS'
    });

    if (manageTx) await client.query('COMMIT');
    return {
      success: true,
      entry,
      invoice_id: invoiceId,
      message: 'Invoice posted successfully',
      meta: {
        permission_mode: perm.mode,
        entity_gate: entityGate.mode,
        totals,
        amounts,
        metadata_profile: 'legacy_invoice_auto_post',
        duplicate_protection: 'application_lookup_and_lock_until_unique_index'
      }
    };
  } catch (err) {
    if (manageTx) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
    }
    throw err;
  } finally {
    if (fromPool) client.release();
  }
}

/**
 * Resolve customer display name for legacy payment JE line descriptions.
 * Prefers payment.customer_name when present; falls back to finance_customers.
 */
async function resolvePaymentCustomerName(client, payment) {
  if (payment.customer_name && String(payment.customer_name).trim()) {
    return String(payment.customer_name).trim();
  }
  if (payment.customer_id == null) return 'عميل';
  const r = await client.query(
    `SELECT * FROM finance_customers WHERE customer_id = $1`,
    [payment.customer_id]
  );
  const row = r.rows[0];
  if (!row) return 'عميل';
  return row.customer_name_ar || row.customer_name || row.customer_name_en || 'عميل';
}

/**
 * B1.d.1 helper — post payment receipt JE with allocations in one transaction (NOT wired to HTTP).
 * B1.d.3.c — JE metadata aligned to live POST /finance/payments (amounts/accounts unchanged).
 */
async function postPaymentReceipt(poolOrClient, paymentId, ctx = {}) {
  const actor = resolveActor(ctx);
  const perm = assertPermission(actor, 'payment_post');
  if (!perm.ok) throw new PostingError(perm.status, perm.code, perm.message);

  const fromPool = isPool(poolOrClient);
  const client = fromPool ? await poolOrClient.connect() : poolOrClient;
  const manageTx = ctx.manageTransaction !== false;

  try {
    if (manageTx) await client.query('BEGIN');
    await advisoryLock(client, 11012, paymentId);

    const payRes = await client.query(
      `SELECT * FROM finance_payments WHERE payment_id = $1 FOR UPDATE`,
      [paymentId]
    );
    const payment = payRes.rows[0];
    if (!payment) throw new PostingError(404, 'NOT_FOUND', 'الدفعة غير موجودة');

    const entityGate = assertEntityOwns(payment.entity_id, actor, 'الدفعة');

    if (payment.journal_entry_id) {
      throw new PostingError(409, 'ALREADY_POSTED', 'الدفعة مرحّلة مسبقًا', {
        journal_entry_id: payment.journal_entry_id
      });
    }
    const byRef = await findActivePostedByReference(client, REF_PAYMENT, paymentId);
    if (byRef.length) {
      throw new PostingError(409, 'ALREADY_POSTED', 'يوجد قيد مرحّل لنفس الدفعة', {
        journal_entry_id: byRef[0].entry_id,
        protection: 'application_lookup_only_until_unique_index'
      });
    }

    const allocs = await client.query(
      `SELECT * FROM finance_payment_allocations WHERE payment_id = $1 FOR UPDATE`,
      [paymentId]
    );
    if (!allocs.rows.length) {
      throw new PostingError(
        422,
        'ALLOCATIONS_REQUIRED',
        'الترحيل يتطلب تخصيصات دفعات. الدفعات غير المخصصة / ADVANCE غير مسموحة (سياسة ADVANCE-B).',
        { policy: 'ADVANCE_B' }
      );
    }

    // Stable lock order by invoice_id to reduce deadlocks under concurrent collections
    const allocRows = [...allocs.rows].sort(
      (a, b) => Number(a.invoice_id) - Number(b.invoice_id)
    );

    const paymentAmount = round2(payment.payment_amount);
    const allocSum = round2(allocRows.reduce((s, a) => s + Number(a.allocated_amount || 0), 0));
    if (Math.abs(allocSum - paymentAmount) > 0.01) {
      throw new PostingError(422, 'ALLOCATION_MISMATCH', 'مجموع التخصيصات لا يساوي مبلغ الدفعة', {
        payment_amount: paymentAmount,
        allocations_sum: allocSum
      });
    }

    for (const alloc of allocRows) {
      // B1.d.5a.3 — collection safety gate (issue JE) before remaining/balance checks
      await advisoryLock(client, 11011, Number(alloc.invoice_id));
      const issueGate = await assertInvoiceIssueReadyForCollection(client, alloc.invoice_id);
      const inv = issueGate.invoice;
      assertEntityOwns(inv.entity_id, actor, `فاتورة ${alloc.invoice_id}`);
      if (String(inv.entity_id) !== String(payment.entity_id)) {
        throw new PostingError(
          403,
          'ALLOCATION_ENTITY_MISMATCH',
          'تخصيص بين كيانات مختلفة مرفوض'
        );
      }
      const remaining = round2(inv.remaining_amount != null ? inv.remaining_amount : Number(inv.total_amount) - Number(inv.paid_amount || 0));
      const allocated = round2(alloc.allocated_amount);
      if (allocated > remaining + 0.01) {
        throw new PostingError(422, 'OVER_ALLOCATION', 'التخصيص يتجاوز متبقي الفاتورة', {
          invoice_id: inv.invoice_id,
          remaining,
          allocated
        });
      }
    }

    const customerName = await resolvePaymentCustomerName(client, payment);
    const lineSpecs = buildLegacyPaymentJournalLines({
      paymentAmount,
      paymentMethod: payment.payment_method,
      customerName
    });
    const lines = [];
    for (const spec of lineSpecs) {
      const acc = await resolveAccountByCode(client, spec.account_code);
      lines.push({ ...spec, account_id: acc.account_id });
    }
    const totals = assertBalanced(lines);

    // B1.d.3.c: match live generateNextNumber('JE') → JE-#### (not JE-PAY-)
    const entryNumber = await generateEntryNumber(client, 'JE');
    // Legacy live INSERT: no posted_at/posted_by; audit retained via writeAudit + created_by from trusted actor
    const ins = await client.query(
      `INSERT INTO finance_journal_entries
       (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
        entity_type, entity_id, branch_id, incubator_id, status, is_posted, created_by)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), 'AUTO', $3, $4, $5, $6,
               $7, $8, $9, $10, 'POSTED', true, $11)
       RETURNING *`,
      [
        entryNumber,
        payment.payment_date,
        legacyPaymentJournalDescription(payment.payment_number),
        payment.payment_number,
        REF_PAYMENT,
        payment.payment_id,
        payment.entity_type || actor.entityType || null,
        payment.entity_id,
        payment.branch_id != null ? payment.branch_id : null,
        payment.incubator_id != null ? payment.incubator_id : null,
        String(actor.userId)
      ]
    );
    const entry = ins.rows[0];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match live route: journal_lines without entity_id (header carries entity)
      await client.query(
        `INSERT INTO finance_journal_lines
         (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          entry.entry_id,
          i + 1,
          line.account_id,
          line.account_code,
          line.debit_amount,
          line.credit_amount,
          line.description
        ]
      );
    }

    await client.query(
      `UPDATE finance_payments
       SET journal_entry_id = $1,
           status = CASE WHEN status IS NULL OR status = 'PENDING' THEN 'APPROVED' ELSE status END
       WHERE payment_id = $2`,
      [entry.entry_id, paymentId]
    );

    for (const alloc of allocRows) {
      const allocated = round2(alloc.allocated_amount);
      await client.query(
        `UPDATE finance_invoices
         SET paid_amount = COALESCE(paid_amount, 0) + $1,
             remaining_amount = GREATEST(COALESCE(total_amount, 0) - (COALESCE(paid_amount, 0) + $1), 0),
             payment_status = CASE
               WHEN GREATEST(COALESCE(total_amount, 0) - (COALESCE(paid_amount, 0) + $1), 0) <= 0.01 THEN 'PAID'
               ELSE 'PARTIAL'
             END,
             status = CASE
               WHEN GREATEST(COALESCE(total_amount, 0) - (COALESCE(paid_amount, 0) + $1), 0) <= 0.01 THEN 'PAID'
               ELSE 'PARTIAL'
             END
         WHERE invoice_id = $2`,
        [allocated, alloc.invoice_id]
      );
    }

    await writeAudit(client, {
      actor,
      action: 'PAYMENT_POST',
      resourceType: 'payment',
      resourceId: String(paymentId),
      newValue: {
        journal_entry_id: entry.entry_id,
        totals,
        allocations: allocRows.length,
        permission_mode: perm.mode,
        entity_gate: entityGate.mode,
        metadata_profile: 'legacy_payment_auto_post',
        duplicate_protection: 'application_only'
      },
      status: 'SUCCESS'
    });

    if (manageTx) await client.query('COMMIT');
    return {
      success: true,
      entry,
      payment_id: paymentId,
      message: 'Payment posted successfully',
      meta: {
        permission_mode: perm.mode,
        entity_gate: entityGate.mode,
        totals,
        metadata_profile: 'legacy_payment_auto_post',
        duplicate_protection: 'application_lookup_and_lock_until_unique_index'
      }
    };
  } catch (err) {
    if (manageTx) {
      try { await client.query('ROLLBACK'); } catch { /* */ }
    }
    throw err;
  } finally {
    if (fromPool) client.release();
  }
}

module.exports = {
  PostingError,
  REVERSAL_REF_TYPE,
  ENTRY_TYPE_REVERSAL,
  REF_INVOICE,
  REF_PAYMENT,
  resolveActor,
  assertPermission,
  assertEntityOwns,
  postManualEntry,
  reverseEntry,
  postInvoiceIssue,
  postPaymentReceipt,
  findActiveReversal,
  findActivePostedByReference,
  assertBalanced,
  writeAudit,
  roundMoney,
  journalAmountsFromStoredInvoice,
  buildLegacyInvoiceJournalLines,
  legacyInvoiceJournalDescription,
  legacyPaymentJournalDescription,
  buildLegacyPaymentJournalLines,
  assertInvoiceIssueReadyForCollection
};
