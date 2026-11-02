const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originalWindow = global.window;
let results, status, request, finish;
const exact = () => ({ types: ['street_address'], geometry: { location_type: 'ROOFTOP', location: { lat: () => 6.6, lng: () => 3.4 } } });
beforeEach(() => {
  load.reset(); results = [exact()]; status = 'OK'; request = null; finish = null;
  global.window = { google: { maps: { Map: class {}, Geocoder: class {
    geocode(value, callback) { request = value; finish = () => callback(results, status); queueMicrotask(finish); }
  } } } };
});
afterEach(() => { global.window = originalWindow; });
const locate = address => load('src/components/commerce/geocodeAddress.ts').geocodeDeliveryAddress(address, 'synthetic-key');
test('typed address resolves to internal delivery coordinates', async () => {
  assert.deepEqual(await locate('  25 Example Street, Lagos  '), { latitude: 6.6, longitude: 3.4 });
  assert.deepEqual(request, { address: '25 Example Street, Lagos', region: 'ng' });
});
test('interpolated building address is accepted', async () => {
  results[0].geometry.location_type = 'RANGE_INTERPOLATED';
  assert.equal((await locate('25 Example Street, Lagos')).latitude, 6.6);
});
test('partial, ambiguous, street-only and approximate matches require confirmation', async () => {
  for (const candidate of [
    [{ ...exact(), partial_match: true }], [exact(), exact()],
    [{ ...exact(), types: ['route'] }],
    [{ ...exact(), geometry: { ...exact().geometry, location_type: 'APPROXIMATE' } }], [],
  ]) {
    results = candidate;
    await assert.rejects(locate('Example address'), /city and state|exact delivery location/);
  }
});
test('out of range coordinates are rejected', async () => {
  results[0].geometry.location.lat = () => 100;
  await assert.rejects(locate('Example address'), /exact delivery location/);
});
test('no results and service failures leave actionable fallback', async () => {
  status = 'ZERO_RESULTS'; await assert.rejects(locate('Unknown address'), /city and state/);
  status = 'REQUEST_DENIED'; await assert.rejects(locate('Example address'), /couldn't locate.*map/);
});
test('empty address and unavailable geocoder reject without storing anything', async () => {
  await assert.rejects(locate(' '), /full delivery address/);
  delete window.google.maps.Geocoder;
  await assert.rejects(locate('Example address'), /couldn't locate/);
});
test('lookup timeout returns fallback rather than hanging save', async () => {
  const originalTimer = global.setTimeout;
  let expire;
  global.setTimeout = callback => { const timer = originalTimer(() => {}, 10000); expire = () => { clearTimeout(timer); callback(); }; return timer; };
  window.google.maps.Geocoder = class { geocode() {} };
  try {
    const pending = locate('Example address');
    await Promise.resolve();
    expire();
    await assert.rejects(pending, /couldn't locate/);
  } finally { global.setTimeout = originalTimer; }
});