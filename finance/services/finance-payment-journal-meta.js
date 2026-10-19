'use strict';

/**
 * B1.d.3.c — Legacy payment JE metadata helpers matching live POST /finance/payments.
 * Amounts/accounts unchanged; descriptions/numbering/refs only.
 */

const { roundMoney } = require('./finance-invoice-amounts');

function legacyPaymentJournalDescription(paymentNumber) {
  return `قيد آلي - دفعة رقم ${paymentNumber}`;
}

/**
 * Build debit/credit line specs mirroring finance-routes POST /payments.
 * @param {{ paymentAmount: number, paymentMethod?: string, customerName?: string }} opts
 */
function buildLegacyPaymentJournalLines(opts = {}) {
  const amount = roundMoney(opts.paymentAmount);
  const method = String(opts.paymentMethod || 'CASH').toUpperCase();
  const cashCode = method === 'CASH' ? '1110' : '1120';
  const customerName = opts.customerName || 'عميل';
  return [
    {
      account_code: cashCode,
      debit_amount: amount,
      credit_amount: 0,
      description: `دفعة من ${customerName}`
    },
    {
      account_code: '1130',
      debit_amount: 0,
      credit_amount: amount,
      description: `ذمم مدينة - ${customerName}`
    }
  ];
}

/** Spec object used by parity tests (live route mirror). */
function livePaymentJournalMetadataSpec({
  paymentNumber,
  paymentAmount,
  paymentMethod,
  customerName,
  entityId,
  entityType,
  branchId,
  incubatorId
}) {
  const lines = buildLegacyPaymentJournalLines({
    paymentAmount,
    paymentMethod,
    customerName
  });
  return {
    entry_number_prefix: 'JE',
    description: legacyPaymentJournalDescription(paymentNumber),
    reference_number: paymentNumber,
    reference_type: 'PAYMENT',
    posted_at: null,
    posted_by: null,
    entity_id: entityId,
    entity_type: entityType || null,
    branch_id: branchId ?? null,
    incubator_id: incubatorId ?? null,
    lines,
    metadata_profile: 'legacy_payment_auto_post'
  };
}

module.exports = {
  legacyPaymentJournalDescription,
  buildLegacyPaymentJournalLines,
  livePaymentJournalMetadataSpec
};
