const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originalFetch = global.fetch, originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
beforeEach(() => { load.reset(); process.env.NEXT_PUBLIC_API_BASE_URL = 'https://marketplace.example/api/v1'; });
afterEach(() => { global.fetch = originalFetch; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase; });
const request = (method, body, auth = 'Bearer admin-token', query = '') => new Request('https://web.example/api/admin/ad-locations' + query, { method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test('admin creates an active city through the existing endpoint without inventing IDs', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true, data: { id: 'backend-created-id' } }, { status: 201 }); };
  const response = await load('src/app/api/admin/ad-locations/route.ts').POST(request('POST', { name: '  Warri  ', type: 'city', parent_id: 'delta-id', id: 'forged-id', is_active: false }));
  assert.equal(response.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://marketplace.example/api/v1/admin/ad-locations');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer admin-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'Warri', type: 'city', parent_id: 'delta-id', is_active: true });
  assert.equal(calls[0].init.redirect, 'manual');
});

test('admin reads paginated locations including inactive records and activates a selected record once', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ data: [] }); };
  await load('src/app/api/admin/ad-locations/route.ts').GET(request('GET', undefined, 'Bearer admin-token', '?limit=100&offset=100'));
  await load('src/app/api/admin/ad-locations/[id]/route.ts').PUT(request('PUT', { is_active: true, name: 'ignored' }), { params: Promise.resolve({ id: 'warri-id' }) });
  assert.equal(calls[0].url, 'https://marketplace.example/api/v1/admin/ad-locations?limit=100&offset=100');
  assert.equal(calls[1].url, 'https://marketplace.example/api/v1/admin/ad-locations/warri-id');
  assert.equal(calls[1].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[1].init.body), { is_active: true });
});

test('invalid or unauthenticated location writes do not reach the backend', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({}); };
  const collection = load('src/app/api/admin/ad-locations/route.ts');
  assert.equal((await collection.POST(request('POST', { name: 'Warri', type: 'city' }, ''))).status, 401);
  for (const body of [{ name: '', type: 'city' }, { name: 'x'.repeat(151), type: 'city' }, { name: 'Warri', type: 'unknown' }, { name: 'Warri', type: 'city', parent_id: {} }]) assert.equal((await collection.POST(request('POST', body))).status, 400);
  assert.equal((await collection.GET(request('GET', undefined, 'Bearer admin-token', '?limit=999'))).status, 400);
  assert.equal((await load('src/app/api/admin/ad-locations/[id]/route.ts').PUT(request('PUT', { is_active: 'true' }), { params: Promise.resolve({ id: 'warri-id' }) })).status, 400);
  assert.equal(calls, 0);
});

test('backend denial and duplicate creation remain errors and writes are never replayed', async () => {
  for (const status of [403, 409, 500]) {
    let calls = 0;
    global.fetch = async () => { calls++; return Response.json({ error: 'Rejected' }, { status }); };
    const response = await load('src/app/api/admin/ad-locations/route.ts').POST(request('POST', { name: 'Warri', type: 'city' }));
    assert.equal(response.status, status);
    assert.equal(calls, 1);
  }
});
