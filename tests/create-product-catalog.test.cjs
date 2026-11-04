const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the form's effect and rendered options without a browser or live account.
function formHarness(brandResponse) {
  const slots = [], effects = [], calls = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useEffect(effect) { effects.push(effect); },
  };
  const jsx = (type, props) => ({ type, props });
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/components/products/CreateProduct.jsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useRouter: () => ({}) };
      if (name.endsWith('authStorage')) return { getAuth: () => ({ access_token: 'test-token' }) };
      return {};
    },
    // Unexpected polling or focus subscriptions fail the test immediately.
    window: {}, localStorage: { getItem: () => null },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.includes('resource=brands')) return brandResponse();
      return Response.json({ data: [{ id: 'reference-id', name: 'Reference' }] });
    },
  });
  return {
    calls, effects,
    render() { cursor = 0; return loadedModule.exports.default({}); },
  };
}

function nodes(tree, match) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, match));
  if (!tree || typeof tree !== 'object') return [];
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}

test('catalog requests run once across effect replay and renders; brands include No brand', async () => {
  const harness = formHarness(() => Response.json({ data: { brands: [
    { brand_id: 'brand-one', brand_name: 'Acme' },
    { id: 'brand-two', name: 'Example' },
  ] } }));
  harness.render();
  const effect = harness.effects[0];
  effect()(); // React development setup/cleanup replay while the request is pending.
  const cleanup = effect();
  await new Promise(resolve => setImmediate(resolve));
  const tree = harness.render();
  const select = nodes(tree, node => node.type === 'select' && node.props.name === 'brand')[0];
  const options = nodes(select, node => node.type === 'option');
  assert.deepEqual(options.map(node => [node.props.value, node.props.children]), [
    ['', 'No brand'], ['brand-one', 'Acme'], ['brand-two', 'Example'],
  ]);
  assert.equal(select.props.disabled, false);
  assert.equal(harness.calls.length, 4);
  assert.equal(new Set(harness.calls.map(call => call.url)).size, 4);
  assert.equal(harness.calls.find(call => call.url.includes('resource=brands')).init.headers.Authorization, 'Bearer test-token');
  cleanup();
});

test('brand request failures display an error instead of reporting an empty catalog', async () => {
  const harness = formHarness(() => Response.json({ error: 'Unavailable' }, { status: 503 }));
  harness.render();
  const cleanup = harness.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  const tree = harness.render();
  assert.equal(nodes(tree, node => node.props?.role === 'alert')[0].props.children, 'Could not load brands (503).');
  assert.equal(nodes(tree, node => node.props?.children === 'No brands available yet.').length, 0);
  cleanup();
});
