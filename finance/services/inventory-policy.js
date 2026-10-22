'use strict';

/**
 * Stock valuation policy for Finance Leadership 360.
 * Method: weighted average cost per item and warehouse.
 * Posted quantities never go negative. Callers persist the result;
 * this module does not touch the database.
 */

function roundQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 1000) / 1000;
}

function roundCost(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 10000) / 10000;
}

function normalizeBalance(balance) {
  return {
    qty: roundQty(balance && balance.qty ? balance.qty : 0) || 0,
    avgCost: roundCost(balance && balance.avgCost ? balance.avgCost : 0) || 0
  };
}

function applyInbound(balance, quantity, unitCost) {
  const qty = roundQty(quantity);
  const cost = roundCost(unitCost);
  if (!(qty > 0)) return { ok: false, error: 'الكمية يجب أن تكون أكبر من صفر.' };
  if (!Number.isFinite(cost) || cost < 0) return { ok: false, error: 'تكلفة الوحدة غير صالحة.' };
  const current = normalizeBalance(balance);
  const newQty = roundQty(current.qty + qty);
  const newAvg = newQty === 0 ? 0 : roundCost(((current.qty * current.avgCost) + (qty * cost)) / newQty);
  return { ok: true, qty: newQty, avgCost: newAvg, appliedUnitCost: cost };
}

function applyOutbound(balance, quantity) {
  const qty = roundQty(quantity);
  if (!(qty > 0)) return { ok: false, error: 'الكمية يجب أن تكون أكبر من صفر.' };
  const current = normalizeBalance(balance);
  if (qty - current.qty > 0.0001) {
    return { ok: false, error: 'الرصيد لا يكفي. الرصيد السالب ممنوع.' };
  }
  return {
    ok: true,
    qty: roundQty(current.qty - qty),
    avgCost: current.avgCost,
    appliedUnitCost: current.avgCost
  };
}

module.exports = {
  roundQty,
  roundCost,
  applyInbound,
  applyOutbound
};
