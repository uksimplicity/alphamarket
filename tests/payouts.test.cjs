const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths; loaded._compile(compiled.outputText, filename); return loaded.exports;
}
const payouts = load('src/components/vendor/payouts.ts');

test('withdrawable funds are never inferred from sales, escrow, wallet totals or missing fields', () => {
  assert.deepEqual(payouts.payoutSummary({ data: { balance: 90000, total_sales: 100000, escrow_balance: 20000 } }), { available: null, pending: null });
  assert.deepEqual(payouts.payoutSummary({ data: { data: { available_balance: '12500.75', pending_withdrawals: 2000 } } }), { available: 12500.75, pending: 2000 });
  assert.equal(payouts.payoutSummary({ data: { available_balance: '', pending_withdrawals: [] } }).pending, null);
  assert.equal(payouts.payoutSummary({ data: { available_balance: -200 } }).available, null);
});
test('naira amounts remain in naira and cannot exceed the explicit available balance', () => {
  assert.equal(payouts.withdrawalAmount('2500.50', 3000), 2500.5);
  for (const value of ['0', '-1', '1e3', '1.001', 'Infinity', '2,500', '3000.01']) assert.throws(() => payouts.withdrawalAmount(value, 3000));
  assert.throws(() => payouts.withdrawalAmount('20', null), /available balance/);
});
test('bank and withdrawal records preserve missing fields without inventing amounts, IDs or statuses', () => {
  assert.deepEqual(payouts.payoutBanks({ data: { banks: [{ name: 'Bank', code: '001' }] } }), [{ name: 'Bank', code: '001' }]);
  assert.equal(payouts.payoutAccount({ data: null }), null);
  assert.deepEqual(payouts.payoutAccount({ data: { account_number: '0123456789', account_name: 'Seller', bank_name: 'Bank', bank_code: '001' } }), { number: '0123456789', name: 'Seller', bank: 'Bank', bankCode: '001' });
  const [item] = payouts.payoutWithdrawals({ data: { withdrawals: [{}] } });
  assert.equal(item.id, ''); assert.equal(item.amount, null); assert.equal(item.status, 'unknown');
  assert.throws(() => payouts.payoutWithdrawals({ data: { unexpected: [] } }), /unrecognized list/);
  assert.equal(payouts.maskedAccount('0123456789'), '•••• 6789');
});
test('payout routes use authenticated documented endpoints and strip account ownership overrides', async () => {
  const originalFetch = global.fetch, previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test/';
  const api = load('src/app/api/payouts/[...path]/route.ts');
  const calls = [];
  const context = (...path) => ({ params: Promise.resolve({ path }) });
  const request = (method, query = '', body, token = true) => new Request(`https://app.test/api/payouts/route${query}`, { method, headers: { ...(token ? { Authorization: 'Bearer seller-token' } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ data: {} }); };
  try {
    await api.GET(request('GET', '?account_number=0123456789&bank_code=001&user_id=other'), context('resolve'));
    assert.equal(calls[0].url, 'https://backend.test/api/v1/payouts/resolve?account_number=0123456789&bank_code=001');
    await api.PUT(request('PUT', '', { account_number: '0123456789', bank_code: '001', user_id: 'other', account_name: 'Spoof' }), context('account'));
    assert.deepEqual(JSON.parse(calls[1].init.body), { account_number: '0123456789', bank_code: '001' });
    await api.POST(request('POST', '', { amount: 2500.5, user_id: 'other', approved: true }), context('withdrawals'));
    assert.deepEqual(JSON.parse(calls[2].init.body), { amount: 2500.5 });
    await api.POST(request('POST'), context('withdrawals', 'withdrawal-id', 'cancel'));
    assert.equal(calls[3].url, 'https://backend.test/api/v1/payouts/withdrawals/withdrawal-id/cancel');
    await api.GET(request('GET', '?limit=20&offset=40&seller_id=other'), context('withdrawals'));
    assert.equal(calls[4].url, 'https://backend.test/api/v1/payouts/withdrawals?limit=20&offset=40');
    await api.GET(request('GET'), context('withdrawals', 'withdrawal-id'));
    for (const call of calls) { assert.equal(call.init.headers.Authorization, 'Bearer seller-token'); assert.equal(call.init.redirect, 'manual'); assert.equal(call.init.cache, 'no-store'); }
    const before = calls.length;
    assert.equal((await api.GET(request('GET', '', undefined, false), context('summary'))).status, 401);
    assert.equal((await api.POST(request('POST', '', { amount: -20 }), context('withdrawals'))).status, 400);
    assert.equal((await api.POST(request('POST', '', { amount: 1.001 }), context('withdrawals'))).status, 400);
    assert.equal((await api.PUT(request('PUT', '', { account_number: '123', bank_code: '001' }), context('account'))).status, 400);
    assert.equal((await api.GET(request('GET', '?limit=20&offset=-1'), context('withdrawals'))).status, 400);
    assert.equal((await api.GET(request('GET'), context('withdrawals', '..'))).status, 400);
    assert.equal((await api.POST(request('POST'), context('withdrawals', 'id', 'approve'))).status, 404);
    assert.equal(calls.length, before);
  } finally { global.fetch = originalFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; }
});
test('financial requests never follow redirects or replay a missing or uncertain response', async () => {
  const originalFetch = global.fetch, previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test/api/v1';
  const api = load('src/app/api/payouts/[...path]/route.ts');
  const context = { params: Promise.resolve({ path: ['withdrawals'] }) };
  const request = () => new Request('https://app.test/api/payouts/withdrawals', { method: 'POST', headers: { Authorization: 'Bearer seller-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 100 }) });
  try {
    for (const status of [404, 307, 500, 'lost']) {
      let calls = 0;
      global.fetch = async () => { calls++; if (status === 'lost') throw new Error('connection lost'); return new Response(null, { status, headers: { Location: 'https://other.test' } }); };
      assert.equal((await api.POST(request(), context)).status, [307, 'lost'].includes(status) ? 502 : status);
      assert.equal(calls, 1);
    }
  } finally { global.fetch = originalFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; }
});
