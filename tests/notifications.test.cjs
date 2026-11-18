const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originals = { fetch: global.fetch, window: global.window, localStorage: global.localStorage, base: process.env.NEXT_PUBLIC_API_BASE_URL };
let auth, client, route;
beforeEach(() => {
  load.reset();
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api/v1';
  const disk = new Map();
  global.localStorage = { getItem: key => disk.get(key) || null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) };
  global.window = new EventTarget(); window.localStorage = localStorage;
  auth = load('src/components/auth/authStorage.ts');
  auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer-one', role: 'buyer' } });
  client = load('src/components/notifications/notificationClient.ts');
  route = load('src/app/api/user/notifications/[[...path]]/route.ts');
});
afterEach(() => {
  global.fetch = originals.fetch; global.window = originals.window; global.localStorage = originals.localStorage;
  if (originals.base === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = originals.base;
});
const request = (method = 'GET', query = '', token = 'Bearer buyer-token') => new Request('https://app.test/api/user/notifications' + query, { method, headers: { Authorization: token, Cookie: 'private=value' } });
const context = (...path) => ({ params: Promise.resolve({ path }) });

test('notification proxy validates pagination and forwards only documented filters and bearer authorization', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true, data: [] }); };
  const response = await route.GET(request('GET', '?limit=20&offset=40&is_read=false&type=order_placed&user_id=another-user'), context());
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://backend.example/api/v1/user/notifications?limit=20&offset=40&is_read=false&type=order_placed');
  assert.deepEqual(calls[0].init.headers, { Authorization: 'Bearer buyer-token', Accept: 'application/json' });
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('all notification actions use exactly the documented method and path once', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true }); };
  for (const [method, path] of [['GET', ['unread-count']], ['POST', ['read-all']], ['PATCH', ['notice-1', 'read']], ['DELETE', ['notice-1']]]) {
    assert.equal((await route[method](request(method), context(...path))).status, 200);
  }
  assert.deepEqual(calls.map(call => [new URL(call.url).pathname, call.init.method]), [
    ['/api/v1/user/notifications/unread-count', 'GET'], ['/api/v1/user/notifications/read-all', 'POST'],
    ['/api/v1/user/notifications/notice-1/read', 'PATCH'], ['/api/v1/user/notifications/notice-1', 'DELETE'],
  ]);
  assert.ok(calls.every(call => call.init.body === undefined));
});

test('invalid inputs and unauthenticated or mismatched methods never reach the notification backend', async () => {
  global.fetch = async () => { throw new Error('No upstream call expected'); };
  assert.equal((await route.GET(request('GET', '', ''), context())).status, 401);
  for (const query of ['?offset=-1', '?limit=0', '?limit=101', '?offset=1.5', '?is_read=maybe']) assert.equal((await route.GET(request('GET', query), context())).status, 400);
  assert.equal((await route.DELETE(request('DELETE'), context('read-all'))).status, 405);
  assert.equal((await route.POST(request('POST'), context('notice', 'read'))).status, 405);
  assert.equal((await route.GET(request(), context('extra', 'nested', 'path'))).status, 404);
  assert.equal((await route.DELETE(request('DELETE'), context('../admin'))).status, 400);
});

test('failed writes, redirects and unreadable results are not replayed or reported as successful', async () => {
  for (const [makeResponse, expected] of [
    [() => Response.json({ message: 'Denied' }, { status: 403 }), 403],
    [() => new Response(null, { status: 302, headers: { Location: 'https://other.test' } }), 502],
    [() => new Response('<html>Sign in</html>'), 502],
    [() => { throw new Error('Lost connection'); }, 502],
  ]) {
    let calls = 0;
    global.fetch = async () => { calls++; return makeResponse(); };
    assert.equal((await route.PATCH(request('PATCH'), context('notice-1', 'read'))).status, expected);
    assert.equal(calls, 1);
  }
});

test('notification parsing retains grouped counts, read state and correct pagination', () => {
  const item = { id: 'notice', title: 'New messages', body: 'Hello', type: 'chat_message', count: 5, is_read: false, created_at: '2026-11-15T10:00:00Z', data: { order_id: 'order-one' } };
  const page = client.notificationPage({ data: [item], meta: { total: 21 } }, 20, 20);
  assert.equal(page.hasMore, false); assert.equal(page.items[0].count, 5); assert.equal(page.items[0].isRead, false);
  assert.equal(client.notificationPage({ data: Array.from({ length: 20 }, (_, index) => ({ ...item, id: String(index) })) }, 20, 0).hasMore, true);
  assert.equal(client.notificationPage({ data: [] }, 20, 0).hasMore, false);
  for (const bad of [{ success: false, data: [] }, { data: null }, { data: [{ id: 'notice' }] }]) assert.throws(() => client.notificationPage(bad, 20, 0));
  assert.equal(client.unreadCount({ data: { unread_count: 0 } }), 0);
  assert.equal(client.unreadCount({ data: { unread_count: 25 } }), 25);
  for (const count of [-1, 1.5, '3', null]) assert.throws(() => client.unreadCount({ data: { unread_count: count } }));
});

test('notification links use known internal destinations and never backend-provided URLs', () => {
  const item = { type: 'order_placed', data: { order_id: 'one/two', url: 'https://evil.test' } };
  assert.equal(client.notificationLink(item, false), '/dashboard/orders/one%2Ftwo');
  assert.equal(client.notificationLink(item, true), '/vendor/orders/one%2Ftwo');
  assert.equal(client.notificationLink({ type: 'unknown', data: { url: 'javascript:alert(1)' } }, false), null);
  assert.equal(client.notificationLink({ type: 'chat_message', data: {} }, true), '/vendor/messages');
});

test('delivery fallback selects the latest dated notification for the exact order', () => {
  const { latestDeliveryNotice, noticeRiderName } = load('src/components/notifications/deliveryNoticeSelection.ts');
  const notice = (title, order, date, type = 'delivery_update') => ({ title, type, date, data: { order_id: order } });
  const items = [notice('Rider on the way for pickup', 'order-1', '2026-11-17T12:23:09Z'),
    notice('Delivery completed', 'order-2', '2026-11-18T12:23:09Z'),
    notice('Rider assigned', 'order-1', '2026-11-16T12:23:09Z'),
    notice('Rider delivered', 'order-1', 'bad-date'),
    notice('Rider on the way', 'order-1', '2026-11-19T12:23:09Z', 'chat_message')];
  assert.equal(latestDeliveryNotice(items, 'order-1').title, 'Rider on the way for pickup');
  assert.equal(latestDeliveryNotice(items, 'unknown'), null);
  assert.equal(noticeRiderName({ data: { rider: { user: { first_name: 'Ada' } } } }), 'Ada');
  assert.equal(noticeRiderName({ data: {} }), '');
});

test('client refuses HTTP 200 failures and uses the current authenticated account', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: false, message: 'Access denied' }); };
  await assert.rejects(client.notificationRequest('/notice/read', 'PATCH'), /Access denied/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer buyer-token');
  auth.clearAuth();
  await assert.rejects(client.notificationRequest(), /sign in/i);
  assert.equal(calls.length, 1);
});

test('a notification response from a previous account is rejected before it can be displayed', async () => {
  let complete;
  global.fetch = () => new Promise(resolve => { complete = resolve; });
  const pending = client.notificationRequest();
  auth.setAuth({ access_token: 'seller-token', user: { id: 'seller-two', role: 'seller' } });
  complete(Response.json({ data: [{ id: 'private-buyer-notice', is_read: false }] }));
  await assert.rejects(pending, /account changed/);
});
