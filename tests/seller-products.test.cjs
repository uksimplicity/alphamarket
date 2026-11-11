const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originalFetch = global.fetch, originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
beforeEach(() => { load.reset(); process.env.NEXT_PUBLIC_API_BASE_URL = 'https://marketplace.example/api/v1'; });
afterEach(() => { global.fetch = originalFetch; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase; });
const payload = { name: 'Chair', categoryId: 'category', productTypeId: 'type', brandId: 'chosen-brand', basePrice: 5000, stock: 3, location: 'Lagos', shortDescription: 'An actual chair', media: { cover: 'https://images.example/chair.png' } };
const request = (method, body, auth = 'Bearer seller-token') => new Request('https://web.example/api/seller/products', { method, headers: { Authorization: auth, Cookie: 'browser=private', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const detail = () => load('src/app/api/seller/products/[productId]/route.ts');
const context = { params: Promise.resolve({ productId: 'product-1' }) };

test('create preserves selected brand and sends once to singular authenticated endpoint', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    if (url.includes('/ads/locations?')) return Response.json({ data: [{ id: 'saved-location', name: 'Lagos', type: 'city', is_active: true }] });
    calls.push({ url, init }); return Response.json({ error: 'failed' }, { status: 500 });
  };
  const response = await load('src/app/api/seller/products/route.ts').POST(request('POST', payload));
  assert.equal(response.status, 500); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://marketplace.example/api/v1/seller/product');
  assert.equal(JSON.parse(calls[0].init.body).brandId, 'chosen-brand');
  assert.equal(JSON.parse(calls[0].init.body).locationId, 'saved-location');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer seller-token');
  assert.equal(calls[0].init.headers.Cookie, undefined); assert.equal(calls[0].init.redirect, 'manual');
});

test('seller creation accepts description and a gallery image without other optional details', async () => {
  const minimal = { name: 'Chair', slug: 'chair', sellerId: 'seller-one', basePrice: 5000, categoryId: 'category', productTypeId: 'type', location: 'Lagos', shortDescription: 'An actual chair', media: { images: ['https://images.example/chair.png'] } };
  const calls = [];
  global.fetch = async (url, init) => {
    if (url.includes('/ads/locations?')) return Response.json({ data: [{ id: 'saved-location', name: 'Lagos', type: 'city', is_active: true }] });
    calls.push({ url, body: JSON.parse(init.body) }); return Response.json({ data: { id: 'created' } }, { status: 201 });
  };
  const result = await load('src/app/api/seller/products/route.ts').POST(request('POST', minimal));
  assert.equal(result.status, 201);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { ...minimal, locationId: 'saved-location' });
});

test('seller create proxy preserves a typed brand name without adding a brand ID', async () => {
  const { brandId: omittedBrandId, ...unbranded } = payload;
  assert.equal(omittedBrandId, 'chosen-brand');
  const typedBrand = { ...unbranded, brandName: 'Acme' };
  const calls = [];
  global.fetch = async (url, init) => {
    if (url.includes('/ads/locations?')) return Response.json({ data: [{ id: 'saved-location', name: 'Lagos', type: 'city', is_active: true }] });
    calls.push({ url, body: JSON.parse(init.body) }); return Response.json({ data: { id: 'created' } }, { status: 201 });
  };
  const result = await load('src/app/api/seller/products/route.ts').POST(request('POST', typedBrand));
  assert.equal(result.status, 201);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { ...typedBrand, locationId: 'saved-location' });
  assert.equal(Object.hasOwn(calls[0].body, 'brandId'), false);
});

test('create resolves the typed city, forwards the product address and overrides a submitted location ID', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/ads/locations?')) return Response.json({ data: [{ id: 'city-location', name: 'Lagos', type: 'city', is_active: true }] });
    return Response.json({ data: { id: 'created' } }, { status: 201 });
  };
  const response = await load('src/app/api/seller/products/route.ts').POST(request('POST', { ...payload, address: '12 Example Street', latitude: 6.5, longitude: 3.4, locationId: 'stale-location' }));
  assert.equal(response.status, 201);
  assert.deepEqual(calls.map(call => call.init.method), ['GET', 'POST']);
  assert.equal(calls[0].url, 'https://marketplace.example/api/v1/ads/locations?type=city&search=Lagos&limit=100&offset=0');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer seller-token');
  assert.equal(calls[0].init.cache, 'no-store');
  const created = JSON.parse(calls[1].init.body);
  assert.equal(created.locationId, 'city-location');
  assert.equal(created.location, 'Lagos');
  assert.equal(created.address, '12 Example Street');
  assert.equal(created.latitude, 6.5);
  assert.equal(created.longitude, 3.4);
  assert.ok(calls.every(call => !call.url.includes('/user/profile')));
});

test('empty, inactive, fuzzy or ambiguous city results prevent incorrect placement', async () => {
  const collection = load('src/app/api/seller/products/route.ts');
  for (const directory of [
    { data: [] },
    { data: [{ id: 'inactive', name: 'Lagos', type: 'city', is_active: false }] },
    { data: [{ id: 'fuzzy', name: 'Lagos Island', type: 'city' }] },
    { data: [{ id: 'state', name: 'Lagos', type: 'state' }] },
    { data: [{ id: 'city-one', name: 'Lagos' }, { id: 'city-two', name: 'Lagos' }] },
  ]) {
    const calls = [];
    global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(directory); };
    const response = await collection.POST(request('POST', payload));
    assert.ok(response.status >= 400);
    assert.match((await response.json()).error, /adds or activates this city in Admin\.|More than one supported city/);
    assert.deepEqual(calls.map(call => call.init.method), ['GET']);
  }
  for (const status of [401, 500]) {
    const calls = [];
    global.fetch = async (url, init) => { calls.push(init.method); return Response.json({ error: 'failed' }, { status }); };
    assert.equal((await collection.POST(request('POST', payload))).status, status);
    assert.deepEqual(calls, ['GET']);
  }
});

test('city search checks later pages and normalizes whitespace and case', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (init.method === 'POST') return Response.json({ data: { id: 'created' } }, { status: 201 });
    return Response.json({ data: calls.length === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: `other-${i}`, name: `Other city ${i}` })) : [{ id: 'real-city', name: '  LAGOS  ' }] });
  };
  assert.equal((await load('src/app/api/seller/products/route.ts').POST(request('POST', payload))).status, 201);
  assert.match(calls[1].url, /offset=100/);
  assert.equal(JSON.parse(calls[2].init.body).locationId, 'real-city');
});

test('malformed and rejected directories are errors, never empty successful searches', async () => {
  for (const directory of [{ success: false, data: [] }, { data: [{ id: 'user-id' }] }, {}]) {
    const calls = [];
    global.fetch = async (url, init) => { calls.push(init.method); return Response.json(directory); };
    assert.equal((await load('src/app/api/seller/products/route.ts').POST(request('POST', payload))).status, 502);
    assert.deepEqual(calls, ['GET']);
  }
});

test('seller creation rejects missing description or images before contacting the backend', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({}); };
  const collection = load('src/app/api/seller/products/route.ts');
  for (const shortDescription of [undefined, '', '   ']) {
    const response = await collection.POST(request('POST', { ...payload, shortDescription }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /description is required/);
  }
  for (const media of [undefined, {}, { cover: ' ', images: [] }, { video: 'https://images.example/video.mp4' }]) {
    const response = await collection.POST(request('POST', { ...payload, media }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /product image/);
  }
  assert.equal(calls, 0);
});

test('seller creation requires a nonblank location before any backend write', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({}); };
  const collection = load('src/app/api/seller/products/route.ts');
  for (const location of [undefined, '', '   ', 123]) {
    const response = await collection.POST(request('POST', { ...payload, location }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Product location is required.');
  }
  assert.equal(calls, 0);
});

test('product uploads accept nested file URLs and preserve backend failure information without replay', async () => {
  const api = load('src/components/vendor/sellerProductForm.ts');
  for (const value of [
    { data: { file: { url: 'https://images.example/cover.png' } } },
    { file: { fileUrl: 'https://images.example/cover.png' } },
    { data: { file_url: 'https://images.example/cover.png' } },
  ]) assert.equal(api.uploadedMediaUrl(value), 'https://images.example/cover.png');
  assert.throws(() => api.uploadedMediaUrl({ success: false, message: 'Storage unavailable', url: 'https://images.example/false.png' }), /Storage unavailable/);
  const file = new File(['photo'], 'chair.png', { type: 'image/png' });
  const calls = [];
  global.fetch = async (url, init) => { calls.push({url, init}); return Response.json({ data: { file: { fileUrl: 'https://images.example/cover.png' } } }); };
  assert.equal(await api.uploadProductMedia(file, 'Bearer seller-token'), 'https://images.example/cover.png');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer seller-token');
  assert.equal(calls[0].init.headers['Content-Type'], undefined);
  assert.equal(calls[0].init.body.get('folder'), 'products');
  assert.equal(calls[0].init.body.get('file').name, 'chair.png');
  let failures = 0;
  global.fetch = async () => { failures++; return Response.json({ message: 'Failed to upload file' }, { status: 500 }); };
  await assert.rejects(api.uploadProductMedia(file, 'seller-token'), /chair\.png.*500.*Failed to upload file/);
  assert.equal(failures, 1);
  global.fetch = async () => Response.json({ success: false, error: { message: 'Storage unavailable' } });
  await assert.rejects(api.uploadProductMedia(file, 'seller-token'), /Storage unavailable/);
  global.fetch = async () => new Response('<html>too large</html>', { status: 413 });
  await assert.rejects(api.uploadProductMedia(file, 'seller-token'), /Maximum size is 3 MB/);
});

test('update, stock patch and delete use singular routes without fallback after failures', async () => {
  const calls = []; global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ error: 'not found' }, { status: 404 }); };
  assert.equal((await detail().PUT(request('PUT', { ...payload, product_id: 'forged' }), context)).status, 404);
  assert.equal(JSON.parse(calls[0].init.body).product_id, 'product-1');
  assert.equal((await detail().PATCH(request('PATCH', { stock: 5 }), context)).status, 404);
  assert.equal((await detail().DELETE(request('DELETE'), context)).status, 404);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => call.init.method), ['PUT', 'PUT', 'DELETE']);
  assert.ok(calls.every(call => call.url.endsWith('/seller/product/product-1')));
});

test('invalid products, unauthenticated calls and missing configuration never manufacture success', async () => {
  let count = 0; global.fetch = async () => { count++; return Response.json({}); };
  const collection = load('src/app/api/seller/products/route.ts');
  assert.equal((await collection.POST(request('POST', payload, ''))).status, 401);
  assert.equal((await collection.POST(request('POST', { ...payload, stock: 1.5 }))).status, 400);
  assert.equal((await collection.POST(request('POST', []))).status, 400);
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  assert.equal((await detail().PUT(request('PUT', payload), context)).status, 503);
  assert.equal((await detail().DELETE(request('DELETE'), context)).status, 503);
  assert.equal(count, 0);
});

test('seller detail finds exact product on later inventory pages without inventing a detail API', async () => {
  const calls = [];
  global.fetch = async url => { calls.push(url); return Response.json({ data: { products: calls.length === 1 ? Array.from({ length: 200 }, (_, i) => ({ id: `other-${i}` })) : [{ id: 'product-1', name: 'Chair' }] } }); };
  const response = await detail().GET(request('GET'), context);
  assert.equal((await response.json()).data.name, 'Chair');
  assert.equal(calls.length, 2); assert.ok(calls[1].endsWith('/seller/products?limit=200&offset=200'));
  global.fetch = async () => Response.json({ data: { products: [] } });
  assert.equal((await detail().GET(request('GET'), context)).status, 404);
  global.fetch = async () => Response.json({ unexpected: true });
  assert.equal((await detail().GET(request('GET'), context)).status, 502);
});

test('attributes, reference details and multipart uploads use documented paths without replay', async () => {
  const calls = []; global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ url: 'https://images.example/cover.png' }); };
  await load('src/app/api/seller/products/[productId]/attributes/route.ts').GET(request('GET'), context);
  assert.ok(calls[0].url.endsWith('/seller/product/product-1/attributes'));
  await load('src/app/api/seller/catalog/route.ts').GET(new Request('https://web.example/api/seller/catalog?resource=attributes&id=attr-1', { headers: { Authorization: 'Bearer seller-token' } }));
  assert.ok(calls[1].url.endsWith('/seller/attributes/attr-1'));
  const form = new FormData(); form.append('folder', 'products'); form.append('file', new File(['image'], 'photo.png', { type: 'image/png' }));
  await load('src/app/api/upload/file/route.ts').POST(new Request('https://web.example/api/upload/file', { method: 'POST', headers: { Authorization: 'Bearer seller-token' }, body: form }));
  assert.ok(calls[2].url.endsWith('/upload/file')); assert.equal(calls[2].init.body.get('file').type, 'image/png');
  assert.equal(calls[2].init.body.get('folder'), 'products'); assert.equal(calls[2].init.headers['Content-Type'], undefined);
  assert.equal(calls.length, 3);
});

test('seller response redirects and malformed bodies stay errors', async () => {
  global.fetch = async () => new Response(null, { status: 302, headers: { Location: 'https://another.example' } });
  assert.equal((await detail().DELETE(request('DELETE'), context)).status, 502);
  global.fetch = async () => new Response('<html>error</html>');
  assert.equal((await detail().PUT(request('PUT', payload), context)).status, 502);
});

test('media edits preserve existing cover, images and video and reject invalid upload URLs', () => {
  const api = load('src/components/vendor/sellerProductForm.ts');
  const product = { media: { cover: 'old-cover', images: ['old-image'], video: 'old-video' } };
  assert.deepEqual(api.editedMedia(product, 'new-cover'), { cover: 'new-cover', images: ['old-image'], video: 'old-video' });
  assert.deepEqual(api.editedMedia(product, undefined, ['new-image']), { cover: 'old-cover', images: ['new-image'], video: 'old-video' });
  assert.throws(() => api.uploadedMediaUrl({ url: '' })); assert.throws(() => api.uploadedMediaUrl({ url: 'javascript:alert(1)' }));
  assert.equal(api.uploadedMediaUrl({ data: { file_url: 'https://images.example/photo.png' } }), 'https://images.example/photo.png');
  assert.deepEqual(api.referenceOptions({ data: { brands: [{ id: 'real-id', name: 'Actual brand' }] } }), [{ id: 'real-id', name: 'Actual brand' }]);
});
