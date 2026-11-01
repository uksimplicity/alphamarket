const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { sellerAccounts } = load('src/components/admin/sellerAccounts.ts');

test('seller details retain email and store names from flat and nested API fields', () => {
  const rows = sellerAccounts([
    { id: 'one', role: 'seller', first_name: 'First', last_name: 'Seller', email: 'one@example.test', store_name: 'First Store', status: 'ACTIVE' },
    { id: 'two', role: 'vendor', email: 'two@example.test', store: { name: 'Second Store' } },
    { id: 'three', role: 'seller', storeName: 'Third Store' },
    { id: 'four', role: 'seller', seller_profile: { store: { name: 'Fourth Store' } } },
    { id: 'five', role: 'seller', business: { business_name: 'Fifth Store' } },
    { id: 'buyer', role: 'buyer', store_name: 'Never shown as a seller' },
  ]);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].email, 'one@example.test');
  assert.equal(rows[0].name, 'First Seller');
  assert.equal(rows[0].status, 'active');
  assert.deepEqual(rows.map(row => row.store), ['First Store', 'Second Store', 'Third Store', 'Fourth Store', 'Fifth Store']);
});

test('missing store data never substitutes the account name or another field', () => {
  const [seller] = sellerAccounts([{ id: 'one', role: 'seller', name: 'Seller Account', email: 'one@example.test' }]);
  assert.equal(seller.store, '');
  assert.equal(seller.status, 'unknown');
});

test('saved browser stores are matched to the seller ID or legacy email owner', () => {
  const client = load('src/components/store/storeProfileClient.ts');
  const profiles = [
    { ownerKey: 'seller-one', slug: 'first', name: 'First Store' },
    { ownerKey: 'legacy@example.test', slug: 'legacy', name: 'Legacy Store' },
  ];
  global.window = { localStorage: { getItem: () => JSON.stringify(profiles) } };
  try {
    assert.equal(client.getSellerStoreProfileByOwner('seller-one', 'one@example.test').name, 'First Store');
    assert.equal(client.getSellerStoreProfileByOwner('seller-two', 'LEGACY@example.test').name, 'Legacy Store');
    assert.equal(client.getSellerStoreProfileByOwner('unrelated', 'other@example.test'), null);
  } finally { delete global.window; }
});
