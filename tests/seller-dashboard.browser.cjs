// Local browser QA with synthetic data. Requires Next.js on :3011 and Chrome CDP on :9228.
// No fixture data or credentials are sent to the real backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
    }
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  }
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async function waitFor(expression, timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 150)); }
    throw new Error('Timed out waiting for ' + expression);
  }
  async function screenshot(filename) {
    const response = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.resolve(__dirname, '..', filename), Buffer.from(response.data, 'base64'));
  }
  const fixtures = `
    if (location.pathname.startsWith('/vendor')) localStorage.setItem('alpha.auth', JSON.stringify({ access_token: 'synthetic-preview-token', user: { id: 'preview-seller', first_name: 'Francis', last_name: 'Ukugha', email: 'seller@example.test', role: 'seller', status: 'active' } }));
    const names = ['Everyday Canvas Tote', 'Studio Wireless Headphones', 'Ceramic Coffee Mug', 'Classic Leather Backpack', 'Linen Button-down Shirt', 'Minimal Desk Lamp'];
    const products = names.map((name, i) => ({ id: 'product-' + i, name, seller_id: 'preview-seller', category_name: ['Accessories', 'Electronics', 'Home & living'][i % 3], base_price: 15000 + i * 8500, stock: [24, 7, 0, 18, 4, 12][i], status: i === 4 ? 'draft' : 'publish' }));
    const orders = Array.from({ length: 20 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - i); date.setHours(12, 0, 0, 0); if (date > new Date()) date.setHours(0); return { id: 'ORDER-2026-' + String(1200 + i), seller_id: 'preview-seller', customer_name: ['Amara Okafor', 'Tunde Bakare', 'Zara Bello', 'David Eze', 'Aisha Ibrahim'][i % 5], total_amount: [48500, 32000, 26500, 75000, 18000][i % 5], payment_status: i === 3 ? 'pending' : 'paid', status: i === 3 ? 'pending' : i < 3 ? 'processing' : i === 4 ? 'failed_delivery' : 'delivered', created_at: date.toISOString() }; });
    const realFetch = window.fetch.bind(window);
    window.__sellerPreviewMode = 'normal';
    window.__sellerRequests = [];
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('/api/')) {
        window.__sellerRequests.push(url);
        if (window.__sellerPreviewMode === 'error' && url.startsWith('/api/seller/orders')) return Response.json({ error: 'Synthetic order service failure' }, { status: 503 });
        if (url.startsWith('/api/seller/products')) return Response.json({ data: { products: window.__sellerPreviewMode === 'empty' ? [] : products } });
        if (url.startsWith('/api/seller/orders')) return Response.json({ data: { orders: window.__sellerPreviewMode === 'empty' ? [] : orders } });
        return Response.json({ data: [] });
      }
      return realFetch(input, init);
    };
  `;
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fixtures });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1120, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:3011/vendor' });
    await waitFor(`document.querySelector('h1')?.textContent.includes('Francis') && document.body.textContent.includes('ORDER') === false && document.querySelectorAll('tbody tr').length === 5`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), true, 'Desktop page overflow');
    assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Store performance"] a').length`), 4);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Store performance"]').textContent.includes('Orders to fulfill3')`), true);
    await screenshot('.admin-preview-seller-desktop.png');
    const report = await evaluate(`(async () => { const originalURL = URL.createObjectURL; const originalClick = HTMLAnchorElement.prototype.click; let file; URL.createObjectURL = blob => { file = blob; return originalURL(blob); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) originalClick.call(this); }; try { Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Export report')).click(); return await file.text(); } finally { URL.createObjectURL = originalURL; HTMLAnchorElement.prototype.click = originalClick; } })()`);
    assert.equal(report.includes('"Amount (NGN)"'), true);
    assert.equal(report.split('\r\n').length, 21);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.startsWith('To fulfill')).click()`);
    await waitFor(`document.querySelectorAll('tbody tr').length === 3`);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'All orders').click()`);
    await evaluate(`document.querySelector('[aria-label="Sales reporting period"]').value = '7'; document.querySelector('[aria-label="Sales reporting period"]').dispatchEvent(new Event('change', { bubbles: true }))`);
    await waitFor(`document.querySelector('[aria-label="Store performance"]').textContent.includes('last 7 days')`);
    await evaluate(`document.querySelector('[aria-label="Sales reporting period"]').value = '30'; document.querySelector('[aria-label="Sales reporting period"]').dispatchEvent(new Event('change', { bubbles: true }))`);
    await evaluate(`const input = document.querySelector('[aria-label="Search your products"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Canvas'); input.dispatchEvent(new Event('input', { bubbles: true }))`);
    await evaluate(`document.querySelector('form[role="search"]').requestSubmit()`);
    await waitFor(`location.search.includes('Canvas') && document.querySelectorAll('#products a[href^="/vendor/products/product-"]').length === 1`);
    await evaluate(`window.history.back()`);
    await waitFor(`!location.search`);
    await evaluate(`document.querySelector('[aria-label="Collapse sidebar"]').click()`);
    assert.equal(await evaluate(`Math.round(document.querySelector('aside').getBoundingClientRect().width)`), 77);
    await evaluate(`document.querySelector('[aria-label="Expand sidebar"]').click()`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate(`window.scrollTo(0, 0)`);
    await new Promise(resolve => setTimeout(resolve, 350));
    const mobileDimensions = await evaluate(`({ inner: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, visual: visualViewport.width, elements: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 2).slice(0, 30).map(e => ({ tag: e.tagName, cls: typeof e.className === 'string' ? e.className : '', width: e.getBoundingClientRect().width, right: e.getBoundingClientRect().right, overflow: getComputedStyle(e).overflowX })) })`);
    if (mobileDimensions.scroll > mobileDimensions.client) console.log(JSON.stringify(mobileDimensions, null, 2));
    assert.equal(mobileDimensions.scroll <= mobileDimensions.client, true, 'Mobile page overflow');
    await screenshot('.admin-preview-seller-mobile.png');
    await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);
    assert.equal(await evaluate(`document.querySelector('dialog[aria-label="Seller navigation"]').open`), true);
    await screenshot('.admin-preview-seller-mobile-menu.png');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor(`!document.querySelector('dialog[aria-label="Seller navigation"]').open`);
    await evaluate(`window.__sellerPreviewMode = 'error'; document.querySelector('[aria-label="Refresh dashboard"]').click()`);
    await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Synthetic order service failure')`);
    assert.equal(await evaluate(`document.querySelectorAll('tbody tr').length`), 5, 'Last good orders should remain visible after a failed refresh');
    await evaluate(`window.__sellerPreviewMode = 'empty'; document.querySelector('[aria-label="Refresh dashboard"]').click()`);
    await waitFor(`document.body.textContent.includes('Your next chapter starts with a sale.') && document.body.textContent.includes('Give your store something to show.')`);
    await screenshot('.admin-preview-seller-empty.png');
    await evaluate(`document.querySelector('[aria-label="Account menu"]').click(); Array.from(document.querySelectorAll('details button')).find(b => b.textContent === 'Sign out').click()`);
    assert.equal(await evaluate(`document.querySelector('dialog[aria-labelledby="seller-logout-title"]').open`), true);
    await evaluate(`Array.from(document.querySelectorAll('dialog button')).find(b => b.textContent === 'Stay signed in').click()`);
    assert.equal(await evaluate(`Boolean(localStorage.getItem('alpha.auth'))`), true);
    await evaluate(`document.querySelector('[aria-label="Account menu"]').click(); Array.from(document.querySelectorAll('details button')).find(b => b.textContent === 'Sign out').click(); Array.from(document.querySelectorAll('dialog button')).find(b => b.textContent === 'Sign out').click()`);
    await waitFor(`location.pathname === '/login/vendor' && !localStorage.getItem('alpha.auth')`);
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(JSON.stringify({ passed: true, checks: ['desktop layout', 'mobile layout', 'paid fulfillment count', 'CSV export', 'order filters', 'date filter', 'product search', 'sidebar collapse', 'mobile drawer and Escape', 'partial failure recovery', 'empty states', 'sign-out cancellation', 'sign-out clears authentication'], screenshots: ['.admin-preview-seller-desktop.png', '.admin-preview-seller-mobile.png', '.admin-preview-seller-mobile-menu.png', '.admin-preview-seller-empty.png'] }, null, 2));
  } finally { socket.close(); await fetch('http://127.0.0.1:9228/json/close/' + target.id); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
