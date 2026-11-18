const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const { firstName } = load('src/components/commerce/firstName.ts');

test('first name displays the first nonempty word without inventing a name', () => {
  assert.equal(firstName('  Ada   Jones '), 'Ada');
  assert.equal(firstName('Emeka'), 'Emeka');
  assert.equal(firstName(''), '');
  assert.equal(firstName(null), '');
});
