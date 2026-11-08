const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { orderPricing, pricingTotal, checkoutPricing } = load('src/components/commerce/orderPricing.ts');
test('missing delivery fee is buyer total minus recorded products, excluding commission', () => {
  const pricing = orderPricing({ subtotal: '45000', TotalAmount: '47250', commission_percentage: 5 });
  assert.equal(pricing.deliveryFee, 2250);
  assert.equal(pricing.adminCommission, 2250);
  assert.equal(pricing.sellerProceeds, 42750);
  assert.deepEqual(pricing.issues, []);
  assert.equal(orderPricing({ items: [{ unit_price: '12.34', quantity: 3 }], total_amount: '38.27' }).deliveryFee, 1.25);
  assert.equal(orderPricing({ subtotal: 45000, total_amount: 45000 }).deliveryFee, 0);
});
test('checkout uses frozen listed prices when the live order has no items or subtotal', () => {
  const snapshot = JSON.stringify([{ id: 'helmet', price: 45000, qty: 1 }]);
  const live = orderPricing({ ID: 'synthetic-order', TotalAmount: '47250', Commission: '2250', Items: null });
  const pricing = checkoutPricing([live], snapshot);
  assert.equal(pricing.productSubtotal, 45000);
  assert.equal(pricing.deliveryFee, 2250);
  assert.equal(pricing.buyerTotal, 47250);
  assert.equal(pricing.adminCommission, null);
  assert.deepEqual(pricing.issues, []);
});
test('checkout subtracts the cart subtotal once across multiple seller orders', () => {
  const snapshot = JSON.stringify([{ id: 'one', price: 100, qty: 2 }, { id: 'two', price: 50, qty: 3 }]);
  const pricing = checkoutPricing([orderPricing({ TotalAmount: 230 }), orderPricing({ TotalAmount: 170 })], snapshot);
  assert.equal(pricing.productSubtotal, 350);
  assert.equal(pricing.deliveryFee, 50);
  assert.equal(pricing.buyerTotal, 400);
  assert.equal(checkoutPricing([orderPricing({ TotalAmount: 230 }), orderPricing({})], snapshot).deliveryFee, null);
});
test('explicit backend fees and recorded subtotals take priority over the snapshot', () => {
  const snapshot = JSON.stringify([{ id: 'one', price: 1, qty: 1 }]);
  assert.equal(checkoutPricing([orderPricing({ subtotal: 45000, total_amount: 47250 })], snapshot).deliveryFee, 2250);
  assert.equal(checkoutPricing([orderPricing({ total_amount: 47250, delivery_fee: 0 })], snapshot).deliveryFee, 0);
  assert.equal(checkoutPricing([orderPricing({ subtotal: 45000, total_amount: 47250, delivery_fee: 100 })], snapshot).deliveryFee, 100);
});
test('invalid snapshots, invalid amounts and negative differences never become delivery fees', () => {
  const value = orderPricing({ TotalAmount: 100 });
  for (const snapshot of [undefined, 'invalid', '{}', '[]', '[{}]', JSON.stringify([{ id: 'one', price: -1, qty: 1 }]), JSON.stringify([{ id: 'one', price: 1, qty: 1.5 }]), JSON.stringify([{ id: 'one', price: 1, qty: '2' }])]) {
    assert.equal(checkoutPricing([value], snapshot).deliveryFee, null);
  }
  const negative = checkoutPricing([value], JSON.stringify([{ id: 'one', price: 101, qty: 1 }]));
  assert.equal(negative.deliveryFee, null);
  assert.match(negative.issues.join(' '), /less than/);
  assert.match(orderPricing({ subtotal: 101, total_amount: 100 }).issues.join(' '), /less than/);
  const invalid = checkoutPricing([orderPricing({ subtotal: 90, total_amount: 100, delivery_fee: 'invalid' })], JSON.stringify([{ id: 'one', price: 90, qty: 1 }]));
  assert.equal(invalid.deliveryFee, null);
  assert.ok(invalid.issues.length);
});
test('live capitalized total does not imply a delivery fee or a commission interpretation', () => {
  const pricing = orderPricing({ ID: 'synthetic-order', TotalAmount: '47250', Commission: '2250', Items: null });
  assert.equal(pricing.buyerTotal, 47250);
  assert.equal(pricing.deliveryFee, null);
  assert.equal(pricing.productSubtotal, null);
  assert.equal(pricing.adminCommission, null);
  assert.deepEqual(pricing.issues, []);
});
test('buyer pays products plus delivery; seller receives products minus admin commission', () => {
  assert.deepEqual(orderPricing({ subtotal: '10000', delivery_fee: '1500', commission_percentage: '10' }), {
    productSubtotal: 10000, deliveryFee: 1500, buyerTotal: 11500, commissionPercentage: 10, adminCommission: 1000, sellerProceeds: 9000, issues: [],
  });
});
test('quantity and discounts use recorded backend prices, with kobo rounding', () => {
  const pricing = orderPricing({ items: [{ unit_price: '12.34', quantity: 3 }], delivery_fee: '1.25', commission_percentage: 1.5 });
  assert.equal(pricing.productSubtotal, 37.02); assert.equal(pricing.buyerTotal, 38.27);
  assert.equal(pricing.adminCommission, 0.56); assert.equal(pricing.sellerProceeds, 36.46);
  assert.equal(orderPricing({ subtotal: 9000, items: [{ unit_price: 10000, quantity: 1 }], delivery_fee: 500, commission_percentage: 10 }).sellerProceeds, 8100);
});
test('historical commission is never inferred from an ambiguous rate, current rate or buyer total', () => {
  const unknown = orderPricing({ total_amount: 11500, commission_rate: 0.1 });
  assert.equal(unknown.buyerTotal, 11500); assert.equal(unknown.productSubtotal, null);
  assert.equal(unknown.adminCommission, null); assert.equal(unknown.sellerProceeds, null); assert.equal(unknown.deliveryFee, null);
  const recorded = orderPricing({ subtotal: 10000, delivery_fee: 1500, commission_amt: 1000 });
  assert.equal(recorded.sellerProceeds, 9000); assert.equal(recorded.buyerTotal, 11500);
});
test('zero fee and zero commission remain real values, and absent amounts stay unknown', () => {
  assert.equal(orderPricing({ subtotal: 10000, delivery_fee: 0, commission_percentage: 0 }).sellerProceeds, 10000);
  assert.equal(orderPricing({ subtotal: 10000, delivery_fee: 0, commission_percentage: 100 }).sellerProceeds, 0);
  const missing = orderPricing({});
  for (const key of ['buyerTotal', 'productSubtotal', 'deliveryFee', 'adminCommission', 'sellerProceeds']) assert.equal(missing[key], null);
});
test('inconsistent buyer charges, excessive commissions and invalid numbers are flagged', () => {
  assert.match(orderPricing({ subtotal: 10000, delivery_fee: 1500, total_amount: 12500 }).issues.join(' '), /buyer total/);
  assert.match(orderPricing({ delivery_fee: 1500, total_amount: 500 }).issues.join(' '), /delivery fee exceeds/);
  assert.equal(orderPricing({ subtotal: 100, seller_proceeds: 101 }).sellerProceeds, null);
  assert.equal(orderPricing({ subtotal: 100, commission_amount: 101 }).sellerProceeds, null);
  assert.match(orderPricing({ subtotal: 100, commission_amount: 10, seller_proceeds: 100 }).issues.join(' '), /Seller proceeds/);
  assert.match(orderPricing({ subtotal: 100, commission_amount: 20, commission_percentage: 10 }).issues.join(' '), /recorded percentage/);
  for (const value of [false, {}, '', 'NaN', -1, '1.001']) assert.ok(orderPricing({ delivery_fee: value }).issues.length);
});
test('multi-seller totals include each delivery and commission exactly once', () => {
  const result = pricingTotal([orderPricing({ subtotal: 10000, delivery_fee: 1500, commission_percentage: 10 }), orderPricing({ subtotal: 5000, delivery_fee: 500, commission_percentage: 10 })]);
  assert.equal(result.buyerTotal, 17000); assert.equal(result.productSubtotal, 15000);
  assert.equal(result.deliveryFee, 2000); assert.equal(result.adminCommission, 1500); assert.equal(result.sellerProceeds, 13500);
  assert.equal(pricingTotal([orderPricing({ total_amount: 100 }), orderPricing({})]).buyerTotal, null);
});
test('client-supplied prices and commission amounts never reach order/payment creation', async () => {
  const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL, originalFetch = global.fetch;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api/v1';
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return Response.json({ success: true }); };
  const request = body => new Request('https://web.example/api/order', { method: 'POST', headers: { Authorization: 'Bearer buyer-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    await load('src/app/api/buyer/orders/route.ts').POST(request({ buyer_id: 'buyer', payment_method: 'gateway', items: [{ product_id: 'product', quantity: 2, unit_price: 1, commission_amount: 0 }], dropoff_lat: 6.5, dropoff_lng: 3.4, delivery_fee: 0, total_amount: 1, commission_percentage: 0, seller_proceeds: 1 }));
    assert.deepEqual(calls[0].body, { buyer_id: 'buyer', payment_method: 'gateway', dropoff_lat: 6.5, dropoff_lng: 3.4, items: [{ product_id: 'product', quantity: 2 }] });
    await load('src/app/api/payments/initialize/route.ts').POST(request({ buyer_id: 'buyer', order_ids: ['order'], callback_url: 'https://web.example/dashboard/checkout/payment', amount: 1, delivery_fee: 0, commission_percentage: 0 }));
    assert.deepEqual(calls[1].body, { buyer_id: 'buyer', order_ids: ['order'], callback_url: 'https://web.example/dashboard/checkout/payment' });
  } finally { global.fetch = originalFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; }
});
