// Local-only Chrome QA. Next.js :3011, dedicated Chrome CDP :9228. All API traffic is mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0; const pending = new Map(); const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
  async function wait(expression) { const start = Date.now(); while (Date.now() - start < 60000) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 150)); } throw new Error('Timed out: ' + expression); }
  async function screenshot(name) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.resolve(__dirname, '..', name), Buffer.from(result.data, 'base64')); }
  const fixtures = `
    const admin = location.pathname.startsWith('/admin'); const seller = location.pathname.startsWith('/vendor');
    localStorage.setItem('alpha.auth', JSON.stringify({ access_token: 'synthetic-escrow-preview', user: { id: admin ? 'admin' : seller ? 'recipient' : 'customer', role: admin ? 'marketplace_admin' : seller ? 'seller' : 'buyer', first_name: 'Preview', last_name: 'Account' } }));
    window.__calls = []; window.__mutations = []; window.__failRelease = false;
    window.__pendingEscrows = [
      { escrow_id: 'es-market', order_id: 'order-one', source: 'marketplace', buyer_name: 'Customer one', seller_name: 'Store recipient', amount: 25000, status: 'held' },
      { escrow_id: 'es-rider', order_id: 'delivery-one', source: 'rider_app_customer', buyer_name: 'Delivery customer', rider_name: 'Rider recipient', amount: 4500, status: 'held' },
      { order_id: 'order-only', source: 'seller', amount: null, status: 'pending' },
      { escrow_id: 'es-done', source: 'marketplace', status: 'released' },
    ];
    window.__order = { id: 'order-one', buyer_id: new URLSearchParams(location.search).has('other') ? 'someone-else' : 'customer', seller_id: 'recipient', status: 'delivered', payment_status: 'paid', escrow_status: 'held', total_amount: 25000, dropoff_address: 'Preview delivery address', items: [] };
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('/api/')) return realFetch(input, init);
      window.__calls.push(url);
      if (init.method === 'POST' && url.startsWith('/api/admin/escrows/')) {
        window.__mutations.push({ url, body: init.body ? JSON.parse(init.body) : null });
        if (window.__failRelease && url.endsWith('/release')) return Response.json({ error: 'The action result could not be confirmed.' }, { status: 502 });
        const id = decodeURIComponent(url.split('/')[4]); window.__pendingEscrows = window.__pendingEscrows.filter(item => item.escrow_id !== id);
        return Response.json({ success: true });
      }
      if (url.startsWith('/api/admin/escrows/pending')) return Response.json({ data: { escrows: window.__pendingEscrows } });
      if (url.startsWith('/api/admin/escrows/timed-out')) return Response.json({ data: [{ escrow_id: 'es-timeout', order_id: 'delivery-timeout', source: 'rider', status: 'timed_out', amount: 6000 }] });
      if (url.startsWith('/api/admin/orders')) return Response.json({ data: [window.__order] });
      if (url.includes('/confirm-delivery') && init.method === 'POST') { window.__mutations.push({ url }); window.__order = { ...window.__order, status: 'confirmed', escrow_status: 'released' }; return Response.json({ success: true }); }
      if (url.startsWith('/api/user/orders/') || url.startsWith('/api/seller/orders/')) return Response.json({ data: window.__order });
      return Response.json({ data: [] });
    };
  `;
  const article = id => `Array.from(document.querySelectorAll('article')).find(a => a.textContent.includes('${id}'))`;
  const clickAction = async (id, text) => evaluate(`${article(id)} && Array.from(${article(id)}.querySelectorAll('button')).find(b => b.textContent === '${text}').click()`);
  const clickDialog = text => evaluate(`Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent === '${text}').click()`);
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fixtures });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:3011/admin/orders' });
    await wait(`document.querySelectorAll('article').length === 4`);
    assert.equal(await evaluate(`document.body.textContent.includes('rider app customer') && document.body.textContent.includes('marketplace')`), true);
    assert.equal(await evaluate(`Array.from(${article('order-only')}.querySelectorAll('button')).every(b => b.disabled)`), true);
    assert.equal(await evaluate(`Array.from(${article('es-done')}.querySelectorAll('button')).every(b => b.disabled)`), true);
    await screenshot('.admin-preview-escrow-desktop.png');
    await clickAction('es-market', 'Release funds'); await wait(`Boolean(document.querySelector('dialog[open]'))`);
    await clickDialog('Cancel'); assert.equal(await evaluate(`window.__mutations.length`), 0);
    await clickAction('es-rider', 'Reverse escrow'); await wait(`Boolean(document.querySelector('dialog[open]'))`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('dialog[open] button')).find(b => b.textContent === 'Confirm reversal').disabled`), true);
    await evaluate(`const textarea = document.querySelector('dialog[open] textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Customer requested cancellation'); textarea.dispatchEvent(new Event('input', { bubbles: true }))`);
    await clickDialog('Confirm reversal'); await wait(`!${article('es-rider')}`);
    assert.deepEqual(await evaluate(`window.__mutations[0]`), { url: '/api/admin/escrows/es-rider/reverse', body: { notes: 'Customer requested cancellation' } });
    await evaluate(`window.__failRelease = true`);
    await clickAction('es-market', 'Release funds'); await clickDialog('Confirm release');
    await wait(`document.querySelector('[role="alert"]')?.textContent.includes('could not be confirmed')`);
    assert.equal(await evaluate(`window.__mutations.length`), 2);
    assert.equal(await evaluate(`Array.from(${article('es-market')}.querySelectorAll('button')).every(b => b.disabled)`), true);
    await evaluate(`window.__failRelease = false; Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Refresh queue').click()`);
    await wait(`!Array.from(${article('es-market')}.querySelectorAll('button')).find(b => b.textContent === 'Release funds').disabled`);
    await clickAction('es-market', 'Release funds'); await clickDialog('Confirm release'); await wait(`!${article('es-market')}`);
    assert.equal(await evaluate(`window.__mutations.length`), 3);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Timed-out escrows').click()`);
    await wait(`Boolean(${article('es-timeout')})`);
    assert.equal(await evaluate(`window.__mutations.length`), 3);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate(`window.scrollTo(0, 0)`); await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), true);
    await screenshot('.admin-preview-escrow-mobile.png');
    await evaluate(`const auth = JSON.parse(localStorage.getItem('alpha.auth')); auth.user.role = 'buyer'; localStorage.setItem('alpha.auth', JSON.stringify(auth)); window.dispatchEvent(new Event('alpha-auth-updated'))`);
    await wait(`document.body.textContent.includes('An authorized administrator account is required')`);
    assert.equal(await evaluate(`document.querySelectorAll('article button').length`), 0);
    await send('Page.navigate', { url: 'http://localhost:3011/dashboard/orders/order-one' });
    await wait(`Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Confirm receipt')`);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Confirm receipt').click()`);
    await clickDialog('Cancel'); assert.equal(await evaluate(`window.__mutations.length`), 0);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Confirm receipt').click()`);
    await clickDialog('Yes, confirm receipt');
    await wait(`document.querySelector('[aria-label="Escrow status"]')?.textContent.includes('released')`);
    assert.deepEqual(await evaluate(`window.__mutations.map(m => m.url)`), ['/api/buyer/orders/order-one/confirm-delivery']);
    await send('Page.navigate', { url: 'http://localhost:3011/dashboard/orders/order-one?other=1' });
    await wait(`Boolean(document.querySelector('[aria-label="Escrow status"]'))`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Confirm receipt')`), false);
    await send('Page.navigate', { url: 'http://localhost:3011/vendor/orders/order-one' });
    await wait(`Boolean(document.querySelector('[aria-label="Escrow status"]'))`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).some(b => ['Confirm receipt', 'Release funds', 'Reverse escrow'].includes(b.textContent))`), false);
    assert.equal(await evaluate(`window.__calls.some(url => url.startsWith('/api/admin/escrows'))`), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['all categories visible', 'escrow IDs distinct from order IDs', 'terminal records cannot be resolved', 'cancel sends no request', 'reversal requires notes', 'reversal uses correct escrow ID and notes', 'uncertain action blocks repeat', 'explicit refresh recovers action controls', 'successful release refreshes queue', 'timed-out queue does not auto-resolve', 'mobile layout', 'non-admin actions unavailable', 'receipt cancellation', 'receipt confirmation refreshes backend status', 'non-owner cannot confirm receipt', 'seller sees escrow without admin powers'] }, null, 2));
  } finally { socket.close(); await fetch('http://127.0.0.1:9228/json/close/' + target.id); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
