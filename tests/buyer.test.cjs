const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = request => request.startsWith('@/') ? load('src/' + request.slice(2) + '.ts') : request.startsWith('.') ? load(path.resolve(path.dirname(filename), request.endsWith('.ts') ? request : request + '.ts')) : module.require(request);
  loaded._compile(compiled.outputText, filename); return loaded.exports;
}
const buyer = load('src/components/dashboard/buyerCatalog.ts');
const sellerNames = load('src/components/dashboard/sellerNames.ts');

test('seller lookup matches account IDs and preserves names already returned by the catalog', () => {
  const directory = [
    { id: 'seller-one', name: '  First Store  ', role: 'seller' },
    { id: 'seller-two', name: 'Second Store', role: 'seller' },
    { id: 'buyer-id', name: 'Buyer Name', role: 'buyer' },
  ];
  const seller = { id: 'seller-one', name: 'Marketplace seller', slug: '' };
  assert.equal(sellerNames.resolveSellerName(seller, directory), 'First Store');
  assert.equal(sellerNames.resolveSellerName({ ...seller, id: 'seller-two' }, directory), 'Second Store');
  assert.equal(sellerNames.resolveSellerName({ ...seller, name: 'Catalog Store' }, directory), 'Catalog Store');
  for (const id of ['unknown', '', 'buyer-id']) assert.equal(sellerNames.resolveSellerName({ ...seller, id }, directory), 'Marketplace seller');
  assert.equal(sellerNames.resolveSellerName(seller), 'Marketplace seller');
});
test('buyer listings use public response envelopes and never invent price, stock or ratings', () => {
  const [product] = buyer.buyerProducts({ success: true, data: { products: [{ id: 'live', name: 'Live product', seller: { name: 'Store', slug: 'store' } }] } });
  assert.equal(product.price, ''); assert.equal(product.stock, null); assert.equal(product.rating, ''); assert.equal(product.preview, false); assert.equal(buyer.canShop(product), false);
  assert.throws(() => buyer.buyerProducts({ success: false, message: 'Unavailable' }), /Unavailable/);
  assert.throws(() => buyer.buyerProducts({ data: {} }), /could not be loaded/);
});

test('catalog pagination advances by raw rows and preserves unknown totals', () => {
  const first = buyer.buyerCatalogPage({ data: { products: [{ id: 'hidden', status: 'draft' }, { id: 'one' }], total: 5, offset: 0 } }, 2, 0);
  assert.deepEqual(first.products.map(item => item.id), ['one']);
  assert.equal(first.nextOffset, 2); assert.equal(first.hasMore, true);
  const last = buyer.buyerCatalogPage({ data: { products: [{ id: 'last' }], total: 5, offset: 4 } }, 2, 4);
  assert.equal(last.nextOffset, 5); assert.equal(last.hasMore, false);
  assert.equal(buyer.buyerCatalogPage({ data: [{ id: 'a' }, { id: 'b' }] }, 2, 0).hasMore, true);
  assert.equal(buyer.buyerCatalogPage({ data: [] }, 2, 2).hasMore, false);
  assert.throws(() => buyer.buyerCatalogPage({ data: { products: [], total: 20 } }, 2, 0), /incomplete page/);
  assert.throws(() => buyer.buyerCatalogPage({ data: { products: [{ id: 'a' }], offset: 0 } }, 2, 2), /unexpected page/);
});

test('buyer cards receive public seller or listing locations without inventing an address', () => {
  const products = buyer.buyerProducts({ data: { products: [
    { id: 'listing-location', location: '  Wuse 2, Abuja  ' },
    { id: 'seller-location', location: 'Listing address', seller: { location: 'Ikeja, Lagos' } },
    { id: 'snake-location', seller_location: 'Ibadan, Oyo' },
    { id: 'camel-location', sellerLocation: 'Benin City, Edo' },
    { id: 'missing-location' },
  ] } });
  assert.deepEqual(products.map(product => product.seller.location), ['Wuse 2, Abuja', 'Ikeja, Lagos', 'Ibadan, Oyo', 'Benin City, Edo', '']);
});

test('public product links resolve beyond 100 rows without seller privileges or premature 404s', async () => {
  const originalFetch = global.fetch, previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test/api/v1';
  const api = load('src/app/api/products/public/[id]/route.ts');
  const calls = [];
  let failLater = false;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    const offset = Number(new URL(url).searchParams.get('offset'));
    if (offset && failLater) return Response.json({ error: 'Unavailable' }, { status: 503 });
    const products = offset ? [{ id: 'beyond-first-page', price: 1200 }] : Array.from({ length: 100 }, (_, i) => ({ id: `p-${i}` }));
    return Response.json({ data: { products, total: 101, limit: 100, offset } });
  };
  const lookup = id => api.GET(new Request(`https://app.test/api/products/public/${id}`, { headers: { Authorization: 'Bearer buyer' } }), { params: Promise.resolve({ id }) });
  try {
    const found = await lookup('beyond-first-page');
    assert.equal(found.status, 200); assert.equal((await found.json()).data.id, 'beyond-first-page');
    assert.equal(calls.length, 2); assert.match(calls[1].url, /offset=100/);
    assert.ok(calls.every(call => !call.init.headers.Authorization && new URL(call.url).pathname === '/api/v1/products/public'));
    assert.equal((await lookup('missing')).status, 404);
    failLater = true;
    assert.equal((await lookup('missing')).status, 503);
    assert.equal((await lookup(' ')).status, 400);
  } finally { global.fetch = originalFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; }
});
test('unpublished products are hidden and only purchasable live stock enters the bag', () => {
  const data = buyer.buyerProducts({ data: { products: [{ id: 'draft', status: 'draft' }, { id: 'pending', status: 'pending_review' }, { name: 'No ID', price: 500 }, { id: 'sold', price: 1000, stock: 0 }, { id: 'live', price: 2500.5, stock: 4 }] } });
  assert.deepEqual(data.map(item => item.id), ['sold', 'live']);
  assert.equal(buyer.canShop(data[0]), false); assert.equal(buyer.canShop(data[1]), true); assert.equal(buyer.canShop({ ...data[1], preview: true }), false);
  assert.equal(data[1].price, '2500.5');
});
test('existing catalog details are explicitly previews rather than real seller inventory', () => {
  const catalog = load('src/components/products/catalog.ts');
  assert.equal(catalog.getProductById('urban-runner-sneakers').preview, true);
  assert.equal(buyer.canShop(catalog.getProductById('urban-runner-sneakers')), false);
  assert.equal(buyer.shoppingCategory(catalog.getProductById('urban-runner-sneakers')), 'Style');
});
test('public product proxy uses the documented read endpoint without forwarding user overrides', async () => {
  const originalFetch = global.fetch, previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.test/api/v1';
  const api = load('src/app/api/products/public/route.ts');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ data: { products: [] } }); };
  try {
    const response = await api.GET(new Request('https://app.test/api/products/public?limit=50&offset=20&search=shoe%26x%3D1&seller_id=other', { headers: { Authorization: 'Bearer buyer' } }));
    assert.equal(response.status, 200); assert.equal(calls[0].url, 'https://backend.test/api/v1/products/public?limit=50&offset=20&search=shoe%26x%3D1');
    assert.equal(calls[0].init.headers.Authorization, undefined); assert.equal(calls[0].init.redirect, 'manual');
    assert.equal((await api.GET(new Request('https://app.test/api/products/public?offset=-1'))).status, 400); assert.equal(calls.length, 1);
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal((await api.GET(new Request('https://app.test/api/products/public'))).status, 502);
  } finally { global.fetch = originalFetch; if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; }
});
