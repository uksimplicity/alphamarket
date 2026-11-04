const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originalFetch = global.fetch;
const originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
beforeEach(() => { load.reset(); process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api/v1/'; });
afterEach(() => {
  global.fetch = originalFetch;
  if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase;
});
function call(method, path, body, query = '', token = 'Bearer buyer-token') {
  return load('src/app/api/chat/productionProxy.ts')[method](new Request(`https://web.example/api/chat/${path}${query}`, {
    method, headers: { Authorization: token, 'Content-Type': 'application/json', Cookie: 'private=never-forward' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), { params: Promise.resolve({ path: path.split('/') }) });
}
test('production chat uses the marketplace API, bearer auth and documented pagination', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true, data: [] }); };
  await call('GET', 'conversations', undefined, '?limit=20&offset=40&type=order&status=open&user_id=forged');
  assert.equal(calls[0].url, 'https://backend.example/api/v1/chat/conversations?limit=20&offset=40&type=order&status=open');
  await call('GET', 'conversations/thread-1/messages', undefined, '?limit=30&before=2026-11-04T10%3A00%3A00Z');
  assert.equal(calls[1].url, 'https://backend.example/api/v1/chat/conversations/thread-1/messages?limit=30&before=2026-11-04T10%3A00%3A00Z');
  await call('GET', 'conversations/thread-1');
  await call('GET', 'categories');
  assert.equal(calls[3].url, 'https://backend.example/api/v1/chat-categories');
  for (const { init } of calls) {
    assert.equal(init.headers.Authorization, 'Bearer buyer-token');
    assert.equal(init.headers.Cookie, undefined);
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'manual');
  }
});
test('start, send and read requests strip identity overrides and temporary service fields', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true }); };
  await call('POST', 'conversations', { type: 'product', context_id: 'product-1', seller_id: 'forged', user_id: 'forged' });
  assert.deepEqual(JSON.parse(calls[0].init.body), { type: 'product', context_id: 'product-1' });
  await call('POST', 'conversations/thread-1/messages', { body: 'Hello', sender_id: 'forged', client_id: 'unsupported' });
  assert.deepEqual(JSON.parse(calls[1].init.body), { body: 'Hello' });
  await call('POST', 'conversations/thread-1/read');
  assert.equal(calls[2].url, 'https://backend.example/api/v1/chat/conversations/thread-1/read');
  assert.equal(calls[2].init.body, undefined);
});
test('invalid context, unauthenticated requests and unsupported routes never reach backend', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({}); };
  assert.equal((await call('GET', 'conversations', undefined, '', '')).status, 401);
  for (const route of ['session', 'sellers', 'conversations/../messages', 'conversations/id/private']) assert.equal((await call('GET', route)).status, 404);
  assert.equal((await call('POST', 'conversations', { type: 'support' })).status, 400);
  assert.equal((await call('POST', 'conversations', { type: 'product' })).status, 400);
  assert.equal((await call('POST', 'conversations/thread-1/messages', { text: 'legacy' })).status, 400);
  assert.equal((await call('GET', 'conversations', undefined, '?offset=-1')).status, 400);
  assert.equal((await call('GET', 'conversations/id/messages', undefined, '?before=invalid')).status, 400);
  assert.equal(calls, 0);
});
test('authorization failures propagate and failed sends are never redirected or replayed', async () => {
  for (const status of [401, 403, 404, 409, 500, 307, 'lost']) {
    let calls = 0;
    global.fetch = async () => {
      calls++;
      if (status === 'lost') throw new Error('connection lost after send');
      return Response.json({ success: false, error: 'backend error' }, { status });
    };
    const response = await call('POST', 'conversations/thread-1/messages', { body: 'Hello' });
    assert.equal(response.status, [307, 'lost'].includes(status) ? 502 : status);
    assert.equal(calls, 1);
  }
});
