const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('./support/load-ts.cjs')('src/components/vendor/sellerData.ts');

test('gallery-only products resolve images, category IDs, stock and publication flags', () => {
  const products = data.parseSellerProducts({ data: { products: [
    { id: 'gallery', categoryId: 'home', stock_quantity: '8', isPublished: true, media: { cover: '', images: [{ file_url: 'https://images.example/chair.png' }] } },
    { id: 'draft', category_id: 'home', stockQuantity: 0, is_published: false },
    { id: 'inventory', inventory: { quantity: '12' }, category: { name: 'Furniture' } },
  ] } }, 'seller', { home: 'Home & living' });
  assert.equal(products[0].image, 'https://images.example/chair.png');
  assert.equal(products[0].category, 'Home & living');
  assert.equal(products[0].stock, 8);
  assert.equal(products[0].status, 'publish');
  assert.equal(products[1].stock, 0);
  assert.equal(products[1].status, 'draft');
  assert.equal(products[1].image, '');
  assert.equal(products[2].stock, 12);
  assert.equal(products[2].category, 'Furniture');
});

test('inventory loads later pages, deduplicates products and resolves category names', async () => {
  const calls = [];
  const products = await data.loadSellerProducts(async path => {
    calls.push(path);
    if (path.includes('resource=categories')) return { data: { categories: [{ id: 'home', name: 'Home' }] } };
    if (path.includes('offset=0')) return { data: { products: Array.from({ length: 200 }, (_, i) => ({ id: `p-${i}`, category_id: 'home' })) } };
    return { data: { products: [{ id: 'p-199' }, { id: 'last', stock: 5 }, { id: 'theirs', seller_id: 'other' }] } };
  }, 'seller');
  assert.equal(products.length, 201);
  assert.equal(products[0].category, 'Home');
  assert.equal(products.at(-1).stock, 5);
  assert.ok(calls.includes('/api/seller/products?limit=200&offset=200'));
});

test('backend activity flags resolve product status without inventing missing stock', () => {
  const products = data.parseSellerProducts({ data: { products: [
    { id: 'live-api', name: 'iPhone 17Pro', base_price: '78000', is_active: true, variants: [] },
    { id: 'inactive', is_active: false, stock: 0 },
    { id: 'camel', isActive: true, stock: 1 },
    { id: 'legacy', active: false },
    { id: 'explicit', status: 'draft', is_active: true },
    { id: 'publication', isPublished: false, is_active: true },
    { id: 'unknown', is_active: 'false' },
  ] } }, 'seller');
  assert.deepEqual(products.map(product => product.status), ['active', 'inactive', 'active', 'inactive', 'draft', 'draft', 'unknown']);
  assert.equal(products[0].stock, null);
  assert.equal(products[1].stock, 0);
  assert.equal(products[2].stock, 1);
});

test('category failure preserves products and failed inventory pages are not counted as a full inventory', async () => {
  const products = await data.loadSellerProducts(async path => {
    if (path.includes('catalog')) throw new Error('Forbidden');
    return { data: [{ id: 'one', categoryId: 'missing' }] };
  }, 'seller');
  assert.equal(products.length, 1);
  assert.equal(products[0].category, 'Category unavailable');
  await assert.rejects(data.loadSellerProducts(async path => {
    if (path.includes('catalog')) return [];
    return Array.from({ length: 200 }, (_, i) => ({ id: `p-${i}` }));
  }, 'seller'), /repeated inventory page/);
});

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
