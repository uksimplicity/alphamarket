const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./support/load-ts.cjs');
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const fixture = { ID: 'order-one', BuyerID: 'buyer', PaymentStatus: 'paid', Status: 'pending', RequiresDelivery: true, DeliveryID: null };

function harness(file, response) {
  const slots = [], dependencies = [], cleanups = [], pending = [], calls = [], timers = new Map(), listeners = new Map();
  let sellerDirectory = [];
  let cursor = 0, timerId = 0, user = { id: 'buyer' }, generation = 0;
  const stamp = () => `${user.id}:${generation}`;
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const window = { setInterval: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearInterval: id => timers.delete(id), addEventListener: document.addEventListener, removeEventListener: document.removeEventListener };
  const loaded = { exports: {} }, jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module: loaded, exports: loaded.exports, Error, AbortController, AbortSignal, document, window,
    fetch: async (url, init) => { calls.push({ url, init }); return response(url, init); },
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name.endsWith('ShopperIcon')) return { default: 'icon' };
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useEffect(fn, deps) { const i = cursor++; if (!dependencies[i] || deps.some((value, index) => value !== dependencies[i][index])) { dependencies[i] = deps; pending.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); } },
      };
      if (name.endsWith('authStorage')) return { getAuth: () => ({ user, access_token: 'buyer-token' }), authGeneration: () => generation };
      if (name.endsWith('useAuthUser')) return { useAuthUser: () => user };
      if (name.endsWith('useSellerName')) return { useSellerName: seller => load('src/components/dashboard/sellerNames.ts').resolveSellerName(seller, sellerDirectory) };
      if (name.endsWith('localAccountData')) return { accountStamp: stamp, checkAccount: previous => { if (previous !== stamp()) throw new Error('Account changed'); } };
      if (name.endsWith('/ui')) return { Card: 'card', SectionTitle: 'title', Button: 'button' };
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      if (name.startsWith('./')) return load('src/components/commerce/' + name.slice(2) + '.ts');
      throw new Error('Unexpected import ' + name);
    },
  });
  return {
    exports: loaded.exports, calls, timers, listeners, document,
    render(fn, ...args) { cursor = 0; return fn(...args); },
    effects() { pending.splice(0).forEach(fn => fn()); },
    switchUser() { user = { id: 'other-buyer' }; generation++; },
    directory(value) { sellerDirectory = value; },
    cleanup() { cleanups.forEach(fn => fn?.()); },
  };
}
const hookFile = 'src/components/commerce/buyerOrders.ts';
const componentFile = 'src/components/commerce/BuyerDeliveryTracking.tsx';
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const contains = (tree, value) => nodes(tree, node => node.props?.children === value).length > 0;

test('buyer parsing preserves explicit delivery fields in both backend serializers', () => {
  const h = harness(hookFile, () => {});
  const parse = h.exports.parseBuyerOrder;
  assert.equal(parse({ data: { order: fixture } }).delivery.required, true);
  assert.equal(parse(fixture).delivery.riderId, '');
  const result = parse({ ...fixture, delivery: { id: 'delivery', status: 'on_the_way', rider_id: 'rider' } });
  assert.equal(result.delivery.status, 'on_the_way');
  assert.equal(result.delivery.riderId, 'rider');
  assert.equal(parse({ ...fixture, DeliveryStatus: 'assigned', RiderID: 'rider' }).delivery.status, 'assigned');
});

test('buyer orders show the matching seller name and preserve supplied names without substituting another seller', () => {
  const hook = harness(hookFile, () => {});
  const parse = hook.exports.parseBuyerOrder;
  const h = harness('src/components/commerce/BuyerOrderSeller.tsx', () => {});
  h.directory([{ id: 'other', name: 'Wrong Store', role: 'seller' }, { id: 'seller-id', name: 'FNUK Tech', role: 'seller' }]);
  const render = order => h.render(h.exports.default, { order }).props.children.join('');
  assert.equal(parse({ ...fixture, SellerID: 'seller-id' }).sellerId, 'seller-id');
  assert.equal(render(parse({ ...fixture, SellerID: 'seller-id' })), 'Seller: FNUK Tech');
  assert.equal(render(parse({ ...fixture, seller_id: 'seller-id', seller_name: 'Actual Store Name' })), 'Seller: Actual Store Name');
  assert.equal(render(parse({ ...fixture, Seller: { ID: 'seller-id', Name: 'Nested Store' } })), 'Seller: Nested Store');
  assert.equal(render(parse({ ...fixture, SellerID: 'unlisted' })), 'Seller: Name not reported');
  h.directory([{ id: 'seller-id', name: 'Buyer Account', role: 'buyer' }]);
  assert.equal(render(parse({ ...fixture, SellerID: 'seller-id' })), 'Seller: Name not reported');
});

test('visible polling updates buyer delivery state, blocks overlap and removes listeners on cleanup', async () => {
  let assigned = false, resolve;
  const h = harness(hookFile, async () => { if (resolve === null) return new Promise(done => { resolve = done; }); return Response.json({ data: { ...fixture, RiderID: assigned ? 'new-rider' : null, DeliveryStatus: assigned ? 'assigned' : null } }); });
  const render = () => h.render(h.exports.useBuyerOrders, 'order-one');
  render(); h.effects(); await settle();
  assert.equal(render().orders[0].delivery.riderId, '');
  const timer = [...h.timers.values()][0]; assert.equal(timer.ms, 30000);
  h.document.visibilityState = 'hidden'; timer.fn(); await settle(); assert.equal(h.calls.length, 1);
  h.document.visibilityState = 'visible'; assigned = true; h.listeners.get('focus')(); await settle();
  assert.equal(render().orders[0].delivery.riderId, 'new-rider');
  resolve = null; timer.fn(); timer.fn(); await settle(); assert.equal(h.calls.length, 3);
  h.cleanup(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
  assert.equal(h.calls.at(-1).init.signal.aborted, true);
  resolve(Response.json({ data: fixture })); await settle();
  assert.equal(render().orders[0].delivery.riderId, 'new-rider');
  assert.ok(h.calls.every(call => call.init.headers.Authorization === 'Bearer buyer-token' && call.init.cache === 'no-store'));
});

test('failed refresh removes actionable old orders, then a subsequent refresh recovers', async () => {
  let failed = false;
  const h = harness(hookFile, () => Response.json(failed ? { success: false, error: 'Order service unavailable' } : { data: fixture }));
  const render = () => h.render(h.exports.useBuyerOrders, 'order-one');
  render(); h.effects(); await settle(); assert.equal(render().orders.length, 1);
  failed = true; [...h.timers.values()][0].fn(); await settle();
  assert.equal(render().orders.length, 0); assert.match(render().error, /unavailable/);
  failed = false; [...h.timers.values()][0].fn(); await settle();
  assert.equal(render().orders.length, 1); assert.equal(render().error, ''); h.cleanup();
});

test('wrong-order responses are rejected and late responses cannot cross account boundaries', async () => {
  let resolve;
  const h = harness(hookFile, () => new Promise(done => { resolve = done; }));
  const render = () => h.render(h.exports.useBuyerOrders, 'order-one');
  render(); h.effects(); resolve(Response.json({ data: { ...fixture, ID: 'different' } })); await settle();
  assert.match(render().error, /does not match/);
  [...h.timers.values()][0].fn(); const resolveOldAccount = resolve; h.switchUser();
  assert.equal(render().orders.length, 0); h.effects();
  resolveOldAccount(Response.json({ data: fixture })); await settle(); assert.equal(render().orders.length, 0);
  resolve(Response.json({ data: { ...fixture, BuyerID: 'other-buyer' } })); await settle();
  assert.equal(render().orders[0].buyerId, 'other-buyer'); h.cleanup();
});

test('buyer tracking shows missing delivery and no assignment explicitly without rider lookup', () => {
  const hook = harness(hookFile, () => {});
  const h = harness(componentFile, () => { throw new Error('Unexpected rider lookup'); });
  const props = { order: hook.exports.parseBuyerOrder(fixture), checkedAt: '2026-11-15T16:27:00Z', refreshing: false, reload() {} };
  const tree = h.render(h.exports.default, props); h.effects();
  assert.ok(contains(tree, 'Your delivery is being arranged.'));
  assert.ok(contains(tree, 'Awaiting rider assignment'));
  assert.ok(contains(tree, 'Awaiting delivery update')); assert.equal(h.calls.length, 0);
  const noDelivery = h.render(h.exports.default, { ...props, order: hook.exports.parseBuyerOrder({ ...fixture, RequiresDelivery: false }) }); h.effects();
  assert.ok(contains(noDelivery, 'No rider delivery is required for this order.')); assert.equal(h.calls.length, 0);
});

test('buyer tracking loads only the assigned rider, clears old contacts and preserves progress on a rider failure', async () => {
  const hook = harness(hookFile, () => {});
  let fail = false;
  const h = harness(componentFile, () => fail ? Response.json({ error: 'Insufficient permissions' }, { status: 403 }) : Response.json({ data: { id: 'rider one', name: 'Example Rider', phone: '08000000000' } }));
  const props = { order: hook.exports.parseBuyerOrder({ ...fixture, DeliveryID: 'delivery', DeliveryStatus: 'on_the_way', RiderID: 'rider one' }), checkedAt: 'first', refreshing: false, reload() {} };
  h.render(h.exports.default, props); h.effects(); await settle();
  let tree = h.render(h.exports.default, props);
  assert.ok(contains(tree, 'Example Rider')); assert.ok(contains(tree, '08000000000'));
  assert.equal(h.calls[0].url, '/api/marketplace/grpc/riders/rider%20one');
  assert.equal(h.calls[0].init.headers.Authorization, 'Bearer buyer-token');
  fail = true; props.checkedAt = 'second';
  tree = h.render(h.exports.default, props); assert.equal(contains(tree, 'Example Rider'), false);
  h.effects(); await settle(); tree = h.render(h.exports.default, props);
  assert.ok(contains(tree, 'On the way to buyer')); assert.ok(nodes(tree, node => node.props?.role === 'alert').length);
  assert.equal(contains(tree, '08000000000'), false);
  props.order = hook.exports.parseBuyerOrder({ ...fixture, DeliveryID: 'delivery' });
  tree = h.render(h.exports.default, props); h.effects(); await settle();
  assert.ok(contains(tree, 'Awaiting rider assignment')); assert.equal(h.calls.length, 3); h.cleanup();
});

test('buyer order with only DeliveryID resolves the delivery then shows its assigned rider', async () => {
  const hook = harness(hookFile, () => {});
  const h = harness(componentFile, url => Response.json(url.includes('/grpc/riders/')
    ? { data: { id: 'rider', name: 'Delivery Rider', phone: '08000000000' } }
    : { data: { id: 'delivery', order_id: 'order-one', rider_id: 'rider', status: 'assigned' } }));
  const props = { order: hook.exports.parseBuyerOrder({ ...fixture, DeliveryID: 'delivery' }), checkedAt: 'first', refreshing: false, reload() {} };
  h.render(h.exports.default, props); h.effects(); await settle();
  const tree = h.render(h.exports.default, props);
  for (const value of ['Rider assigned', 'Delivery Rider', '08000000000']) assert.ok(contains(tree, value), value);
  assert.deepEqual(h.calls.map(call => call.url), ['/api/marketplace/deliveries/delivery', '/api/marketplace/grpc/riders/rider']);
  assert.ok(h.calls.every(call => call.init.headers.Authorization === 'Bearer buyer-token'));
  h.cleanup();
});

test('buyer order history requests the chosen page and clears the previous page while loading', async () => {
  const h = harness(hookFile, () => Response.json({ data: [fixture] }));
  h.render(h.exports.useBuyerOrders, undefined, 0, 20); h.effects(); await settle();
  assert.equal(h.calls[0].url, '/api/user/orders?limit=20&offset=0');
  assert.equal(h.render(h.exports.useBuyerOrders, undefined, 0, 20).orders.length, 1);
  assert.equal(h.render(h.exports.useBuyerOrders, undefined, 120, 20).orders.length, 0);
  h.effects(); await settle();
  assert.equal(h.calls.at(-1).url, '/api/user/orders?limit=20&offset=120');
  assert.equal(h.render(h.exports.useBuyerOrders, undefined, 120, 20).orders.length, 1);
  h.cleanup();
});

test('buyer order item parsing accepts nested PascalCase fields without inventing missing items', () => {
  const h = harness(hookFile, () => {});
  const order = h.exports.parseBuyerOrder({ ...fixture, Items: [{ ProductID: 'product', Product: { Name: 'Actual product' }, Quantity: 2, UnitPrice: '1250.50' }] });
  assert.equal(order.items[0].id, 'product'); assert.equal(order.items[0].name, 'Actual product');
  assert.equal(order.items[0].qty, 2); assert.equal(order.items[0].price, 1250.5);
  assert.equal(h.exports.parseBuyerOrder({ ...fixture, Items: null }).items.length, 0);
});
