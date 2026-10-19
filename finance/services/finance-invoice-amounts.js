'use strict';

/**
 * Unified money rounding for invoice ↔ journal parity (B1.d.2 D1).
 * All line/tax/discount/total amounts are rounded to 2 decimal places.
 * Journal posting must use the stored invoice row amounts (after this policy),
 * never unrounded intermediate JS floats.
 */

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * Compute invoice header totals from lines with per-component roundMoney.
 * Default tax 15% when tax_percentage is null/undefined (matches current create path).
 * Ready for future create-path adoption; postInvoiceIssue reads stored columns only.
 */
function computeInvoiceTotalsFromLines(lines = []) {
  let subtotal = 0;
  let discount_amount = 0;
  let tax_amount = 0;
  const normalizedLines = [];

  for (const line of lines) {
    const quantity = Number(line.quantity) || 0;
    const unit_price = roundMoney(line.unit_price);
    const lineSubtotal = roundMoney(quantity * unit_price);
    let lineDiscount;
    if (line.discount_amount != null && line.discount_amount !== '') {
      lineDiscount = roundMoney(line.discount_amount);
    } else {
      lineDiscount = roundMoney((lineSubtotal * (Number(line.discount_percentage) || 0)) / 100);
    }
    const lineTaxable = roundMoney(Math.max(lineSubtotal - lineDiscount, 0));
    const taxPct = line.tax_percentage != null && line.tax_percentage !== '' ? Number(line.tax_percentage) : 15;
    const lineTax = roundMoney((lineTaxable * taxPct) / 100);
    const lineTotal = roundMoney(lineTaxable + lineTax);

    subtotal = roundMoney(subtotal + lineSubtotal);
    discount_amount = roundMoney(discount_amount + lineDiscount);
    tax_amount = roundMoney(tax_amount + lineTax);

    normalizedLines.push({
      ...line,
      quantity,
      unit_price,
      discount_amount: lineDiscount,
      tax_percentage: taxPct,
      tax_amount: lineTax,
      line_total: lineTotal
    });
  }

  const net = roundMoney(Math.max(subtotal - discount_amount, 0));
  const total_amount = roundMoney(net + tax_amount);

  return {
    subtotal,
    discount_amount,
    tax_amount,
    net,
    total_amount,
    lines: normalizedLines
  };
}

/**
 * Journal amount view from a stored invoice row (source of truth after D1).
 */
function journalAmountsFromStoredInvoice(invoice) {
  const subtotal = roundMoney(invoice.subtotal || 0);
  const discount_amount = roundMoney(invoice.discount_amount || 0);
  const tax_amount = roundMoney(invoice.tax_amount || 0);
  const net = roundMoney(Math.max(subtotal - discount_amount, 0));
  let total_amount = roundMoney(invoice.total_amount);
  if (!Number.isFinite(Number(invoice.total_amount))) {
    total_amount = roundMoney(net + tax_amount);
  }
  return { subtotal, discount_amount, tax_amount, net, total_amount };
}

/**
 * Build JE line specs matching legacy POST /finance/invoices formulas (D2 metadata).
 */
function buildLegacyInvoiceJournalLines(invoice, amounts) {
  const customerLabel = invoice.customer_name || invoice.customer_name_ar || invoice.invoice_number;
  const lines = [
    {
      account_code: '1130',
      debit_amount: amounts.total_amount,
      credit_amount: 0,
      description: `ذمم مدينة - ${customerLabel}`
    },
    {
      account_code: '4100',
      debit_amount: 0,
      credit_amount: amounts.net,
      description: 'إيرادات'
    }
  ];
  if (amounts.tax_amount > 0) {
    lines.push({
      account_code: '2140',
      debit_amount: 0,
      credit_amount: amounts.tax_amount,
      description: 'ضريبة القيمة المضافة'
    });
  }
  return lines;
}

function legacyInvoiceJournalDescription(invoiceNumber) {
  return `قيد آلي - فاتورة رقم ${invoiceNumber}`;
}

module.exports = {
  roundMoney,
  computeInvoiceTotalsFromLines,
  journalAmountsFromStoredInvoice,
  buildLegacyInvoiceJournalLines,
  legacyInvoiceJournalDescription
};
