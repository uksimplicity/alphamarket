const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originalFetch = global.fetch, originalBase = process.env.CHAT_SERVER_URL;
beforeEach(() => { load.reset(); process.env.CHAT_SERVER_URL = 'https://shared-chat.example'; });
afterEach(() => { global.fetch = originalFetch; if (originalBase === undefined) delete process.env.CHAT_SERVER_URL; else process.env.CHAT_SERVER_URL = originalBase; delete global.window; delete global.localStorage; });
function proxy() { return load('src/app/api/chat/[...path]/route.ts'); }
function call(method, path, body, authorization = 'Bearer buyer-token', query = '') {
  return proxy()[method](new Request(`https://web.example/api/chat/${path}${query}`, { method, headers: { Authorization: authorization, 'Content-Type': 'application/json', Cookie: 'private=not-forwarded' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { params: Promise.resolve({ path: path.split('/') }) });
}
test('same-origin chat proxy forwards only bearer credentials to fixed HTTPS service', async () => {
  let sent;
  global.fetch = async (url, init) => { sent = { url, init }; return Response.json({ messages: [], has_more: false }); };
  const response = await call('GET', 'conversations/thread-1/messages', undefined, 'Bearer buyer-token', '?after=3&url=https://evil.test');
  assert.equal(response.status, 200); assert.equal(sent.url, 'https://shared-chat.example/v1/conversations/thread-1/messages?after=3');
  assert.equal(sent.init.headers.Authorization, 'Bearer buyer-token'); assert.equal(sent.init.headers.Cookie, undefined);
  assert.equal(sent.init.redirect, 'manual'); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('proxy strips forged identity fields and preserves stable message IDs', async () => {
  let sent;
  global.fetch = async (_, init) => { sent = JSON.parse(init.body); return Response.json({ message: {} }); };
  await call('POST', 'conversations/thread-1/messages', { client_id: 'stable-message-id-1', text: 'Hello', sender_id: 'forged', role: 'seller' });
  assert.deepEqual(sent, { client_id: 'stable-message-id-1', text: 'Hello' });
  await call('POST', 'session', { id: 'forged', role: 'seller' }); assert.deepEqual(sent, {});
});
test('missing authentication, arbitrary routes and invalid bodies never reach the service', async () => {
  let calls = 0; global.fetch = async () => { calls++; return Response.json({}); };
  assert.equal((await call('GET', 'conversations', undefined, '')).status, 401);
  assert.equal((await call('GET', 'admin/private')).status, 404);
  assert.equal((await call('GET', 'conversations/thread-1/messages', undefined, undefined, '?after=-1')).status, 400);
  assert.equal((await call('POST', 'conversations/thread-1/messages', { client_id: 'stable-message-id-1', text: '' })).status, 400);
  assert.equal(calls, 0);
});
test('insecure, redirected and malformed upstream responses cannot be accepted', async () => {
  global.fetch = async () => new Response('redirect', { status: 302, headers: { Location: 'https://evil.test' } });
  assert.equal((await call('GET', 'conversations')).status, 502);
  global.fetch = async () => new Response('<html>failed</html>');
  assert.equal((await call('GET', 'conversations')).status, 502);
  process.env.CHAT_SERVER_URL = 'http://insecure.example'; assert.equal((await call('GET', 'conversations')).status, 503);
  process.env.CHAT_SERVER_URL = 'https://user:pass@chat.example'; assert.equal((await call('GET', 'conversations')).status, 503);
});
function browser() {
  const values = new Map(); global.window = new EventTarget();
  global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const auth = load('src/components/auth/authStorage.ts'); auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer' } }); return auth;
}
test('chat client uses web proxy and rejects responses after account switching', async () => {
  const auth = browser(); const api = load('src/components/chat/chatClient.ts'); let finish;
  global.fetch = (_, init) => { assert.equal(init.headers.Authorization, 'Bearer buyer-token'); return new Promise(resolve => { finish = resolve; }); };
  const client = new api.ChatClient(); const pending = assert.rejects(client.connect(), /account changed/);
  auth.clearAuth(); auth.setAuth({ access_token: 'other', user: { id: 'other' } });
  finish(Response.json({ user: { id: 'buyer', name: 'Buyer', role: 'buyer' } })); await pending;
});
test('message merging preserves missed incoming messages after outgoing acknowledgement', () => {
  browser(); const { mergeMessages } = load('src/components/chat/chatClient.ts');
  assert.deepEqual(mergeMessages([{ id: 'one', sequence: 1 }, { id: 'three', sequence: 3 }], [{ id: 'two', sequence: 2 }, { id: 'three', sequence: 3 }]).map(m => m.id), ['one','two','three']);
});
