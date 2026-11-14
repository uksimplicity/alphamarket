const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const originalFetch = global.fetch, originalBase = process.env.NEXT_PUBLIC_API_BASE_URL, originalWindow = global.window, originalStorage = global.localStorage;
beforeEach(() => { load.reset(); process.env.NEXT_PUBLIC_API_BASE_URL = 'https://marketplace.example/api/v1'; });
afterEach(() => { global.fetch = originalFetch; global.window = originalWindow; global.localStorage = originalStorage; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase; });
function request(method, body, query = '', auth = 'Bearer qa-token') { return new Request('https://web.example/api/ads' + query, { method, headers: { Authorization: auth, Cookie: 'private-browser-cookie', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
function browserAccount() {
  let auth = { access_token: 'buyer-token', user: { id: 'buyer-one', role: 'buyer' } };
  const storage = { getItem: () => JSON.stringify(auth) };
  global.window = { localStorage: storage };
  global.localStorage = storage;
  return value => { auth = value; };
}

test('public Ads reads need no login and never forward browser credentials', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true, data: [] }); };
  const response = await load('src/app/api/adsProxy.ts').forwardAds(request('GET', undefined, '?category_id=category&location_id=city&promotion=vip&limit=20&offset=0'), 'public');
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith('https://marketplace.example/api/v1/ads?'));
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.equal(calls[0].init.headers.Cookie, undefined);
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('My Ads uses authenticated ownership routes and exact documented purchase/resubmit bodies', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ data: { id: 'ad-one' } }, { status: init.method === 'POST' ? 201 : 200 }); };
  const { forwardAds } = load('src/app/api/adsProxy.ts');
  const payload = { name: 'Chair', basePrice: 5000, categoryId: 'category', productTypeId: 'type', locationId: 'area', address: '12 Allen Avenue, Ikeja, Lagos, Nigeria' };
  await forwardAds(request('POST', payload), 'mine');
  await forwardAds(request('PUT', { shortDescription: 'Updated chair' }), 'mine', ['ad-one']);
  await forwardAds(request('POST', { plan_id: 'plan-one' }), 'mine', ['ad-one', 'promotions']);
  await forwardAds(request('POST'), 'mine', ['ad-one', 'resubmit']);
  assert.deepEqual(calls.map(call => call.url), [
    'https://marketplace.example/api/v1/user/ads', 'https://marketplace.example/api/v1/user/ads/ad-one',
    'https://marketplace.example/api/v1/user/ads/ad-one/promotions', 'https://marketplace.example/api/v1/user/ads/ad-one/resubmit',
  ]);
  assert.deepEqual(JSON.parse(calls[0].init.body), payload);
  assert.deepEqual(JSON.parse(calls[2].init.body), { plan_id: 'plan-one' });
  assert.ok(calls.every(call => call.init.headers.Authorization === 'Bearer qa-token' && !call.init.headers.Cookie));
});

test('admin moderation, fee overrides, plans and refund cancellation preserve backend contracts', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true }); };
  const { forwardAds } = load('src/app/api/adsProxy.ts');
  for (const action of ['approve', 'reject', 'request-changes', 'suspend', 'unsuspend']) {
    await forwardAds(request('POST', action === 'suspend' ? { reason: 'Verify details', duration_hours: 24 } : { reason: 'Review reason', note: 'Review note' }), 'admin', ['ad-one', action]);
  }
  await forwardAds(request('DELETE', { reason: 'Duplicate listing' }), 'admin', ['ad-one']);
  assert.deepEqual(JSON.parse(calls[5].init.body), { reason: 'Duplicate listing' }, 'DELETE must forward the required audit reason');
  await forwardAds(request('PUT', { amount: 250, is_active: true }), 'admin', ['fees', 'categories', 'category']);
  await forwardAds(request('DELETE'), 'admin', ['fees', 'categories', 'category']);
  const plan = { name: 'VIP week', type: 'vip', price: 1000, duration_days: 7, category_ids: ['category'], location_ids: ['area'] };
  await forwardAds(request('POST', plan), 'plans');
  await forwardAds(request('POST', { reason: 'Stopped by admin', refund: true }), 'promotions', ['promotion-one', 'cancel']);
  assert.ok(calls[8].url.endsWith('/admin/promotion-plans'));
  assert.deepEqual(JSON.parse(calls[8].init.body), plan);
  assert.ok(calls[9].url.endsWith('/admin/promotions/promotion-one/cancel'));
  assert.deepEqual(JSON.parse(calls[9].init.body), { reason: 'Stopped by admin', refund: true });
});

test('protected reads/writes and invalid routes fail before any upstream call', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('Must not reach upstream'); };
  const { forwardAds } = load('src/app/api/adsProxy.ts');
  for (const scope of ['mine', 'admin', 'plans', 'promotions']) assert.equal((await forwardAds(request('GET', undefined, '', ''), scope)).status, 401);
  assert.equal((await forwardAds(request('POST', {}), 'public')).status, 405);
  assert.equal((await forwardAds(request('GET'), 'mine', ['..'])).status, 400);
  assert.equal((await forwardAds(request('GET'), 'mine', ['ad/../other'])).status, 400);
  assert.equal((await forwardAds(request('POST', {}), 'mine', ['ad-one', 'approve'])).status, 405);
  assert.equal((await forwardAds(request('GET', undefined, '?limit=0'), 'public')).status, 400);
  assert.equal((await forwardAds(request('GET', undefined, '?offset=-1'), 'public')).status, 400);
  assert.equal((await forwardAds(request('GET', undefined, '?target=https://other.example'), 'public')).status, 400);
  assert.equal((await forwardAds(request('GET', undefined, '?include_deleted=true'), 'public')).status, 400);
  assert.equal((await forwardAds(request('GET', undefined, '?status=pending'), 'public')).status, 400);
  assert.equal((await forwardAds(request('GET', undefined, '?owner_id=other'), 'mine')).status, 400);
  assert.equal(calls, 0);
});

test('Ads writes never retry after a rejection, redirect, malformed response or lost response', async () => {
  const { forwardAds } = load('src/app/api/adsProxy.ts');
  for (const respond of [
    () => Response.json({ error: 'Not found' }, { status: 404 }),
    () => new Response(null, { status: 302, headers: { Location: 'https://other.example' } }),
    () => new Response('<html>unreadable</html>'),
    () => { throw new Error('Lost response'); },
  ]) {
    let calls = 0;
    global.fetch = async () => { calls++; return respond(); };
    assert.ok((await forwardAds(request('POST', { plan_id: 'plan' }), 'mine', ['ad-one', 'promotions'])).status >= 400);
    assert.equal(calls, 1);
  }
});

test('fee and wallet parsing preserves zero and rejects unknown amounts', () => {
  const { amount, rows, money } = load('src/components/ads/data.ts');
  assert.equal(amount({ data: { amount: 0 } }, ['amount', 'fee']), 0);
  assert.equal(amount({ data: { fee: { amount: '250.50' } } }, ['amount', 'fee']), 250.5);
  assert.equal(amount({ data: { balance: '1200.00' } }, ['balance']), 1200);
  assert.equal(amount({ data: {} }, ['amount', 'fee']), null);
  assert.equal(amount({ data: { amount: '' } }, ['amount']), null);
  assert.equal(money(undefined), 'Unavailable');
  assert.throws(() => rows({ data: { unexpected: [] } }), /unreadable list/);
});

test('only approved, published, non-deleted ads can be promoted', () => {
  const { canPromote } = load('src/components/ads/data.ts');
  assert.equal(canPromote({ moderation_status: 'approved', is_active: true }), true);
  for (const item of [{ moderation_status: 'pending' }, { moderation_status: 'rejected' }, { moderation_status: 'changes_requested' }, { moderation_status: 'suspended' }, { moderation_status: 'approved', is_active: false }, { moderation_status: 'approved', is_published: false }, { moderation_status: 'approved', deleted_at: '2026-11-14' }]) assert.equal(canPromote(item), false);
});

test('posting cost requires a backend quote and never treats a wallet failure as a zero balance', async () => {
  browserAccount();
  const { fetchPostingCost } = load('src/components/ads/client.ts');
  global.fetch = async url => url.includes('posting-fee') ? Response.json({ data: { amount: 250 } }) : Response.json({ error: 'Unavailable' }, { status: 503 });
  assert.deepEqual(await fetchPostingCost('category'), { fee: 250, balance: null });
  global.fetch = async url => url.includes('posting-fee') ? Response.json({ data: {} }) : Response.json({ data: { balance: 1000 } });
  await assert.rejects(fetchPostingCost('category'), /posting fee could not be read/);
});

test('client refuses HTTP 200 business failures and ignores responses after an account change', async () => {
  const changeAccount = browserAccount();
  const { adsRequest } = load('src/components/ads/client.ts');
  global.fetch = async () => Response.json({ success: false, error: 'Wallet balance too low' });
  await assert.rejects(adsRequest('/api/my-ads', { method: 'POST', body: '{}' }), /Wallet balance too low/);
  global.fetch = async () => { changeAccount({ access_token: 'other-token', user: { id: 'other-buyer' } }); return Response.json({ data: { id: 'private-ad' } }); };
  await assert.rejects(adsRequest('/api/my-ads'), /account changed/);
});

test('mutation lock prevents concurrent purchases and uncertain retries before React renders again', async () => {
  let release, calls = 0;
  class AdsError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/components/ads/hooks.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module: loaded, exports: loaded.exports, require(name) {
    if (name === 'react') return { useRef: current => ({ current }), useState: initial => [initial, () => {}] };
    if (name === './client') return { AdsError, adsRequest: async () => { calls++; await new Promise(resolve => { release = resolve; }); throw new AdsError('Response lost', 502); } };
    return {};
  } });
  const mutation = loaded.exports.useAdsMutation();
  const first = mutation.run('/api/my-ads/ad-one/promotions', 'POST', { plan_id: 'plan' });
  assert.equal(await mutation.run('/api/my-ads/ad-one/promotions', 'POST', { plan_id: 'plan' }), false);
  assert.equal(calls, 1);
  release(); await first;
  assert.equal(await mutation.run('/api/my-ads/ad-one/promotions', 'POST', { plan_id: 'plan' }), false);
  assert.equal(calls, 1);
});
