const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { orderDelivery, assignedRider, deliveryStatusLabel } = load('src/components/vendor/orderDelivery.ts');

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

test('mismatched riders, rejected payloads and missing contact are not displayed as confirmed rider details', () => {
  for (const payload of [{ data: { id: 'other-rider', name: 'Wrong Rider' } }, { success: false, message: 'Unavailable' }, { data: { success: false } }, { data: {} }]) {
    assert.throws(() => assignedRider(payload, 'rider'));
  }
});
