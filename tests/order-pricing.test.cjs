const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { orderPricing, pricingTotal, checkoutPricing } = load('src/components/commerce/orderPricing.ts');
test('missing delivery fee is buyer total minus products and commission', () => {
  const pricing = orderPricing({ subtotal: '45000', total_amount: '47250', commission_percentage: 5 });
  assert.equal(pricing.deliveryFee, 0);
  assert.equal(pricing.adminCommission, 2250);
  assert.equal(pricing.sellerProceeds, 45000);
  assert.deepEqual(pricing.issues, []);
  assert.equal(orderPricing({ items: [{ unit_price: '12.34', quantity: 3 }], total_amount: '38.27', commission_amount: 0 }).deliveryFee, 1.25);
  assert.equal(orderPricing({ subtotal: 45000, total_amount: 45000, commission_percentage: 0 }).deliveryFee, 0);
});
test('checkout uses frozen listed prices when the live order has no items or subtotal', () => {
  const snapshot = JSON.stringify([{ id: 'helmet', price: 45000, qty: 1 }]);
  const live = orderPricing({ ID: 'synthetic-order', total_amount: '47250', Items: null });
  const pricing = checkoutPricing([live], snapshot);
  assert.equal(pricing.productSubtotal, 45000);
  assert.equal(pricing.deliveryFee, null);
  assert.equal(pricing.buyerTotal, 47250);
  assert.equal(pricing.adminCommission, null);
  assert.deepEqual(pricing.issues, []);
});
test('checkout subtracts the cart subtotal once across multiple seller orders', () => {
  const snapshot = JSON.stringify([{ id: 'one', price: 100, qty: 2 }, { id: 'two', price: 50, qty: 3 }]);
  const pricing = checkoutPricing([orderPricing({ total_amount: 230, commission_amount: 20 }), orderPricing({ total_amount: 170, commission_amount: 15 })], snapshot);
  assert.equal(pricing.productSubtotal, 350);
  assert.equal(pricing.deliveryFee, 15);
  assert.equal(pricing.buyerTotal, 400);
  assert.equal(checkoutPricing([orderPricing({ TotalAmount: 230 }), orderPricing({})], snapshot).deliveryFee, null);
});
test('explicit backend fees and recorded subtotals take priority over the snapshot', () => {
  const snapshot = JSON.stringify([{ id: 'one', price: 1, qty: 1 }]);
  assert.equal(checkoutPricing([orderPricing({ subtotal: 45000, total_amount: 47250, commission_amount: 2250 })], snapshot).deliveryFee, 0);
  assert.equal(checkoutPricing([orderPricing({ total_amount: 47250, delivery_fee: 0 })], snapshot).deliveryFee, 0);
  assert.equal(checkoutPricing([orderPricing({ subtotal: 45000, total_amount: 47250, delivery_fee: 100 })], snapshot).deliveryFee, 100);
});
test('invalid snapshots, invalid amounts and negative differences never become delivery fees', () => {
  const value = orderPricing({ total_amount: 100 });
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
test('capitalized product total does not imply a missing delivery fee is zero', () => {
  const pricing = orderPricing({ ID: 'synthetic-order', TotalAmount: '47250', Commission: '2250', Items: null });
  assert.equal(pricing.buyerTotal, null);
  assert.equal(pricing.deliveryFee, null);
  assert.equal(pricing.productSubtotal, 45000);
  assert.equal(pricing.adminCommission, 2250);
  assert.deepEqual(pricing.issues, []);
});

test('Create Order response adds DeliveryFee to TotalAmount exactly once', () => {
  const saved = { ID: 'order-1', TotalAmount: '9450', Commission: '450', DeliveryFee: '1451.64', Items: null };
  assert.deepEqual(orderPricing(saved), {
    productSubtotal: 9000, deliveryFee: 1451.64, buyerTotal: 10901.64,
    commissionPercentage: null, adminCommission: 450, sellerProceeds: 9000, issues: [],
  });
  assert.deepEqual(orderPricing({ ID: 'order-1' }, saved), orderPricing(saved));
  assert.equal(orderPricing({ ID: 'order-1', TotalAmount: '10500', DeliveryFee: '0' }, saved).buyerTotal, 10500);
  assert.equal(orderPricing({ buyer_total: '10901.64' }, saved).buyerTotal, 10901.64);
  assert.equal(orderPricing({ TotalAmount: '10500', DeliveryFee: '0', Commission: '500' }, { buyer_total: '10901.64' }).buyerTotal, 10500);
  assert.ok(orderPricing({ TotalAmount: 'invalid' }, { buyer_total: '10901.64' }).issues.length);
  assert.ok(orderPricing({ DeliveryFee: 'invalid' }, saved).issues.length);
  const split = pricingTotal([orderPricing(saved), orderPricing({ TotalAmount: '2100', Commission: '100', DeliveryFee: '200' })]);
  assert.equal(split.buyerTotal, 13201.64);
  assert.equal(split.sellerProceeds, 11000);
});

test('delivery selection controls the charge, including mixed seller orders', () => {
  const order = { TotalAmount: '9450', Commission: '450', DeliveryFee: '1451.64' };
  const pickup = orderPricing({ ...order, RequiresDelivery: false });
  const delivery = orderPricing({ ...order, RequiresDelivery: true });
  assert.equal(pickup.buyerTotal, 9450);
  assert.equal(pickup.deliveryFee, 0);
  assert.equal(pickup.requiresDelivery, false);
  assert.equal(pickup.sellerProceeds, 9000);
  assert.deepEqual(pickup.issues, []);
  assert.equal(delivery.buyerTotal, 10901.64);
  assert.equal(pricingTotal([pickup, pickup]).requiresDelivery, false);
  const mixed = pricingTotal([pickup, delivery]);
  assert.equal(mixed.requiresDelivery, true);
  assert.equal(mixed.deliveryFee, 1451.64);
  assert.equal(mixed.buyerTotal, 20351.64);
  assert.ok(orderPricing({ ...order, RequiresDelivery: 'false' }).issues.length);
});

test('buyer breakdown bundles commission and shows delivery only when selected', () => {
  const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
  const filename = path.resolve('src/components/commerce/OrderMoneyBreakdown.tsx');
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = request => request === './orderPricing' ? { orderPricing, pricingMoney: load('src/components/commerce/orderPricing.ts').pricingMoney } : module.require(request);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const render = (pricing, seller = false) => renderToStaticMarkup(React.createElement(loaded.exports.default, { pricing, seller }));
  const order = { TotalAmount: '9450', Commission: '450', DeliveryFee: '1451.64', RequiresDelivery: true };
  const html = render(orderPricing(order));
  assert.match(html, /9,450\.00/); assert.match(html, /1,451\.64/); assert.match(html, /10,901\.64/);
  assert.doesNotMatch(html, /commission|₦450\.00|9,000\.00/i);
  const pickup = render(orderPricing({ ...order, RequiresDelivery: false }));
  assert.match(pickup, /9,450\.00/); assert.doesNotMatch(pickup, /Delivery fee|commission|1,451\.64/i);
  assert.match(render(orderPricing(order), true), /Admin commission/);
  assert.doesNotMatch(render(orderPricing({ ...order, commission_percentage: 10 })), /commission/i);
});
test('buyer pays products plus commission plus delivery; seller keeps the product price', () => {
  assert.deepEqual(orderPricing({ subtotal: '10000', delivery_fee: '1500', commission_percentage: '10' }), {
    productSubtotal: 10000, deliveryFee: 1500, buyerTotal: 12500, commissionPercentage: 10, adminCommission: 1000, sellerProceeds: 10000, issues: [],
  });
});
test('quantity and discounts use recorded backend prices, with kobo rounding', () => {
  const pricing = orderPricing({ items: [{ unit_price: '12.34', quantity: 3 }], delivery_fee: '1.25', commission_percentage: 1.5 });
  assert.equal(pricing.productSubtotal, 37.02); assert.equal(pricing.buyerTotal, 38.83);
  assert.equal(pricing.adminCommission, 0.56); assert.equal(pricing.sellerProceeds, 37.02);
  assert.equal(orderPricing({ subtotal: 9000, items: [{ unit_price: 10000, quantity: 1 }], delivery_fee: 500, commission_percentage: 10 }).sellerProceeds, 9000);
});
test('historical commission is never inferred from an ambiguous rate, current rate or buyer total', () => {
  const unknown = orderPricing({ total_amount: 11500, commission_rate: 0.1 });
  assert.equal(unknown.buyerTotal, 11500); assert.equal(unknown.productSubtotal, null);
  assert.equal(unknown.adminCommission, null); assert.equal(unknown.sellerProceeds, null); assert.equal(unknown.deliveryFee, null);
  const recorded = orderPricing({ subtotal: 10000, delivery_fee: 1500, commission_amt: 1000 });
  assert.equal(recorded.sellerProceeds, 10000); assert.equal(recorded.buyerTotal, 12500);
});
test('zero fee and zero commission remain real values, and absent amounts stay unknown', () => {
  assert.equal(orderPricing({ subtotal: 10000, delivery_fee: 0, commission_percentage: 0 }).sellerProceeds, 10000);
  assert.equal(orderPricing({ subtotal: 10000, delivery_fee: 0, commission_percentage: 100 }).sellerProceeds, 10000);
  assert.equal(orderPricing({ subtotal: 10000, delivery_fee: 0, commission_percentage: 100 }).buyerTotal, 20000);
  const missing = orderPricing({});
  for (const key of ['buyerTotal', 'productSubtotal', 'deliveryFee', 'adminCommission', 'sellerProceeds']) assert.equal(missing[key], null);
});
test('inconsistent buyer charges, seller proceeds and invalid numbers are flagged', () => {
  assert.match(orderPricing({ subtotal: 10000, delivery_fee: 1500, total_amount: 11500, commission_percentage: 10 }).issues.join(' '), /buyer total/);
  assert.match(orderPricing({ delivery_fee: 1500, total_amount: 500 }).issues.join(' '), /delivery fee exceeds/);
  assert.equal(orderPricing({ subtotal: 100, seller_proceeds: 101 }).sellerProceeds, null);
  assert.equal(orderPricing({ subtotal: 100, commission_amount: 101 }).sellerProceeds, 100);
  assert.match(orderPricing({ subtotal: 100, commission_amount: 10, seller_proceeds: 90 }).issues.join(' '), /Seller proceeds/);
  assert.match(orderPricing({ subtotal: 100, commission_amount: 20, commission_percentage: 10 }).issues.join(' '), /recorded percentage/);
  for (const value of [false, {}, '', 'NaN', -1, '1.001']) assert.ok(orderPricing({ delivery_fee: value }).issues.length);
});
test('multi-seller totals include each delivery and commission exactly once', () => {
  const result = pricingTotal([orderPricing({ subtotal: 10000, delivery_fee: 1500, commission_percentage: 10 }), orderPricing({ subtotal: 5000, delivery_fee: 500, commission_percentage: 10 })]);
  assert.equal(result.buyerTotal, 18500); assert.equal(result.productSubtotal, 15000);
  assert.equal(result.deliveryFee, 2000); assert.equal(result.adminCommission, 1500); assert.equal(result.sellerProceeds, 15000);
  assert.equal(pricingTotal([orderPricing({ total_amount: 100 }), orderPricing({})]).buyerTotal, null);
});

test('unknown commission cannot become delivery or a fabricated buyer total', () => {
  const missing = orderPricing({ subtotal: 10000, delivery_fee: 1500 });
  assert.equal(missing.buyerTotal, null);
  assert.equal(orderPricing({ subtotal: 10000, total_amount: 12500 }).deliveryFee, null);
  assert.equal(orderPricing({ total_amount: 12500, delivery_fee: 1500 }).productSubtotal, null);
  const complete = orderPricing({ total_amount: 12500, delivery_fee: 1500, commission_amount: 1000 });
  assert.equal(complete.productSubtotal, 10000);
  assert.equal(complete.sellerProceeds, 10000);
  assert.deepEqual(complete.issues, []);
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
