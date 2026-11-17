const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originalFetch = global.fetch, originalBase = process.env.NEXT_PUBLIC_API_BASE_URL, originalDirectory = process.env.CHAT_SERVER_URL;
beforeEach(() => { load.reset(); process.env.NEXT_PUBLIC_API_BASE_URL = 'https://marketplace.example/api/v1'; process.env.CHAT_SERVER_URL = 'https://directory.example'; });
afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of [['NEXT_PUBLIC_API_BASE_URL', originalBase], ['CHAT_SERVER_URL', originalDirectory]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  delete global.window; delete global.localStorage;
});
const conversation = () => ({ id: 'thread-1', type: 'product', status: 'open', context_id: 'product-1', participants: [
  { user_id: 'seller', name: 'Example Seller', role: 'seller' }, { user_id: 'buyer', name: 'Example Buyer', role: 'buyer' }
], last_message_preview: 'Hello', last_message_at: '2026-11-04T10:39:30.231039Z', unread_count: 1, created_at: '2026-11-04T10:39:30.16872Z' });
const message = (id = 'message-1', created_at = '2026-11-04T10:39:30.231039Z') => ({ id, conversation_id: 'thread-1', sender_id: 'buyer', sender_role: 'buyer', type: 'text', body: 'Hello', created_at });
function browser() {
  const values = new Map(); global.window = new EventTarget();
  global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const auth = load('src/components/auth/authStorage.ts'); auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer' } }); return auth;
}
test('active chat route uses production API while retaining read-only catalog names separately', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true, data: [] }); };
  const api = load('src/app/api/chat/[...path]/route.ts');
  const request = path => new Request('https://web.example/api/chat/' + path, { headers: { Authorization: 'Bearer buyer-token', Cookie: 'private=not-forwarded' } });
  await api.GET(request('conversations'), { params: Promise.resolve({ path: ['conversations'] }) });
  assert.equal(calls[0].url, 'https://marketplace.example/api/v1/chat/conversations?limit=20&offset=0');
  await api.GET(request('sellers'), { params: Promise.resolve({ path: ['sellers'] }) });
  assert.equal(calls[1].url, 'https://directory.example/v1/sellers');
  assert.equal(calls[0].init.headers.Cookie, undefined);
  assert.equal(calls[1].init.headers.Cookie, undefined);
  const response = await api.POST(new Request('https://web.example/api/chat/session', { method: 'POST' }), { params: Promise.resolve({ path: ['session'] }) });
  assert.equal(response.status, 404);
});
test('conversation and message decoders follow supplied backend response fields', () => {
  browser(); const api = load('src/components/chat/chatClient.ts');
  const thread = api.decodeThread(conversation(), 'buyer');
  assert.equal(thread.peer.id, 'seller'); assert.equal(thread.peer.name, 'Example Seller'); assert.equal(thread.unread, 1);
  assert.equal(thread.contextId, 'product-1'); assert.equal(thread.status, 'open');
  assert.equal(api.decodeThread(conversation(), 'seller').peer.id, 'buyer');
  const item = api.decodeMessage(message());
  assert.equal(item.text, 'Hello'); assert.equal(item.conversation_id, 'thread-1');
  assert.throws(() => api.decodeThread(conversation(), 'unrelated'));
  assert.throws(() => api.decodeMessage({ ...message(), created_at: 'invalid' }));
  assert.equal(api.decodeMessage({ ...message(), attachment_url: 'javascript:alert(1)' }).attachment, '');
});
test('client uses envelopes, context IDs, before cursors, plain body sends and read acknowledgements', async () => {
  browser(); const { ChatClient } = load('src/components/chat/chatClient.ts'); const client = new ChatClient(), calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/messages')) return Response.json({ success: true, data: init.method === 'POST' ? message() : [message('new', '2026-11-04T10:39:31Z'), message()] });
    if (url.endsWith('/read')) return Response.json({ success: true });
    if (url.includes('?limit=20')) return Response.json({ success: true, data: [conversation()], meta: { total: 21, offset: 20, limit: 20 } });
    return Response.json({ success: true, data: conversation() });
  };
  assert.equal((await client.threads(20)).total, 21);
  assert.equal((await client.start('product-1')).id, 'thread-1');
  assert.deepEqual(JSON.parse(calls[1].init.body), { type: 'product', context_id: 'product-1' });
  assert.equal((await client.messages('thread-1', '2026-11-04T10:39:32Z'))[0].id, 'message-1');
  assert.match(calls[2].url, /before=2026-11-04T10%3A39%3A32Z/);
  await client.send('thread-1', 'Hello'); assert.deepEqual(JSON.parse(calls[3].init.body), { body: 'Hello' });
  await client.read('thread-1'); assert.equal(calls[4].init.body, undefined);
  for (const call of calls) assert.equal(call.init.headers.Authorization, 'Bearer buyer-token');
});
test('seller starts contextual buyer and rider chats with matching participants and without sending messages', async () => {
  const auth = browser(); auth.setAuth({ access_token: 'seller-token', user: { id: 'seller' } });
  const { ChatClient } = load('src/components/chat/chatClient.ts'); const client = new ChatClient(); const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init }); const body = JSON.parse(init.body);
    const data = { ...conversation(), type: body.type, context_id: body.context_id };
    if (body.type === 'delivery') data.participants = [{ user_id: 'seller', name: 'Seller', role: 'seller' }, { user_id: 'rider', name: 'Rider', role: 'rider' }];
    return Response.json({ success: true, data });
  };
  assert.equal((await client.startOrder('paid-order', 'buyer')).peer.id, 'buyer');
  assert.equal((await client.startDelivery('delivery', 'rider')).peer.id, 'rider');
  assert.deepEqual(calls.map(call => JSON.parse(call.init.body)), [{ type: 'order', context_id: 'paid-order' }, { type: 'delivery', context_id: 'delivery' }]);
  assert.ok(calls.every(call => call.url === '/api/chat/conversations' && call.init.headers.Authorization === 'Bearer seller-token'));
  for (const data of [
    { ...conversation(), type: 'order', context_id: 'other-order' },
    { ...conversation(), type: 'order', context_id: 'paid-order', participants: [{ user_id: 'seller', name: 'Seller', role: 'seller' }, { user_id: 'other', name: 'Other', role: 'buyer' }] },
  ]) {
    global.fetch = async () => Response.json({ success: true, data });
    await assert.rejects(client.startOrder('paid-order', 'buyer'), /invalid response/);
  }
  global.fetch = async () => Response.json({ success: true, data: { ...conversation(), type: 'delivery', context_id: 'delivery' } });
  await assert.rejects(client.startDelivery('delivery'), /invalid response/);
});

test('malformed success envelopes and cross-conversation messages are rejected', async () => {
  browser(); const { ChatClient } = load('src/components/chat/chatClient.ts'); const client = new ChatClient();
  for (const data of [[], { data: 'string' }, { data: [message()], success: true }, { data: [conversation()], meta: { total: -1 } }]) {
    global.fetch = async () => Response.json(data);
    await assert.rejects(client.threads(), /invalid response/);
  }
  global.fetch = async () => Response.json({ success: true, data: [{ ...message(), conversation_id: 'other-thread' }] });
  await assert.rejects(client.messages('thread-1'), /invalid response/);
  global.fetch = async () => Response.json({ success: false, error: 'Invalid or expired token' });
  await assert.rejects(client.threads(), /Invalid or expired token/);
});
test('delayed chat responses cannot populate another signed-in account', async () => {
  const auth = browser(); const { ChatClient } = load('src/components/chat/chatClient.ts'); let finish;
  global.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = assert.rejects(new ChatClient().threads(), /account changed/);
  auth.clearAuth(); auth.setAuth({ access_token: 'other', user: { id: 'other' } });
  finish(Response.json({ success: true, data: [conversation()], meta: { total: 1 } })); await pending;
});
test('message merging deduplicates IDs and retains microsecond timestamp order', () => {
  browser(); const { mergeMessages } = load('src/components/chat/chatClient.ts');
  const a = message('a', '2026-11-04T10:39:30.231039Z'), b = message('b', '2026-11-04T10:39:30.231038Z');
  assert.deepEqual(mergeMessages([a], [b, a]).map(m => m.id), ['b', 'a']);
});

test('support uses authenticated category and filtered conversation endpoints and creates no initial message', async () => {
  browser(); const { ChatClient } = load('src/components/chat/chatClient.ts'); const client = new ChatClient(), calls = [];
  const support = { ...conversation(), type: 'support', context_id: '', participants: [{ user_id: 'buyer', name: 'Buyer', role: 'buyer' }, { user_id: 'admin', name: 'Support', role: 'admin' }] };
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/categories')) return Response.json({ data: [{ id: 'category', name: 'Orders' }] });
    return Response.json({ data: init.method === 'POST' ? support : [support], meta: { total: 22 } });
  };
  assert.deepEqual(await client.categories(), [{ id: 'category', name: 'Orders' }]);
  assert.equal((await client.threads(20, undefined, 'support')).threads[0].type, 'support');
  assert.equal(calls[1].url, '/api/chat/conversations?limit=20&offset=20&type=support');
  assert.equal((await client.startSupport('category')).id, 'thread-1');
  assert.deepEqual(JSON.parse(calls[2].init.body), { type: 'support', category_id: 'category' });
  assert.ok(calls.every(call => call.init.headers.Authorization === 'Bearer buyer-token'));
  global.fetch = async () => Response.json({ data: conversation() });
  await assert.rejects(client.startSupport('category'), /invalid response/);
});

test('buyer starts the matching seller order conversation after payment without a recipient override', async () => {
  browser(); const { ChatClient } = load('src/components/chat/chatClient.ts'); const client = new ChatClient(); let body;
  global.fetch = async (_, init) => { body = JSON.parse(init.body); return Response.json({ data: { ...conversation(), type: 'order', context_id: 'order' } }); };
  assert.equal((await client.startOrder('order', 'seller')).peer.id, 'seller');
  assert.deepEqual(body, { type: 'order', context_id: 'order' });
  await assert.rejects(client.startOrder('order', 'other-seller'), /invalid response/);
});
