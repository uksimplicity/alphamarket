const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./support/load-ts.cjs');
const originalFetch = global.fetch, originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
beforeEach(() => { load.reset(); process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example/api/v1'; });
afterEach(() => { global.fetch = originalFetch; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase; });
const request = (query = '') => new Request('https://shop.example/api/seller/orders' + query, { headers: { Authorization: 'Bearer seller-token' } });
const fixture = { ID: 'order-uuid', SellerID: 'seller', TotalAmount: '265000', Status: 'pending', PaymentStatus: 'paid', CreatedAt: '2026-11-15T16:27:15Z', DeliveryAddress: 'Example address' };

test('seller list preserves delivery acceptance separately from order and payment state', async () => {
  const { loadSellerOrders } = load('src/components/vendor/sellerOrders.ts');
  const [order] = await loadSellerOrders(async () => ({ data: [{ ...fixture, DeliveryStatus: 'assigned', RiderID: 'r1', DeliveryAcceptedAt: '2026-11-17T10:00:00Z' }] }), 'seller');
  assert.equal(order.status, 'pending');
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.delivery.riderId, 'r1');
  assert.equal(order.delivery.status, 'assigned');
  assert.equal(order.delivery.accepted, true);
});

test('seller list and detail use the authenticated user endpoints with no guessed fallback', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ data: { orders: [fixture] } }); };
  const list = await load('src/app/api/seller/orders/route.ts').GET(request('?limit=200&offset=20&status=pending&payment_status=paid'));
  assert.equal(list.status, 200);
  assert.equal(calls[0].url, 'https://api.example/api/v1/user/orders?limit=200&offset=20&status=pending&payment_status=paid');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer seller-token');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.redirect, 'manual');
  await load('src/app/api/seller/orders/[orderId]/route.ts').GET(request(), { params: Promise.resolve({ orderId: 'order/uuid' }) });
  assert.equal(calls[1].url, 'https://api.example/api/v1/user/orders/order%2Fuuid');
  assert.equal(calls.length, 2);
});

test('upstream failures are never converted into successful empty order lists or false not-found details', async () => {
  const list = load('src/app/api/seller/orders/route.ts'), detail = load('src/app/api/seller/orders/[orderId]/route.ts');
  for (const status of [401, 403, 404, 500, 503]) {
    let calls = 0;
    global.fetch = async () => { calls++; return Response.json({ error: 'Backend failure' }, { status }); };
    const response = await list.GET(request());
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: 'Backend failure' });
    assert.equal(calls, 1);
    const details = await detail.GET(request(), { params: Promise.resolve({ orderId: 'id' }) });
    assert.equal(details.status, status);
  }
  for (const response of [() => new Response('not json'), () => new Response(null, { status: 302 }), () => { throw new Error('Network failure'); }]) {
    global.fetch = async () => response();
    assert.equal((await list.GET(request())).status, 502);
  }
});

test('missing configuration, missing authorization and invalid pagination cannot manufacture zero orders', async () => {
  global.fetch = async () => { throw new Error('Must not call backend'); };
  const route = load('src/app/api/seller/orders/route.ts');
  assert.equal((await route.GET(new Request('https://shop.example/api/seller/orders'))).status, 401);
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  assert.equal((await route.GET(request())).status, 503);
  for (const query of ['?limit=0', '?limit=201', '?offset=-1', '?limit=abc']) assert.equal((await route.GET(request(query))).status, 400);
});

test('nested order envelopes and both serializers preserve the order, payment and amount', async () => {
  const { loadSellerOrders, sellerOrderDetail } = load('src/components/vendor/sellerOrders.ts');
  for (const payload of [[fixture], { data: [fixture] }, { data: { orders: [fixture] } }, { data: { items: [fixture] } }, { data: { data: [fixture] } }]) {
    const orders = await loadSellerOrders(async () => payload, 'seller');
    assert.equal(orders.length, 1);
    assert.equal(orders[0].id, 'order-uuid');
    assert.equal(orders[0].amount, 265000);
    assert.equal(orders[0].paymentStatus, 'paid');
  }
  const order = sellerOrderDetail({ success: true, data: { order: fixture } });
  assert.equal(order.id, 'order-uuid');
  assert.equal(order.dropoff_address, 'Example address');
  assert.throws(() => sellerOrderDetail({ success: false, error: 'Unavailable' }), /Unavailable/);
});

test('all order pages contribute to totals and another seller is excluded', async () => {
  const calls = [];
  const orders = await load('src/components/vendor/sellerOrders.ts').loadSellerOrders(async path => {
    calls.push(path);
    return { data: { orders: path.includes('offset=0')
      ? Array.from({ length: 200 }, (_, i) => ({ ...fixture, ID: 'order-' + i }))
      : [{ ...fixture, ID: 'order-199' }, { ...fixture, ID: 'last' }, { ...fixture, ID: 'theirs', SellerID: 'another-seller' }] } };
  }, 'seller');
  assert.equal(orders.length, 201);
  assert.equal(orders.at(-1).id, 'last');
  assert.deepEqual(calls, ['/api/seller/orders?limit=200&offset=0', '/api/seller/orders?limit=200&offset=200']);
});

test('only a readable empty list becomes zero; failures and malformed responses are errors', async () => {
  const { loadSellerOrders } = load('src/components/vendor/sellerOrders.ts');
  assert.deepEqual(await loadSellerOrders(async () => ({ data: { orders: [] } }), 'seller'), []);
  for (const payload of [{}, null, { data: null }, { data: {} }, { data: [{ Status: 'pending' }] }, { success: false, data: [] }, { fallback: true, data: [] }]) {
    await assert.rejects(loadSellerOrders(async () => payload, 'seller'));
  }
  await assert.rejects(loadSellerOrders(async () => ({ data: Array.from({ length: 200 }, (_, i) => ({ id: 'repeat-' + i })) }), 'seller'), /repeated order page/);
});

function pageHarness(response, component = 'VendorOrders') {
  const slots = [], effects = [], calls = [], timers = new Map(), focusListeners = new Map(), visibilityListeners = new Map();
  const chatCalls = [], navigations = [];
  let startChat = async () => { throw new Error('Chat unavailable'); };
  let deliveryNotice = null;
  let notices = [];
  let cursor = 0;
  let timerId = 0, user = { id: 'seller' };
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => visibilityListeners.set(name, fn), removeEventListener: name => visibilityListeners.delete(name) };
  const window = {
    setInterval: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearInterval: id => timers.delete(id),
    addEventListener: (name, fn) => focusListeners.set(name, fn), removeEventListener: name => focusListeners.delete(name),
  };
  const jsx = (type, props) => ({ type, props });
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/vendor/pages/' + component + '.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: loaded, exports: loaded.exports, Error, AbortController, AbortSignal, document, window,
    fetch: async (url, init) => { calls.push({ url, init }); return response(url, init); },
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
        useMemo(fn) { return fn(); }, useEffect(effect) { effects.push(effect); },
      };
      if (name === 'react-router-dom') return { Link: 'link', useParams: () => ({ orderId: 'order-uuid' }), useNavigate: () => path => navigations.push(path) };
      if (name.endsWith('chatClient')) return { ChatClient: class {
        startOrder(...args) { chatCalls.push({ type: 'order', args }); return startChat(...args); }
        startDelivery(...args) { chatCalls.push({ type: 'delivery', args }); return startChat(...args); }
      } };
      if (name.endsWith('authStorage')) return { getAuth: () => ({ access_token: 'seller-token', user }), authGeneration: () => 1 };
      if (name.endsWith('useAuthUser')) return { useAuthUser: () => user };
      if (name.endsWith('AdminIcon')) return { default: 'icon' };
      if (name.endsWith('localAccountData')) return { accountStamp: () => user.id, checkAccount(stamp) { if (stamp !== user.id) throw new Error('Account changed'); } };
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name.endsWith('EscrowStatus') || name.endsWith('OrderMoneyBreakdown')) return { default: 'status-component' };
      if (name.endsWith('DeliveryProgress')) return { default: 'delivery-progress' };
      if (name.endsWith('OrderDeliveryNotice')) return { useOrderDeliveryNotice: (_id, _refresh, enabled) => enabled ? deliveryNotice : null };
      if (name.endsWith('notificationClient')) return { notificationRequest: async () => notices, notificationPage: items => ({ items }) };
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      throw new Error(name);
    },
  });
  return { effects, calls, timers, document, focusListeners, visibilityListeners, chatCalls, navigations, chat: fn => { startChat = fn; }, notice: value => { deliveryNotice = value; }, notices: value => { notices = value; }, changeUser: id => { user = { id }; }, render() { cursor = 0; return loaded.exports.default(); } };
}
function nodes(tree, match) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, match));
  if (!tree || typeof tree !== 'object') return [];
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Orders page renders a nested backend order with working detail link and nonzero totals', async () => {
  const h = pageHarness(() => Response.json({ data: { orders: [fixture] } }));
  h.render(); h.effects[0](); await settle();
  const tree = h.render();
  assert.deepEqual(nodes(tree, node => node.props?.className === 'statValue').map(node => node.props.children), [1, 0, 1, 0]);
  const link = nodes(tree, node => node.type === 'link')[0];
  assert.equal(link.props.to, '/vendor/orders/order-uuid');
  assert.equal(link.props.children, 'order-uuid');
  assert.ok(nodes(tree, node => node.type === 'th' && node.props.children === 'Payment').length);
  assert.ok(nodes(tree, node => node.props?.children === 'paid').length);
  assert.equal(nodes(tree, node => node.props?.children === 'No orders yet.').length, 0);
});

test('Orders page shows unknown totals and an error on failure, then Refresh recovers', async () => {
  let failed = true;
  const h = pageHarness(() => failed ? Response.json({ error: 'Orders unavailable' }, { status: 503 }) : Response.json({ data: { orders: [fixture] } }));
  h.render(); h.effects[0](); await settle();
  let tree = h.render();
  assert.equal(nodes(tree, node => node.props?.role === 'alert')[0].props.children, 'Orders unavailable');
  assert.equal(nodes(tree, node => node.props?.children === 'No orders yet.').length, 0);
  assert.ok(nodes(tree, node => node.props?.className === 'statValue').every(node => node.props.children === '—'));
  failed = false;
  nodes(tree, node => node.type === 'button' && node.props.children === 'Refresh')[0].props.onClick();
  h.render(); h.effects.at(-1)(); await settle(); tree = h.render();
  assert.equal(nodes(tree, node => node.props?.role === 'alert').length, 0);
  assert.equal(nodes(tree, node => node.props?.className === 'statValue')[0].props.children, 1);
});

test('Orders page reports zero only after a genuine successful empty response', async () => {
  const h = pageHarness(() => Response.json({ data: { orders: [] } }));
  h.render(); h.effects[0](); await settle();
  const tree = h.render();
  assert.deepEqual(nodes(tree, node => node.props?.className === 'statValue').map(node => node.props.children), [0, 0, 0, 0]);
  assert.equal(nodes(tree, node => node.props?.children === 'No orders yet.').length, 1);
});

test('Orders page rejects HTTP 200 logical failures instead of displaying zero', async () => {
  const h = pageHarness(() => Response.json({ success: false, message: 'Service unavailable', data: [] }));
  h.render(); h.effects[0](); await settle();
  const tree = h.render();
  assert.equal(nodes(tree, node => node.props?.role === 'alert')[0].props.children, 'Service unavailable');
  assert.equal(nodes(tree, node => node.props?.children === 'No orders yet.').length, 0);
  assert.ok(nodes(tree, node => node.props?.className === 'statValue').every(node => node.props.children === '—'));
});

test('seller order references, buyer identity aliases and delivery-inclusive totals survive normalization', async () => {
  const { loadSellerOrders } = load('src/components/vendor/sellerOrders.ts');
  const [order] = await loadSellerOrders(async () => ({ data: { orders: [{ ...fixture, OrderNumber: 'ORD-readable', BuyerID: 'buyer-one', Buyer: { FirstName: 'Amara', LastName: 'Okafor' }, Commission: '15000', DeliveryFee: '500', RequiresDelivery: true }] } }), 'seller');
  assert.equal(order.orderNumber, 'ORD-readable');
  assert.equal(order.buyerId, 'buyer-one');
  assert.equal(order.customer, 'Amara Okafor');
  assert.equal(order.pricing.buyerTotal, 265500);
  assert.equal(order.amount, 265500);
  assert.equal(order.pricing.sellerProceeds, 250000);
  assert.deepEqual(order.pricing.issues, []);
});

test('customer detail enrichment matches order and buyer and cannot replace names with unrelated records', async () => {
  const { loadSellerOrders, loadOrderCustomerNames } = load('src/components/vendor/sellerOrders.ts');
  const orders = await loadSellerOrders(async () => ({ data: { orders: [{ ...fixture, BuyerID: 'buyer-one' }] } }), 'seller');
  const named = await loadOrderCustomerNames(async path => {
    assert.equal(path, '/api/seller/orders/order-uuid');
    return { data: { order: { ...fixture, BuyerID: 'buyer-one', BuyerName: 'Actual Buyer' } } };
  }, orders);
  assert.equal(named[0].customer, 'Actual Buyer');
  assert.equal(orders[0].customer, 'Customer');
  for (const payload of [
    { data: { ...fixture, ID: 'other-order', BuyerName: 'Wrong Order' } },
    { data: { ...fixture, BuyerID: 'other-buyer', BuyerName: 'Wrong Buyer' } },
    { success: false, error: 'Unavailable' },
  ]) assert.equal((await loadOrderCustomerNames(async () => payload, orders))[0].customer, 'Customer');
  let calls = 0;
  await loadOrderCustomerNames(async () => { calls++; }, named);
  assert.equal(calls, 0);
});

test('seller summary separates unpaid orders from fulfillment and displays references and pricing warnings', async () => {
  const h = pageHarness(url => url.includes('/orders?') ? Response.json({ data: { orders: [
    { ...fixture, OrderNumber: 'ORD-paid', BuyerName: 'Actual Buyer', Commission: '15000', DeliveryFee: '0', seller_proceeds: '249500' },
    { ...fixture, ID: 'unpaid', PaymentStatus: 'pending', BuyerName: 'Second Buyer' },
    { ...fixture, ID: 'cancelled', PaymentStatus: 'pending', Status: 'cancelled', BuyerName: 'Third Buyer' },
  ] } }) : Response.json({ data: fixture }));
  h.render(); h.effects[0](); await settle(); await settle();
  const tree = h.render();
  assert.deepEqual(nodes(tree, node => node.props?.className === 'statValue').map(node => node.props.children), [3, 1, 1, 0]);
  assert.ok(nodes(tree, node => node.props?.children === 'Actual').length);
  assert.ok(nodes(tree, node => node.props?.children === 'Pricing needs review').length);
  const link = nodes(tree, node => node.type === 'link' && node.props.children === 'ORD-paid')[0];
  assert.equal(link.props.to, '/vendor/orders/order-uuid');
});

test('notification destination renders nested order details including payment status and delivery address', async () => {
  const h = pageHarness(() => Response.json({ data: { order: fixture } }), 'VendorOrderDetail');
  h.render(); h.effects[0](); await settle();
  const tree = h.render();
  assert.ok(nodes(tree, node => node.props?.children === 'Order Details').length);
  assert.ok(nodes(tree, node => node.props?.children === 'paid').length);
  assert.ok(nodes(tree, node => node.props?.children === 'Example address').length);
  assert.equal(nodes(tree, node => node.props?.children === 'Unable to load order').length, 0);
});

test('paid seller orders open the buyer and rider conversations without payment gating or duplicate starts', async () => {
  const h = pageHarness(() => Response.json({ data: { ...fixture, BuyerID: 'buyer', DeliveryID: 'delivery', RiderID: 'rider', PaymentStatus: 'paid', Status: 'processing' } }), 'VendorOrderDetail');
  h.render(); const cleanup = h.effects[0](); await settle();
  let finish;
  h.chat(() => new Promise(resolve => { finish = resolve; }));
  const buyer = nodes(h.render(), node => node.type === 'button' && (node.props['aria-label'] || node.props.children) === 'Chat with buyer')[0];
  assert.equal(buyer.props.disabled, false); buyer.props.onClick(); buyer.props.onClick();
  assert.equal(h.chatCalls.length, 1); assert.equal(h.chatCalls[0].type, 'order');
  assert.deepEqual(h.chatCalls[0].args.slice(0, 2), ['order-uuid', 'buyer']);
  finish({ id: 'buyer-thread' }); await settle();
  assert.equal(h.navigations.at(-1), '/vendor/messages?conversationId=buyer-thread');
  h.chat(async () => ({ id: 'rider-thread' }));
  nodes(h.render(), node => node.type === 'button' && (node.props['aria-label'] || node.props.children) === 'Chat with rider')[0].props.onClick(); await settle();
  assert.equal(h.chatCalls.at(-1).type, 'delivery');
  assert.deepEqual(h.chatCalls.at(-1).args.slice(0, 2), ['delivery', 'rider']);
  assert.equal(h.navigations.at(-1), '/vendor/messages?conversationId=rider-thread');
  h.chat(async () => { throw new Error('Insufficient permissions'); });
  nodes(h.render(), node => node.type === 'button' && (node.props['aria-label'] || node.props.children) === 'Chat with buyer')[0].props.onClick(); await settle();
  assert.ok(nodes(h.render(), node => node.props?.role === 'alert' && node.props.children === 'Insufficient permissions').length);
  assert.equal(h.navigations.length, 2);
  cleanup();
});

test('seller order list shows only the matching rider update when tracking is denied', async () => {
  const h = pageHarness(url => url.includes('/marketplace/deliveries/')
    ? Response.json({ error: 'Denied' }, { status: 403 })
    : Response.json({ data: { orders: [{ ...fixture, BuyerName: 'Ada', DeliveryID: 'delivery', RequiresDelivery: true }] } }));
  h.notices([{ title: 'Rider on the way for pickup', type: 'delivery_update', date: '2026-11-17T12:23:09Z', data: { order_id: 'order-uuid' } },
    { title: 'Delivery completed', type: 'delivery_update', date: '2026-11-18T12:23:09Z', data: { order_id: 'other-order' } }]);
  h.render(); const cleanup = h.effects[0](); await settle(); await settle();
  const tree = h.render();
  assert.ok(nodes(tree, node => node.props?.children === 'Rider on the way for pickup').length);
  assert.equal(nodes(tree, node => node.props?.children === 'Delivery completed').length, 0);
  cleanup();
});

test('seller order details appear while delivery tracking is still loading', async () => {
  let finishTracking;
  const h = pageHarness(url => url.includes('/marketplace/deliveries/')
    ? new Promise(resolve => { finishTracking = resolve; })
    : Response.json({ data: { ...fixture, OrderNumber: 'ORD-fast', DeliveryID: 'delivery', RequiresDelivery: true } }), 'VendorOrderDetail');
  h.render(); const cleanup = h.effects[0](); await settle();
  assert.ok(nodes(h.render(), node => node.props?.children === 'ORD-fast').length);
  assert.equal(typeof finishTracking, 'function');
  finishTracking(Response.json({ data: { id: 'delivery', order_id: 'order-uuid', status: 'requested' } }));
  await settle(); cleanup();
});

test('seller escrow displays the PascalCase status even when delivery lookup is denied', async () => {
  const h = pageHarness(url => url.includes('/marketplace/deliveries/')
    ? Response.json({ error: 'Delivery tracking is unavailable to this account' }, { status: 403 })
    : Response.json({ success: true, data: {
      ID: 'order-uuid', OrderNumber: 'ORD-example', BuyerID: 'buyer', SellerID: 'seller',
      Commission: '600', TotalAmount: '10600', Status: 'processing', PaymentStatus: 'paid',
      DeliveryFee: '522.98', DeliveryAddress: 'Example address', DeliveryID: 'delivery',
      RequiresDelivery: true, EscrowID: 'escrow', EscrowStatus: 'held', Items: null,
    } }), 'VendorOrderDetail');
  h.render(); const cleanup = h.effects[0](); await settle();
  const tree = h.render();
  assert.ok(nodes(tree, node => node.type === 'status-component' && node.props.status === 'held').length);
  assert.equal(nodes(tree, node => node.type === 'status-component' && node.props.status === 'held')[0].props.sellerAmount, 10000);
  assert.ok(nodes(tree, node => node.props?.children === 'paid').length);
  assert.ok(nodes(tree, node => node.props?.role === 'alert').length);
  cleanup();
});

test('a matching rider update replaces the unavailable status and shows the rider first name', async () => {
  const h = pageHarness(url => url.includes('/marketplace/deliveries/')
    ? Response.json({ error: 'Denied' }, { status: 403 })
    : Response.json({ data: { ...fixture, DeliveryID: 'delivery', RequiresDelivery: true } }), 'VendorOrderDetail');
  h.notice({ title: 'Rider on the way for pickup', date: '2026-11-17T12:23:09Z', data: { rider_name: 'Ada Okafor' } });
  h.render(); const cleanup = h.effects[0](); await settle();
  const tree = h.render();
  assert.ok(nodes(tree, node => node.props?.children === 'Rider on the way for pickup').length);
  assert.ok(nodes(tree, node => node.props?.children === 'Ada').length);
  assert.equal(nodes(tree, node => node.props?.children === 'Tracking unavailable').length, 0);
  assert.equal(nodes(tree, node => node.props?.children === 'Delivery tracking is unavailable to this account').length, 0);
  cleanup();
});

test('seller tracking queries only the assigned rider and displays backend progress and contact', async () => {
  const h = pageHarness(url => url.includes('/grpc/riders/')
    ? Response.json({ data: { rider: { id: 'rider one', user: { first_name: 'Example', last_name: 'Rider', phone: '08000000000' } } } })
    : Response.json({ data: { ...fixture, RiderID: 'rider one', DeliveryStatus: 'heading_to_pickup' } }), 'VendorOrderDetail');
  h.render(); const cleanup = h.effects[0](); await settle();
  const tree = h.render();
  assert.deepEqual(h.calls.map(call => call.url), ['/api/seller/orders/order-uuid', '/api/marketplace/grpc/riders/rider%20one']);
  assert.ok(h.calls.every(call => call.init.headers.Authorization === 'Bearer seller-token' && call.init.cache === 'no-store'));
  for (const text of ['Example', '08000000000', 'Heading to pickup']) assert.ok(nodes(tree, node => node.props?.children === text).length, text);
  assert.equal([...h.timers.values()][0].ms, 15000);
  cleanup();
  assert.equal(h.timers.size, 0);
  assert.equal(h.focusListeners.size, 0);
  assert.equal(h.visibilityListeners.size, 0);
});

test('seller order with only DeliveryID resolves delivery assignment before fetching rider details', async () => {
  const h = pageHarness(url => Response.json(url.includes('/grpc/riders/')
    ? { data: { id: 'rider', name: 'Delivery Rider', phone: '08000000000' } }
    : url.includes('/marketplace/deliveries/') ? { data: { id: 'delivery', order_id: 'order-uuid', rider_id: 'rider', status: 'on_the_way' } }
    : { data: { ...fixture, DeliveryID: 'delivery', Status: 'processing' } }), 'VendorOrderDetail');
  h.render(); const cleanup = h.effects[0](); await settle();
  const tree = h.render();
  for (const value of ['Delivery', '08000000000', 'On the way to buyer']) assert.ok(nodes(tree, node => node.props?.children === value).length, value);
  assert.deepEqual(h.calls.map(call => call.url), ['/api/seller/orders/order-uuid', '/api/marketplace/deliveries/delivery', '/api/marketplace/grpc/riders/rider']);
  assert.ok(h.calls.every(call => call.init.headers.Authorization === 'Bearer seller-token'));
  cleanup();
});

test('missing assignment is explicit; hidden pages do not poll and refreshed assignment is loaded', async () => {
  let assigned = false;
  const h = pageHarness(url => url.includes('/grpc/riders/')
    ? Response.json({ data: { id: 'rider-2', name: 'New Rider' } })
    : url.includes('/marketplace/deliveries/') ? Response.json({ data: { id: 'delivery-1', order_id: 'order-uuid', status: 'requested', ...(assigned ? { rider_id: 'rider-2' } : {}) } })
    : Response.json({ data: { ...fixture, delivery_id: 'delivery-1', ...(assigned ? { rider_id: 'rider-2' } : {}) } }), 'VendorOrderDetail');
  h.render(); h.effects[0](); await settle();
  assert.equal(h.calls.length, 2);
  assert.ok(nodes(h.render(), node => node.props?.children === 'Rider assignment has not been reported.').length);
  assert.ok(nodes(h.render(), node => node.props?.children === 'Awaiting rider assignment').length);
  const poll = [...h.timers.values()][0].fn;
  h.document.visibilityState = 'hidden'; poll(); await settle();
  assert.equal(h.calls.length, 2);
  assigned = true; h.document.visibilityState = 'visible'; poll(); await settle(); await settle();
  assert.equal(h.calls.length, 5);
  assert.ok(nodes(h.render(), node => node.props?.children === 'New').length);
});

test('rider lookup failure preserves order details, clears old rider contact and offers refresh', async () => {
  let failed = false;
  const h = pageHarness(url => url.includes('/grpc/riders/')
    ? failed ? Response.json({ error: 'Rider service unavailable' }, { status: 503 }) : Response.json({ data: { id: 'rider', name: 'Old Rider', phone: '08000000000' } })
    : Response.json({ data: { ...fixture, rider_id: 'rider' } }), 'VendorOrderDetail');
  h.render(); h.effects[0](); await settle();
  assert.ok(nodes(h.render(), node => node.props?.children === 'Old').length);
  failed = true; [...h.timers.values()][0].fn(); await settle();
  const tree = h.render();
  assert.ok(nodes(tree, node => node.props?.children === 'Order Details').length);
  assert.ok(nodes(tree, node => node.props?.role === 'alert').length);
  assert.equal(nodes(tree, node => node.props?.children === 'Old').length, 0);
  assert.ok(nodes(tree, node => node.type === 'button' && node.props.children === 'Refresh tracking').length);
});

test('orders without delivery never query a rider and do not show rider progress', async () => {
  const h = pageHarness(() => Response.json({ data: { ...fixture, RequiresDelivery: false, rider_id: 'stale-rider' } }), 'VendorOrderDetail');
  h.render(); h.effects[0](); await settle();
  const tree = h.render();
  assert.equal(h.calls.length, 1);
  assert.ok(nodes(tree, node => node.props?.children === 'No rider delivery is required for this order.').length);
  assert.equal(nodes(tree, node => node.props?.children === 'Assigned rider').length, 0);
});

test('late tracking responses cannot populate another seller or an unmounted page', async () => {
  for (const cancel of [true, false]) {
    let finish;
    const h = pageHarness(() => new Promise(resolve => { finish = resolve; }), 'VendorOrderDetail');
    h.render(); const cleanup = h.effects[0]();
    if (cancel) cleanup(); else h.changeUser('other-seller');
    finish(Response.json({ data: { ...fixture, rider_id: 'private-rider' } })); await settle();
    assert.equal(h.calls.length, 1);
    assert.equal(nodes(h.render(), node => node.props?.children === 'Order Details').length, 0);
  }
});
