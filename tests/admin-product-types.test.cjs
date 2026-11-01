const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const catalog = load('src/components/admin/catalogRecords.ts');
const { productTypeResponseError } = load('src/components/admin/productTypeResponse.ts');
const originalFetch = global.fetch;
test.afterEach(() => { global.fetch = originalFetch; });

test('the reported 200 OK products payload is rejected as a product type response', () => {
  assert.match(productTypeResponseError({ success: true, data: { products: [], total: 0, limit: 100, offset: 0 } }), /products collection instead of product types/);
  assert.equal(productTypeResponseError({ success: true, data: { product_types: [], total: 0 } }), null);
  assert.equal(productTypeResponseError({ success: true, data: [{ id: 'type', name: 'Kit' }] }), null);
});

test('product type proxy uses documented catalog endpoints and surfaces a wrong collection', async () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example.test/api/v1';
  load.reset();
  try {
    const route = load('src/app/api/admin/[...path]/route.ts');
    const context = { params: Promise.resolve({ path: ['product-types'] }) };
    const calls = [];
    global.fetch = async (url, init) => {
      calls.push({ url, init });
      return Response.json({ success: true, data: { products: [], total: 0, limit: 100, offset: 0 } });
    };
    const request = () => new Request('http://localhost/api/admin/product-types?limit=100', { headers: { Authorization: 'Bearer synthetic-admin' } });
    const response = await route.GET(request(), context);
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /products collection/);
    assert.equal(response.headers.get('X-Admin-Upstream-Path'), '/api/v1/admin/product-types');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://backend.example.test/api/v1/admin/product-types?limit=100');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer synthetic-admin');
    assert.equal(calls[1].url, 'https://backend.example.test/api/v1/seller/product-types?limit=100');
    assert.equal(calls[1].init.headers.Authorization, 'Bearer synthetic-admin');
    global.fetch = async (url, init) => {
      calls.push({ url, init });
      return url.includes('/admin/') ? Response.json({ data: { products: [], total: 0 } }) : Response.json({ data: { product_types: [{ id: 'saved-type', name: 'Jerseys' }] } });
    };
    const recovered = await route.GET(request(), context);
    assert.equal(recovered.status, 200);
    assert.equal((await recovered.json()).data.product_types[0].name, 'Jerseys');
    assert.equal(recovered.headers.get('X-Admin-Upstream-Path'), '/api/v1/seller/product-types');
    assert.equal(calls.length, 4);
    global.fetch = async url => { calls.push({ url }); return Response.json({ error: 'Not found' }, { status: 404 }); };
    assert.equal((await route.GET(request(), context)).status, 404);
    assert.equal(calls.length, 5);
    global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ data: { products: [] } }); };
    const writeResponse = await route.POST(new Request('http://localhost/api/admin/product-types', { method: 'POST', body: '{"name":"Jerseys"}' }), context);
    assert.equal(writeResponse.status, 502);
    assert.equal(calls.length, 6);
    global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ error: 'Unavailable' }, { status: 503 }); };
    await route.DELETE(new Request('http://localhost/api/admin/product-types/saved-type', { method: 'DELETE' }), { params: Promise.resolve({ path: ['product-types', 'saved-type'] }) });
    assert.equal(calls.length, 7);
    global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ error: 'Forbidden' }, { status: 403 }); };
    assert.equal((await route.GET(request(), context)).status, 403);
    assert.equal(calls.length, 8);
  } finally {
    if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase;
  }
});

test('single create responses and nested lists preserve the actual type ID and category', () => {
  const item = { id: 'type-one', name: 'Jerseys', category: { id: 'sports', name: 'Sportswear' } };
  for (const payload of [item, { data: item }, { data: { product_type: item } }, { data: { product_types: [item] } }]) {
    const [type] = catalog.parseCatalogItems(payload);
    assert.equal(type.id, 'type-one');
    assert.equal(type.categoryId, 'sports');
    assert.equal(type.categoryName, 'Sportswear');
    assert.equal(catalog.parseCatalogItems(payload).length, 1);
  }
});

test('collection parsing preserves legacy service-specific arrays for types and categories', () => {
  const types = { data: { available_types: [{ id: 'type-one', name: 'Jerseys', category_id: 'sports' }] } };
  assert.equal(catalog.parseCatalogItems(types)[0].name, 'Jerseys');
  assert.equal(catalog.parseCatalogItems(types)[0].categoryId, 'sports');
  const categories = { data: { category_list: [{ id: 'sports', name: 'Sportswear' }] } };
  assert.equal(catalog.parseCatalogItems(categories)[0].name, 'Sportswear');
});

test('admin parsing accepts the same case and field aliases as the seller form', () => {
  const config = { idKeys: ['id', 'uuid', 'product_type_id', 'type_id'], nameKeys: ['name', 'title', 'product_type', 'type_name'] };
  for (const row of [
    { ID: 'type-one', Name: 'Jerseys', CategoryID: 'sports', Category: { ID: 'sports', Name: 'Sportswear' } },
    { productTypeId: 'type-one', productTypeName: 'Jerseys', categoryId: 'sports', parentCategory: { id: 'sports', name: 'Sportswear' } },
    { typeId: 'type-one', label: 'Jerseys', category_name: 'Sportswear', category_id: 'sports' },
  ]) {
    const [item] = catalog.parseCatalogItems({ Data: { Catalog: { Types: [row] } } }, config);
    assert.equal(item.id, 'type-one');
    assert.equal(item.name, 'Jerseys');
    assert.equal(item.categoryId, 'sports');
    assert.equal(item.categoryName, 'Sportswear');
  }
});

test('a nested category is not substituted for an unreadable product type', () => {
  const rows = catalog.parseCatalogItems({ data: [{ ID: 'type-one', Category: { ID: 'sports', Name: 'Sportswear' } }] }, {
    idKeys: ['id', 'product_type_id'], nameKeys: ['name', 'product_type_name'],
  });
  assert.deepEqual(rows, []);
});

test('view resolves a cached temporary type category without sending a fake ID to the API', async () => {
  global.fetch = async () => { throw new Error('No API calls expected'); };
  const type = { id: 'tmppt-one', name: 'Jerseys', hint: '', categoryId: 'sports' };
  const result = await catalog.loadProductTypeDetails(type, [{ id: 'sports', name: 'Sportswear', hint: '' }]);
  assert.equal(result.categoryName, 'Sportswear');
  assert.equal((await catalog.loadProductTypeDetails({ ...type, categoryId: '' }, [])).categoryName, '');
});

test('view uses the category list name instead of an outdated cached name', async () => {
  global.fetch = async () => { throw new Error('No API calls expected'); };
  const details = await catalog.loadProductTypeDetails({ id: 'real', name: 'Kit', hint: '', categoryId: 'sports', categoryName: 'Old name' }, [{ id: 'sports', name: 'Sportswear', hint: '' }]);
  assert.equal(details.categoryName, 'Sportswear');
});

test('view fetches type details and the category name when the list lacks its mapping', async () => {
  const calls = [];
  global.fetch = async url => {
    calls.push(url);
    return Response.json(url.includes('/product-types/')
      ? { data: { id: 'real-type', name: 'Kit', category_id: 'sports' } }
      : { data: { id: 'sports', name: 'Sportswear' } });
  };
  const details = await catalog.loadProductTypeDetails({ id: 'real-type', name: 'Kit', hint: '' }, []);
  assert.equal(details.categoryName, 'Sportswear');
  assert.deepEqual(calls, ['/api/admin/product-types/real-type', '/api/admin/categories/sports']);
});

test('known category IDs need only a category read, and failures remain visible', async () => {
  const calls = [];
  global.fetch = async url => { calls.push(url); return Response.json({ error: 'Category unavailable' }, { status: 503 }); };
  await assert.rejects(catalog.loadProductTypeDetails({ id: 'real-type', name: 'Kit', hint: '', categoryId: 'sports' }, []), /Category unavailable/);
  assert.deepEqual(calls, ['/api/admin/categories/sports']);
});

test('missing category relationships stay unknown instead of using descriptions as names', async () => {
  global.fetch = async () => Response.json({ data: { id: 'real-type', name: 'Kit', description: 'Not a category' } });
  assert.equal((await catalog.loadProductTypeDetails({ id: 'real-type', name: 'Kit', hint: 'Not a category' }, [])).categoryName, '');
});
