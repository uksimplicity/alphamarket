const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { sellerPhone, sellerPhoneHref } = load('src/components/products/sellerPhone.ts');
const { buyerProducts } = load('src/components/dashboard/buyerCatalog.ts');

test('seller telephone numbers preserve display formatting and produce call links', () => {
  assert.equal(sellerPhone(' +234 (803) 123-4567 '), '+234 (803) 123-4567');
  assert.equal(sellerPhoneHref('+234 (803) 123-4567'), 'tel:+2348031234567');
  assert.equal(sellerPhoneHref('08031234567'), 'tel:08031234567');
  for (const value of ['', 'javascript:alert(1)', 'https://example.test', '123', null, 8031234567]) assert.equal(sellerPhone(value), '');
});

test('public products retain seller contact fields without substituting buyer contact information', () => {
  for (const seller of [{ phone: '+2348031234567' }, { phone_number: '+2348031234567' }, { phoneNumber: '+2348031234567' }]) {
    assert.equal(buyerProducts([{ id: 'p', seller }])[0].seller.phone, '+2348031234567');
  }
  assert.equal(buyerProducts([{ id: 'p', seller_phone: '08031234567' }])[0].seller.phone, '08031234567');
  assert.equal(buyerProducts([{ id: 'p', phone: '08031234567' }])[0].seller.phone, '');
  assert.equal(buyerProducts([{ id: 'p', seller: { phone: 'unavailable' } }])[0].seller.phone, '');
});
