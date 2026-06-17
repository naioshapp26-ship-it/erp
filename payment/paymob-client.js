'use strict';

const crypto = require('crypto');

const DEFAULT_PAYMOB_BASE_URL = 'https://accept.paymob.com';

function normalizeBaseUrl(baseUrl) {
  const resolved = (baseUrl || DEFAULT_PAYMOB_BASE_URL).trim();
  return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved;
}

function buildPaymobHeaders(secretKey) {
  return {
    Authorization: `Token ${secretKey}`,
    'Content-Type': 'application/json',
  };
}

async function createPaymobIntention(input) {
  const baseUrl = normalizeBaseUrl(input.auth.baseUrl);
  const paymentMethods = (input.paymentMethods || []).map((method) => {
    if (typeof method === 'string') {
      const trimmed = method.trim();
      if (/^\d+$/.test(trimmed)) return Number(trimmed);
      return trimmed;
    }
    return method;
  });

  const payload = {
    amount: input.amount,
    currency: input.currency,
    payment_methods: paymentMethods,
  };

  if (input.items?.length) {
    payload.items = input.items.map((item) => ({
      name: item.name,
      amount: item.amount,
      quantity: item.quantity,
      ...(item.description ? { description: item.description } : {}),
    }));
  }

  if (input.billingData && Object.keys(input.billingData).length) {
    payload.billing_data = input.billingData;
  }

  if (input.metadata && Object.keys(input.metadata).length) {
    payload.metadata = input.metadata;
  }

  if (input.successUrl) payload.success_url = input.successUrl;
  if (input.failureUrl) payload.failure_url = input.failureUrl;
  if (input.callbackUrl) payload.notification_url = input.callbackUrl;

  const response = await fetch(`${baseUrl}/v1/intention`, {
    method: 'POST',
    headers: buildPaymobHeaders(input.auth.secretKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paymob API error: ${error}`);
  }

  const data = await response.json();
  return {
    id: data.id || data.intention_id || data?.intention?.id || null,
    clientSecret: data.client_secret || data.clientSecret || data.secret || null,
    paymentUrl: data.payment_url || data.checkout_url || data.url || data.redirect_url || null,
    raw: data,
  };
}

function resolvePaymobSignature(headers, body) {
  const headerValue = headers['x-paymob-signature']
    || headers['x-paymob-hmac']
    || headers['x-paymob-signature-hmac'];

  if (Array.isArray(headerValue)) return headerValue[0] || null;
  if (typeof headerValue === 'string' && headerValue.trim()) return headerValue.trim();

  const bodyHmac = body?.hmac || body?.signature || null;
  return typeof bodyHmac === 'string' && bodyHmac.trim() ? bodyHmac.trim() : null;
}

function verifyPaymobWebhookSignature(payload, signature, secret) {
  const raw = typeof payload === 'string' ? payload : payload.toString('utf8');
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const received = String(signature || '').toLowerCase();
  const expected = digest.toLowerCase();
  if (received.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return received === expected;
  }
}

module.exports = {
  createPaymobIntention,
  resolvePaymobSignature,
  verifyPaymobWebhookSignature,
};
