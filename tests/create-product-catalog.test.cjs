const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the form's effect and rendered options without a browser or live account.
function formHarness(brandResponse, createResponse, sellerFields = {}) {
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
      if (name.endsWith('authStorage')) return { getAuth: () => ({ access_token: 'test-token', user: { id: 'seller-one', status: 'active', ...sellerFields } }) };
      if (name.endsWith('localAccountData')) return { accountStamp: () => 'seller-one', checkAccount: () => {} };
      if (name.endsWith('sellerProductForm')) return { uploadProductMedia: async () => 'https://images.example/chair.png' };
      return {};
    },
    // Unexpected polling or focus subscriptions fail the test immediately.
    window: {}, localStorage: { getItem: () => null },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (init?.method === 'POST' && createResponse) return createResponse();
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

async function prepareProduct(harness, fields = {}) {
  harness.render();
  const cleanups = harness.effects.map(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  const tree = harness.render();
  for (const [name, value] of Object.entries({
    name: 'Chair', category: 'category-one', type: 'type-one',
    basePrice: '5000', shortDescription: 'An actual chair', brand: '',
    location: '  Lagos  ',
    ...fields,
  })) {
    nodes(tree, node => node.props?.name === name)[0].props.onChange({ target: { name, value } });
  }
  nodes(tree, node => node.type === 'input' && node.props.type === 'file')[0].props.onChange({
    target: { files: [{ name: 'chair.png', size: 100 }] },
  });
  return () => cleanups.forEach(cleanup => cleanup?.());
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

test('No brand submits no brand ID and does not retry a rejected product creation', async () => {
  const backendError = 'ERROR: insert or update on table "products" violates foreign key constraint "fk_products_brand" (SQLSTATE 23503)';
  const harness = formHarness(
    () => Response.json({ data: { brands: [] } }),
    () => Response.json({ error: backendError }, { status: 500 })
  );
  const cleanup = await prepareProduct(harness);
  const tree = harness.render();
  await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  const writes = harness.calls.filter(call => call.init?.method === 'POST');
  assert.equal(writes.length, 1);
  const body = JSON.parse(writes[0].init.body);
  assert.equal(writes[0].url, '/api/seller/products');
  assert.equal(body.name, 'Chair');
  for (const key of ['brandId', 'brandName', 'brand_id', 'brand']) assert.equal(Object.hasOwn(body, key), false);
  assert.equal(nodes(harness.render(), node => node.props?.className === 'form-error')[0].props.children, backendError);
  cleanup();
});

for (const scenario of [
  { title: 'a typed brand name', fields: { brandName: '  Acme  ' }, expected: { brandName: 'Acme' } },
  { title: 'a selected brand instead of a previously typed name', fields: { brand: '4ba87dfb-1aa4-40a1-9872-f7957e1834d1', brandName: 'Acme' }, expected: { brandId: '4ba87dfb-1aa4-40a1-9872-f7957e1834d1' } },
  { title: 'automatic identification for a blank brand name', fields: { brandName: '   ' }, expected: {} },
  { title: 'a brand name at the documented length limit', fields: { brandName: 'A'.repeat(150) }, expected: { brandName: 'A'.repeat(150) } },
]) {
  test(`create payload uses ${scenario.title}`, async () => {
    const harness = formHarness(() => Response.json({ data: [] }), () => Response.json({ error: 'Synthetic rejection' }, { status: 400 }));
    const cleanup = await prepareProduct(harness, scenario.fields);
    const tree = harness.render();
    const brandNameInput = nodes(tree, node => node.props?.name === 'brandName')[0];
    assert.ok(brandNameInput, 'The optional brand-name field remains visible');
    assert.equal(brandNameInput.props.disabled, Boolean(scenario.fields.brand));
    await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    const writes = harness.calls.filter(call => call.init?.method === 'POST');
    assert.equal(writes.length, 1);
    const body = JSON.parse(writes[0].init.body);
    const brandFields = Object.fromEntries(Object.entries(body).filter(([key]) => key === 'brandId' || key === 'brandName'));
    assert.deepEqual(brandFields, scenario.expected);
    for (const key of ['basePrice', 'categoryId', 'name', 'productTypeId', 'sellerId', 'slug']) assert.ok(body[key], `Required field: ${key}`);
    cleanup();
  });
}

test('overlong brand names are rejected before product submission', async () => {
  const harness = formHarness(() => Response.json({ data: [] }));
  const cleanup = await prepareProduct(harness, { brandName: 'A'.repeat(151) });
  await nodes(harness.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(harness.calls.some(call => call.init?.method === 'POST'), false);
  assert.equal(nodes(harness.render(), node => node.props?.className === 'form-error')[0].props.children, 'Brand name must be 150 characters or fewer.');
  cleanup();
});

test('seller types a city and sends trimmed location with no city lookup, ID, address or coordinates', async () => {
  const harness = formHarness(() => Response.json({ data: [] }), () => Response.json({ error: 'Synthetic rejection' }, { status: 400 }));
  const cleanup = await prepareProduct(harness, { location: '  Port Harcourt  ' });
  const field = nodes(harness.render(), node => node.props?.name === 'location')[0];
  assert.equal(field.type, 'input');
  assert.equal(field.props.type, 'text');
  await nodes(harness.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  const writes = harness.calls.filter(call => call.init?.method === 'POST');
  assert.equal(writes.length, 1);
  const body = JSON.parse(writes[0].init.body);
  assert.equal(body.location, 'Port Harcourt');
  for (const key of ['locationId', 'address', 'latitude', 'longitude']) assert.equal(Object.hasOwn(body,key),false);
  assert.equal(harness.calls.some(call => call.url.includes('/locations')), false);
  cleanup();
});

test('blank city blocks product submission', async () => {
  const harness = formHarness(() => Response.json({ data: [] }));
  const cleanup = await prepareProduct(harness, { location: '   ' });
  await nodes(harness.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(harness.calls.some(call => call.init?.method === 'POST'), false);
  assert.equal(nodes(harness.render(), node => node.props?.className === 'form-error')[0].props.children, 'Enter the city where this product is located.');
  cleanup();
});

test('typed city retains saved seller coordinates from the pre-map submission contract', async () => {
  for (const seller of [
    { latitude: 5.52, longitude: 5.75 },
    { lat: '5.52', lng: '5.75' },
    { profile: { latitude: '5.52', longitude: '5.75' } },
    { profile: { lat: 5.52, lng: 5.75 } },
  ]) {
    const harness = formHarness(() => Response.json({ data: [] }), () => Response.json({ error: 'Synthetic rejection' }, { status: 400 }), seller);
    const cleanup = await prepareProduct(harness, { location: '  Warri  ' });
    await nodes(harness.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    const writes = harness.calls.filter(call => call.init?.method === 'POST');
    assert.equal(writes.length, 1);
    const body = JSON.parse(writes[0].init.body);
    assert.equal(body.location, 'Warri');
    assert.equal(body.latitude, 5.52); assert.equal(body.longitude, 5.75);
    assert.equal(Object.hasOwn(body, 'locationId'), false);
    assert.equal(Object.hasOwn(body, 'address'), false);
    cleanup();
  }
});

test('missing or invalid saved seller coordinates are not replaced with invented values', async () => {
  const harness = formHarness(() => Response.json({ data: [] }), () => Response.json({ error: 'Synthetic rejection' }, { status: 400 }), { latitude: 'bad', longitude: '' });
  const cleanup = await prepareProduct(harness);
  await nodes(harness.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  const body = JSON.parse(harness.calls.find(call => call.init?.method === 'POST').init.body);
  assert.equal(Object.hasOwn(body, 'latitude'), false);
  assert.equal(Object.hasOwn(body, 'longitude'), false);
  cleanup();
});

