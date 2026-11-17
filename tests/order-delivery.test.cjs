const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { orderDelivery, assignedRider, deliveryStatusLabel, orderDeliveryLabel } = load('src/components/vendor/orderDelivery.ts');

test('delivery status and assignment come from explicit fields, never order state or delivery ID alone', () => {
  const unknown = orderDelivery({ status: 'shipped', delivery_id: 'delivery-only' });
  assert.equal(unknown.status, '');
  assert.equal(unknown.riderId, '');
  assert.equal(deliveryStatusLabel(unknown.status), 'Not reported');
  assert.equal(orderDelivery({ delivery: { status: 'picked_up', rider_id: 'rider' } }).status, 'picked_up');
  assert.equal(orderDelivery({ RiderID: 'rider', DeliveryStatus: 'assigned' }).riderId, 'rider');
  assert.equal(deliveryStatusLabel('picked_up'), 'Collected');
});

test('rider parsing supports nested contact details without treating availability as delivery progress', () => {
  const rider = assignedRider({ data: { rider: { id: 'rider', user: { first_name: 'Example', last_name: 'Rider', phone_number: '08000000000' }, availability: 'online' } } }, 'rider');
  assert.deepEqual(rider, { name: 'Example Rider', phone: '08000000000' });
});

test('rider acceptance is distinguished from assignment without confusing seller order acceptance', () => {
  const assignment = orderDelivery({ DeliveryStatus: 'assigned', RiderID: 'rider', accepted_at: '2026-11-17T10:00:00Z' });
  assert.equal(assignment.accepted, false);
  assert.equal(orderDeliveryLabel(assignment), 'Rider assigned');
  const accepted = orderDelivery({ delivery: { status: 'assigned', rider_id: 'rider', accepted_at: '2026-11-17T10:00:00Z' } });
  assert.equal(accepted.status, 'assigned');
  assert.equal(accepted.accepted, true);
  assert.equal(orderDeliveryLabel(accepted), 'Rider accepted');
  assert.equal(orderDeliveryLabel(orderDelivery({ DeliveryStatus: 'assigned', RiderAcceptedAt: '2026-11-17T10:00:00Z' })), 'Rider accepted');
  assert.equal(orderDeliveryLabel(orderDelivery({ delivery: { status: 'assigned', acceptance_status: 'accepted' } })), 'Rider accepted');
  assert.equal(orderDelivery({ delivery: { status: 'assigned', accepted_at: 'invalid' } }).accepted, false);
  assert.equal(orderDeliveryLabel(orderDelivery({ delivery: { status: 'cancelled', accepted_at: '2026-11-17T10:00:00Z' } })), 'Cancelled');
});

test('rider package progress has readable labels while missing tracking stays explicit', () => {
  assert.equal(deliveryStatusLabel('requested'), 'Awaiting rider assignment');
  assert.equal(deliveryStatusLabel('picking_up'), 'Heading to pickup');
  assert.equal(deliveryStatusLabel('on_the_way'), 'On the way to buyer');
  assert.equal(deliveryStatusLabel('completed'), 'Delivery completed');
  assert.equal(orderDeliveryLabel(orderDelivery({ status: 'completed', delivery_id: 'delivery' })), 'Awaiting delivery update');
  assert.equal(orderDeliveryLabel(orderDelivery({ rider_id: 'rider' })), 'Rider assigned');
  assert.equal(orderDeliveryLabel(orderDelivery({ RequiresDelivery: false })), 'No rider delivery required');
});

test('mismatched riders, rejected payloads and missing contact are not displayed as confirmed rider details', () => {
  for (const payload of [{ data: { id: 'other-rider', name: 'Wrong Rider' } }, { success: false, message: 'Unavailable' }, { data: { success: false } }, { data: {} }]) {
    assert.throws(() => assignedRider(payload, 'rider'));
  }
});
