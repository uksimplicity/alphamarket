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
  loaded.require = request => request.startsWith('@/') ? load('src/' + request.slice(2) + '.ts') : request.startsWith('.') ? load(path.resolve(path.dirname(filename), request + '.ts')) : module.require(request);
  loaded._compile(compiled.outputText, filename); return loaded.exports;
}
const buyer = load('src/components/dashboard/buyerCatalog.ts');
test('buyer listings use public response envelopes and never invent price, stock or ratings', () => {
  const [product] = buyer.buyerProducts({ success: true, data: { products: [{ id: 'live', name: 'Live product', seller: { name: 'Store', slug: 'store' } }] } });
  assert.equal(product.price, ''); assert.equal(product.stock, null); assert.equal(product.rating, ''); assert.equal(product.preview, false); assert.equal(buyer.canShop(product), false);
  assert.throws(() => buyer.buyerProducts({ success: false, message: 'Unavailable' }), /Unavailable/);
  assert.throws(() => buyer.buyerProducts({ data: {} }), /could not be loaded/);
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
