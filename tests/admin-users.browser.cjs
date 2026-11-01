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
  const click = async label => {
    await wait(`${button(label)}&&!${button(label)}.disabled`);
    return evaluate(`${button(label)}.click()`);
  };
  const stat = `document.querySelector('main')?.innerText`;
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('alpha.auth', JSON.stringify({ access_token: 'synthetic-admin', user: { id: 'admin-fixture', first_name: 'Admin', role: 'admin' } }));
      window.__writes = [];
      window.__catalogReads = [];
      window.__failAction = false;
      let users = JSON.parse(sessionStorage.getItem('admin-fixture-users') || '[{"id":"seller-one","name":"Synthetic Seller","email":"seller@example.test","role":"seller","status":"pending"}]');
      if (!sessionStorage.getItem('admin-fixture-users')) users.push(...Array.from({ length: 25 }, (_, i) => ({ id: 'buyer-' + i, name: 'Synthetic Buyer ' + i, email: 'buyer' + i + '@example.test', role: 'buyer', status: 'pending' })));
      const save = () => sessionStorage.setItem('admin-fixture-users', JSON.stringify(users));
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
        if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
        const method = init.method || 'GET';
        if (method === 'GET' && (url.pathname.includes('product-types') || url.pathname.includes('/categories'))) window.__catalogReads.push(url.pathname);
        if (method !== 'GET') {
          window.__writes.push({ path: url.pathname, method, body: init.body });
          if (window.__failAction) return Response.json({ error: 'Action denied by service' }, { status: 403 });
          if (url.pathname.endsWith('/status')) {
            const status = JSON.parse(init.body).status;
            const id = decodeURIComponent(url.pathname.split('/').at(-2));
            users = users.map(user => user.id === id ? { ...user, status } : user); save();
            return new Response(null, { status: 204 });
          }
          if (url.pathname === '/api/admin/user' && method === 'DELETE') {
            users = users.filter(user => user.email !== url.searchParams.get('email')); save();
            return new Response(null, { status: 204 });
          }
          return Response.json({ error: 'Unexpected fixture write' }, { status: 400 });
        }
        if (url.pathname === '/api/admin/users') {
          const offset = Number(url.searchParams.get('offset') || 0);
          const limit = Number(url.searchParams.get('limit') || 100);
          const rows = users.slice(offset, offset + limit);
          return Response.json({ data: { users: rows, count: rows.length } });
        }
        if (url.pathname === '/api/admin/dashboard') return Response.json({ total_users: 999 });
        if (url.pathname === '/api/admin/product-types') {
          if (sessionStorage.getItem('catalog-use-cache')) return Response.json({error:'Catalog offline'}, {status:503});
          return Response.json({data:{product_types:[{id:'real-type',name:'Kit',category_id:'sports'},{id:'type-detail',name:'Boots'}]}});
        }
        if (url.pathname === '/api/admin/product-types/type-detail') return Response.json({data:{id:'type-detail',name:'Boots',category_id:'football'}});
        if (url.pathname === '/api/admin/categories/raw') return Response.json({data:[{id:'sports',name:'Sportswear'}]});
        if (url.pathname === '/api/admin/categories/football') return Response.json({data:{id:'football',name:'Football Equipment'}});
        if (url.pathname === '/api/user/profile') return Response.json({ data: { id: 'admin-fixture', role: 'admin' } });
        return Response.json({ data: [] });
      };
    ` });
    await send('Page.navigate', { url: 'http://127.0.0.1:3014/admin/dashboard' });
    await wait(`${stat}?.includes('Total Users')`);
    await wait(`[...document.querySelectorAll('main div')].some(el=>el.textContent==='Total Users'&&el.nextElementSibling?.textContent==='26')`);
    console.log('PASS overview counts 26 users despite page-local counts and stale dashboard totals');
    await click('Accounts');
    await wait(`document.querySelector('a[href="/admin/users"]')`);
    await evaluate(`document.querySelector('a[href="/admin/users"]').click()`);
    await wait(`${button('Approve')}`);
    await wait(`${stat}?.includes('26 users')`);
    for (const [label, expected] of [['Approve', 'rgb(21, 128, 61)'], ['Suspend', 'rgb(234, 88, 12)'], ['Delete', 'rgb(220, 38, 38)']]) {
      assert.equal(await evaluate(`getComputedStyle(${button(label)}).backgroundColor`), expected, label + ' button color');
    }
    console.log('PASS Users agrees with Overview; approve is green, suspend orange, delete red');
    await click('Approve'); await wait(`${button('Active')}`);
    await wait(`document.querySelector('[data-admin-toast]')?.textContent.includes('Account approved successfully.')`);
    assert.equal(await evaluate(`window.__writes.length`), 1);
    assert.equal(await evaluate(`${button('Active')}.disabled`), true);
    await click('Suspend'); await wait(`${button('Reactivate')}`);
    await wait(`document.querySelector('[data-admin-toast]')?.textContent.includes('Account suspended successfully.')`);
    await click('Reactivate'); await wait(`${button('Active')}`);
    await wait(`document.querySelector('[data-admin-toast]')?.textContent.includes('Account reactivated successfully.')`);
    await evaluate(`document.querySelector('button[aria-label="Dismiss notification"]').click()`);
    await wait(`!document.querySelector('[data-admin-toast]')`);
    console.log('PASS approve, suspend, and reactivate update the account status');
    await evaluate('window.__failAction = true');
    await click('Suspend'); await wait(`document.querySelector('[role="alert"]')?.textContent.includes('Action denied')`);
    assert.equal(await evaluate(`document.querySelector('[data-admin-toast]').getAttribute('role')`), 'alert');
    assert.ok(await evaluate(`Boolean(${button('Active')})`));
    await evaluate('window.__failAction = false');
    console.log('PASS backend rejection keeps the existing status and displays the error');
    await click('Delete'); await wait(`document.querySelector('[role="alertdialog"]')`);
    assert.equal(await evaluate(`document.querySelector('[role="alertdialog"] p').textContent`), 'Are you sure you want to delete this account?');
    assert.equal(await evaluate('window.__writes.length'), 4);
    await click('Cancel');
    assert.equal(await evaluate('window.__writes.length'), 4);
    console.log('PASS cancel deletion sends no account deletion request');
    await evaluate(`document.querySelector('a[href="/admin/vendors"]').click()`);
    await wait(`${button('Suspend')}`);
    await click('Suspend'); await wait(`${button('Reactivate')}`);
    console.log('PASS seller account controls are connected');
    await evaluate('window.__failAction = true');
    await click('Delete'); await click('Yes');
    await wait(`!document.querySelector('[role="alertdialog"]')&&document.querySelector('[data-admin-toast]')?.textContent.includes('Action denied')`);
    await evaluate('window.__failAction = false');
    console.log('PASS rejected deletion keeps the account and shows an error toast above the closed dialog');
    await click('Delete'); await click('Yes');
    await wait(`${stat}?.includes('No seller accounts found')`);
    await wait(`document.querySelector('[data-admin-toast]')?.textContent.includes('Account deleted successfully.')`);
    console.log('PASS approval, suspension, reactivation, errors, and deletion show dismissible toasts; deletion toast survives row removal');
    assert.equal(await evaluate(`window.__writes.filter(row=>row.method==='DELETE').length`), 2);
    await evaluate(`document.querySelector('a[href="/admin/dashboard"]').click()`);
    await wait(`[...document.querySelectorAll('main div')].some(el=>el.textContent==='Total Users'&&el.nextElementSibling?.textContent==='25')`);
    console.log('PASS confirmed deletion removes account and updates dashboard count to 25');
    await evaluate(`sessionStorage.setItem('admin-fixture-users', JSON.stringify([
      {id:'layout-one',role:'seller',name:'First Seller',email:'first.seller@example.test',store:{name:'First Store'},status:'active'},
      {id:'layout-two',role:'seller',name:'A seller with a much longer account name',email:'a.very.long.seller.email.address.for.layout.verification@example.test',status:'pending'},
      {id:'layout-three',role:'seller',name:'Third Seller',email:'third.seller@example.test',status:'suspended'}
    ]));localStorage.setItem('alpha.vendor.storeProfiles.v1',JSON.stringify([{ownerKey:'layout-two',slug:'second-store',name:'Second Store With A Longer Name'}]));`);
    await send('Page.navigate', { url: 'http://127.0.0.1:3014/admin/vendors' });
    await wait(`${stat}?.includes('First Store')&&${stat}?.includes('Second Store With A Longer Name')`);
    assert.equal(await evaluate(`document.querySelector('[data-seller-row] a').textContent`), 'first.seller@example.test');
    assert.equal(await evaluate(`document.querySelectorAll('[data-seller-row]')[2].textContent.includes('Store name unavailable')`), true);
    const columns = await evaluate(`[...document.querySelectorAll('[data-seller-row]')].map(row=>[...row.children].map(cell=>Math.round(cell.getBoundingClientRect().left)))`);
    assert.deepEqual(columns[0], columns[1]);
    assert.deepEqual(columns[1], columns[2]);
    console.log('PASS seller emails and API/browser store names display in aligned desktop columns');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await wait(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`);
    assert.equal(await evaluate(`document.querySelectorAll('[data-seller-row]').length`), 3);
    console.log('PASS long seller names and emails fit the mobile layout');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:3014/admin/products#product-types' });
    await wait(`${stat}?.includes('Kit')&&${stat}?.includes('Boots')`);
    await click('View');
    await wait(`document.querySelector('dialog[open]')?.textContent.includes('Sportswear')`);
    assert.equal(await evaluate(`document.querySelector('dialog[open] dd').textContent`), 'Kit');
    await click('Close');
    await evaluate(`[...document.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('Boots')).querySelector('button').click()`);
    await wait(`document.querySelector('dialog[open]')?.textContent.includes('Football Equipment')`);
    await click('Close');
    console.log('PASS product type View reveals category names from list mappings and fetched details');
    await evaluate(`sessionStorage.setItem('catalog-use-cache','yes');localStorage.setItem('alpha.admin.product-types',JSON.stringify([{id:'tmppt-cached',name:'Cached Jerseys',categoryId:'sports',categoryName:'Sportswear'}]));`);
    await send('Page.reload', { ignoreCache: true });
    await wait(`${stat}?.includes('Cached Jerseys')`);
    await click('View');
    await wait(`document.querySelector('dialog[open]')?.textContent.includes('Sportswear')`);
    assert.equal(await evaluate(`window.__catalogReads.some(path=>path.includes('tmppt-'))`), false);
    await click('Close');
    console.log('PASS cached temporary types reveal their category without sending invalid IDs to the backend');
    assert.deepEqual(errors, []);
  } finally {
    await send('Page.close'); socket.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
