const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const users = load('src/components/admin/users.ts');
const originalFetch = global.fetch;
test.afterEach(() => { global.fetch = originalFetch; });

test('user totals prefer pagination totals over page counts and preserve zero', () => {
  assert.equal(users.reportedUserCount({ count: 100, data: { users: [], pagination: { total: '245' } } }), 245);
  assert.equal(users.reportedUserCount({ data: { total_users: 0 } }), 0);
  assert.equal(users.reportedUserCount({ data: { total: 99, total_orders: 500 } }, true), undefined);
  assert.equal(users.reportedUserCount({ data: { users: { count: 12 } } }, true), undefined);
  for (const total of [null, '', false, -1, 'Infinity', 'NaN']) {
    assert.equal(users.reportedUserCount({ total }), undefined);
  }
});

test('overview counts the same 26 accounts as Users instead of a one-row page count', async () => {
  const calls = [];
  const accounts = Array.from({ length: 26 }, (_, i) => ({ id: String(i) }));
  global.fetch = async (url, init) => {
    calls.push(url);
    assert.equal(init.cache, 'no-store');
    const limit = Number(new URL(url, 'http://localhost').searchParams.get('limit'));
    const rows = accounts.slice(0, limit);
    return Response.json({ data: { users: rows, count: rows.length } });
  };
  assert.equal(await users.fetchAdminUserCount(), 26);
  assert.equal(calls[0], '/api/admin/users?limit=100&offset=0');
  assert.equal(calls.length, 1);
});

test('page-local count never truncates users beyond the first full page', async () => {
  const accounts = Array.from({ length: 126 }, (_, i) => ({ id: String(i) }));
  global.fetch = async url => {
    const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset'));
    const rows = accounts.slice(offset, offset + 100);
    return Response.json({ users: rows, count: rows.length });
  };
  assert.equal(await users.fetchAdminUserCount(), 126);
});

test('count falls back to actual user rows when list metadata is absent', async () => {
  global.fetch = async () => Response.json({ data: [{ id: 'one' }] });
  assert.equal(await users.fetchAdminUserCount(), 1);
});

test('pagination includes users beyond the first page even when the service clamps the limit', async () => {
  const calls = [];
  const rows = Array.from({ length: 125 }, (_, i) => ({ id: String(i) }));
  global.fetch = async url => {
    const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset'));
    calls.push(offset);
    return Response.json({ data: { users: rows.slice(offset, offset + 50), pagination: { total: 125 } } });
  };
  assert.deepEqual(await users.fetchAdminUsers(), rows);
  assert.deepEqual(calls, [0, 50, 100]);
});

test('without totals, dashboard counts all pages including the final partial page', async () => {
  const rows = Array.from({ length: 125 }, (_, i) => ({ id: String(i) }));
  global.fetch = async url => {
    const parsed = new URL(url, 'http://localhost');
    const offset = Number(parsed.searchParams.get('offset'));
    const limit = Number(parsed.searchParams.get('limit'));
    return Response.json({ users: rows.slice(offset, offset + limit) });
  };
  assert.equal(await users.fetchAdminUserCount(), 125);
});

test('repeated pages and invalid user payloads surface errors instead of false totals', async () => {
  global.fetch = async () => Response.json({ data: { users: [{ id: 'one' }], total: 5 } });
  await assert.rejects(users.fetchAdminUsers(), /repeated a user page/);
  global.fetch = async () => Response.json({ success: true });
  await assert.rejects(users.fetchAdminUsers(), /did not return a user list/);
  global.fetch = async () => Response.json({ users: [], total: 5 });
  await assert.rejects(users.fetchAdminUsers(), /incomplete user list/);
});

test('approve, suspend, and delete send the expected account targets', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 204 }); };
  await users.setAdminUserStatus('user/id', 'active');
  await users.setAdminUserStatus('user/id', 'suspended');
  await users.deleteAdminUser(' user+one@example.test ');
  assert.equal(calls[0].url, '/api/admin/users/user%2Fid/status');
  assert.equal(calls[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].init.body), { status: 'active' });
  assert.deepEqual(JSON.parse(calls[1].init.body), { status: 'suspended' });
  assert.equal(calls[2].url, '/api/admin/user?email=user%2Bone%40example.test');
  assert.equal(calls[2].init.method, 'DELETE');
  await assert.rejects(users.setAdminUserStatus('', 'active'), /no user ID/);
  await assert.rejects(users.deleteAdminUser(''), /no email/);
  assert.equal(calls.length, 3);
});

test('rejected account changes surface the backend error', async () => {
  global.fetch = async () => Response.json({ error: 'Admin access required' }, { status: 403 });
  await assert.rejects(users.setAdminUserStatus('user', 'active'), /Admin access required/);
  global.fetch = async () => Response.json({ success: false, message: 'Account cannot be deleted' });
  await assert.rejects(users.deleteAdminUser('one@example.test'), /cannot be deleted/);
});

test('admin proxy preserves authentication and empty success responses for account actions', async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example.test/api/v1';
  load.reset();
  const route = load('src/app/api/admin/[...path]/route.ts');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 204 }); };
  const context = path => ({ params: Promise.resolve({ path }) });
  const response = await route.PUT(new Request('http://localhost/api/admin/users/one/status', {
    method: 'PUT', headers: { Authorization: 'Bearer synthetic-admin' }, body: '{"status":"active"}',
  }), context(['users', 'one', 'status']));
  assert.equal(response.status, 204);
  assert.equal(calls[0].url, 'https://backend.example.test/api/v1/admin/users/one/status');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer synthetic-admin');
  assert.equal(calls[0].init.body, '{"status":"active"}');
  const deletion = await route.DELETE(new Request('http://localhost/api/admin/user?email=one%40example.test', { method: 'DELETE' }), context(['user']));
  assert.equal(deletion.status, 204);
  assert.equal(calls[1].url, 'https://backend.example.test/api/v1/admin/user?email=one%40example.test');
});

test('missing or failed account mutation routes are never retried against other paths', async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example.test/api/v1';
  load.reset();
  const route = load('src/app/api/admin/[...path]/route.ts');
  for (const status of [404, 500]) {
    let writes = 0;
    global.fetch = async () => { writes++; return Response.json({ error: 'Failed' }, { status }); };
    const response = await route.DELETE(new Request('http://localhost/api/admin/user?email=one%40example.test', { method: 'DELETE' }), { params: Promise.resolve({ path: ['user'] }) });
    assert.equal(response.ok, false);
    assert.equal(writes, 1);
  }
});
