const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { orderPricing, pricingTotal } = load('src/components/commerce/orderPricing.ts');
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
