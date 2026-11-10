const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { parseSettings, settingError, sameSettingValue } = load('src/components/admin/platformSettings.ts');
const originalFetch = global.fetch, originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api/v1'; });
afterEach(() => { global.fetch = originalFetch; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase; });
const percent = { key: 'marketplace_commission_rate', value: '5', type: 'percent', min: 0, max: 100 };
const call = (method = 'GET', body, token = 'Bearer test-admin') => load('src/app/api/admin/platform-settings/route.ts')[method](new Request('https://web.example/api/admin/platform-settings', {
  method, headers: { Authorization: token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
}));

test('settings retain metadata and reject missing types, duplicates and malformed lists', () => {
  assert.equal(parseSettings({ success: true, data: [percent] })[0].min, 0);
  for (const payload of [{ success: false, data: [] }, {}, { data: [percent, percent] }, { data: [{ ...percent, type: undefined }] }, { data: [{ ...percent, min: '0' }] }, { data: [{ key: 'choice', value: 'rider', type: 'choice', options: [] }] }]) assert.throws(() => parseSettings(payload));
});

test('numeric validation permits zero and decimals, enforces ranges and whole hours', () => {
  for (const value of ['0', '7.5', '100']) assert.equal(settingError(percent, value), '');
  for (const value of ['', ' ', '-1', '101', 'NaN', 'Infinity', '0x10']) assert.ok(settingError(percent, value));
  const hours = { key: 'escrow_timeout_hours', type: 'integer', min: 1, max: 1440 };
  assert.ok(settingError(hours, '1.5'));
  assert.equal(settingError(hours, '12'), '');
  assert.ok(sameSettingValue(percent, '5.00', '5'));
});

test('choice and fee validation uses server options and the saved counterpart', () => {
  const choice = { key: 'delivery_fee_recipient', type: 'choice', options: ['rider', 'platform'] };
  assert.equal(settingError(choice, 'rider'), '');
  assert.ok(settingError(choice, 'buyer'));
  assert.ok(settingError({ key: 'delivery_min_fee', type: 'number' }, '1000', { delivery_max_fee: '500' }));
  assert.ok(settingError({ key: 'delivery_max_fee', type: 'number' }, '400', { delivery_min_fee: '500' }));
});

test('updates use the documented DTO, authenticated identity and a single endpoint', async () => {
  let calls = 0;
  global.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://backend.example/api/v1/admin/platform-settings/upsert');
    assert.deepEqual(JSON.parse(init.body), { key: percent.key, value: '7.5' });
    assert.equal(init.headers.Authorization, 'Bearer test-admin');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.cache, 'no-store');
    return Response.json({ success: true });
  };
  assert.equal((await call('PUT', { key: percent.key, value: '7.5', admin_id: 'forged' })).status, 200);
  assert.equal(calls, 1);
});

test('authentication and malformed writes fail before reaching the backend', async () => {
  let calls = 0; global.fetch = async () => { calls++; return Response.json({}); };
  assert.equal((await call('GET', undefined, '')).status, 401);
  for (const body of [{ key: '../bad', value: '5' }, { key: percent.key, value: '' }, { key: percent.key, value: 5 }]) assert.equal((await call('PUT', body)).status, 400);
  assert.equal(calls, 0);
});

test('uncertain writes and rejection are never retried at alternative endpoints', async () => {
  for (const status of [302, 401, 403, 404, 500, 'lost']) {
    let calls = 0;
    global.fetch = async () => { calls++; if (status === 'lost') throw Error('Lost connection'); return Response.json({ error: 'Rejected' }, { status }); };
    assert.equal((await call('PUT', { key: percent.key, value: '0' })).status, [302, 'lost'].includes(status) ? 502 : status);
    assert.equal(calls, 1);
  }
});
