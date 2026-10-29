const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/components/vendor/sellerData.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const data = loaded.exports;

test('nested API envelopes preserve orders and exclude another seller', () => {
  const rows = data.parseSellerOrders({ data: { orders: [{ id: 'ours', seller_id: 'seller', payment_status: 'paid' }, { id: 'theirs', seller_id: 'other' }] } }, 'seller');
  assert.deepEqual(rows.map(row => row.id), ['ours']);
  assert.equal(rows[0].amount, null);
});

test('unknown stock, amount and status are not invented as zero or paid', () => {
  const product = data.parseSellerProducts({ data: [{ id: 'one', stock: null, base_price: false }, { id: 'zero', stock: 0, base_price: '0' }] }, 'seller');
  assert.equal(product[0].stock, null);
  assert.equal(product[0].price, null);
  assert.equal(product[1].stock, 0);
  assert.equal(product[1].price, 0);
  const [order] = data.parseSellerOrders([{ id: 'order', status: 'delivered', total_amount: '900' }], 'seller');
  assert.equal(data.isPaid(order), false);
  assert.equal(data.needsFulfillment(order), false);
});

test('failed delivery is a failure, not a successful delivery', () => {
  assert.equal(data.orderTone('failed_delivery'), 'danger');
  assert.equal(data.orderTone('delivered'), 'success');
  assert.equal(data.orderTone('ready_for_pickup'), 'warning');
});

test('fulfillment work includes only paid orders awaiting dispatch', () => {
  assert.equal(data.needsFulfillment({ paymentStatus: 'paid', status: 'processing' }), true);
  assert.equal(data.needsFulfillment({ paymentStatus: 'pending', status: 'processing' }), false);
  assert.equal(data.needsFulfillment({ paymentStatus: 'paid', status: 'delivered' }), false);
  assert.equal(data.needsFulfillment({ paymentStatus: 'refunded', status: 'pending' }), false);
});

test('sales exclude unpaid, refunded, future and undated orders', () => {
  const now = new Date(2026, 9, 29, 18);
  const stamp = day => new Date(2026, 9, day, 12).toISOString();
  const orders = [
    { id: 'paid', paymentStatus: 'paid', amount: 1000, createdAt: stamp(29) },
    { id: 'unpaid', paymentStatus: 'pending', amount: 5000, createdAt: stamp(29) },
    { id: 'refund', paymentStatus: 'refunded', amount: 1000, createdAt: stamp(29) },
    { id: 'future', paymentStatus: 'paid', amount: 9000, createdAt: stamp(30) },
    { id: 'undated', paymentStatus: 'paid', amount: 9000, createdAt: '' },
    { id: 'old', paymentStatus: 'paid', amount: 9000, createdAt: stamp(1) },
  ];
  assert.deepEqual(data.scopedOrders(orders, 7, now).map(order => order.id), ['paid', 'unpaid', 'refund']);
  const chart = data.salesSeries(orders, 7, now);
  assert.equal(chart.length, 7);
  assert.equal(chart.reduce((sum, day) => sum + day.sales, 0), 1000);
});

test('sales are grouped by local calendar day at the reporting boundary', () => {
  const now = new Date(2026, 9, 29, 18);
  const orders = [
    { paymentStatus: 'paid', amount: 300, createdAt: new Date(2026, 9, 23, 0).toISOString() },
    { paymentStatus: 'paid', amount: 200, createdAt: new Date(2026, 9, 23, 23).toISOString() },
    { paymentStatus: 'paid', amount: 999, createdAt: new Date(2026, 9, 22, 23, 59).toISOString() },
  ];
  const chart = data.salesSeries(orders, 7, now);
  assert.equal(chart[0].sales, 500);
  assert.equal(chart.slice(1).every(day => day.sales === 0), true);
});
