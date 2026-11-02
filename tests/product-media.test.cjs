const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { marketplaceImage, productImage } = load('src/components/products/productMedia.ts');
const id = 'product_Image-123';
const direct = `https://lh3.googleusercontent.com/d/${id}=w1600`;

test('stored Drive download and viewer links resolve to the image endpoint', () => {
  for (const url of [
    `https://drive.google.com/uc?id=${id}`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://drive.google.com/file/d/${id}/view?usp=sharing`,
    `https://drive.google.com/file/u/0/d/${id}/preview`,
    `https://drive.google.com/open?id=${id}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w400`,
    `https://docs.google.com/uc?export=download&id=${id}`,
    `https://drive.usercontent.google.com/download?id=${id}&export=download`,
    `//drive.google.com/uc?id=${id}`,
  ]) assert.equal(marketplaceImage(url), direct);
  assert.equal(marketplaceImage(direct), direct);
});

test('Drive resource keys survive normalization', () => {
  assert.equal(marketplaceImage(`https://drive.google.com/file/d/${id}/view?resourcekey=key-123`), `${direct}?resourcekey=key-123`);
});

test('unrelated URLs, missing IDs and non-file Drive pages are unchanged', () => {
  for (const url of ['https://images.example/photo.png?width=400', '/buyer/photo.jpg', 'data:image/png;base64,abc', 'blob:https://app.test/123', 'https://drive.google.com/drive/folders/folder', 'https://drive.google.com/uc', 'https://drive.google.com/uc?id=bad%2Fid', `https://drive.google.com.evil.test/uc?id=${id}`]) {
    assert.equal(marketplaceImage(url), url);
  }
  assert.equal(marketplaceImage('https://images.unsplash.com/photo-1542291026-7eec264c27ff?width=400'), '/buyer/buyer-style.jpg');
});

test('cover and gallery resolution preserve uploaded metadata and missing-image behavior', () => {
  const product = { media: { cover: `https://drive.google.com/uc?id=${id}`, images: [] } };
  const before = JSON.stringify(product);
  assert.equal(productImage(product), direct);
  assert.equal(JSON.stringify(product), before);
  assert.equal(productImage({ media: { images: [{ file_url: `https://drive.google.com/file/d/${id}/view` }] } }), direct);
  assert.equal(productImage({ image: `//drive.google.com/uc?id=${id}` }), direct);
  assert.equal(productImage({}, ''), '');
});

test('buyer and seller product views resolve the same stored Drive cover', () => {
  const row = { id: 'live-product', name: 'Product', price: 1000, media: { cover: `https://drive.google.com/uc?id=${id}`, images: [`https://drive.google.com/file/d/${id}/view`] } };
  const [buyer] = load('src/components/dashboard/buyerCatalog.ts').buyerProducts({ data: { products: [row] } });
  const [seller] = load('src/components/vendor/sellerData.ts').parseSellerProducts({ data: { products: [row] } }, 'seller');
  assert.equal(buyer.image, direct);
  assert.equal(buyer.images[0], direct);
  assert.equal(seller.image, direct);
});