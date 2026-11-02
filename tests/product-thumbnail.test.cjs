const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const load = require('./support/load-ts.cjs');
const filename = path.resolve(__dirname, '../src/components/products/ProductThumbnail.tsx');
const loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded.require = request => request === './productMedia' ? load('src/components/products/productMedia.ts') : module.require(request);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
const Thumbnail = loaded.exports.default;
test('seller table thumbnail renders the uploaded Drive image', () => {
  const html = renderToStaticMarkup(React.createElement(Thumbnail, { image: 'https://drive.google.com/uc?id=product_Image-123' }));
  assert.match(html, /<img[^>]+src="https:\/\/lh3.googleusercontent.com\/d\/product_Image-123=w1600"/);
  assert.match(html, /object-fit:cover/);
});
test('missing thumbnails keep the empty frame without an invalid image request', () => {
  const html = renderToStaticMarkup(React.createElement(Thumbnail, { image: '' }));
  assert.match(html, /class="product-thumb"/);
  assert.doesNotMatch(html, /<img/);
});