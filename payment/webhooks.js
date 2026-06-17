'use strict';

const express = require('express');
const platformService = require('./platform-service');
const tenantService = require('./tenant-service');
const creditBilling = require('./credit-billing');
const { decryptPlatformSecret, decryptSecretForContext } = require('./secrets');
const { verifyPayPalWebhookSignature } = require('./paypal-client');
const { resolvePaymobSignature, verifyPaymobWebhookSignature } = require('./paymob-client');

const router = express.Router();

async function handleStripeWebhook(req, res, context) {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');

  try {
    let webhookSecret;
    if (context === 'tenant' && req.tenantPool) {
      const row = await tenantService.getProviderSettings(req.tenantPool, 'stripe');
      webhookSecret = row?.stripe_webhook_secret
        ? decryptSecretForContext(row.stripe_webhook_secret, 'tenant')
        : null;
    } else {
      const row = await platformService.getProviderSettings('stripe');
      webhookSecret = row?.stripe_webhook_secret
        ? decryptPlatformSecret(row.stripe_webhook_secret)
        : null;
    }

    if (!webhookSecret) return res.status(422).send('Stripe webhook not configured');

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');
    const stripe = context === 'tenant' && req.tenantPool
      ? await tenantService.getStripeClient(req.tenantPool)
      : await platformService.getStripeClient();

    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const sessionId = session.id;

      if (context === 'tenant' && req.tenantPool) {
        await tenantService.updateTenantTransactionStatus(req.tenantPool, sessionId, 'succeeded');
        if (metadata.payment_type === 'credit_topup') {
          await creditBilling.settleCreditPurchase(req.tenantPool, sessionId, session.payment_intent);
        }
        if (metadata.payment_type === 'store_order' && metadata.order_id) {
          await req.tenantPool.query(
            `UPDATE store_orders SET payment_status = 'paid', status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [metadata.order_id]
          );
        }
      } else if (metadata.registration_token) {
        const saasApi = require('../saas-signup-api');
        if (typeof saasApi.handleStripePaymentSuccess === 'function') {
          await saasApi.handleStripePaymentSuccess(metadata.registration_token, sessionId);
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook]', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

router.post('/stripe/platform', (req, res) => handleStripeWebhook(req, res, 'platform'));
router.post('/stripe/tenant', (req, res) => handleStripeWebhook(req, res, 'tenant'));

router.post('/paypal/platform', async (req, res) => {
  try {
    const auth = await platformService.getPayPalAuth();
    if (auth.webhookId) {
      const valid = await verifyPayPalWebhookSignature({
        auth, webhookId: auth.webhookId, headers: req.headers, event: req.body,
      });
      if (!valid) return res.status(400).json({ message: 'Invalid signature' });
    }
    const event = req.body || {};
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' || event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const token = event.resource?.custom_id;
      if (token) {
        const saasApi = require('../saas-signup-api');
        if (typeof saasApi.handlePayPalPaymentSuccess === 'function') {
          await saasApi.handlePayPalPaymentSuccess(token, event.resource?.id || event.id);
        }
      }
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('[PayPal Platform Webhook]', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.post('/paypal/tenant', async (req, res) => {
  if (!req.tenantPool) return res.status(400).json({ message: 'Tenant required' });
  try {
    const auth = await tenantService.getPayPalAuth(req.tenantPool);
    if (auth.webhookId) {
      const valid = await verifyPayPalWebhookSignature({
        auth, webhookId: auth.webhookId, headers: req.headers, event: req.body,
      });
      if (!valid) return res.status(400).json({ message: 'Invalid signature' });
    }
    const event = req.body || {};
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id;
      if (orderId) {
        await tenantService.updateTenantTransactionStatus(req.tenantPool, orderId, 'succeeded');
        const tx = await req.tenantPool.query(
          `SELECT metadata FROM tenant_payment_transactions WHERE provider_transaction_id = $1 LIMIT 1`,
          [orderId]
        );
        const metadata = tx.rows[0]?.metadata || {};
        if (metadata.payment_type === 'credit_topup') {
          await creditBilling.settleCreditPurchase(req.tenantPool, orderId, event.resource?.id);
        }
        if (metadata.payment_type === 'store_order' && metadata.order_id) {
          await req.tenantPool.query(
            `UPDATE store_orders SET payment_status = 'paid', status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [metadata.order_id]
          );
        }
      }
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('[PayPal Tenant Webhook]', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.post('/paymob/platform', async (req, res) => {
  try {
    const auth = await platformService.getPaymobAuth();
    const signature = resolvePaymobSignature(req.headers, req.body);
    if (auth.hmacSecret && signature) {
      const raw = JSON.stringify(req.body);
      if (!verifyPaymobWebhookSignature(raw, signature, auth.hmacSecret)) {
        return res.status(400).json({ error: 'Invalid HMAC' });
      }
    }
    const payload = req.body || {};
    if (payload.type === 'TRANSACTION' && payload.obj?.success === true) {
      const token = payload.obj?.payment_key_claims?.extra?.registration_token
        || payload.obj?.order?.merchant_order_id
        || payload.obj?.metadata?.registration_token;
      if (token) {
        const saasApi = require('../saas-signup-api');
        if (typeof saasApi.handlePaymobPaymentSuccess === 'function') {
          await saasApi.handlePaymobPaymentSuccess(token, String(payload.obj?.id));
        }
      }
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('[Paymob Platform Webhook]', err.message);
    return res.status(500).json({ message: err.message });
  }
});

router.post('/paymob/tenant', async (req, res) => {
  if (!req.tenantPool) return res.status(400).json({ message: 'Tenant required' });
  try {
    const auth = await tenantService.getPaymobAuth(req.tenantPool);
    const signature = resolvePaymobSignature(req.headers, req.body);
    if (auth.hmacSecret && signature) {
      const raw = JSON.stringify(req.body);
      if (!verifyPaymobWebhookSignature(raw, signature, auth.hmacSecret)) {
        return res.status(400).json({ error: 'Invalid HMAC' });
      }
    }
    const payload = req.body || {};
    if (payload.type === 'TRANSACTION' && payload.obj?.success === true) {
      const ref = String(payload.obj?.id || '');
      if (ref) {
        await tenantService.updateTenantTransactionStatus(req.tenantPool, ref, 'succeeded');
        const tx = await req.tenantPool.query(
          `SELECT metadata FROM tenant_payment_transactions
           WHERE provider_transaction_id = $1 LIMIT 1`,
          [ref]
        );
        const metadata = tx.rows[0]?.metadata || {};
        if (metadata.payment_type === 'credit_topup') {
          await creditBilling.settleCreditPurchase(req.tenantPool, ref, ref);
        }
        if (metadata.payment_type === 'store_order' && metadata.order_id) {
          await req.tenantPool.query(
            `UPDATE store_orders SET payment_status = 'paid', status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [metadata.order_id]
          );
        }
      }
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('[Paymob Tenant Webhook]', err.message);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
