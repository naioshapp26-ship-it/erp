'use strict';

/**
 * FinancePostingService — B1.b
 * Unified post/reverse for MANUAL journal entries only.
 * Does NOT touch invoice/payment auto-posting paths.
 * No schema migrations: reverse linkage via reference_type/reference_id on the NEW entry;
 * concurrency via pg_advisory_xact_lock + row FOR UPDATE.
 */

const REVERSAL_REF_TYPE = 'JOURNAL_REVERSAL';
const ENTRY_TYPE_REVERSAL = 'REVERSAL';

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
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function parsePermissions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return String(raw)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Trusted actor from server session only (req.authUser set by auth middleware).
 * Client headers x-user-role / x-finance-permissions are IGNORED (spoofable).
 * Tests may pass ctx.actor explicitly with ctx.trustedTestActor=true.
 */
function resolveActor(reqOrCtx = {}) {
  if (reqOrCtx.actor && reqOrCtx.trustedTestActor === true) {
    return {
      ...reqOrCtx.actor,
      authenticated: true,
      trustSource: 'test'
    };
  }
  const req = reqOrCtx.req || reqOrCtx;
  const headers = req.headers || {};
  const authUser = req.authUser || null;
  if (authUser && (authUser.id || authUser.role || authUser.email)) {
    return {
      userId: authUser.id || null,
      userName: authUser.name || authUser.email || null,
      role: authUser.role || null,
      // permissions only from server-attached authUser, never request headers
      permissions: parsePermissions(authUser.permissions || authUser.financePermissions),
      ip: headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: headers['user-agent'] || null,
      entityId: req.userEntity?.id || req.authenticatedEntityContext?.id || null,
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
    entityId: req.userEntity?.id || null,
    authenticated: false,
    trustSource: 'none'
  };
}

/**
 * Backend permission gate — default deny.
 * Trusted role/permissions from session authUser only (B1.c closes legacy_unscoped).
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
  const perm = action === 'reverse' ? 'journals.reverse' : 'journals.post';
  if (actor.permissions.includes('*') || actor.permissions.includes(perm)) {
    return { ok: true, mode: 'explicit_permission' };
  }
  const role = String(actor.role || '').trim();
  const roleNorm = role.toLowerCase();
  // Trusted admin-equivalent roles from session (Arabic + English product roles)
  const isAdminRole =
    /^(admin|administrator|super_admin|company_admin|system_admin)$/i.test(roleNorm) ||
    role === 'مسؤول النظام' ||
    /مسؤول/.test(role);
  if (isAdminRole) {
    return { ok: true, mode: 'role_admin' };
  }
  if (action === 'post' && /^(manager|hr_manager)$/i.test(roleNorm)) {
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
  try {
    await client.query(
      `INSERT INTO audit_logs
       (user_id, user_name, entity_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        Number.isFinite(Number(actor.userId)) ? Number(actor.userId) : null,
        actor.userName ? String(actor.userName).slice(0, 100) : String(actor.userId || '').slice(0, 100) || null,
        actor.entityId ? String(actor.entityId).slice(0, 20) : null,
        String(action).slice(0, 50),
        String(resourceType || 'journal_entry').slice(0, 50),
        String(resourceId || '').slice(0, 100) || null,
        oldValue != null ? String(typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)).slice(0, 4000) : null,
        newValue != null ? String(typeof newValue === 'string' ? newValue : JSON.stringify(newValue)).slice(0, 4000) : null,
        actor.ip ? String(actor.ip).slice(0, 45) : null,
        actor.userAgent ? String(actor.userAgent).slice(0, 500) : null,
        reason || null,
        status
      ]
    );
  } catch (err) {
    // Soft-fail: audit must not abort posting if audit_logs unavailable in a schema
    console.warn('finance audit_logs write skipped:', err.message);
  }
}

async function advisoryLock(client, namespace, id) {
  // Two-int advisory lock: namespace hash + entry id
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [namespace, Number(id)]);
}

async function generateEntryNumber(client, prefix = 'JE') {
  const result = await client.query(
    `SELECT entry_number FROM finance_journal_entries WHERE entry_number LIKE $1 ORDER BY entry_number DESC LIMIT 1`,
    [`${prefix}%`]
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
      newValue: { status: 'POSTED', totals, permission_mode: perm.mode },
      reason: ctx.reason || null,
      status: 'SUCCESS'
    });

    if (manageTx) await client.query('COMMIT');
    return {
      success: true,
      entry: result.rows[0],
      message: 'Journal entry posted successfully',
      meta: { permission_mode: perm.mode, totals }
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
        permission_mode: perm.mode
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
      meta: { permission_mode: perm.mode }
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
  resolveActor,
  assertPermission,
  postManualEntry,
  reverseEntry,
  findActiveReversal,
  assertBalanced,
  writeAudit
};
