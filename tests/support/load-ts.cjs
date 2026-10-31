const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  cache.set(filename, loaded);
  loaded.require = request => {
    if (request.startsWith('@/')) return load('src/' + request.slice(2) + '.ts');
    if (request.startsWith('.')) return load(path.resolve(path.dirname(filename), request.endsWith('.ts') ? request : request + '.ts'));
    return module.require(request);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return loaded.exports;
}
load.reset = () => cache.clear();
module.exports = load;
