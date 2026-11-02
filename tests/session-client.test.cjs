const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originals = { window: global.window, localStorage: global.localStorage, fetch: global.fetch, now: Date.now };
let auth, api, clock, calls;
beforeEach(() => {
  load.reset(); clock = 100000; calls = 0; Date.now = () => clock;
  const disk = new Map();
  global.localStorage = { getItem: key => disk.get(key) || null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) };
  global.window = new EventTarget(); window.localStorage = localStorage;
  auth = load('src/components/auth/authStorage.ts');
  auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer', role: 'buyer' } });
  api = load('src/components/auth/sessionClient.ts');
  global.fetch = async () => { calls++; return Response.json({ data: { id: 'buyer', role: 'buyer' } }); };
});
afterEach(() => { Date.now = originals.now; global.fetch = originals.fetch; global.window = originals.window; global.localStorage = originals.localStorage; });
test('simultaneous session checks share one request and navigation reuses the verified profile', async () => {
  const saved = auth.getAuth();
  const first = api.verifySession(saved), second = api.verifySession(saved);
  assert.equal(first, second);
  const profile = await first;
  assert.equal(profile.role, 'buyer');
  assert.equal(await api.verifySession(saved), profile);
  assert.equal(calls, 1);
});
test('verification expires after a minute even with repeated navigation and profile synchronization', async () => {
  const saved = auth.getAuth(); const profile = await api.verifySession(saved);
  clock += 30000;
  auth.setAuth({ ...saved, user: profile }); api.rememberSession(auth.getAuth(), profile);
  assert.equal(api.cachedSession(auth.getAuth()), profile);
  clock += 30001;
  assert.equal(api.cachedSession(auth.getAuth()), null);
  await api.verifySession(auth.getAuth()); assert.equal(calls, 2);
});
test('logout and sign-in with the same token cannot reuse earlier verification', async () => {
  await api.verifySession(auth.getAuth());
  const saved = auth.getAuth(); auth.clearAuth(); auth.setAuth(saved);
  assert.equal(api.cachedSession(auth.getAuth()), null);
  await api.verifySession(auth.getAuth()); assert.equal(calls, 2);
});
test('a response from a previous account never becomes verified', async () => {
  let finish;
  global.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = api.verifySession(auth.getAuth());
  auth.setAuth({ access_token: 'other-token', user: { id: 'other', role: 'seller' } });
  finish(Response.json({ data: { id: 'buyer', role: 'buyer' } }));
  await assert.rejects(pending, /sign-in changed/);
  assert.equal(api.cachedSession(auth.getAuth()), null);
});
test('server roles are preserved and failed identity checks cannot seed the cache', async () => {
  global.fetch = async () => Response.json({ data: { id: 'buyer', role: 'buyer' } });
  const saved = { ...auth.getAuth(), user: { id: 'buyer', role: 'seller' } };
  assert.equal((await api.verifySession(saved)).role, 'buyer');
  auth.setAuth({ access_token: 'new-token', user: { id: 'buyer', role: 'seller' } });
  global.fetch = async () => Response.json({ data: { id: 'wrong-account', role: 'seller' } });
  await assert.rejects(api.verifySession(auth.getAuth()), /does not match/);
  assert.equal(api.cachedSession(auth.getAuth()), null);
});
test('failed checks can be retried and unauthorized or expired sessions are rejected', async () => {
  global.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(api.verifySession(auth.getAuth()), /could not be checked/);
  global.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(api.verifySession(auth.getAuth()), /session has expired/);
  const expired = 'header.' + Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url') + '.signature';
  await assert.rejects(api.verifySession({ ...auth.getAuth(), access_token: expired }), /session has expired/);
});