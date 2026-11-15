const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const load = require('./support/load-ts.cjs');

function nodes(tree, match) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, match));
  if (!tree || typeof tree !== 'object') return [];
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (tree && typeof tree === 'object') return text(tree.props?.children);
  return tree == null || typeof tree === 'boolean' ? '' : String(tree);
}
function harness(options = {}) {
  const state = [], calls = [], refreshes = [];
  let cursor = 0;
  const dialog = { open: false, closes: 0, showModal() { this.open = true; }, close() { this.open = false; this.closes++; } };
  const mutation = { disabled: false, busy: false, error: '', run: async (...args) => {
    calls.push(args);
    if (options.throw) throw new Error('Connection lost');
    if (options.reject) { mutation.error = 'The rejection was not saved.'; return false; }
    return true;
  } };
  const item = { id: 'ad-one', name: 'Test ad', moderation_status: 'pending', ...options.item };
  const jsx = (type, props) => ({ type, props });
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/components/ads/AdDetail.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module: loaded, exports: loaded.exports, Error,
    require(name) {
      if (name === 'react') return {
        useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
        useRef(initial) { const index = cursor++; return state[index] ??= { current: initial }; },
      };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === './data') return load('src/components/ads/data.ts');
      if (name === './hooks') return { useAdsResource: path => ({ data: /\/(history|moderation-logs)\?/.test(path) ? { data: [] } : path.includes('/ad-one') ? { data: item } : undefined, loading: false, refresh: () => refreshes.push(path) }), usePostingCost: () => ({ cost: { fee: 0, balance: 1000 }, refresh() {} }), useAdsMutation: () => mutation };
      if (name === './Common') return { ...Object.fromEntries(['Feedback', 'History', 'Pager'].map(name => [name, Object.assign(() => null, { displayName: name })])), collection: () => ({ items: [] }) };
      return { default: () => null };
    },
    window: { location: { assign() {} } },
  });
  function render() {
    cursor = 0;
    const tree = loaded.exports.default({ id: 'ad-one', admin: options.admin !== false, basePath: '/admin/ads' });
    for (const node of nodes(tree, node => node.type === 'dialog' && node.props['aria-labelledby'] === 'moderation-dialog-title')) node.props.ref.current = dialog;
    return tree;
  }
  const rejection = () => nodes(render(), node => node.type === 'dialog' && node.props['aria-labelledby'] === 'moderation-dialog-title')[0];
  return {
    calls, dialog, refreshes, render,
    open() { nodes(render(), node => node.type === 'button' && text(node) === 'Reject')[0].props.onClick(); },
    reason(value) { nodes(rejection(), node => node.type === 'textarea')[0].props.onChange({ target: { value } }); },
    submit() { return nodes(rejection(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); },
    field() { return nodes(rejection(), node => node.type === 'textarea')[0]; },
    feedback() { return nodes(rejection(), node => node.type?.displayName === 'Feedback')[0].props.error; },
  };
}

test('rejection requires a nonblank admin comment before any write', async () => {
  const h = harness(); h.open();
  assert.equal(h.field().props.required, true);
  assert.equal(h.field().props.maxLength, 2000);
  h.reason('   '); await h.submit();
  assert.equal(h.calls.length, 0);
  assert.equal(h.dialog.open, true);
  assert.match(h.feedback(), /reason for rejection/);
});

test('failed and lost rejection responses preserve the open dialog and comment', async () => {
  for (const options of [{ reject: true }, { throw: true }]) {
    const h = harness(options); h.open(); h.reason('Please add a clear description.'); await h.submit();
    assert.equal(h.dialog.open, true); assert.equal(h.dialog.closes, 0);
    assert.equal(h.field().props.value, 'Please add a clear description.');
    assert.match(h.feedback(), /not saved|Connection lost/);
    assert.equal(h.calls.length, 1);
    assert.equal(h.refreshes.length, 0);
  }
});

test('successful rejection submits the trimmed reason and closes only after confirmation', async () => {
  const h = harness(); h.open(); h.reason('  Add delivery details.  '); await h.submit();
  assert.equal(h.calls[0][0], '/api/admin/ads/ad-one/reject');
  assert.equal(h.calls[0][1], 'POST');
  assert.equal(JSON.stringify(h.calls[0][2]), JSON.stringify({ reason: 'Add delivery details.' }));
  assert.equal(h.dialog.open, false); assert.equal(h.dialog.closes, 1);
  assert.equal(h.field().props.value, ''); assert.ok(h.refreshes.length > 0);
});

test('sellers can see the saved rejection reason even when another feedback field is blank', () => {
  const h = harness({ admin: false, item: { moderation_status: 'rejected', moderation_reason: '', rejection_reason: 'Correct the description.\nInclude its condition.' } });
  assert.match(text(h.render()), /Reason for rejection/);
  assert.match(text(h.render()), /Correct the description.\nInclude its condition./);
});

test('unknown moderation status still does not expose approve or reject actions', () => {
  const h = harness({ item: { moderation_status: '' } });
  assert.equal(nodes(h.render(), node => node.type === 'button' && ['Approve', 'Reject'].includes(text(node))).length, 0);
});

test('admin review exposes moderation actions without editing, deletion or change requests', () => {
  for (const moderation_status of ['pending', 'approved', 'suspended', '']) {
    const h = harness({ item: { moderation_status } });
    const buttons = nodes(h.render(), node => node.type === 'button').map(text);
    for (const removed of ['Edit ad', 'Delete', 'Delete ad', 'Request changes']) assert.equal(buttons.includes(removed), false, moderation_status + ': ' + removed);
    if (moderation_status === 'pending') assert.ok(buttons.includes('Approve') && buttons.includes('Reject') && buttons.includes('Suspend'));
    if (moderation_status === 'suspended') assert.ok(buttons.includes('Unsuspend'));
  }
  const owner = harness({ admin: false });
  assert.ok(nodes(owner.render(), node => node.type === 'button' && text(node) === 'Edit ad').length);
});

test('API nested moderation states expose the matching admin controls', () => {
  for (const status of ['pending', 'approved', 'suspended']) {
    const h = harness({ item: { moderation_status: undefined, moderation: { status }, owner: { status: 'active' }, is_active: true } });
    const buttons = nodes(h.render(), node => node.type === 'button').map(text);
    if (status === 'pending') assert.ok(buttons.includes('Approve') && buttons.includes('Reject'));
    if (status === 'approved') assert.ok(buttons.includes('Suspend') && !buttons.includes('Approve'));
    if (status === 'suspended') assert.ok(buttons.includes('Unsuspend') && !buttons.includes('Suspend'));
    assert.equal(buttons.includes('Edit ad'), false);
  }
});
