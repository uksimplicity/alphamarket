const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originalFetch = global.fetch;
const env = { NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL, ADMIN_COMMISSION_SETTING_KEY: process.env.ADMIN_COMMISSION_SETTING_KEY };
beforeEach(() => { load.reset(); process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api/v1'; delete process.env.ADMIN_COMMISSION_SETTING_KEY; });
afterEach(() => { global.fetch = originalFetch; for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
function call(method = 'GET', body, token = 'Bearer admin-token') {
  return load('src/app/api/admin/commission-setting/route.ts')[method](new Request('https://web.example/api/admin/commission-setting?admin_id=admin-id', {
    method, headers: { Authorization: token, 'Content-Type': 'application/json', Cookie: 'private=not-forwarded' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
test('unset percentage remains unset; saved zero is distinct from no rate', async () => {
  global.fetch = async () => Response.json({ success: true, data: [] });
  assert.deepEqual(await (await call()).json(), { percentage: null });
  global.fetch = async () => Response.json({ success: true, data: [{ key: 'commission_percentage', value: '0' }] });
  assert.deepEqual(await (await call()).json(), { percentage: 0 });
});
test('admin chooses the percentage with no ratio conversion or identity overrides', async () => {
  let sent;
  global.fetch = async (url, init) => { sent = { url, init }; return Response.json({ success: true }); };
  for (const percentage of [0, 7.25, 10, 100, 0.0000001]) {
    assert.equal((await call('PUT', { percentage, key: 'forged', value: 'forged' })).status, 200);
    assert.equal(sent.url, 'https://backend.example/api/v1/admin/platform-settings/upsert?admin_id=admin-id');
    const payload = JSON.parse(sent.init.body);
    assert.equal(payload.key, 'commission_percentage'); assert.equal(payload.value, String(percentage));
    assert.equal(sent.init.headers.Authorization, 'Bearer admin-token'); assert.equal(sent.init.headers.Cookie, undefined);
    assert.equal(sent.init.redirect, 'manual'); assert.equal(sent.init.cache, 'no-store');
  }
});
test('invalid percentages and missing authentication never reach the backend', async () => {
  let calls = 0; global.fetch = async () => { calls++; return Response.json({}); };
  assert.equal((await call('GET', undefined, '')).status, 401);
  for (const percentage of [-1, 100.01, '10', '', null, {}, undefined]) assert.equal((await call('PUT', { percentage })).status, 400);
  assert.equal(calls, 0);
});
test('load uses the configured setting key and rejects malformed or ambiguous saved values', async () => {
  process.env.ADMIN_COMMISSION_SETTING_KEY = 'backend_commission_percent';
  global.fetch = async url => {
    assert.equal(url, 'https://backend.example/api/v1/admin/platform-settings/all');
    return Response.json({ data: { settings: [{ key: 'backend_commission_percent', value: '15.5' }] } });
  };
  assert.deepEqual(await (await call()).json(), { percentage: 15.5 });
  for (const data of [{ unexpected: [] }, [{ key: 'backend_commission_percent', value: '' }], [{ key: 'backend_commission_percent', value: '101' }], [{ key: 'backend_commission_percent', value: '10%' }], [{ key: 'backend_commission_percent', value: '10' }, { key: 'backend_commission_percent', value: '20' }]]) {
    global.fetch = async () => Response.json({ data });
    assert.equal((await call()).status, 502);
  }
});
test('redirects, missing routes and uncertain saves are never replayed', async () => {
  for (const status of [307, 401, 403, 404, 500, 'lost']) {
    let calls = 0;
    global.fetch = async () => { calls++; if (status === 'lost') throw new Error('connection lost'); return Response.json({ error: 'Backend rejected request' }, { status }); };
    const response = await call('PUT', { percentage: 10 });
    assert.equal(response.status, [307, 'lost'].includes(status) ? 502 : status);
    assert.equal(calls, 1);
  }
});
