const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { orderDelivery } = load('src/components/vendor/orderDelivery.ts');
const { loadOrderRiderTracking } = load('src/components/commerce/orderRiderTracking.ts');

test('delivery ID resolves the matching delivery, assignment, acceptance and rider contact in sequence', async () => {
  const calls = [];
  const result = await loadOrderRiderTracking(async path => {
    calls.push(path);
    return calls.length === 1 ? { data: { delivery: { ID: 'delivery one', OrderID: 'order', RiderID: 'rider one', Status: 'assigned', AcceptedAt: '2026-11-17T10:00:00Z' } } }
      : { data: { id: 'rider one', name: 'Assigned Rider', phone: '08000000000' } };
  }, orderDelivery({ DeliveryID: 'delivery one', Status: 'processing' }), 'order');
  assert.deepEqual(calls, ['/api/marketplace/deliveries/delivery%20one', '/api/marketplace/grpc/riders/rider%20one']);
  assert.equal(result.tracking.riderId, 'rider one');
  assert.equal(result.tracking.status, 'assigned');
  assert.equal(result.tracking.accepted, true);
  assert.deepEqual(result.rider, { name: 'Assigned Rider', phone: '08000000000' });
});

test('unassigned deliveries do not query riders; no-delivery orders do not query either endpoint', async () => {
  const calls = [];
  const request = async path => { calls.push(path); return { data: { id: 'delivery', order_id: 'order', status: 'requested', rider_id: null } }; };
  const result = await loadOrderRiderTracking(request, orderDelivery({ delivery_id: 'delivery' }), 'order');
  assert.equal(result.tracking.status, 'requested');
  assert.equal(result.rider, null);
  assert.equal(calls.length, 1);
  await loadOrderRiderTracking(request, orderDelivery({ requires_delivery: false, delivery_id: 'delivery' }), 'order');
  assert.equal(calls.length, 1);
});

test('delivery progress is refreshed even when the order already has an assigned rider', async () => {
  for (const status of ['picking_up', 'on_the_way', 'delivered', 'completed']) {
    const calls = [];
    const result = await loadOrderRiderTracking(async path => {
      calls.push(path);
      return path.includes('/deliveries/')
        ? { data: { id: 'delivery', order_id: 'order', rider_id: 'rider', status } }
        : { data: { id: 'rider', name: 'Rider' } };
    }, orderDelivery({ delivery_id: 'delivery', rider_id: 'rider', delivery_status: 'assigned' }), 'order');
    assert.equal(result.tracking.status, status);
    assert.equal(calls[0], '/api/marketplace/deliveries/delivery');
    assert.equal(calls[1], '/api/marketplace/grpc/riders/rider');
  }
});

test('wrong delivery, wrong order, missing identity and logical failures cannot disclose a rider', async () => {
  for (const payload of [{ data: { id: 'other', rider_id: 'private' } }, { data: { id: 'delivery', order_id: 'other', rider_id: 'private' } }, { data: { rider_id: 'private' } }, { success: false, error: 'Unauthorized' }]) {
    let calls = 0;
    const result = await loadOrderRiderTracking(async () => { calls++; return payload; }, orderDelivery({ delivery_id: 'delivery' }), 'order');
    assert.equal(calls, 1); assert.equal(result.rider, null); assert.equal(result.tracking.riderId, ''); assert.ok(result.riderError);
  }
});

test('delivery denial preserves order tracking; rider denial preserves the resolved delivery progress', async () => {
  const original = orderDelivery({ delivery_id: 'delivery' });
  const denied = await loadOrderRiderTracking(async () => { throw new Error('Insufficient permissions'); }, original, 'order');
  assert.equal(denied.tracking, original); assert.match(denied.riderError, /permissions/);
  let count = 0;
  const result = await loadOrderRiderTracking(async () => {
    if (++count === 1) return { data: { id: 'delivery', status: 'picking_up', rider_id: 'rider' } };
    throw new Error('Rider lookup denied');
  }, original, 'order');
  assert.equal(result.tracking.status, 'picking_up'); assert.equal(result.tracking.riderId, 'rider'); assert.equal(result.rider, null); assert.match(result.riderError, /denied/);
});

test('an assigned rider can be identified from the order even when delivery tracking is denied', async () => {
  const result = await loadOrderRiderTracking(async path => {
    if (path.includes('/deliveries/')) throw new Error('Delivery access denied');
    return { data: { id: 'rider', first_name: 'Ada', last_name: 'Jones' } };
  }, orderDelivery({ delivery_id: 'delivery', rider_id: 'rider' }), 'order');
  assert.equal(result.rider.name, 'Ada Jones');
  assert.match(result.riderError, /Delivery access denied/);
});

test('delivery proxy uses only customer delivery endpoint with caller auth and preserves access denials', async () => {
  const { GET } = load('src/app/api/marketplace/deliveries/[id]/route.ts');
  const previousFetch = global.fetch, previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const calls = [];
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://example.test/api/v1';
  try {
    global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ error: 'Unauthorized' }, { status: 403 }); };
    const context = { params: Promise.resolve({ id: 'delivery one' }) };
    assert.equal((await GET(new Request('https://local.test/api'), context)).status, 401);
    assert.equal(calls.length, 0);
    const response = await GET(new Request('https://local.test/api', { headers: { Authorization: 'Bearer seller-token' } }), context);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match((await response.json()).error, /did not grant access/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://example.test/api/v1/rider-app/deliveries/delivery%20one');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer seller-token');
    assert.equal(calls[0].init.redirect, 'manual');
  } finally { global.fetch = previousFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; }
});
