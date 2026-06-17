'use strict';

/** Direct signup / payment bypass — same flags as Naiosh Fit */

function isDirectSignupAllowed() {
  if (process.env.SAAS_REQUIRE_PAYMENT === '1') {
    return process.env.SAAS_ALLOW_DIRECT_SIGNUP === '1';
  }
  return (
    process.env.SAAS_ALLOW_DIRECT_SIGNUP === '1' ||
    process.env.SAAS_SKIP_PAYMENT === '1' ||
    process.env.SAAS_SKIP_PAYMENT !== '0'
  );
}

function isSaasPaymentSkipped() {
  if (process.env.SAAS_REQUIRE_PAYMENT === '1') return false;
  if (process.env.SAAS_SKIP_PAYMENT === '0') return false;
  return true;
}

function getStoreCurrency() {
  return String(process.env.STORE_CURRENCY || 'SAR').toUpperCase();
}

module.exports = {
  isDirectSignupAllowed,
  isSaasPaymentSkipped,
  getStoreCurrency,
};
