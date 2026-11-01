const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const catalog = load('src/components/admin/catalogRecords.ts');
const originalFetch = global.fetch;
test.afterEach(() => { global.fetch = originalFetch; });

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
