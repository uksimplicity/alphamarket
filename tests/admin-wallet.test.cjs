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
