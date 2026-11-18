const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { findOrderBuyerName } = load('src/components/commerce/orderConversationName.ts');
const thread = (contextId, id, name, role = 'buyer') => ({ type: 'order', contextId, peer: { id, name, role } });

test('uses a matching existing order conversation and the matching buyer ID', async () => {
  const name = await findOrderBuyerName(async () => ({ total: 3, threads: [thread('other', 'buyer', 'Wrong Order'), thread('order', 'other', 'Wrong Buyer'), thread('order', 'buyer', 'Ada Jones')] }), 'order', 'buyer');
  assert.equal(name, 'Ada Jones');
});

test('without a buyer ID, only an unambiguous buyer participant is accepted', async () => {
  assert.equal(await findOrderBuyerName(async () => ({ total: 2, threads: [thread('order', 'rider', 'Rider', 'rider'), thread('order', 'buyer', 'Ada Jones')] }), 'order', ''), 'Ada Jones');
  assert.equal(await findOrderBuyerName(async () => ({ total: 2, threads: [thread('order', 'buyer1', 'Ada'), thread('order', 'buyer2', 'Emeka')] }), 'order', ''), '');
});
