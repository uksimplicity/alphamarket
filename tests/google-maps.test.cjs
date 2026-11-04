const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const original = { window: global.window, document: global.document, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
let scripts, timers;
beforeEach(() => {
  load.reset(); scripts = []; timers = new Set();
  global.window = new EventTarget();
  global.document = {
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { appendChild(script) { scripts.push(script); } },
  };
  global.setTimeout = callback => { timers.add(callback); return callback; };
  global.clearTimeout = callback => timers.delete(callback);
});
afterEach(() => Object.assign(global, original));
const api = () => load('src/components/commerce/googleMapsLoader.ts');
function ready() {
  window.google = { maps: { Map: class {}, Marker: class {} } };
  window.__alphaMapsReady();
}

test('concurrent map pickers share one script and loaded API', async () => {
  const loader = api();
  const first = loader.loadGoogleMaps('synthetic-key');
  const second = loader.loadGoogleMaps('synthetic-key');
  assert.equal(first, second); assert.equal(scripts.length, 1);
  assert.match(scripts[0].src, /^https:\/\/maps.googleapis.com\/maps\/api\/js\?/);
  ready();
  assert.equal(await first, window.google.maps);
  assert.equal(await loader.loadGoogleMaps('synthetic-key'), window.google.maps);
  assert.equal(timers.size, 0); assert.equal(scripts.length, 1);
});

test('network failure removes the script and allows a new attempt', async () => {
  const loader = api(); const first = loader.loadGoogleMaps('synthetic-key');
  scripts[0].onerror(); await assert.rejects(first, /could not be loaded/);
  assert.equal(scripts[0].removed, true); assert.equal(timers.size, 0);
  const retry = loader.loadGoogleMaps('synthetic-key'); ready();
  await retry; assert.equal(scripts.length, 2);
});

test('timeout and incomplete API reject and clean up loading callbacks', async () => {
  const loader = api(); const first = loader.loadGoogleMaps('synthetic-key');
  [...timers][0](); await assert.rejects(first, /could not be loaded/);
  assert.equal(window.__alphaMapsReady, undefined);
  const second = loader.loadGoogleMaps('synthetic-key');
  window.google = { maps: { Map: class {} } }; window.__alphaMapsReady();
  await assert.rejects(second, /could not be loaded/);
});

test('Google authorization failure rejects pending loads and notifies open maps', async () => {
  const loader = api(); let failures = 0;
  window.addEventListener(loader.mapsAuthFailureEvent, () => failures++);
  const first = loader.loadGoogleMaps('synthetic-key'); window.gm_authFailure();
  await assert.rejects(first, /could not be loaded/);
  assert.equal(failures, 1);
  await assert.rejects(loader.loadGoogleMaps('synthetic-key'), /unavailable/);
  assert.equal(scripts.length, 1);
});

test('missing key does not load a script', async () => {
  await assert.rejects(api().loadGoogleMaps('  '), /unavailable/);
  assert.equal(scripts.length, 0);
});
