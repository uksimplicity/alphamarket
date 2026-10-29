const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded._compile(compiled.outputText, filename);
  return loaded.exports;
}

const payments = loadTypeScript('src/components/commerce/payments.ts');

test('preserves every created order ID in a multi-seller checkout', () => {
  assert.deepEqual(payments.createdOrderIds({ data: { orders: [{ id: 'one' }, { order_id: 'two' }, { id: 'one' }] } }), ['one', 'two']);
  assert.deepEqual(payments.createdOrderIds({ data: { order_ids: ['one', 'two'] } }), ['one', 'two']);
  assert.deepEqual(payments.createdOrderIds({ data: { id: 'one' } }), ['one']);
});

test('does not initialize a partial or unidentified order response', () => {
  for (const payload of [{ data: [] }, { data: {} }, { data: [{ id: 'one' }, {}] }, { data: { order_ids: [''] } }]) {
    assert.throws(() => payments.createdOrderIds(payload), /did not return order IDs/);
  }
});

test('only accepts the HTTPS Paystack checkout host', () => {
  assert.equal(payments.checkoutUrl({ data: { checkout_url: 'https://checkout.paystack.com/session' } }), 'https://checkout.paystack.com/session');
  for (const url of ['javascript:alert(1)', 'http://checkout.paystack.com/session', 'https://checkout.paystack.com.attacker.test/session', 'https://attacker.test/session', 'https://user@checkout.paystack.com/session', 'https://checkout.paystack.com:444/session']) {
    assert.throws(() => payments.checkoutUrl({ data: { checkout_url: url } }));
  }
});

test('a reference or successful callback alone never counts as paid', () => {
  assert.equal(payments.orderPaymentStatus({ success: true, reference: 'ref' }), 'pending');
  assert.equal(payments.orderPaymentStatus({ data: { status: 'processing' } }), 'pending');
  assert.equal(payments.orderPaymentStatus({ data: { payment_status: 'paid' } }), 'paid');
  assert.equal(payments.orderPaymentStatus({ data: { order: { paymentStatus: 'FAILED' } } }), 'failed');
});

test('initialization forwards the authenticated order IDs and never retries an uncertain request', async () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalFetch = global.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test/api/v1';
  const initialize = loadTypeScript('src/app/api/payments/initialize/route.ts');
  const body = { buyer_id: 'buyer', order_ids: ['one', 'two'], callback_url: 'https://app.test/dashboard/checkout/payment' };
  let calls = 0;
  global.fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, 'https://backend.test/api/v1/payments/initialize');
    assert.deepEqual(JSON.parse(init.body), body);
    assert.equal(init.headers.Authorization, 'Bearer buyer-token');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'manual');
    return Response.json({ data: { checkout_url: 'https://checkout.paystack.com/session', reference: 'ref' } });
  };
  const request = () => new Request('https://app.test/api/payments/initialize', { method: 'POST', headers: { Authorization: 'Bearer buyer-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const response = await initialize.POST(request());
    assert.equal(response.status, 200);
    assert.equal(payments.paymentReference(await response.json()), 'ref');
    assert.equal(calls, 1);
    global.fetch = async () => { calls += 1; throw new Error('connection lost'); };
    assert.equal((await initialize.POST(request())).status, 502);
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
  }
});

test('checkout forwards created order IDs to payment initialization using the documented API base', async () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalFetch = global.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test/';
  const orders = loadTypeScript('src/app/api/buyer/orders/route.ts');
  const initialize = loadTypeScript('src/app/api/payments/initialize/route.ts');
  const orderBody = { buyer_id: 'buyer', payment_method: 'gateway', items: [{ product_id: 'product', quantity: 2 }], dropoff_address: 'Delivery address', dropoff_lat: 6.5, dropoff_lng: 3.4 };
  const requests = [];
  const request = (body, authenticated = true) => new Request('https://app.test/api/checkout', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer buyer-token' } : {}) }, body: JSON.stringify(body),
  });
  global.fetch = async (url, init) => {
    requests.push(url);
    assert.equal(init.headers.Authorization, 'Bearer buyer-token');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.cache, 'no-store');
    if (url.endsWith('/buyer/orders')) {
      assert.deepEqual(JSON.parse(init.body), orderBody);
      return Response.json({ data: { orders: [{ id: 'one' }, { id: 'two' }] } });
    }
    assert.deepEqual(JSON.parse(init.body).order_ids, ['one', 'two']);
    return Response.json({ data: { checkout_url: 'https://checkout.paystack.com/session' } });
  };
  try {
    const created = await orders.POST(request(orderBody));
    const orderIds = payments.createdOrderIds(await created.json());
    const started = await initialize.POST(request({ buyer_id: 'buyer', order_ids: orderIds, callback_url: 'https://app.test/dashboard/checkout/payment' }));
    assert.equal(payments.checkoutUrl(await started.json()), 'https://checkout.paystack.com/session');
    assert.deepEqual(requests, ['https://backend.test/api/v1/buyer/orders', 'https://backend.test/api/v1/payments/initialize']);
    for (const route of [orders, initialize]) {
      assert.equal((await route.POST(request({}, false))).status, 401);
      for (const status of [404, 307]) {
        let calls = 0;
        global.fetch = async () => { calls += 1; return new Response(null, { status, headers: { Location: 'https://other.test' } }); };
        assert.equal((await route.POST(request({}))).status, status === 307 ? 502 : 404);
        assert.equal(calls, 1, 'must not replay at an alternative endpoint or redirect');
      }
      let calls = 0;
      global.fetch = async () => { calls += 1; throw new Error('lost response'); };
      assert.equal((await route.POST(request({}))).status, 502);
      assert.equal(calls, 1);
    }
  } finally {
    global.fetch = originalFetch;
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
  }
});

test('callback verifies server-side without following a backend redirect or trusting it as payment success', async () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalFetch = global.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test/api/v1';
  const callback = loadTypeScript('src/app/api/payments/callback/route.ts');
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status: 302, headers: { Location: 'https://external.test/success' } });
  };
  try {
    const response = await callback.GET(new Request('https://app.test/api/payments/callback?reference=ref%26extra%3D1'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { verification_requested: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://backend.test/api/v1/payments/callback?reference=ref%26extra%3D1');
    assert.equal(calls[0].init.redirect, 'manual');
    assert.equal(calls[0].init.cache, 'no-store');
    assert.equal((await callback.GET(new Request('https://app.test/api/payments/callback'))).status, 400);
    assert.equal(calls.length, 1);
    global.fetch = async () => { throw new Error('network failure'); };
    assert.equal((await callback.GET(new Request('https://app.test/api/payments/callback?reference=ref'))).status, 502);
    global.fetch = async () => Response.json({ error: 'Invalid reference' }, { status: 400 });
    const rejected = await callback.GET(new Request('https://app.test/api/payments/callback?reference=ref'));
    assert.equal(rejected.status, 400);
    assert.deepEqual(await rejected.json(), { error: 'Invalid reference' });
  } finally {
    global.fetch = originalFetch;
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
  }
});
