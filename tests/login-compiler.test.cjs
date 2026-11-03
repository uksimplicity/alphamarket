const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { loadBindings, transform } = require('next/dist/build/swc');

for (const name of ['UserLogin', 'VendorLogin']) {
  test(`${name} compiles with the Next compiler`, async () => {
    const filename = path.resolve(__dirname, `../src/components/auth/${name}.tsx`);
    await loadBindings();
    await transform(fs.readFileSync(filename, 'utf8'), {
      filename,
      jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2022' },
    });
  });
}
