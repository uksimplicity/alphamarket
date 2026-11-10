const test = require('node:test');
const assert = require('node:assert/strict');
const { GET } = require('./support/load-ts.cjs')('src/app/payment-processing/route.ts');

test('backend return path keeps the reference and stays on the hosted origin', () => {
  const response = GET(new Request('https://shop.example/payment-processing?reference=PAY-test-123'));
  assert.equal(response.status, 307);
  const destination = new URL(response.headers.get('Location'), 'https://shop.example');
  assert.equal(destination.origin, 'https://shop.example');
  assert.equal(destination.pathname, '/dashboard/checkout/payment');
  assert.equal(destination.searchParams.get('reference'), 'PAY-test-123');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('both provider reference fields survive URL encoding without accepting a redirect target', () => {
  const reference = 'PAY-test&other=1+#value';
  const query = new URLSearchParams({ reference, trxref: reference, redirect: 'https://external.example', status: 'paid' });
  const response = GET(new Request('https://shop.example/payment-processing?' + query));
  const destination = new URL(response.headers.get('Location'), 'https://shop.example');
  assert.equal(destination.searchParams.get('reference'), reference);
  assert.equal(destination.searchParams.get('trxref'), reference);
  assert.deepEqual([...destination.searchParams.keys()], ['reference', 'trxref']);
});

test('a missing reference opens existing checkout recovery without claiming payment success', () => {
  const response = GET(new Request('https://shop.example/payment-processing'));
  assert.equal(response.headers.get('Location'), '/dashboard/checkout/payment');
  assert.equal(response.body, null);
});
