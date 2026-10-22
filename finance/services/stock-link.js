'use strict';

const { applyInbound, applyOutbound, roundQty, roundCost } = require('./inventory-policy');

function httpError(status, error) {
  const err = new Error(error);
  err.status = status;
  return err;
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

function normalizeCurrency(value) {
  const code = String(value || 'SAR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw httpError(400, 'رمز العملة يجب أن يكون ثلاثة أحرف.');
  return code;
}

function optionalCostCenter(value) {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'مركز التكلفة غير صالح.');
  return id;
}

async function ensureStockLinkSchema(db) {
  await db.query(`
    ALTER TABLE finance_stock_documents ADD COLUMN IF NOT EXISTS source_type TEXT;
    ALTER TABLE finance_stock_documents ADD COLUMN IF NOT EXISTS source_id TEXT;
    ALTER TABLE finance_stock_documents ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER;
    ALTER TABLE finance_stock_documents ADD COLUMN IF NOT EXISTS cost_center_id INTEGER;
    ALTER TABLE finance_stock_documents ADD COLUMN IF NOT EXISTS currency_code TEXT;
    ALTER TABLE finance_stock_documents ADD COLUMN IF NOT EXISTS reverses_document_id INTEGER;
    CREATE TABLE IF NOT EXISTS finance_inventory_account_map (
      entity_id TEXT PRIMARY KEY,
      inventory_account_id INTEGER NOT NULL,
      grni_account_id INTEGER NOT NULL,
      cogs_account_id INTEGER NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'SAR',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS finance_document_links (
      link_id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL,
      from_type TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_type TEXT NOT NULL,
      to_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (entity_id, from_type, from_id, to_type, to_id)
    );
    CREATE TABLE IF NOT EXISTS finance_stock_source_qty (
      allocation_id SERIAL PRIMARY KEY,
      entity_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_line TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      quantity NUMERIC(14,3) NOT NULL,
      direction TEXT NOT NULL,
      document_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_fin_doc_links_from ON finance_document_links(entity_id, from_type, from_id);
    CREATE INDEX IF NOT EXISTS idx_fin_doc_links_to ON finance_document_links(entity_id, to_type, to_id);
    CREATE INDEX IF NOT EXISTS idx_fin_source_qty ON finance_stock_source_qty(entity_id, source_type, source_id, source_line);
  `);
}

async function lockBalance(client, entityId, itemId, warehouseId) {
  const existing = await client.query(
    `SELECT qty, avg_cost FROM finance_stock_balances
     WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3
     FOR UPDATE`,
    [entityId, itemId, warehouseId]
  );
  if (existing.rows.length) {
    return { qty: Number(existing.rows[0].qty), avgCost: Number(existing.rows[0].avg_cost) };
  }
  await client.query(
    `INSERT INTO finance_stock_balances (entity_id, item_id, warehouse_id, qty, avg_cost)
     VALUES ($1,$2,$3,0,0)
     ON CONFLICT (entity_id, item_id, warehouse_id) DO NOTHING`,
    [entityId, itemId, warehouseId]
  );
  const locked = await client.query(
    `SELECT qty, avg_cost FROM finance_stock_balances
     WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3
     FOR UPDATE`,
    [entityId, itemId, warehouseId]
  );
  return { qty: Number(locked.rows[0].qty), avgCost: Number(locked.rows[0].avg_cost) };
}

async function saveBalance(client, entityId, itemId, warehouseId, next) {
  await client.query(
    `UPDATE finance_stock_balances
     SET qty = $4, avg_cost = $5, updated_at = NOW()
     WHERE entity_id = $1 AND item_id = $2 AND warehouse_id = $3`,
    [entityId, itemId, warehouseId, next.qty, next.avgCost]
  );
}

async function nextDocumentNo(client, entityId) {
  const result = await client.query(
    `INSERT INTO finance_stock_counters (entity_id, last_no) VALUES ($1, 1)
     ON CONFLICT (entity_id) DO UPDATE SET last_no = finance_stock_counters.last_no + 1
     RETURNING last_no`,
    [entityId]
  );
  return `STK-${String(result.rows[0].last_no).padStart(4, '0')}`;
}

async function findByRequest(client, entityId, clientRequestId) {
  if (!clientRequestId) return null;
  const existing = await client.query(
    `SELECT document_id FROM finance_stock_documents WHERE entity_id = $1 AND client_request_id = $2`,
    [entityId, clientRequestId]
  );
  return existing.rows[0] ? existing.rows[0].document_id : null;
}

async function requireWarehouse(client, entityId, warehouseId) {
  const warehouse = await client.query(
    `SELECT * FROM finance_warehouses WHERE warehouse_id = $1 AND entity_id = $2`,
    [warehouseId, entityId]
  );
  if (!warehouse.rows.length || !warehouse.rows[0].is_active) {
    throw httpError(404, 'المستودع غير موجود أو غير نشط.');
  }
  return warehouse.rows[0];
}

async function requireStockItem(client, entityId, itemId) {
  const item = await client.query(
    `SELECT * FROM finance_items WHERE item_id = $1 AND entity_id = $2 FOR UPDATE`,
    [itemId, entityId]
  );
  if (!item.rows.length) throw httpError(404, 'الصنف غير موجود في هذا الكيان.');
  if (!item.rows[0].is_active) throw httpError(409, 'الصنف غير نشط.');
  if (!item.rows[0].is_stocked || item.rows[0].item_type === 'service') {
    throw httpError(422, 'الخدمات لا تُحرّك مخزونًا.');
  }
  return item.rows[0];
}

async function requireMap(client, entityId) {
  const map = await client.query(
    `SELECT m.*,
            inv.account_code AS inventory_code,
            grni.account_code AS grni_code,
            cogs.account_code AS cogs_code,
            inv.is_active AS inventory_active,
            grni.is_active AS grni_active,
            cogs.is_active AS cogs_active,
            inv.is_header AS inventory_header,
            grni.is_header AS grni_header,
            cogs.is_header AS cogs_header
     FROM finance_inventory_account_map m
     JOIN finance_accounts inv ON inv.account_id = m.inventory_account_id
     JOIN finance_accounts grni ON grni.account_id = m.grni_account_id
     JOIN finance_accounts cogs ON cogs.account_id = m.cogs_account_id
     WHERE m.entity_id = $1`,
    [entityId]
  );
  if (!map.rows.length) {
    throw httpError(422, 'اربط حسابات المخزون والوسيط وتكلفة المبيعات قبل ترحيل أثر مالي.');
  }
  const row = map.rows[0];
  if (!row.inventory_active || !row.grni_active || !row.cogs_active || row.inventory_header || row.grni_header || row.cogs_header) {
    throw httpError(422, 'حسابات الربط يجب أن تكون حسابات فرعية نشطة.');
  }
  return row;
}

async function addLink(client, entityId, fromType, fromId, toType, toId) {
  await client.query(
    `INSERT INTO finance_document_links (entity_id, from_type, from_id, to_type, to_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (entity_id, from_type, from_id, to_type, to_id) DO NOTHING`,
    [entityId, fromType, String(fromId), toType, String(toId)]
  );
}

async function postJournal(client, spec) {
  const debit = money(spec.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
  const credit = money(spec.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));
  if (!(debit > 0) || Math.abs(debit - credit) > 0.001) {
    throw httpError(422, 'القيد غير متوازن أو بمبلغ صفر.');
  }
  const entityKey = String(spec.entityId || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  const entryNumber = `JE-${spec.referenceNumber}-${entityKey}`;
  const today = new Date().toISOString().slice(0, 10);
  const entry = await client.query(
    `INSERT INTO finance_journal_entries
      (entry_number, entry_date, entry_type, description, reference_number, reference_type, reference_id,
       status, is_posted, posted_at, posted_by, entity_type, entity_id, fiscal_year, fiscal_period, created_by)
     VALUES ($1,$2,'AUTO',$3,$4,'STOCK_DOCUMENT',$5,'POSTED',true,NOW(),$6,$7,$8,$9,$10,$6)
     RETURNING *`,
    [
      entryNumber,
      today,
      spec.description,
      spec.referenceNumber,
      spec.referenceId,
      spec.actor,
      spec.entityType || 'OFFICE',
      spec.entityId,
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)),
    ]
  );
  let lineNumber = 1;
  for (const line of spec.lines) {
    await client.query(
      `INSERT INTO finance_journal_lines
        (entry_id, line_number, account_id, account_code, debit_amount, credit_amount, description, cost_center_id, entity_type, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.rows[0].entry_id,
        lineNumber,
        line.accountId,
        line.code,
        money(line.debit || 0),
        money(line.credit || 0),
        line.description,
        spec.costCenterId,
        spec.entityType || 'OFFICE',
        spec.entityId
      ]
    );
    lineNumber += 1;
  }
  return entry.rows[0];
}

async function present(client, entityId, documentId) {
  const doc = await client.query(
    `SELECT * FROM finance_stock_documents WHERE document_id = $1 AND entity_id = $2`,
    [documentId, entityId]
  );
  if (!doc.rows.length) throw httpError(404, 'مستند المخزون غير موجود في هذا الكيان.');
  const lines = await client.query(
    `SELECT m.*, i.sku, i.name_ar, w.code AS warehouse_code
     FROM finance_stock_movements m
     JOIN finance_items i ON i.item_id = m.item_id
     JOIN finance_warehouses w ON w.warehouse_id = m.warehouse_id
     WHERE m.document_id = $1
     ORDER BY m.movement_id`,
    [documentId]
  );
  const links = await client.query(
    `SELECT * FROM finance_document_links
     WHERE entity_id = $1 AND (
       (from_type = 'STOCK_DOCUMENT' AND from_id = $2) OR
       (to_type = 'STOCK_DOCUMENT' AND to_id = $2)
     )
     ORDER BY link_id`,
    [entityId, String(documentId)]
  );
  let journal = null;
  if (doc.rows[0].journal_entry_id) {
    const entry = await client.query(
      `SELECT * FROM finance_journal_entries WHERE entry_id = $1 AND entity_id = $2`,
      [doc.rows[0].journal_entry_id, entityId]
    );
    const journalLines = await client.query(
      `SELECT line_number, account_id, account_code, debit_amount, credit_amount, description, cost_center_id
       FROM finance_journal_lines WHERE entry_id = $1 ORDER BY line_number`,
      [doc.rows[0].journal_entry_id]
    );
    const debit = money(journalLines.rows.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0));
    const credit = money(journalLines.rows.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0));
    journal = {
      entry: entry.rows[0] || null,
      lines: journalLines.rows,
      total_debit: debit,
      total_credit: credit,
      balanced: Math.abs(debit - credit) <= 0.001 && debit > 0
    };
  }
  return {
    document: doc.rows[0],
    lines: lines.rows,
    links: links.rows,
    journal,
    journal_posted: !!doc.rows[0].journal_entry_id
  };
}

async function insertDocument(client, spec) {
  const inserted = await client.query(
    `INSERT INTO finance_stock_documents
      (entity_id, document_no, client_request_id, movement_type, reason, created_by,
       source_type, source_id, cost_center_id, currency_code, reverses_document_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      spec.entityId,
      spec.documentNo,
      spec.clientRequestId,
      spec.movementType,
      spec.reason,
      spec.actor,
      spec.sourceType,
      spec.sourceId != null ? String(spec.sourceId) : null,
      spec.costCenterId,
      spec.currencyCode,
      spec.reversesDocumentId || null
    ]
  );
  return inserted.rows[0];
}

async function insertMovement(client, spec) {
  await client.query(
    `INSERT INTO finance_stock_movements
      (document_id, entity_id, item_id, warehouse_id, movement_type, direction, quantity, unit_cost)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [spec.documentId, spec.entityId, spec.itemId, spec.warehouseId, spec.movementType, spec.direction, spec.quantity, spec.unitCost]
  );
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || !lines.length) throw httpError(400, 'أسطر الحركة مطلوبة.');
  return lines.map((line) => ({
    item_id: Number(line.item_id),
    warehouse_id: line.warehouse_id != null ? Number(line.warehouse_id) : null,
    quantity: roundQty(line.quantity),
    unit_cost: line.unit_cost != null ? roundCost(line.unit_cost) : null
  }));
}

async function postReceipt(client, input) {
  const clientRequestId = String(input.clientRequestId || '').trim() || null;
  const replayId = await findByRequest(client, input.entityId, clientRequestId);
  if (replayId) return { replayed: true, ...(await present(client, input.entityId, replayId)) };

  const poId = Number(input.poId);
  if (!Number.isInteger(poId)) throw httpError(400, 'أمر الشراء مطلوب.');
  const po = await client.query(
    `SELECT * FROM finance_purchase_orders WHERE po_id = $1 AND entity_id = $2 FOR UPDATE`,
    [poId, input.entityId]
  );
  if (!po.rows.length) throw httpError(404, 'أمر الشراء غير موجود في هذا الكيان.');
  const status = String(po.rows[0].status || '').toUpperCase();
  if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(status)) {
    throw httpError(409, 'الاستلام يزيد المخزون فقط بعد اعتماد أمر الشراء. إنشاء الأمر أو مسودته لا يحرّك الرصيد.');
  }
  const map = await requireMap(client, input.entityId);
  const warehouse = await requireWarehouse(client, input.entityId, input.warehouseId);
  const currency = normalizeCurrency(input.currencyCode || map.currency_code);
  const costCenterId = optionalCostCenter(input.costCenterId);
  const lines = normalizeLines(input.lines).sort((a, b) => a.item_id - b.item_id);
  const posted = [];
  let raw = 0;
  for (const line of lines) {
    if (!(line.quantity > 0)) throw httpError(400, 'الكمية يجب أن تكون أكبر من صفر.');
    if (!Number.isFinite(line.unit_cost) || line.unit_cost < 0) throw httpError(400, 'تكلفة الوحدة غير صالحة.');
    const item = await requireStockItem(client, input.entityId, line.item_id);
    const balance = await lockBalance(client, input.entityId, item.item_id, warehouse.warehouse_id);
    const next = applyInbound(balance, line.quantity, line.unit_cost);
    if (!next.ok) throw httpError(400, next.error);
    await saveBalance(client, input.entityId, item.item_id, warehouse.warehouse_id, next);
    raw += line.quantity * next.appliedUnitCost;
    posted.push({ item, quantity: line.quantity, unitCost: next.appliedUnitCost, balance: next });
  }
  const amount = money(raw);
  if (!(amount > 0)) throw httpError(422, 'لا يُرحَّل قيد استلام بمبلغ صفر.');
  const documentNo = await nextDocumentNo(client, input.entityId);
  const doc = await insertDocument(client, {
    entityId: input.entityId,
    documentNo,
    clientRequestId,
    movementType: 'RECEIPT',
    reason: String(input.reason || '').trim() || `استلام أمر الشراء ${po.rows[0].po_number}`,
    actor: input.actor,
    sourceType: 'PURCHASE_ORDER',
    sourceId: poId,
    costCenterId,
    currencyCode: currency
  });
  for (const line of posted) {
    await insertMovement(client, {
      documentId: doc.document_id,
      entityId: input.entityId,
      itemId: line.item.item_id,
      warehouseId: warehouse.warehouse_id,
      movementType: 'RECEIPT',
      direction: 'in',
      quantity: line.quantity,
      unitCost: line.unitCost
    });
    await client.query(
      `INSERT INTO finance_stock_source_qty
        (entity_id, source_type, source_id, source_line, item_id, quantity, direction, document_id)
       VALUES ($1,'PURCHASE_ORDER',$2,$3,$4,$5,'receipt',$6)`,
      [input.entityId, String(poId), String(line.item.item_id), line.item.item_id, line.quantity, doc.document_id]
    );
  }
  const journal = await postJournal(client, {
    entityId: input.entityId,
    entityType: input.entityType,
    actor: input.actor,
    referenceNumber: documentNo,
    referenceId: doc.document_id,
    costCenterId,
    description: `استلام مخزون ${documentNo} من أمر الشراء ${po.rows[0].po_number} (${currency})`,
    lines: [
      { accountId: map.inventory_account_id, code: map.inventory_code, debit: amount, credit: 0, description: 'زيادة المخزون' },
      { accountId: map.grni_account_id, code: map.grni_code, debit: 0, credit: amount, description: 'بضاعة مستلمة غير مفوترة' }
    ]
  });
  await client.query(
    `UPDATE finance_stock_documents SET journal_entry_id = $1 WHERE document_id = $2`,
    [journal.entry_id, doc.document_id]
  );
  await addLink(client, input.entityId, 'PURCHASE_ORDER', poId, 'STOCK_DOCUMENT', doc.document_id);
  await addLink(client, input.entityId, 'STOCK_DOCUMENT', doc.document_id, 'JOURNAL_ENTRY', journal.entry_id);
  await client.query(
    `UPDATE finance_purchase_orders SET status = 'PARTIALLY_RECEIVED', updated_at = NOW() WHERE po_id = $1 AND entity_id = $2`,
    [poId, input.entityId]
  );
  return { replayed: false, ...(await present(client, input.entityId, doc.document_id)) };
}

async function invoiceRemaining(client, entityId, invoiceId, lineId) {
  const sum = await client.query(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'issue' THEN quantity WHEN direction = 'return' THEN -quantity ELSE 0 END), 0) AS qty
     FROM finance_stock_source_qty
     WHERE entity_id = $1 AND source_type = 'SALES_INVOICE' AND source_id = $2 AND source_line = $3`,
    [entityId, String(invoiceId), String(lineId)]
  );
  return Number(sum.rows[0].qty);
}

async function postIssue(client, input) {
  const clientRequestId = String(input.clientRequestId || '').trim() || null;
  const replayId = await findByRequest(client, input.entityId, clientRequestId);
  if (replayId) return { replayed: true, ...(await present(client, input.entityId, replayId)) };

  const invoiceId = Number(input.invoiceId);
  if (!Number.isInteger(invoiceId)) throw httpError(400, 'الفاتورة مطلوبة.');
  const invoice = await client.query(
    `SELECT * FROM finance_invoices WHERE invoice_id = $1 AND entity_id = $2 FOR UPDATE`,
    [invoiceId, input.entityId]
  );
  if (!invoice.rows.length) throw httpError(404, 'الفاتورة غير موجودة في هذا الكيان.');
  const status = String(invoice.rows[0].status || '').toUpperCase();
  if (!['ISSUED', 'PARTIAL', 'PAID', 'OVERDUE'].includes(status)) {
    throw httpError(409, 'صرف المخزون مسموح للفاتورة المصدرة أو المدفوعة فقط. المسودة والملغاة لا تصرف مخزونًا.');
  }
  const map = await requireMap(client, input.entityId);
  const warehouse = await requireWarehouse(client, input.entityId, input.warehouseId);
  const currency = normalizeCurrency(input.currencyCode || map.currency_code || invoice.rows[0].currency_code);
  const costCenterId = optionalCostCenter(input.costCenterId);
  const requestLines = normalizeLines(input.lines);
  const invoiceLines = await client.query(
    `SELECT * FROM finance_invoice_lines WHERE invoice_id = $1 ORDER BY line_number`,
    [invoiceId]
  );
  const posted = [];
  let raw = 0;
  for (const requestLine of requestLines.sort((a, b) => a.item_id - b.item_id)) {
    if (!(requestLine.quantity > 0)) throw httpError(400, 'الكمية يجب أن تكون أكبر من صفر.');
    const item = await requireStockItem(client, input.entityId, requestLine.item_id);
    const matches = invoiceLines.rows.filter((line) => String(line.item_code || '').toUpperCase() === String(item.sku).toUpperCase());
    if (matches.length !== 1) {
      throw httpError(409, 'سطر الفاتورة يجب أن يطابق رمز صنف واحد.');
    }
    const invoiceLine = matches[0];
    const already = await invoiceRemaining(client, input.entityId, invoiceId, invoiceLine.line_id);
    const allowed = roundQty(Number(invoiceLine.quantity) - already);
    if (requestLine.quantity - allowed > 0.0001) {
      throw httpError(409, 'الكمية تتجاوز المتبقي من الفاتورة أو صُرف هذا السطر من قبل.');
    }
    const balance = await lockBalance(client, input.entityId, item.item_id, warehouse.warehouse_id);
    const next = applyOutbound(balance, requestLine.quantity);
    if (!next.ok) throw httpError(409, next.error);
    await saveBalance(client, input.entityId, item.item_id, warehouse.warehouse_id, next);
    raw += requestLine.quantity * next.appliedUnitCost;
    posted.push({
      item,
      invoiceLine,
      quantity: requestLine.quantity,
      unitCost: next.appliedUnitCost,
      balance: next
    });
  }
  const amount = money(raw);
  if (!(amount > 0)) throw httpError(422, 'لا يُرحَّل قيد صرف بتكلفة صفر.');
  const documentNo = await nextDocumentNo(client, input.entityId);
  const doc = await insertDocument(client, {
    entityId: input.entityId,
    documentNo,
    clientRequestId,
    movementType: 'ISSUE',
    reason: String(input.reason || '').trim() || `صرف فاتورة ${invoice.rows[0].invoice_number}`,
    actor: input.actor,
    sourceType: 'SALES_INVOICE',
    sourceId: invoiceId,
    costCenterId,
    currencyCode: currency
  });
  for (const line of posted) {
    await insertMovement(client, {
      documentId: doc.document_id,
      entityId: input.entityId,
      itemId: line.item.item_id,
      warehouseId: warehouse.warehouse_id,
      movementType: 'ISSUE',
      direction: 'out',
      quantity: line.quantity,
      unitCost: line.unitCost
    });
    await client.query(
      `INSERT INTO finance_stock_source_qty
        (entity_id, source_type, source_id, source_line, item_id, quantity, direction, document_id)
       VALUES ($1,'SALES_INVOICE',$2,$3,$4,$5,'issue',$6)`,
      [input.entityId, String(invoiceId), String(line.invoiceLine.line_id), line.item.item_id, line.quantity, doc.document_id]
    );
  }
  const journal = await postJournal(client, {
    entityId: input.entityId,
    entityType: input.entityType,
    actor: input.actor,
    referenceNumber: documentNo,
    referenceId: doc.document_id,
    costCenterId,
    description: `صرف مخزون ${documentNo} لفاتورة ${invoice.rows[0].invoice_number} (${currency})`,
    lines: [
      { accountId: map.cogs_account_id, code: map.cogs_code, debit: amount, credit: 0, description: 'تكلفة المبيعات' },
      { accountId: map.inventory_account_id, code: map.inventory_code, debit: 0, credit: amount, description: 'نقص المخزون' }
    ]
  });
  await client.query(
    `UPDATE finance_stock_documents SET journal_entry_id = $1 WHERE document_id = $2`,
    [journal.entry_id, doc.document_id]
  );
  await addLink(client, input.entityId, 'SALES_INVOICE', invoiceId, 'STOCK_DOCUMENT', doc.document_id);
  await addLink(client, input.entityId, 'STOCK_DOCUMENT', doc.document_id, 'JOURNAL_ENTRY', journal.entry_id);
  return { replayed: false, ...(await present(client, input.entityId, doc.document_id)) };
}

async function returnedQty(client, entityId, documentId, itemId, warehouseId, direction) {
  const sum = await client.query(
    `SELECT COALESCE(SUM(m.quantity), 0) AS qty
     FROM finance_stock_movements m
     JOIN finance_stock_documents d ON d.document_id = m.document_id
     WHERE d.entity_id = $1 AND d.reverses_document_id = $2
       AND m.item_id = $3 AND m.warehouse_id = $4 AND m.direction = $5`,
    [entityId, documentId, itemId, warehouseId, direction]
  );
  return Number(sum.rows[0].qty);
}

async function postReturn(client, input) {
  const clientRequestId = String(input.clientRequestId || '').trim() || null;
  const replayId = await findByRequest(client, input.entityId, clientRequestId);
  if (replayId) return { replayed: true, ...(await present(client, input.entityId, replayId)) };

  const documentId = Number(input.documentId);
  if (!Number.isInteger(documentId)) throw httpError(400, 'مستند المخزون الأصلي مطلوب.');
  const original = await client.query(
    `SELECT * FROM finance_stock_documents WHERE document_id = $1 AND entity_id = $2 FOR UPDATE`,
    [documentId, input.entityId]
  );
  if (!original.rows.length) throw httpError(404, 'المستند الأصلي غير موجود في هذا الكيان.');
  if (original.rows[0].movement_type === 'TRANSFER') {
    throw httpError(409, 'التحويل يُعكس بتحويل جديد. المستند الأصلي يبقى كما هو.');
  }
  const reason = String(input.reason || '').trim();
  if (!reason) throw httpError(400, 'سبب المرتجع أو الإلغاء مطلوب.');
  const movements = await client.query(
    `SELECT * FROM finance_stock_movements WHERE document_id = $1 ORDER BY movement_id`,
    [documentId]
  );
  const requestLines = normalizeLines(input.lines);
  const posted = [];
  let raw = 0;
  for (const requestLine of requestLines) {
    const warehouseId = requestLine.warehouse_id;
    if (!Number.isInteger(requestLine.item_id) || !Number.isInteger(warehouseId)) {
      throw httpError(400, 'الصنف والمستودع مطلوبان في المرتجع.');
    }
    if (!(requestLine.quantity > 0)) throw httpError(400, 'الكمية يجب أن تكون أكبر من صفر.');
    const matches = movements.rows.filter((row) => Number(row.item_id) === requestLine.item_id && Number(row.warehouse_id) === warehouseId);
    const directions = new Set(matches.map((row) => row.direction));
    if (directions.size !== 1) throw httpError(409, 'تعذر تحديد اتجاه السطر الأصلي.');
    const direction = matches[0].direction;
    const originalQty = roundQty(matches.reduce((sum, row) => sum + Number(row.quantity), 0));
    const opposite = direction === 'in' ? 'out' : 'in';
    const already = await returnedQty(client, input.entityId, documentId, requestLine.item_id, warehouseId, opposite);
    if (requestLine.quantity - roundQty(originalQty - already) > 0.0001) {
      throw httpError(409, 'كمية المرتجع تتجاوز الكمية المتبقية من المستند الأصلي.');
    }
    const item = await requireStockItem(client, input.entityId, requestLine.item_id);
    await requireWarehouse(client, input.entityId, warehouseId);
    const balance = await lockBalance(client, input.entityId, item.item_id, warehouseId);
    if (direction === 'in') {
      const next = applyOutbound(balance, requestLine.quantity);
      if (!next.ok) throw httpError(409, next.error);
      await saveBalance(client, input.entityId, item.item_id, warehouseId, next);
      raw += requestLine.quantity * next.appliedUnitCost;
      posted.push({ item, warehouseId, quantity: requestLine.quantity, unitCost: next.appliedUnitCost, direction: 'out', balance: next });
    } else {
      const originalCost = roundCost(matches.reduce((sum, row) => sum + (Number(row.quantity) * Number(row.unit_cost)), 0) / originalQty);
      const next = applyInbound(balance, requestLine.quantity, originalCost);
      if (!next.ok) throw httpError(400, next.error);
      await saveBalance(client, input.entityId, item.item_id, warehouseId, next);
      raw += requestLine.quantity * next.appliedUnitCost;
      posted.push({ item, warehouseId, quantity: requestLine.quantity, unitCost: next.appliedUnitCost, direction: 'in', balance: next });
    }
  }
  const amount = money(raw);
  const documentNo = await nextDocumentNo(client, input.entityId);
  const doc = await insertDocument(client, {
    entityId: input.entityId,
    documentNo,
    clientRequestId,
    movementType: 'RETURN',
    reason,
    actor: input.actor,
    sourceType: original.rows[0].source_type,
    sourceId: original.rows[0].source_id,
    costCenterId: original.rows[0].cost_center_id,
    currencyCode: original.rows[0].currency_code || 'SAR',
    reversesDocumentId: documentId
  });
  for (const line of posted) {
    await insertMovement(client, {
      documentId: doc.document_id,
      entityId: input.entityId,
      itemId: line.item.item_id,
      warehouseId: line.warehouseId,
      movementType: 'RETURN',
      direction: line.direction,
      quantity: line.quantity,
      unitCost: line.unitCost
    });
  }
  await addLink(client, input.entityId, 'STOCK_DOCUMENT', documentId, 'STOCK_RETURN', doc.document_id);
  if (original.rows[0].journal_entry_id) {
    if (!(amount > 0)) throw httpError(422, 'مرتجع القيد يحتاج مبلغًا أكبر من صفر.');
    const originalLines = await client.query(
      `SELECT * FROM finance_journal_lines WHERE entry_id = $1 ORDER BY line_number`,
      [original.rows[0].journal_entry_id]
    );
    if (originalLines.rows.length !== 2) throw httpError(422, 'القيد الأصلي ليس قيدًا مزدوجًا بسيطًا.');
    const debitLine = originalLines.rows.find((line) => Number(line.debit_amount) > 0);
    const creditLine = originalLines.rows.find((line) => Number(line.credit_amount) > 0);
    const journal = await postJournal(client, {
      entityId: input.entityId,
      entityType: input.entityType,
      actor: input.actor,
      referenceNumber: documentNo,
      referenceId: doc.document_id,
      costCenterId: original.rows[0].cost_center_id,
      description: `عكس مستند ${original.rows[0].document_no} بالمستند ${documentNo}`,
      lines: [
        { accountId: creditLine.account_id, code: creditLine.account_code, debit: amount, credit: 0, description: 'عكس دائن' },
        { accountId: debitLine.account_id, code: debitLine.account_code, debit: 0, credit: amount, description: 'عكس مدين' }
      ]
    });
    await client.query(
      `UPDATE finance_stock_documents SET journal_entry_id = $1 WHERE document_id = $2`,
      [journal.entry_id, doc.document_id]
    );
    await addLink(client, input.entityId, 'STOCK_RETURN', doc.document_id, 'JOURNAL_ENTRY', journal.entry_id);
    await addLink(client, input.entityId, 'JOURNAL_ENTRY', original.rows[0].journal_entry_id, 'JOURNAL_ENTRY', journal.entry_id);
  }
  if (original.rows[0].source_type === 'SALES_INVOICE' && original.rows[0].source_id) {
    for (const line of posted) {
      const alloc = await client.query(
        `SELECT source_line FROM finance_stock_source_qty
         WHERE document_id = $1 AND item_id = $2 AND direction = 'issue'
         ORDER BY allocation_id LIMIT 1`,
        [documentId, line.item.item_id]
      );
      if (alloc.rows.length) {
        await client.query(
          `INSERT INTO finance_stock_source_qty
            (entity_id, source_type, source_id, source_line, item_id, quantity, direction, document_id)
           VALUES ($1,'SALES_INVOICE',$2,$3,$4,$5,'return',$6)`,
          [input.entityId, String(original.rows[0].source_id), alloc.rows[0].source_line, line.item.item_id, line.quantity, doc.document_id]
        );
      }
    }
  }
  return { replayed: false, ...(await present(client, input.entityId, doc.document_id)) };
}

async function trace(client, entityId, fromType, fromId) {
  const originType = String(fromType || '').trim().toUpperCase();
  const originId = String(fromId || '').trim();
  if (!originType || !originId) throw httpError(400, 'نوع المستند ومعرّفه مطلوبان.');
  const seen = new Set([`${originType}:${originId}`]);
  const nodes = [{ type: originType, id: originId }];
  const edges = [];
  const queue = [{ type: originType, id: originId }];
  while (queue.length && nodes.length < 30) {
    const current = queue.shift();
    const links = await client.query(
      `SELECT * FROM finance_document_links
       WHERE entity_id = $1 AND (
         (from_type = $2 AND from_id = $3) OR (to_type = $2 AND to_id = $3)
       )
       ORDER BY link_id`,
      [entityId, current.type, current.id]
    );
    for (const link of links.rows) {
      edges.push(link);
      const other = link.from_type === current.type && link.from_id === current.id
        ? { type: link.to_type, id: link.to_id }
        : { type: link.from_type, id: link.from_id };
      const key = `${other.type}:${other.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        nodes.push(other);
        queue.push(other);
      }
    }
  }
  const detailed = [];
  for (const node of nodes) {
    if (node.type === 'STOCK_DOCUMENT' || node.type === 'STOCK_RETURN') {
      const doc = await client.query(
        `SELECT document_id, document_no, movement_type, journal_entry_id, source_type, source_id, reverses_document_id
         FROM finance_stock_documents WHERE entity_id = $1 AND document_id = $2`,
        [entityId, Number(node.id)]
      );
      detailed.push({ ...node, record: doc.rows[0] || null });
    } else if (node.type === 'JOURNAL_ENTRY') {
      const entry = await client.query(
        `SELECT entry_id, entry_number, status, is_posted, description, reference_number
         FROM finance_journal_entries WHERE entity_id = $1 AND entry_id = $2`,
        [entityId, Number(node.id)]
      );
      const lines = await client.query(
        `SELECT debit_amount, credit_amount FROM finance_journal_lines WHERE entry_id = $1`,
        [Number(node.id)]
      );
      const debit = money(lines.rows.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0));
      const credit = money(lines.rows.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0));
      detailed.push({
        ...node,
        record: entry.rows[0] || null,
        total_debit: debit,
        total_credit: credit,
        balanced: !!entry.rows[0] && Math.abs(debit - credit) <= 0.001
      });
    } else if (node.type === 'PURCHASE_ORDER') {
      const po = await client.query(
        `SELECT po_id, po_number, status, total_amount FROM finance_purchase_orders WHERE entity_id = $1 AND po_id = $2`,
        [entityId, Number(node.id)]
      );
      detailed.push({ ...node, record: po.rows[0] || null });
    } else if (node.type === 'SALES_INVOICE') {
      const invoice = await client.query(
        `SELECT invoice_id, invoice_number, status, total_amount FROM finance_invoices WHERE entity_id = $1 AND invoice_id = $2`,
        [entityId, Number(node.id)]
      );
      detailed.push({ ...node, record: invoice.rows[0] || null });
    } else {
      detailed.push(node);
    }
  }
  return { origin: { type: originType, id: originId }, nodes: detailed, edges };
}

async function getAccountMap(client, entityId) {
  const map = await client.query(
    `SELECT * FROM finance_inventory_account_map WHERE entity_id = $1`,
    [entityId]
  );
  return map.rows[0] || null;
}

async function saveAccountMap(client, entityId, body, actor) {
  const inventoryAccountId = Number(body.inventory_account_id);
  const grniAccountId = Number(body.grni_account_id);
  const cogsAccountId = Number(body.cogs_account_id);
  const ids = [inventoryAccountId, grniAccountId, cogsAccountId];
  if (ids.some((id) => !Number.isInteger(id))) throw httpError(400, 'حسابات الربط الثلاثة مطلوبة.');
  if (new Set(ids).size !== 3) throw httpError(400, 'حساب المخزون والوسيط والتكلفة يجب أن تكون مختلفة.');
  const currency = normalizeCurrency(body.currency_code || 'SAR');
  const accounts = await client.query(
    `SELECT account_id, is_active, is_header FROM finance_accounts WHERE account_id = ANY($1::int[])`,
    [ids]
  );
  if (accounts.rows.length !== 3 || accounts.rows.some((row) => !row.is_active || row.is_header)) {
    throw httpError(422, 'كل حساب يجب أن يكون موجودًا ونشطًا وغير تجميعي.');
  }
  const before = await getAccountMap(client, entityId);
  const saved = await client.query(
    `INSERT INTO finance_inventory_account_map
      (entity_id, inventory_account_id, grni_account_id, cogs_account_id, currency_code, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (entity_id) DO UPDATE SET
       inventory_account_id = EXCLUDED.inventory_account_id,
       grni_account_id = EXCLUDED.grni_account_id,
       cogs_account_id = EXCLUDED.cogs_account_id,
       currency_code = EXCLUDED.currency_code,
       updated_at = NOW()
     RETURNING *`,
    [entityId, inventoryAccountId, grniAccountId, cogsAccountId, currency]
  );
  await client.query(
    `INSERT INTO finance_item_audit
      (entity_id, record_type, record_id, action, before_data, after_data, actor)
     VALUES ($1,'inventory_account_map',0,'update',$2,$3,$4)`,
    [entityId, before ? JSON.stringify(before) : null, JSON.stringify(saved.rows[0]), actor]
  );
  return saved.rows[0];
}

module.exports = {
  httpError,
  ensureStockLinkSchema,
  postReceipt,
  postIssue,
  postReturn,
  present,
  trace,
  getAccountMap,
  saveAccountMap
};
