const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { orderCheckoutError } = load('src/components/commerce/checkoutErrors.ts');

test('seller pickup failures give buyers actionable guidance without exposing raw coordinates', () => {
  const result = orderCheckoutError({ success: false, error: 'pickup location is outside our delivery area: pickup coordinates (0.00000, 0.00000) are not in Nigeria - check the seller/sender saved location' }, 'Failed');
  assert.equal(result.code, 'SELLER_PICKUP_LOCATION_INVALID');
  assert.match(result.message, /pickup location.*updating/);
  assert.match(result.message, /seller/);
  assert.doesNotMatch(result.message, /0\.00000|coordinates|Nigeria/);
});

test('buyer delivery, payment and unrelated validation errors retain their own messages', () => {
  for (const message of ['dropoff location is outside our delivery area', 'Payment authorization declined', 'Product is out of stock', 'Pickup instructions are too long']) {
    const result = orderCheckoutError({ error: message }, 'Fallback');
    assert.equal(result.code, undefined);
    assert.equal(result.message, message);
  }
  assert.deepEqual(orderCheckoutError({}, 'Fallback'), { code: undefined, message: 'Fallback' });
});
