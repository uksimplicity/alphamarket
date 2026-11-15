const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./support/load-ts.cjs');

function harness(lookup) {
  const slots = [], effects = [], timers = [], confirmations = [];
  let cursor = 0, changedAccount = false;
  const jsx = (type, props) => ({ type, props });
  const loadedModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/products/ProductPickupLocation.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: loadedModule, exports: loadedModule.exports, process: { env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'synthetic-key' } },
    setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useEffect(effect) { effects.push(effect); },
      };
      if (name.endsWith('/addresses')) return load('src/components/commerce/addresses.ts');
      if (name.endsWith('/geocodeAddress')) return { geocodeDeliveryAddress: lookup };
      if (name.endsWith('/deliveryLocation')) return { default: 'map-picker' };
      if (name.endsWith('/localAccountData')) return { accountStamp: () => 'seller', checkAccount: () => { if (changedAccount) throw new Error('Account changed'); } };
      throw new Error(name);
    },
  });
  return {
    effects, timers, confirmations, changedAccount: () => { changedAccount = true; },
    valid: loadedModule.exports.validPickupPoint,
    render(props = {}) { cursor = 0; return loadedModule.exports.default({ address: '12B Example Street, Ikeja, Lagos, Nigeria', complete: true, disabled: false, confirmed: false, onConfirm: point => confirmations.push(point), ...props }); },
  };
}
function nodes(tree, match) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, match));
  if (!tree || typeof tree !== 'object') return [];
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('address lookup proposes a point and requires explicit confirmation', async () => {
  let requested;
  const h = harness(async (address, key) => { requested = { address, key }; return { latitude: 6.6, longitude: 3.4 }; });
  h.render(); h.effects[0](); h.timers[0](); await settle();
  assert.match(requested.address, /Example Street/);
  assert.equal(requested.key, 'synthetic-key');
  assert.equal(h.confirmations.length, 0);
  nodes(h.render(), node => node.props?.children === 'Confirm pickup location')[0].props.onClick();
  assert.equal(h.confirmations[0].latitude, 6.6);
});

test('failed lookup permits map confirmation without inventing coordinates', async () => {
  const h = harness(async () => { throw new Error('Lookup unavailable'); });
  h.render(); h.effects[0](); h.timers[0](); await settle();
  const map = nodes(h.render(), node => node.type === 'map-picker')[0];
  assert.equal(map.props.point, null);
  assert.equal(h.confirmations.length, 0);
  map.props.onConfirm({ latitude: 6.7, longitude: 3.5 });
  assert.equal(h.confirmations[0].longitude, 3.5);
});

test('late lookup after address unmount is ignored; incomplete or disabled forms do not geocode', async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  h.render(); const cleanup = h.effects[0](); h.timers[0](); cleanup();
  finish({ latitude: 6.6, longitude: 3.4 }); await settle();
  assert.equal(nodes(h.render(), node => node.props?.children === 'Confirm pickup location').length, 0);
  for (const props of [{ complete: false }, { disabled: true }]) {
    const blocked = harness(() => { throw new Error('Must not geocode'); });
    blocked.render(props); blocked.effects[0](); assert.equal(blocked.timers.length, 0);
  }
});

test('zero or invalid points and account switches cannot confirm', () => {
  const h = harness(async () => null);
  const map = nodes(h.render(), node => node.type === 'map-picker')[0];
  for (const point of [null, { latitude: 0, longitude: 0 }, { latitude: NaN, longitude: 3 }, { latitude: 6, longitude: 200 }]) {
    assert.equal(h.valid(point), false);
    map.props.onConfirm(point);
  }
  h.changedAccount(); map.props.onConfirm({ latitude: 6.6, longitude: 3.4 });
  assert.equal(h.confirmations.length, 0);
});
