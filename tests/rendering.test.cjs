const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const load = require('./support/load-ts.cjs');
const filename = path.resolve(__dirname, '../src/components/auth/SessionBoundary.tsx');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded.require = request => {
  if (request === '../PagePending') return { default: () => React.createElement('div', { role: 'status', 'aria-label': 'Loading page' }) };
  if (request === 'next/link') return { default: ({ children }) => React.createElement('a', null, children) };
  if (request.startsWith('.')) return load(path.resolve(path.dirname(filename), request + '.ts'));
  return module.require(request);
};
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
test('initial HTML does not flash a sign-in screen or expose private content before hydration', () => {
  const html = renderToString(React.createElement(loaded.exports.default, null, React.createElement('p', null, 'Private account details')));
  assert.match(html, /Loading page/);
  assert.doesNotMatch(html, /Please sign in|Checking your sign-in|Private account details/);
});
test('fresh query reads reuse data and separate cache instances do not share private results', async () => {
  const { createAppQueryClient } = load('src/components/dashboard/queryClient.ts');
  const first = createAppQueryClient(), second = createAppQueryClient();
  let calls = 0;
  const options = { queryKey: ['profile'], queryFn: async () => { calls++; return { name: 'First account' }; } };
  try {
    await first.fetchQuery(options); await first.fetchQuery(options);
    assert.equal(calls, 1);
    assert.equal(second.getQueryData(['profile']), undefined);
  } finally { first.clear(); second.clear(); }
});