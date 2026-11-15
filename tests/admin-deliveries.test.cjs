const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./support/load-ts.cjs');
const { loadAdminDeliveries, searchDeliveries } = load('src/components/admin/deliveryData.ts');
const row = { id: 'delivery-1', order_id: 'order-1', rider_id: 'rider-1', status: 'requested' };

test('delivery status and rider filters use only documented query parameters', async () => {
  const calls = [];
  const rows = await loadAdminDeliveries(async path => { calls.push(path); return { data: { deliveries: [row], total: 1 } }; }, { status: 'requested', riderId: ' rider-1 ' });
  assert.equal(rows.length, 1);
  assert.equal(calls.length, 1);
  const query = new URL(calls[0], 'https://test.example').searchParams;
  assert.equal(query.get('status'), 'requested');
  assert.equal(query.get('rider_id'), 'rider-1');
  assert.equal(query.has('order_id'), false);
  await assert.rejects(loadAdminDeliveries(async () => { throw Error('Must not fetch'); }, { status: 'order-1', riderId: '' }), /Choose a delivery status/);
});

test('order search includes later delivery pages even when the service caps page size', async () => {
  const calls = [];
  const rows = await loadAdminDeliveries(async path => {
    const offset = new URL(path, 'https://test.example').searchParams.get('offset');
    calls.push(offset);
    return { data: { deliveries: offset === '0' ? [row] : [{ ID: 'delivery-2', OrderID: 'order-2', OrderNumber: 'ORD-EXAMPLE', RiderID: 'rider-2', Status: 'assigned' }], total: 2 } };
  }, { status: '', riderId: '' });
  assert.deepEqual(calls, ['0', '1']);
  assert.equal(searchDeliveries(rows, ' ORDER-2 ')[0].id, 'delivery-2');
  assert.equal(searchDeliveries(rows, 'ord-example')[0].id, 'delivery-2');
});

test('unknown totals are followed until an empty page and repeated pages cannot hide an incomplete search', async () => {
  const rows = await loadAdminDeliveries(async path => new URL(path, 'https://test.example').searchParams.get('offset') === '0' ? { data: [row] } : { data: [] }, { status: '', riderId: '' });
  assert.equal(rows.length, 1);
  await assert.rejects(loadAdminDeliveries(async () => ({ data: [row] }), { status: '', riderId: '' }), /repeated page/);
});

test('failed, malformed and incomplete responses are errors rather than missing deliveries', async () => {
  for (const payload of [{ success: false, error: 'Unavailable' }, {}, { data: {} }, { data: [{}] }, { data: { deliveries: [], total: 2 } }]) {
    await assert.rejects(loadAdminDeliveries(async () => payload, { status: '', riderId: '' }));
  }
  assert.deepEqual(await loadAdminDeliveries(async () => ({ data: { deliveries: [], total: 0 } }), { status: '', riderId: '' }), []);
});

function nodes(tree, match) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, match));
  if (!tree || typeof tree !== 'object') return [];
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}

function harness(options = {}) {
  const slots = [], calls = [];
  let cursor = 0, query, refreshes = 0;
  const loaded = { exports: {} }, jsx = (type, props) => ({ type, props });
  const data = [{ id: 'delivery-1', orderId: 'order-1', orderNumber: '', riderId: 'rider-1', status: 'requested' }, { id: 'delivery-2', orderId: 'order-2', orderNumber: '', riderId: '', status: 'assigned' }];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/admin/deliveries/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: loaded, exports: loaded.exports, Error, URLSearchParams, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; } };
    if (name === '@tanstack/react-query') return { useQuery(value) { query = value; return { data, isLoading: false, isFetching: false, refetch: async () => { refreshes++; }, ...options }; } };
    if (name.endsWith('/ui')) return { Button: 'button', Card: 'card', ErrorState: 'error', SectionTitle: 'title', Skeleton: 'skeleton' };
    if (name.endsWith('/api')) return { adminFetcher: async (path, init) => { calls.push({ path, init }); return { data: { deliveries: [row], total: 1 } }; } };
    if (name.endsWith('useAuthUser')) return { useAuthUser: () => ({ id: 'admin' }) };
    if (name.endsWith('authStorage')) return { authGeneration: () => 0 };
    if (name.endsWith('localAccountData')) return { accountStamp: () => 'admin', checkAccount() {} };
    if (name.endsWith('deliveryData')) return load('src/components/admin/deliveryData.ts');
    throw Error(name);
  } });
  return {
    calls, query: () => query, refreshes: () => refreshes,
    render() { cursor = 0; return loaded.exports.default(); },
    input(name, value) { nodes(this.render(), node => node.props?.name === name)[0].props.onChange({ target: { value } }); },
    apply() { nodes(this.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); },
  };
}

test('draft filter edits do not affect applied query or displayed results until Apply Filters', async () => {
  const h = harness();
  h.render(); const initialKey = JSON.stringify(h.query().queryKey);
  h.input('orderId', ' order-2 '); h.input('status', 'assigned'); h.input('riderId', ' rider-2 ');
  let tree = h.render();
  assert.equal(JSON.stringify(h.query().queryKey), initialKey);
  assert.equal(nodes(tree, node => node.type === 'td' && node.props.children === 'order-1').length, 1);
  h.apply(); tree = h.render();
  assert.equal(h.query().queryKey.at(-2), 'assigned');
  assert.equal(h.query().queryKey.at(-1), 'rider-2');
  assert.equal(nodes(tree, node => node.type === 'td' && node.props.children === 'order-1').length, 0);
  assert.equal(nodes(tree, node => node.type === 'td' && node.props.children === 'order-2').length, 1);
  await h.query().queryFn({ signal: new AbortController().signal });
  assert.match(h.calls[0].path, /status=assigned/);
  assert.equal(h.calls[0].path.includes('order-2'), false);
});

test('Reset clears all draft and applied filters and restores the full displayed list', () => {
  const h = harness();
  h.input('orderId', 'order-2'); h.input('status', 'requested'); h.apply(); h.render();
  nodes(h.render(), node => node.type === 'button' && node.props.children === 'Reset')[0].props.onClick();
  const tree = h.render();
  for (const name of ['orderId', 'status', 'riderId']) assert.equal(nodes(tree, node => node.props?.name === name)[0].props.value, '');
  assert.equal(h.query().queryKey.at(-2), ''); assert.equal(h.query().queryKey.at(-1), '');
  assert.equal(nodes(tree, node => node.type === 'td' && node.props.children === 'order-1').length, 1);
});

test('filter controls stay available on loading or failure and API errors are not shown as no matches', () => {
  for (const options of [{ isLoading: true }, { error: new Error('Unavailable') }]) {
    const h = harness(options), tree = h.render();
    assert.equal(nodes(tree, node => node.type === 'form').length, 1);
    assert.equal(nodes(tree, node => node.props?.children === 'No deliveries match the applied filters.').length, 0);
  }
  const h = harness({ data: [] });
  assert.equal(nodes(h.render(), node => node.props?.children === 'No deliveries match the applied filters.').length, 1);
});
