// Local browser QA with synthetic accounts; no account actions reach the backend.
// Requires Next on :3014 and Chrome CDP on :9234.
const assert = require('node:assert/strict');
async function main() {
  const target = await (await fetch('http://127.0.0.1:9234/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression) {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    throw new Error('Timed out: ' + expression);
  }
  const button = label => `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)})`;
  const click = label => evaluate(`${button(label)}.click()`);
  const stat = `document.querySelector('main')?.innerText`;
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('alpha.auth', JSON.stringify({ access_token: 'synthetic-admin', user: { id: 'admin-fixture', first_name: 'Admin', role: 'admin' } }));
      window.__writes = [];
      window.__failAction = false;
      let users = JSON.parse(sessionStorage.getItem('admin-fixture-users') || '[{"id":"seller-one","name":"Synthetic Seller","email":"seller@example.test","role":"seller","status":"pending"}]');
      const save = () => sessionStorage.setItem('admin-fixture-users', JSON.stringify(users));
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
        const method = init.method || 'GET';
        if (method !== 'GET') {
          window.__writes.push({ path: url.pathname, method, body: init.body });
          if (window.__failAction) return Response.json({ error: 'Action denied by service' }, { status: 403 });
          if (url.pathname.endsWith('/status')) {
            const status = JSON.parse(init.body).status;
            users = users.map(user => ({ ...user, status })); save();
            return new Response(null, { status: 204 });
          }
          if (url.pathname === '/api/admin/user' && method === 'DELETE') {
            users = users.filter(user => user.email !== url.searchParams.get('email')); save();
            return new Response(null, { status: 204 });
          }
          return Response.json({ error: 'Unexpected fixture write' }, { status: 400 });
        }
        if (url.pathname === '/api/admin/users') return Response.json({ data: { users, pagination: { total: users.length } } });
        if (url.pathname === '/api/admin/dashboard') return Response.json({ total_users: 999 });
        if (url.pathname === '/api/user/profile') return Response.json({ data: { id: 'admin-fixture', role: 'admin' } });
        return Response.json({ data: [] });
      };
    ` });
    await send('Page.navigate', { url: 'http://127.0.0.1:3014/admin/dashboard' });
    await wait(`${stat}?.includes('Total Users')`);
    await wait(`[...document.querySelectorAll('main div')].some(el=>el.textContent==='Total Users'&&el.nextElementSibling?.textContent==='1')`);
    console.log('PASS dashboard uses user-service total instead of stale dashboard total');
    await click('Accounts');
    await wait(`document.querySelector('a[href="/admin/users"]')`);
    await evaluate(`document.querySelector('a[href="/admin/users"]').click()`);
    await wait(`${button('Approve')}`);
    await click('Approve'); await wait(`${button('Active')}`);
    assert.equal(await evaluate(`window.__writes.length`), 1);
    assert.equal(await evaluate(`${button('Active')}.disabled`), true);
    await click('Suspend'); await wait(`${button('Reactivate')}`);
    await click('Reactivate'); await wait(`${button('Active')}`);
    console.log('PASS approve, suspend, and reactivate update the account status');
    await evaluate('window.__failAction = true');
    await click('Suspend'); await wait(`document.querySelector('[role="alert"]')?.textContent.includes('Action denied')`);
    assert.ok(await evaluate(`Boolean(${button('Active')})`));
    await evaluate('window.__failAction = false');
    console.log('PASS backend rejection keeps the existing status and displays the error');
    await click('Delete'); await wait(`document.querySelector('[role="alertdialog"]')`);
    assert.equal(await evaluate('window.__writes.length'), 4);
    await click('Cancel');
    assert.equal(await evaluate('window.__writes.length'), 4);
    console.log('PASS cancel deletion sends no account deletion request');
    await evaluate(`document.querySelector('a[href="/admin/vendors"]').click()`);
    await wait(`${button('Suspend')}`);
    await click('Suspend'); await wait(`${button('Reactivate')}`);
    console.log('PASS seller account controls are connected');
    await click('Delete'); await click('Confirm delete');
    await wait(`${stat}?.includes('No seller accounts found')`);
    assert.equal(await evaluate(`window.__writes.filter(row=>row.method==='DELETE').length`), 1);
    await evaluate(`document.querySelector('a[href="/admin/dashboard"]').click()`);
    await wait(`[...document.querySelectorAll('main div')].some(el=>el.textContent==='Total Users'&&el.nextElementSibling?.textContent==='0')`);
    console.log('PASS confirmed deletion removes account and updates dashboard count to zero');
    assert.deepEqual(errors, []);
  } finally {
    await send('Page.close'); socket.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
