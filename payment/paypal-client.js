'use strict';

const PAYPAL_BASE_URL = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

function getPayPalBaseUrl(isLiveMode) {
  return isLiveMode ? PAYPAL_BASE_URL.live : PAYPAL_BASE_URL.sandbox;
}

async function getPayPalAccessToken(auth) {
  const baseUrl = getPayPalBaseUrl(auth.isLiveMode);
  const credentials = Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal auth failed: ${error}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function paypalRequest(auth, path, init) {
  const baseUrl = getPayPalBaseUrl(auth.isLiveMode);
  const token = await getPayPalAccessToken(auth);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal API error: ${error}`);
  }

  return response.json();
}

async function createPayPalOrder(input) {
  const body = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: input.currency, value: input.amount },
      ...(input.customId ? { custom_id: input.customId } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.items?.length ? {
        items: input.items.map((item) => ({
          name: item.name,
          unit_amount: { currency_code: input.currency, value: item.unitAmount },
          quantity: String(item.quantity),
        })),
      } : {}),
    }],
    application_context: {
      shipping_preference: input.shippingPreference || 'NO_SHIPPING',
      user_action: 'PAY_NOW',
    },
  };

  return paypalRequest(input.auth, '/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function capturePayPalOrder(auth, orderId) {
  return paypalRequest(auth, `/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

async function createPayPalSubscription(input) {
  const body = {
    plan_id: input.planId,
    ...(input.customId ? { custom_id: input.customId } : {}),
    application_context: {
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      user_action: 'SUBSCRIBE_NOW',
    },
  };

  if (input.subscriber) {
    const subscriber = {};
    if (input.subscriber.name?.givenName || input.subscriber.name?.surname) {
      subscriber.name = {
        given_name: input.subscriber.name?.givenName,
        surname: input.subscriber.name?.surname,
      };
    }
    if (input.subscriber.emailAddress) {
      subscriber.email_address = input.subscriber.emailAddress;
    }
    if (Object.keys(subscriber).length) body.subscriber = subscriber;
  }

  return paypalRequest(input.auth, '/v1/billing/subscriptions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function verifyPayPalWebhookSignature(options) {
  const headers = options.headers || {};
  const transmissionId = String(headers['paypal-transmission-id'] || '');
  const transmissionTime = String(headers['paypal-transmission-time'] || '');
  const transmissionSig = String(headers['paypal-transmission-sig'] || '');
  const certUrl = String(headers['paypal-cert-url'] || '');
  const authAlgo = String(headers['paypal-auth-algo'] || '');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const response = await paypalRequest(options.auth, '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: options.webhookId,
      webhook_event: options.event,
    }),
  });

  return response.verification_status === 'SUCCESS';
}

function formatPayPalAmount(amount) {
  if (!Number.isFinite(amount)) return '0.00';
  return amount.toFixed(2);
}

module.exports = {
  createPayPalOrder,
  capturePayPalOrder,
  createPayPalSubscription,
  verifyPayPalWebhookSignature,
  formatPayPalAmount,
};
