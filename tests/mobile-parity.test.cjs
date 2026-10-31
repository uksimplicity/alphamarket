const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
let values, disk, auth;
beforeEach(() => {
  load.reset(); values = new Map();
  disk = { fail: false, getItem: key => values.get(key) ?? null, setItem(key, value) { if (this.fail) throw new Error('Storage full'); values.set(key, value); }, removeItem: key => values.delete(key) };
  global.localStorage = disk; global.window = new EventTarget(); window.localStorage = disk;
  auth = load('src/components/auth/authStorage.ts');
  auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer-a', role: 'buyer' } });
});
afterEach(() => { delete global.window; delete global.localStorage; });
const addresses = () => load('src/components/commerce/addresses.ts');
const input = { label: 'Home', address: 'Lekki entrance', contact: '08012345678', latitude: 6.5, longitude: 3.3 };
test('address records preserve defaults, edits and account separation across reloads', () => {
  const api = addresses(), row = api.saveAddress(input, true);
  assert.equal(api.readAddresses().defaultId, row.id);
  api.saveAddress({ ...input, address: 'Updated gate' }, true, row.id);
  assert.equal(api.readAddresses().addresses[0].address, 'Updated gate');
  auth.setAuth({ access_token: 'other-token', user: { id: 'buyer-b', role: 'buyer' } });
  assert.equal(api.readAddresses().addresses.length, 0);
  auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer-a', role: 'buyer' } });
  assert.equal(api.readAddresses().addresses[0].id, row.id);
  api.deleteAddress(row.id);
  assert.deepEqual(api.readAddresses(), { addresses: [], defaultId: null });
});
test('invalid coordinates, unknown edits and failed saves preserve storage', () => {
  const api = addresses(); api.saveAddress(input, false); const before = [...values];
  for (const point of [{ latitude: 91 }, { longitude: Infinity }, { address: '' }]) assert.throws(() => api.saveAddress({ ...input, ...point }, false));
  assert.throws(() => api.saveAddress(input, false, 'unknown'));
  disk.fail = true; assert.throws(() => api.saveAddress(input, true), /could not save/);
  assert.deepEqual([...values], before);
  assert.equal(api.deliveryPoint('0', '0').latitude, 0);
  assert.equal(api.deliveryPoint('', '3'), null);
});
test('damaged address data requires explicit reset and is not silently overwritten', () => {
  const api = addresses(); api.saveAddress(input, false);
  const key = [...values.keys()].find(key => key.includes(':addresses:'));
  values.set(key, 'broken');
  assert.throws(() => api.readAddresses(), /Saved data could not/);
  assert.throws(() => api.saveAddress(input, true)); assert.equal(values.get(key), 'broken');
  api.resetAddresses(); assert.equal(api.readAddresses().addresses.length, 0);
});
test('notification choices default off, persist and roll back failed writes', () => {
  const api = load('src/components/commerce/notificationPreferences.ts');
  assert.ok(Object.values(api.readNotificationChoices()).every(v => v === false));
  api.saveNotificationChoice('sound', true); assert.equal(api.readNotificationChoices().sound, true);
  disk.fail = true; assert.throws(() => api.saveNotificationChoice('sound', false));
  assert.equal(api.readNotificationChoices().sound, true);
  disk.fail = false; api.resetNotificationChoices(); assert.equal(api.readNotificationChoices().sound, false);
});
test('review drafts retain text and rating, allow partial drafts and never cross account/order', () => {
  const api = load('src/components/commerce/reviewDrafts.ts');
  api.saveReviewDraft('one', { rating: 0, text: 'Still writing' });
  assert.deepEqual(api.readReviewDraft('one'), { rating: 0, text: 'Still writing' });
  assert.equal(api.readReviewDraft('two'), null);
  assert.throws(() => api.saveReviewDraft('one', { rating: 6, text: 'Invalid' }));
  assert.throws(() => api.saveReviewDraft('one', { rating: 0, text: '' }));
  auth.setAuth({ access_token: 'other', user: { id: 'buyer-b' } });
  assert.equal(api.readReviewDraft('one'), null);
  auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer-a' } });
  api.discardReviewDraft('one'); assert.equal(api.readReviewDraft('one'), null);
});
test('account stamps reject delayed actions even after signing back into the same account', () => {
  const api = load('src/components/commerce/localAccountData.ts'); const stamp = api.accountStamp();
  auth.clearAuth(); auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer-a' } });
  assert.throws(() => api.checkAccount(stamp), /account changed/);
});
test('cart storage is separated by account and keeps original guest data separate', () => {
  const cart = load('src/components/commerce/store.ts');
  cart.addToCart({ id: 'chair', name: 'Chair', price: 12.5 }, 2);
  assert.equal(cart.cartSubtotal(cart.getCart()), 25);
  auth.setAuth({ access_token: 'other', user: { id: 'buyer-b' } }); assert.equal(cart.getCart().items.length, 0);
  auth.clearAuth(); cart.addToCart({ id: 'guest', name: 'Guest chair', price: 4 });
  auth.setAuth({ access_token: 'buyer-token', user: { id: 'buyer-a' } }); assert.equal(cart.getCart().items[0].id, 'chair');
});
test('checkout recovery migrates only matching legacy records and remains account-scoped', () => {
  const api = load('src/components/commerce/payments.ts');
  const raw = JSON.stringify({ buyerId: 'buyer-a', orderIds: ['order'], submitted: true });
  values.set(api.PENDING_CHECKOUT_KEY, raw);
  assert.equal(api.readSavedCheckout(disk, 'buyer-b'), null);
  assert.equal(api.readSavedCheckout(disk, 'buyer-a'), raw);
  assert.equal(values.get(api.PENDING_CHECKOUT_KEY), undefined);
  assert.equal(values.get(api.checkoutStorageKey('buyer-a')), raw);
  assert.notEqual(api.checkoutStorageKey('buyer-a'), api.checkoutStorageKey('buyer-b'));
});
test('session validation checks backend identity and role, and JWT expiry is only a hint', () => {
  const api = load('src/components/auth/sessionValidation.ts'); const saved = auth.getAuth();
  assert.equal(api.verifiedProfile({ data: { user: { id: 'buyer-a', role: 'buyer' } } }, { ...saved, user: { id: 'buyer-a', role: 'seller' } }).role, 'buyer');
  assert.throws(() => api.verifiedProfile({ data: { id: 'someone-else', role: 'seller' } }, saved), /does not match/);
  assert.throws(() => api.verifiedProfile({ data: {} }, saved), /did not identify/);
  const jwt = exp => 'header.' + Buffer.from(JSON.stringify({ exp })).toString('base64url') + '.signature';
  assert.equal(api.tokenExpired(jwt(1), 2000), true); assert.equal(api.tokenExpired(jwt(10), 2000), false);
  assert.equal(api.tokenExpired('not-a-jwt'), false);
  assert.throws(() => auth.setAuth({ access_token: '', user: { id: 'bad' } }), /invalid session/);
});

test('Google Maps script loads once on demand and resolves through the ready callback', async () => {
  const scripts = [];
  global.document = { createElement: () => ({ remove() {} }), head: { appendChild: script => scripts.push(script) } };
  try {
    const maps = load('src/components/commerce/googleMapsLoader.ts');
    const first = maps.loadGoogleMaps('public-key'), second = maps.loadGoogleMaps('public-key');
    assert.equal(scripts.length, 1); assert.equal(first, second);
    assert.match(scripts[0].src, /callback=__alphaMapsReady/);
    const api = { Map: class {} }; window.google = { maps: api }; window.__alphaMapsReady();
    assert.equal(await first, api); assert.equal(await maps.loadGoogleMaps('public-key'), api);
    assert.equal(scripts.length, 1);
  } finally { delete global.document; }
});
test('failed map loading can be retried without marking a location as selected', async () => {
  const scripts = [];
  global.document = { createElement: () => ({ remove() {} }), head: { appendChild: script => scripts.push(script) } };
  try {
    const maps = load('src/components/commerce/googleMapsLoader.ts');
    const failed = assert.rejects(maps.loadGoogleMaps('public-key'), /could not be loaded/);
    scripts[0].onerror(); await failed;
    const retry = maps.loadGoogleMaps('public-key'); assert.equal(scripts.length, 2);
    window.google = { maps: { Map: class {} } }; window.__alphaMapsReady(); await retry;
    assert.deepEqual(maps.mapPoint({ latitude: -33.5, longitude: 18.4 }), { lat: -33.5, lng: 18.4 });
  } finally { delete global.document; }
});
