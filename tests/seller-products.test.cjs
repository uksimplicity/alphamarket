const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const originalFetch = global.fetch, originalBase = process.env.NEXT_PUBLIC_API_BASE_URL;
beforeEach(() => { load.reset(); process.env.NEXT_PUBLIC_API_BASE_URL = 'https://marketplace.example/api/v1'; });
afterEach(() => { global.fetch = originalFetch; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = originalBase; });
const payload = { name: 'Chair', categoryId: 'category', productTypeId: 'type', brandId: 'chosen-brand', basePrice: 5000, stock: 3 };
const request = (method, body, auth = 'Bearer seller-token') => new Request('https://web.example/api/seller/products', { method, headers: { Authorization: auth, Cookie: 'browser=private', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const detail = () => load('src/app/api/seller/products/[productId]/route.ts');
const context = { params: Promise.resolve({ productId: 'product-1' }) };

test('create preserves selected brand and sends once to singular authenticated endpoint', async () => {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ error: 'failed' }, { status: 500 }); };
  const response = await load('src/app/api/seller/products/route.ts').POST(request('POST', payload));
  assert.equal(response.status, 500); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://marketplace.example/api/v1/seller/product');
  assert.equal(JSON.parse(calls[0].init.body).brandId, 'chosen-brand');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer seller-token');
  assert.equal(calls[0].init.headers.Cookie, undefined); assert.equal(calls[0].init.redirect, 'manual');
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
