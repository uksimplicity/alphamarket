const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };

function harness(threadResponse) {
  const slots = [], dependencies = [], pending = [], cleanups = [], calls = [];
  let cursor = 0;
  class ChatClient {
    threads() { return Promise.resolve({ threads: [], total: 0 }); }
    async thread(id, signal) { calls.push({ id, signal }); return threadResponse(id, signal); }
  }
  const jsx = (type, props) => ({ type, props }), loaded = { exports: {} };
  const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/chat/ChatWorkspace.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module: loaded, exports: loaded.exports, Error, AbortController, document, window: document, setInterval: () => 1, clearInterval() {},
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return {
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
        useEffect(fn, deps) { const i = cursor++; if (!dependencies[i] || deps.some((value, j) => value !== dependencies[i][j])) { dependencies[i] = deps; pending.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); } },
      };
      if (name.endsWith('authStorage')) return { getAuth: () => ({ access_token: 'seller-token' }) };
      if (name.endsWith('useAuthUser')) return { useAuthUser: () => ({ id: 'seller' }) };
      if (name.endsWith('chatClient')) return { ChatClient, mergeThreads: (previous, incoming) => [...previous, ...incoming] };
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name.endsWith('ShopperIcon') || name.endsWith('ConversationProduct')) return { default: 'presentation' };
      throw new Error(name);
    },
  });
  return { calls, render(id) { cursor = 0; const root = loaded.exports.default({ conversationId: id }); return root.type(root.props); }, effects() { pending.splice(0).forEach(fn => fn()); }, cleanup() { cleanups.forEach(fn => fn?.()); } };
}
function nodes(tree, match) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, match)); return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)]; }

test('seller messages deep link loads the requested conversation independently of the inbox and preserves backend status', async () => {
  const h = harness(async id => ({ id, type: 'order', status: 'closed', peer: { id: 'buyer', name: 'Buyer' } }));
  h.render('thread'); h.effects(); await settle();
  const selected = nodes(h.render('thread'), node => typeof node.type === 'function' && node.type.name === 'Conversation')[0];
  assert.equal(selected.props.thread.id, 'thread');
  assert.equal(selected.props.thread.peer.id, 'buyer');
  assert.equal(selected.props.thread.status, 'closed');
  assert.equal(h.calls.length, 1);
  h.cleanup(); assert.equal(h.calls[0].signal.aborted, true);
});

test('mismatched conversation responses show an error and never select an unrelated thread', async () => {
  const h = harness(async () => ({ id: 'other-thread' }));
  h.render('thread'); h.effects(); await settle();
  const tree = h.render('thread');
  assert.equal(nodes(tree, node => typeof node.type === 'function' && node.type.name === 'Conversation').length, 0);
  assert.ok(nodes(tree, node => node.props?.role === 'alert').length);
  h.cleanup();
});
