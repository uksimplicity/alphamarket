const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return loaded.exports;
}
const escrow = load('src/components/commerce/escrow.ts');

test('all categories are preserved and escrow IDs remain distinct from order IDs', () => {
  const rows = escrow.parseEscrows({ data: { escrows: [
    { id: 'fallback', escrow_id: 'escrow-one', order_id: 'order-one', source: 'marketplace', amount: '1200' },
    { id: 'escrow-two', order_id: 'order-two', source: 'rider', rider_id: 'rider-user' },
    { order_id: 'order-only', user_category: 'seller' },
  ] } }, 'pending');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].id, 'escrow-one');
  assert.equal(rows[0].orderId, 'order-one');
  assert.equal(rows[0].amount, 1200);
  assert.equal(rows[1].category, 'rider');
  assert.equal(rows[1].recipient, 'rider-user');
  assert.equal(rows[2].id, '');
  assert.equal(rows[2].amount, null);
  assert.equal(escrow.canResolveEscrow(rows[2]), false);
});
test('reversal requires an intentional reason and release notes are optional', () => {
  assert.throws(() => escrow.escrowActionBody('reverse', '  '), /Explain why/);
  assert.deepEqual(escrow.escrowActionBody('reverse', ' Customer requested refund '), { notes: 'Customer requested refund' });
  assert.deepEqual(escrow.escrowActionBody('release', ''), {});
});
test('admin roles are supported without granting admin powers to other categories', () => {
  for (const role of ['marketplace_admin', 'rider_admin', 'super_admin', 'admin']) assert.equal(escrow.isEscrowAdmin(role), true);
  for (const role of ['buyer', 'seller', 'rider', 'rider_app_customer', undefined]) assert.equal(escrow.isEscrowAdmin(role), false);
});
test('payment status alone does not prove escrow is held or released', () => {
  assert.equal(escrow.escrowStatusFromOrder({ data: { payment_status: 'paid', status: 'delivered' } }), 'unknown');
  assert.equal(escrow.escrowStatusFromOrder({ data: { order: { escrow: { status: 'released' } } } }), 'released');
  assert.equal(escrow.canResolveEscrow({ id: 'id', status: 'released' }), false);
  assert.match(escrow.escrowDescription('timed_out'), /does not automatically/);
});
test('receipt confirmation requires the actual customer, a paid delivery, and unresolved escrow', () => {
  const order = { buyerId: 'customer', status: 'delivered', paymentStatus: 'paid', escrowStatus: 'held' };
  assert.equal(escrow.canConfirmReceipt(order, 'customer'), true);
  assert.equal(escrow.canConfirmReceipt(order, 'seller'), false);
  assert.equal(escrow.canConfirmReceipt({ ...order, buyerId: '' }, 'customer'), false);
  assert.equal(escrow.canConfirmReceipt({ ...order, status: 'shipped' }, 'customer'), false);
  assert.equal(escrow.canConfirmReceipt({ ...order, paymentStatus: 'pending' }, 'customer'), false);
  assert.equal(escrow.canConfirmReceipt({ ...order, escrowStatus: 'released' }, 'customer'), false);
});
test('admin proxy uses only the documented admin endpoint and validates the financial action', async () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL, realFetch = global.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test/api/v1';
  const api = load('src/app/api/admin/escrows/[...path]/route.ts');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true, data: [] }); };
  const context = (...path) => ({ params: Promise.resolve({ path }) });
  const request = (body, token = 'Bearer admin-token') => new Request('https://app.test/api/admin/escrows/id/reverse', { method: 'POST', headers: token ? { Authorization: token, 'Content-Type': 'application/json' } : {}, body: JSON.stringify(body) });
  try {
    assert.equal((await api.POST(request({ notes: '' }), context('id', 'reverse'))).status, 400);
    assert.equal((await api.POST(request({ notes: 'reason' }, ''), context('id', 'reverse'))).status, 401);
    assert.equal((await api.POST(request({}), context('..', 'release'))).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await api.POST(request({ notes: ' reason ', force: true }), context('escrow-id', 'reverse'))).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://backend.test/api/v1/admin/escrows/escrow-id/reverse');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer admin-token');
    assert.equal(calls[0].init.redirect, 'manual');
    assert.deepEqual(JSON.parse(calls[0].init.body), { notes: 'reason' });
    await api.GET(new Request('https://app.test/api/admin/escrows/pending?limit=50&offset=50', { headers: { Authorization: 'Bearer admin-token' } }), context('pending'));
    assert.equal(calls[1].url, 'https://backend.test/api/v1/admin/escrows/pending?limit=50&offset=50');
    let attempts = 0;
    global.fetch = async () => { attempts++; throw new Error('connection lost'); };
    assert.equal((await api.POST(request({}), context('id', 'release'))).status, 502);
    assert.equal(attempts, 1);
    global.fetch = async () => { attempts++; return Response.json({ error: 'Not found' }, { status: 404 }); };
    assert.equal((await api.POST(request({}), context('id', 'release'))).status, 404);
    assert.equal(attempts, 2);
    global.fetch = async () => new Response(null, { status: 204 });
    const noContent = await api.POST(request({}), context('id', 'release'));
    assert.equal(noContent.status, 204);
    assert.equal(await noContent.text(), '');
  } finally { global.fetch = realFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; }
});
test('delivery confirmation is forwarded once and never retried at a different endpoint', async () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL, realFetch = global.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test';
  const api = load('src/app/api/buyer/orders/[orderId]/confirm-delivery/route.ts');
  const context = { params: Promise.resolve({ orderId: 'order-one' }) };
  let calls = 0;
  global.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://backend.test/api/v1/buyer/orders/order-one/confirm-delivery');
    assert.equal(init.redirect, 'manual');
    return Response.json({ error: 'Not delivered' }, { status: 400 });
  };
  try {
    const request = () => new Request('https://app.test/api/buyer/orders/order-one/confirm-delivery', { method: 'POST', headers: { Authorization: 'Bearer customer-token' } });
    assert.equal((await api.POST(request(), context)).status, 400);
    assert.equal(calls, 1);
    global.fetch = async () => { calls++; throw new Error('connection lost'); };
    assert.equal((await api.POST(request(), context)).status, 502);
    assert.equal(calls, 2);
  } finally { global.fetch = realFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; }
});
