const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./support/load-ts.cjs');
const api = load('src/components/commerce/payments.ts');
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const items = [{ id: 'new-product', name: 'Current product', qty: 1, price: 10000 }];
const old = { buyerId: 'buyer', orderIds: ['old-order'], cartKey: JSON.stringify([{ id: 'old-product', qty: 1, price: 265000 }]), submitted: true, reference: 'PAY-old', checkoutUrl: 'https://checkout.paystack.com/old' };
test('current cart never selects a different saved order, while explicit resume preserves its reference', () => {
  const s = storage(); api.rememberCheckout(s, old);
  assert.equal(api.selectCheckout(s, 'buyer', JSON.stringify(items)), null);
  assert.deepEqual(api.selectCheckout(s, 'buyer', old.cartKey), old);
  assert.deepEqual(api.selectCheckout(s, 'buyer', JSON.stringify(items), 'old-order'), old);
  assert.deepEqual(api.selectCheckout(s, 'buyer', JSON.stringify(items), '', true), old);
  assert.deepEqual(api.selectCheckout(s, 'buyer', '', 'another-order').orderIds, ['another-order']);
});
test('a new checkout preserves old callback and order recovery without leaking across accounts', () => {
  const s = storage(); api.rememberCheckout(s, old);
  const current = { ...old, orderIds: ['new-order'], cartKey: JSON.stringify(items), reference: 'PAY-new' };
  api.rememberCheckout(s, current);
  assert.deepEqual(api.checkoutForReference(s, 'buyer', 'PAY-old'), old);
  assert.deepEqual(api.checkoutForReference(s, 'buyer', 'PAY-new'), current);
  assert.deepEqual(api.selectCheckout(s, 'buyer', '', 'old-order'), old);
  assert.equal(api.checkoutForReference(s, 'another-buyer', 'PAY-old'), null);
  assert.equal(api.checkoutForReference(s, 'buyer', 'unknown-reference'), null);
  assert.deepEqual(JSON.parse(s.getItem(api.checkoutStorageKey('buyer'))), current);
});
test('uncertain submissions and malformed saved checkouts block a fresh submission instead of being discarded', () => {
  const s = storage();
  const uncertain = { ...old, orderIds: [], reference: undefined };
  api.rememberCheckout(s, uncertain);
  assert.throws(() => api.selectCheckout(s, 'buyer', JSON.stringify(items)), /could not be confirmed/);
  assert.throws(() => api.rememberCheckout(s, { ...old, cartKey: JSON.stringify(items) }), /previous order submission/);
  api.rememberCheckout(s, { ...uncertain, orderIds: ['confirmed-order'] });
  assert.equal(api.selectCheckout(s, 'buyer', old.cartKey).orderIds[0], 'confirmed-order');
  s.setItem(api.checkoutStorageKey('buyer'), '{broken');
  assert.throws(() => api.selectCheckout(s, 'buyer', JSON.stringify(items)));
});

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function checkoutHarness(href = 'https://shop.test/dashboard/checkout?cart=1') {
  const s = storage(); api.rememberCheckout(s, old);
  const states = [], refs = [], effects = [], calls = [], reviewed = [];
  let cursor = 0, refCursor = 0;
  const loaded = { exports: {} }, jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/checkout/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module: loaded, exports: loaded.exports, Error, URL, sessionStorage: s,
    window: { location: { href, origin: 'https://shop.test', assign() { throw new Error('Unexpected payment redirect'); } } },
    fetch: async (url, init) => { calls.push({ url, init }); return Response.json({ data: { ID: 'new-order', TotalAmount: '10500', Commission: '500', PaymentStatus: 'pending' } }); },
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
        useRef(initial) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: initial }; return refs[i]; },
        useEffect(fn) { effects.push(fn); },
      };
      if (name === 'next/link') return { default: 'link' };
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name.endsWith('authStorage')) return { getAuth: () => ({ user: { id: 'buyer', role: 'buyer' }, access_token: 'token' }) };
      if (name.endsWith('useAuthUser')) return { useAuthUser: () => ({ id: 'buyer' }) };
      if (name.endsWith('localAccountData')) return { accountStamp: () => 'buyer', checkAccount() {} };
      if (name.endsWith('/store')) return { useCart: () => ({ items }), cartSubtotal: () => 10000, formatCurrency: value => String(value) };
      if (name.endsWith('/payments')) return api;
      if (name.endsWith('/ui')) return { Button: 'button', Card: 'card' };
      if (name.endsWith('useCheckoutPricing')) return { useCheckoutPricing: ids => { reviewed.push(ids); return { ready: false, pricing: null, loading: false, error: '', reload() {} }; } };
      if (name.endsWith('/addresses')) return { deliveryPoint: () => ({ latitude: 6, longitude: 3 }) };
      if (name.endsWith('checkoutErrors')) return load('src/components/commerce/checkoutErrors.ts');
      return { default: name.split('/').at(-1) };
    },
  });
  return { calls, reviewed, effects, storage: s, render() { cursor = 0; refCursor = 0; return loaded.exports.default(); } };
}
test('cart checkout renders the current subtotal and submits its products rather than resuming the old order', async () => {
  const h = checkoutHarness(); h.render(); h.effects[0](); let tree = h.render();
  assert.ok(nodes(tree, n => n.props?.children === 'Cart Summary').length);
  assert.equal(nodes(tree, n => n.props?.children === 'Saved order pricing').length, 0);
  assert.equal(h.reviewed.at(-1).length, 0);
  nodes(tree, n => n.type === 'AddressLocationLookup')[0].props.onAddressChange('Buyer address');
  nodes(tree, n => n.type === 'AddressLocationLookup')[0].props.onLocate({ latitude: 6, longitude: 3 });
  nodes(tree, n => n.type === 'input' && n.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } });
  tree = h.render();
  await nodes(tree, n => n.type === 'button' && n.props.children === 'Review order')[0].props.onClick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, '/api/buyer/orders');
  assert.deepEqual(JSON.parse(h.calls[0].init.body).items, [{ product_id: 'new-product', quantity: 1 }]);
  assert.deepEqual(JSON.parse(h.storage.getItem(api.checkoutStorageKey('buyer'))).orderIds, ['new-order']);
  assert.deepEqual(api.checkoutForReference(h.storage, 'buyer', 'PAY-old'), old);
});
test('explicit unpaid-order resume displays saved pricing without creating an order', () => {
  const h = checkoutHarness('https://shop.test/dashboard/checkout?order=old-order');
  h.render(); h.effects[0](); const tree = h.render();
  assert.ok(nodes(tree, n => n.props?.children === 'Saved order pricing').length);
  assert.deepEqual(h.reviewed.at(-1), ['old-order']); assert.equal(h.calls.length, 0);
});

test('confirmed pricing permits only unpaid pending orders, blocking paid or uncertain payment states', async () => {
  async function review(paymentStatus, status = 'pending') {
    const slots = [], effects = []; let cursor = 0;
    const loaded = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/commerce/useCheckoutPricing.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      module: loaded, exports: loaded.exports, Error, AbortController, AbortSignal,
      fetch: async () => Response.json({ data: { ID: 'order-one', BuyerID: 'buyer', PaymentStatus: paymentStatus, Status: status, TotalAmount: '10500', DeliveryFee: '500', Commission: '500' } }),
      require(name) {
        if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }, useEffect: fn => effects.push(fn) };
        if (name.endsWith('authStorage')) return { getAuth: () => ({ user: { id: 'buyer' }, access_token: 'token' }) };
        if (name.endsWith('useAuthUser')) return { useAuthUser: () => ({ id: 'buyer' }) };
        if (name.endsWith('localAccountData')) return { accountStamp: () => 'buyer', checkAccount() {} };
        if (name.endsWith('orderPricing')) return load('src/components/commerce/orderPricing.ts');
        throw new Error(name);
      },
    });
    const render = () => { cursor = 0; return loaded.exports.useCheckoutPricing(['order-one']); };
    render(); effects[0](); for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
    return render();
  }
  assert.equal((await review('pending')).ready, true);
  for (const state of ['paid', 'processing', 'refunded', undefined]) {
    const result = await review(state); assert.equal(result.ready, false); assert.ok(result.error);
  }
  assert.equal((await review('pending', 'cancelled')).ready, false);
});

test('an older payment callback cannot clear a newer checkout or its cart', async () => {
  const s = storage(); api.rememberCheckout(s, old);
  const current = { ...old, orderIds: ['new-order'], cartKey: JSON.stringify(items), reference: 'PAY-new' };
  api.rememberCheckout(s, current);
  const effects = [], slots = [], calls = []; let cursor = 0, cleared = false;
  const loaded = { exports: {} }, jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/dashboard/checkout/payment/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module: loaded, exports: loaded.exports, Error, URL, URLSearchParams, AbortController, sessionStorage: s,
    window: { location: { href: 'https://shop.test/dashboard/checkout/payment?reference=PAY-old' } },
    fetch: async url => { calls.push(url); return Response.json(url.includes('/callback') ? { verification_requested: true } : { data: { ID: 'old-order', PaymentStatus: 'paid' } }); },
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }, useEffect: fn => effects.push(fn) };
      if (name.endsWith('authStorage')) return { getAuth: () => ({ user: { id: 'buyer' }, access_token: 'token' }) };
      if (name.endsWith('/payments')) return api;
      if (name.endsWith('localAccountData')) return { accountStamp: () => 'buyer', checkAccount() {} };
      if (name.endsWith('/store')) return { getCart: () => ({ items }), clearCart: () => { cleared = true; } };
      if (name.endsWith('/ui')) return { Card: 'card', Button: 'button' };
      if (name === 'next/link') return { default: 'link' };
      throw new Error(name);
    },
  });
  loaded.exports.default(); effects[0](); for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(cleared, false);
  assert.deepEqual(JSON.parse(s.getItem(api.checkoutStorageKey('buyer'))), current);
  assert.deepEqual(JSON.parse(s.getItem(api.checkoutStorageKey('buyer', true))).orderIds, ['old-order']);
  assert.ok(calls.includes('/api/user/orders/old-order'));
  assert.equal(calls.includes('/api/user/orders/new-order'), false);
});
