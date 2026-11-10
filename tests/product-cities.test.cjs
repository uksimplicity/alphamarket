const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { productCityPage } = load('src/components/products/productCities.ts');
const originalFetch = global.fetch, previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
afterEach(() => { global.fetch = originalFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; });

test('supported city records retain real IDs; inactive and non-city records are excluded', () => {
  assert.deepEqual(productCityPage({ data: [{ id: 'lagos-id', name: 'Lagos', type: 'city' }, { id: 'inactive', name: 'Inactive', type: 'city', is_active: false }, { id: 'state-id', name: 'Lagos', type: 'state' }], meta: { total: 3 } }), { cities: [{ id: 'lagos-id', name: 'Lagos' }], total: 3, count: 3 });
  assert.deepEqual(productCityPage({ data: [], meta: { total: 0 } }).cities, []);
  for (const payload of [{}, { success: false, data: [] }, { data: [{ name: 'Missing ID' }] }, { data: [], meta: { total: 'bad' } }]) assert.throws(() => productCityPage(payload));
});

test('city proxy forwards public paginated reads to the documented endpoint without leaking browser credentials', async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api/v1';
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ data: [] }); };
  const response = await load('src/app/api/products/locations/route.ts').GET(new Request('https://web.example/api/products/locations?offset=100&type=state', { headers: { Authorization: 'Bearer private' } }));
  assert.equal(response.status, 200);
  assert.equal(calls[0].url, 'https://backend.example/api/v1/ads/locations?type=city&limit=100&offset=100');
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('city read failures are explicit and redirects never become alternate endpoints', async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example';
  for (const status of [302, 404, 500]) {
    let count = 0;
    global.fetch = async () => { count++; return Response.json({ error: 'Unavailable' }, { status }); };
    const result = await load('src/app/api/products/locations/route.ts').GET(new Request('https://web.example/api/products/locations'));
    assert.equal(result.status, status === 302 ? 502 : status);
    assert.equal(count, 1);
  }
});
