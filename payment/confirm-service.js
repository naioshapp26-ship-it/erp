'use strict';

const db = require('../db');
const platformService = require('./platform-service');
const tenantService = require('./tenant-service');
const creditBilling = require('./credit-billing');
const { capturePayPalOrder } = require('./paypal-client');
const { isDemoPaymentMode } = require('./env-seed');

async function updatePlatformTransactionStatus(sessionId, status) {
  await db.query(
    `UPDATE platform_payment_transactions
     SET status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE provider_transaction_id = $1`,
    [sessionId, status]
  );
}

async function updateTenantTransactionStatus(pool, sessionId, status) {
  if (!pool) return;
  await tenantService.updateTenantTransactionStatus(pool, sessionId, status);
}

async function confirmStripeSession({ pool, isPlatform, sessionId }) {
  const stripe = isPlatform
    ? await platformService.getStripeClient()
    : await tenantService.getStripeClient(pool);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (!paid) {
    return { confirmed: false, status: session.payment_status || session.status, session };
  }

  const metadata = session.metadata || {};
  if (metadata.payment_type === 'credit_topup') {
    await creditBilling.settleCreditPurchase(pool, sessionId, session.payment_intent);
  }
  if (isPlatform) {
    await updatePlatformTransactionStatus(sessionId, 'succeeded');
  } else {
    await updateTenantTransactionStatus(pool, sessionId, 'succeeded');
    if (metadata.payment_type === 'store_order' && metadata.order_id) {
      await pool.query(
        `UPDATE store_orders SET payment_status = 'paid', status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [metadata.order_id]
      );
    }
  }
  return { confirmed: true, status: 'succeeded', session, metadata };
}

async function confirmPayPalOrder({ pool, isPlatform, orderId }) {
  const auth = isPlatform
    ? await platformService.getPayPalAuth()
    : await tenantService.getPayPalAuth(pool);
  const result = await capturePayPalOrder(auth, orderId);
  const status = result?.status || result?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
  const paid = String(status).toUpperCase() === 'COMPLETED';

  if (!paid) {
    return { confirmed: false, status: status || 'pending', result };
  }

  if (isPlatform) {
    const tx = await db.query(
      `SELECT metadata FROM platform_payment_transactions WHERE provider_transaction_id = $1 LIMIT 1`,
      [orderId]
    );
    const metadata = tx.rows[0]?.metadata || {};
    if (metadata.payment_type === 'credit_topup') {
      await creditBilling.settleCreditPurchase(db, orderId, result?.id || orderId);
    }
    await updatePlatformTransactionStatus(orderId, 'succeeded');
    return { confirmed: true, status: 'succeeded', metadata };
  }

  const tx = await pool.query(
    `SELECT metadata FROM tenant_payment_transactions WHERE provider_transaction_id = $1 LIMIT 1`,
    [orderId]
  );
  const metadata = tx.rows[0]?.metadata || {};
  if (metadata.payment_type === 'credit_topup') {
    await creditBilling.settleCreditPurchase(pool, orderId, result?.id || orderId);
  }
  await updateTenantTransactionStatus(pool, orderId, 'succeeded');
  if (metadata.payment_type === 'store_order' && metadata.order_id) {
    await pool.query(
      `UPDATE store_orders SET payment_status = 'paid', status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [metadata.order_id]
    );
  }
  return { confirmed: true, status: 'succeeded', metadata };
}

async function confirmPaymentSession({ pool, isPlatform, provider, sessionId }) {
  if (!sessionId) throw new Error('معرّف جلسة الدفع مطلوب.');

  if (provider === 'stripe') {
    return confirmStripeSession({ pool: isPlatform ? db : pool, isPlatform, sessionId });
  }
  if (provider === 'paypal') {
    return confirmPayPalOrder({ pool: isPlatform ? db : pool, isPlatform, orderId: sessionId });
  }
  if (provider === 'paymob') {
    if (isPlatform) {
      await updatePlatformTransactionStatus(sessionId, 'succeeded');
      await creditBilling.settleCreditPurchase(db, sessionId, sessionId);
    } else {
      await updateTenantTransactionStatus(pool, sessionId, 'succeeded');
      await creditBilling.settleCreditPurchase(pool, sessionId, sessionId);
    }
    return { confirmed: true, status: 'succeeded' };
  }
  throw new Error(`مزود الدفع ${provider} غير مدعوم للتأكيد.`);
}

async function confirmDemoCreditPurchase({ pool, isPlatform, sessionId }) {
  if (!isDemoPaymentMode()) {
    throw new Error('وضع الدفع التجريبي غير مفعّل.');
  }
  const targetPool = isPlatform ? db : pool;
  const settled = await creditBilling.settleCreditPurchase(targetPool, sessionId, `demo-${Date.now()}`);
  if (!settled) throw new Error('لا توجد عملية دفع معلقة لهذه الجلسة.');
  if (isPlatform) {
    await updatePlatformTransactionStatus(sessionId, 'succeeded');
  } else {
    await updateTenantTransactionStatus(pool, sessionId, 'succeeded');
  }
  return { confirmed: true, status: 'succeeded', demo: true };
}

module.exports = {
  confirmPaymentSession,
  confirmDemoCreditPurchase,
};
