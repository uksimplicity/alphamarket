const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./support/load-ts.cjs');
const original = { fetch: global.fetch, window: global.window, localStorage: global.localStorage };
const originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
let calls;
beforeEach(() => {
  load.reset(); calls = [];
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api/v1';
  const values = new Map([['alpha.auth', JSON.stringify({ access_token: 'admin-token', user: { id: 'admin', role: 'admin' } })]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  global.window = Object.assign(new EventTarget(), { localStorage: storage }); global.localStorage = storage;
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true, data: { id: 'rider-1', name: 'Example Rider' } }); };
});
afterEach(() => { Object.assign(global, original); if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase; });
const request = (method = 'GET') => new Request('https://shop.example/api/riders/rider-1', { method, headers: { Authorization: 'Bearer admin-token' } });
const context = { params: Promise.resolve({ id: 'rider-1' }) };

test('rider details proxy preserves real 404/500 errors and uses the documented lookup once', async () => {
  const route = load('src/app/api/marketplace/grpc/riders/[id]/route.ts');
  for (const status of [200, 401, 403, 404, 500]) {
    calls = [];
    global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ error: 'Original rider-service message' }, { status }); };
    const response = await route.GET(request(), context);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: 'Original rider-service message' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://backend.example/api/v1/marketplace/grpc/riders/rider-1');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer admin-token');
    assert.equal(calls[0].init.redirect, 'manual');
  }
});

test('verification proxy never replays failed writes or redirects', async () => {
  const route = load('src/app/api/admin/riders/[id]/verify/route.ts');
  for (const status of [200, 401, 404, 500, 302]) {
    calls = [];
    global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: status === 200 }, { status }); };
    const response = await route.POST(request('POST'), context);
    assert.equal(response.status, status === 302 ? 502 : status);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://backend.example/api/v1/admin/riders/rider-1/verify');
    assert.equal(calls[0].init.method, 'POST');
  }
});

test('rider proxy failures are explicit and never fabricated profiles', async () => {
  const route = load('src/app/api/marketplace/grpc/riders/[id]/route.ts');
  for (const result of [() => new Response('invalid json'), () => new Response(null, { status: 302 }), () => { throw new Error('Network error'); }]) {
    global.fetch = async () => result();
    assert.equal((await route.GET(request(), context)).status, 502);
  }
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  assert.equal((await route.GET(request(), context)).status, 503);
});

test('detail client surfaces backend status/reason and rejects mismatched or missing rider identities', async () => {
  const client = load('src/components/admin/riderClient.ts');
  for (const [status, payload, pattern] of [
    [403, { success: false, error: 'Insufficient permissions' }, /does not have permission.*HTTP 403/],
    [404, { error: 'Rider profile not found' }, /Rider profile not found.*HTTP 404/],
    [200, { success: false, message: 'gRPC unavailable' }, /gRPC unavailable.*HTTP 200/],
    [200, { data: { id: 'another-rider' } }, /does not match/],
    [200, { data: {} }, /identifiable profile/],
  ]) {
    global.fetch = async () => Response.json(payload, { status });
    await assert.rejects(client.fetchRiderDetails('rider-1', new AbortController().signal), pattern);
  }
  global.fetch = async () => Response.json({ data: { rider: { id: 'rider-1', name: 'Example Rider' } } });
  assert.ok(await client.fetchRiderDetails('rider-1', new AbortController().signal));
});

test('verification client rejects HTTP 200 failures, expired sessions and uncertain responses without retries', async () => {
  const client = load('src/components/admin/riderClient.ts');
  for (const [status, body, uncertain] of [[200, { success: false, message: 'Rejected' }, false], [401, { error: 'invalid or expired token' }, false], [500, { error: 'Uncertain result' }, true]]) {
    calls = [];
    global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(body, { status }); };
    await assert.rejects(client.verifyRiderRequest('rider-1'), error => error instanceof client.RiderVerificationError && error.uncertain === uncertain);
    assert.equal(calls.length, 1);
  }
});

test('accepted verification is confirmed only after a successful queue refresh excludes the pending rider', async () => {
  const { verifyAndConfirm } = load('src/components/admin/riderVerification.ts');
  let accepted = 0, writes = 0;
  const verify = async () => { writes++; };
  const onAccepted = () => { accepted++; };
  const stale = await verifyAndConfirm('rider-1', verify, async () => ({ isError: false, data: [{ id: 'rider-1', verificationStatus: 'pending' }] }), onAccepted);
  assert.equal(stale.confirmed, false); assert.match(stale.message, /still in the unverified queue/);
  const failed = await verifyAndConfirm('rider-1', verify, async () => ({ isError: true }), onAccepted);
  assert.equal(failed.confirmed, false); assert.match(failed.message, /accepted.*could not be loaded/);
  const confirmed = await verifyAndConfirm('rider-1', verify, async () => ({ isError: false, data: [] }), onAccepted);
  assert.equal(confirmed.confirmed, true);
  assert.equal(accepted, 3); assert.equal(writes, 3);
  await assert.rejects(verifyAndConfirm('rider-1', async () => { throw new Error('Rejected'); }, async () => { throw new Error('Must not refresh'); }, onAccepted), /Rejected/);
  assert.equal(accepted, 3);
});

test('unverified queue removes explicitly verified riders and refuses malformed or failed responses', () => {
  const { unverifiedRiders } = load('src/components/admin/riderVerification.ts');
  assert.deepEqual(unverifiedRiders({ data: { riders: [{ id: 'pending', is_verified: false }, { id: 'verified', is_verified: true }] } }).map(r => r.id), ['pending']);
  assert.deepEqual(unverifiedRiders({ data: [] }), []);
  for (const payload of [{}, { success: false, data: [] }, { data: [{}] }]) assert.throws(() => unverifiedRiders(payload));
});

function nodes(tree, match) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, match));
  if (!tree || typeof tree !== 'object') return [];
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
function renderCard(props) {
  const loaded = { exports: {} }, jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/admin/RiderVerificationCard.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: loaded, exports: loaded.exports, Error, require(name) {
    if (name === 'react') return { useId: () => 'panel' };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@tanstack/react-query') return { useQuery: () => ({ data: undefined, isFetching: false, error: new Error('Service unavailable (HTTP 404)'), refetch() {} }) };
    if (name.endsWith('authStorage')) return { authGeneration: () => 0 };
    if (name.endsWith('useAuthUser')) return { useAuthUser: () => ({ id: 'admin' }) };
    if (name.endsWith('/ui')) return { Button: 'button' };
    if (name === './riderClient' || name === './api') return {};
    if (name === './riderRecords') return load('src/components/admin/riderRecords.ts');
    throw new Error(name);
  } });
  return loaded.exports.default({ expanded: true, pending: false, onVerify() {}, onReview() {}, ...props });
}

test('rider card separates verified/offline states and disables duplicate verification while confirming', () => {
  const parse = load('src/components/admin/riderRecords.ts').parseRider;
  for (const [rider, verificationPending, label] of [
    [parse({ id: 'rider-1', status: 'offline', is_verified: true }), false, 'Verified'],
    [parse({ id: 'rider-1', status: 'offline', is_verified: false }), true, 'Verification pending confirmation'],
  ]) {
    const tree = renderCard({ rider, verificationPending });
    assert.ok(nodes(tree, node => node.props?.children === label).length);
    assert.ok(nodes(tree, node => node.props?.role === 'alert').length);
    const button = nodes(tree, node => node.type === 'button' && ['Verified', 'Awaiting confirmation'].includes(node.props.children))[0];
    assert.equal(button.props.disabled, true);
    assert.equal(nodes(tree, node => node.props?.children === 'Awaiting verification').length, 0);
  }
});

function pageHarness(refreshState, uncertain = false) {
  const slots = [], loaded = { exports: {} }, jsx = (type, props) => ({ type, props });
  const rider = load('src/components/admin/riderRecords.ts').parseRider({ id: 'rider-1', name: 'Example Rider', is_verified: false });
  const client = load('src/components/admin/riderClient.ts');
  let cursor = 0, rows = [rider], writes = 0;
  const refetch = async () => {
    if (refreshState === 'empty') rows = [];
    return { data: rows, isError: refreshState === 'error' };
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/admin/notifications/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: loaded, exports: loaded.exports, Error, require(name) {
    if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; } };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@tanstack/react-query') return { useQuery: options => options.queryKey[0] === 'admin-unverified-riders' ? { data: rows, refetch, isLoading: false, isFetching: false } : { data: [], isLoading: false } };
    if (name.endsWith('authStorage')) return { getAuth: () => ({ access_token: 'admin-token' }), authGeneration: () => 0 };
    if (name.endsWith('useAuthUser')) return { useAuthUser: () => ({ id: 'admin' }) };
    if (name.endsWith('localAccountData')) return { accountStamp: () => 'admin', checkAccount() {} };
    if (name.endsWith('RiderVerificationCard')) return { default: 'rider-card' };
    if (name.endsWith('riderClient')) return { RiderVerificationError: client.RiderVerificationError, verifyRiderRequest: async () => { writes++; if (uncertain) throw new client.RiderVerificationError('Refresh to confirm.', true); } };
    if (name.endsWith('/ui')) return { Button: 'button', Card: 'card', SectionTitle: 'title', ErrorState: 'error', Skeleton: 'skeleton' };
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
    throw new Error(name);
  } });
  return { writes: () => writes, render() { cursor = 0; return loaded.exports.default(); } };
}

test('admin page does not claim verified success for stale or failed queue refreshes and prevents resubmission', async () => {
  for (const state of ['stale', 'error']) {
    const h = pageHarness(state);
    await nodes(h.render(), node => node.type === 'rider-card')[0].props.onVerify();
    let tree = h.render();
    assert.ok(nodes(tree, node => node.props?.role === 'alert').length);
    assert.equal(nodes(tree, node => node.props?.children === 'Rider verified successfully.').length, 0);
    assert.equal(nodes(tree, node => node.type === 'rider-card')[0].props.verificationPending, true);
    await nodes(tree, node => node.type === 'rider-card')[0].props.onVerify();
    assert.equal(h.writes(), 1);
  }
});

test('admin page confirms success when the refreshed unverified queue no longer contains the rider', async () => {
  const h = pageHarness('empty');
  await nodes(h.render(), node => node.type === 'rider-card')[0].props.onVerify();
  const tree = h.render();
  assert.ok(nodes(tree, node => node.props?.children === 'Rider verified successfully.').length);
  assert.equal(nodes(tree, node => node.type === 'rider-card').length, 0);
});

test('an uncertain verification result blocks another write while keeping the queue reviewable', async () => {
  const h = pageHarness('stale', true);
  await nodes(h.render(), node => node.type === 'rider-card')[0].props.onVerify();
  const card = nodes(h.render(), node => node.type === 'rider-card')[0];
  assert.equal(card.props.verificationPending, true);
  await card.props.onVerify();
  assert.equal(h.writes(), 1);
});
