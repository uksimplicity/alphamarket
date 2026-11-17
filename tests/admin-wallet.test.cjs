const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { parseAdminWallets, walletBalance } = load('src/components/admin/walletData.ts');

test('admin wallet response preserves real zero balances, currency, wallet type and boolean activity', () => {
  const [wallet] = parseAdminWallets({ success: true, data: [{ id: 'wallet', user_id: 'owner', wallet_type: 'seller', balance: '0', currency: 'USD', is_active: true }] });
  assert.deepEqual(wallet, { id: 'wallet', owner: 'owner', type: 'seller', balance: '0', currency: 'USD', status: 'Active' });
  assert.match(walletBalance(wallet), /USD/); assert.doesNotMatch(walletBalance(wallet), /NGN|₦/);
  assert.equal(parseAdminWallets({ data: [{ id: 'inactive', is_active: false }] })[0].status, 'Inactive');
});

test('missing and malformed balances never become zero or an invented currency', () => {
  for (const balance of [undefined, null, '', ' ', true, 'invalid', Infinity]) {
    const [wallet] = parseAdminWallets({ data: [{ id: 'wallet', balance }] });
    assert.equal(wallet.balance, null); assert.equal(walletBalance(wallet), 'Not reported');
    assert.equal(wallet.status, 'Not reported');
  }
  assert.equal(walletBalance({ balance: '12.50', currency: '' }), '12.50 (currency not reported)');
});

test('empty wallets stay empty while failed and unreadable lists remain errors', () => {
  assert.deepEqual(parseAdminWallets({ success: true, data: [] }), []);
  for (const payload of [{ success: false, error: 'Denied' }, { data: { success: false } }, {}, { data: [{}] }]) assert.throws(() => parseAdminWallets(payload));
  assert.equal(parseAdminWallets({ data: { wallets: [{ wallet_id: 'wallet', owner_id: 'owner', available_balance: '1500.25', currency: 'NGN' }] } })[0].balance, '1500.25');
});

test('manual credits require finite positive amounts with at most two decimal places', () => {
  const { walletCreditAmount } = load('src/components/admin/walletData.ts');
  assert.equal(walletCreditAmount('1500.25'), 1500.25);
  assert.equal(walletCreditAmount('0.01'), 0.01);
  for (const value of ['', '0', '-1', '1e5', 'Infinity', '0.001', 'abc', '9007199254740992']) assert.throws(() => walletCreditAmount(value));
});

test('an expired admin session never replays a manual credit', async () => {
  const previousFetch = global.fetch, previousWindow = global.window, previousStorage = global.localStorage;
  const values = new Map(); global.window = new EventTarget();
  global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  try {
    load.reset(); load('src/components/auth/authStorage.ts').setAuth({ access_token: 'expired', user: { id: 'admin' } });
    let calls = 0; global.fetch = async () => { calls++; return Response.json({ error: 'Invalid or expired token' }, { status: 401 }); };
    await assert.rejects(load('src/components/admin/api.ts').adminFetcher('/admin_wallet/credit?user_id=owner', { method: 'POST', body: '{}' }), /check the result before retrying/);
    assert.equal(calls, 1);
  } finally { global.fetch = previousFetch; global.window = previousWindow; global.localStorage = previousStorage; load.reset(); }
});
