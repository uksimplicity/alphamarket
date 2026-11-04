const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { nigeriaLGAs, nigeriaStates } = load('src/data/nigeriaLocations.ts');
const { fullAddress, readAddressDetails } = load('src/components/commerce/structuredAddress.ts');

test('bundled Nigerian regions cover states and FCT with 774 distinct state/LGA pairs', () => {
  assert.equal(nigeriaStates.length, 37);
  assert.equal(Object.values(nigeriaLGAs).reduce((total, names) => total + names.length, 0), 774);
  assert.ok(nigeriaLGAs['Federal Capital Territory'].includes('Abaji'));
  assert.ok(nigeriaLGAs.Nasarawa);
  assert.ok(nigeriaLGAs.Lagos.includes('Ifako-Ijaiye'));
  for (const names of Object.values(nigeriaLGAs)) {
    assert.ok(names.length > 0);
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.every(name => typeof name === 'string' && name.trim() === name && name.length));
  }
});
test('generated addresses restore their fields, including common separator and casing differences', () => {
  const fields = { houseNumber: '10', street: 'Ayaji Road Ogba', lga: 'Ifako-Ijaiye', state: 'Lagos' };
  assert.deepEqual(readAddressDetails(fullAddress(fields)), fields);
  assert.deepEqual(readAddressDetails('10 Ayaji Road Ogba, ifako ijaiye, lagos, Nigeria'), fields);
  assert.deepEqual(readAddressDetails('12B Example Street, Eti-Osa, Lagos, Nigeria'), { houseNumber: '12B', street: 'Example Street', lga: 'Eti-Osa', state: 'Lagos' });
});
test('unrecognized saved addresses never invent a matching state or LGA', () => {
  for (const address of ['Some old address', '12 Example Street, Ikeja, Ogun, Nigeria', '12 Example Street, Abuja, Unknown, Nigeria']) {
    assert.deepEqual(readAddressDetails(address), { houseNumber: '', street: '', lga: '', state: '' });
  }
  assert.equal(fullAddress({ houseNumber: '', street: '', lga: '', state: '' }), '');
});
