// Local-only browser QA: Next.js :3011, dedicated Chrome CDP :9228. No backend transactions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0; const pending = new Map(); const errors = []; let checks = 0;
  socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text);
    if (value.id && pending.has(value.id)) { const item = pending.get(value.id); pending.delete(value.id); value.error ? item.reject(new Error(value.error.message)) : item.resolve(value.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
  async function wait(expression) { const start = Date.now(); while (Date.now() - start < 60000) { if (await evaluate('!!document.body && (' + expression + ')')) return; await new Promise(resolve => setTimeout(resolve, 120)); } throw new Error('Timed out: ' + expression); }
  async function click(label) { await wait(`!![...document.querySelectorAll('button')].find(item => item.textContent.trim() === ${JSON.stringify(label)} && !item.disabled)`); await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw new Error('Button unavailable: ' + ${JSON.stringify(label)}); button.click(); })()`); }
  async function input(selector, value) { await evaluate(`(() => { const item = document.querySelector(${JSON.stringify(selector)}); const prototype = item.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(item, ${JSON.stringify(value)}); item.dispatchEvent(new Event('input', { bubbles: true })); item.dispatchEvent(new Event('change', { bubbles: true })); })()`); }
  async function check(expression, label) { assert.equal(await evaluate(expression), true, label); checks++; console.log('PASS ' + label); }
  async function screenshot(name) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.resolve(__dirname, '..', name), Buffer.from(result.data, 'base64')); }
  const fixtures = `
    localStorage.setItem('alpha.auth', JSON.stringify({ access_token: 'synthetic-payout-token', user: { id: 'seller-preview', role: new URLSearchParams(location.search).has('buyer') ? 'buyer' : 'seller', first_name: 'Seller', last_name: 'Preview' } }));
    window.__calls = []; window.__writes = []; window.__available = 15000.5; window.__pending = 2500;
    window.__account = { account_number: '0123456789', bank_code: '001', bank_name: 'Preview Bank', account_name: 'Preview Seller' };
    window.__history = [{ id: 'withdrawal-pending', amount: 2500, status: 'pending', created_at: '2026-10-28T12:00:00Z', reference: 'preview-reference' }, { id: 'withdrawal-paid', amount: 4000, status: 'paid', created_at: '2026-10-27T12:00:00Z' }];
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('/api/')) return realFetch(input, init);
      window.__calls.push({ url, method: init.method || 'GET', authorization: init.headers?.Authorization });
      const parsed = new URL(url, location.origin), endpoint = parsed.pathname.replace('/api/payouts/', '');
      const method = init.method || 'GET';
      if (!url.startsWith('/api/payouts/')) return Response.json({ data: {} });
      if (method !== 'GET') {
        const body = init.body ? JSON.parse(init.body) : null; window.__writes.push({ endpoint, method, body });
        if (window.__failWrite) return Response.json({ error: 'The response could not be confirmed.' }, { status: 502 });
        if (endpoint === 'account') window.__account = { ...body, account_name: 'Verified Seller', bank_name: 'Second Bank' };
        if (endpoint === 'withdrawals') { window.__available -= body.amount; window.__pending += body.amount; window.__history.unshift({ id: 'new-withdrawal', amount: body.amount, status: 'pending', created_at: '2026-10-29T12:00:00Z' }); }
        if (endpoint.endsWith('/cancel')) { const id = endpoint.split('/')[1]; const item = window.__history.find(item => item.id === id); item.status = 'cancelled'; window.__available += item.amount; window.__pending -= item.amount; }
        return Response.json({ success: true }, { status: endpoint === 'withdrawals' ? 201 : 200 });
      }
      if (endpoint === 'summary') return window.__summaryFail ? Response.json({ error: 'Preview unavailable' }, { status: 503 }) : Response.json({ data: { available_balance: window.__available, pending_withdrawals_amount: window.__pending } });
      if (endpoint === 'account') return window.__account404 ? Response.json({ error: 'No payout account saved' }, { status: 404 }) : Response.json({ data: window.__account });
      if (endpoint === 'banks') return Response.json({ data: [{ name: 'Preview Bank', code: '001' }, { name: 'Second Bank', code: '002' }] });
      if (endpoint === 'resolve') return Response.json({ data: { account_name: 'Verified Seller', account_number: parsed.searchParams.get('account_number') } });
      if (endpoint === 'withdrawals') { const offset = Number(parsed.searchParams.get('offset')); return Response.json({ data: { withdrawals: window.__history.slice(offset, offset + 20) } }); }
      if (endpoint.startsWith('withdrawals/')) return Response.json({ data: window.__history.find(item => item.id === endpoint.split('/')[1]) });
      return Response.json({ error: 'Unexpected preview endpoint' }, { status: 404 });
    };
  `;
  try {
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fixtures });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:3011/vendor/payments' });
    await wait(`document.body.innerText.includes('15,000.50') && !document.body.innerText.includes('Refreshing...')`);
    await check(`document.querySelector('a[href="/vendor/payments"][aria-current="page"]') !== null`, 'seller navigation opens payments');
    await check(`__calls.filter(item => item.url.startsWith('/api/payouts/')).every(item => item.authorization === 'Bearer synthetic-payout-token')`, 'all payout requests use the current seller token');
    await check(`!document.body.innerText.includes('0123456789') && document.body.innerText.includes('6789')`, 'saved account is masked');
    await check(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`, 'desktop fits viewport');
    await input('select', '002'); await input('input[pattern]', '0987654321'); await click('Verify account');
    await wait(`document.body.innerText.includes('Verified Seller')`);
    await check(`__writes.length === 0`, 'account verification does not save or withdraw');
    await input('input[pattern]', '0987654322');
    await check(`![...document.querySelectorAll('button')].some(item => item.textContent === 'Save payout account')`, 'editing account details invalidates verification');
    await click('Verify account'); await wait(`document.body.innerText.includes('Verified Seller')`); await click('Save payout account');
    await wait(`document.querySelector('dialog[open]') !== null`); await click('Go back');
    await check(`__writes.length === 0`, 'cancelling bank confirmation sends no update');
    await click('Save payout account'); await click('Confirm bank account');
    await wait(`document.body.innerText.includes('Bank account saved.') && !document.body.innerText.includes('Refreshing...')`);
    await check(`__writes.length === 1 && __writes[0].method === 'PUT' && __writes[0].body.bank_code === '002' && __writes[0].body.account_number === '0987654322'`, 'verified bank details save through payout account endpoint');
    await input('input[inputmode="decimal"]', '16000'); await click('Review withdrawal');
    await check(`document.body.innerText.includes('exceeds your available balance') && !document.querySelector('dialog[open]')`, 'overdrawn amount is rejected before submission');
    await input('input[inputmode="decimal"]', '1000.25'); await click('Review withdrawal');
    await check(`document.querySelector('dialog[open]').innerText.includes('1,000.25') && document.querySelector('dialog[open]').innerText.includes('Verified Seller') && __writes.length === 1`, 'withdrawal confirmation shows amount and saved destination before sending');
    await click('Go back'); await check(`__writes.length === 1`, 'cancelling withdrawal confirmation sends no request');
    await click('Review withdrawal');
    await evaluate(`(() => { const form = document.querySelector('dialog[open] form'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })()`);
    await wait(`document.body.innerText.includes('Withdrawal request submitted') && !document.body.innerText.includes('Refreshing...')`);
    await check(`__writes.filter(item => item.endpoint === 'withdrawals').length === 1 && __writes.find(item => item.endpoint === 'withdrawals').body.amount === 1000.25 && document.body.innerText.includes('14,000.25')`, 'double submission creates one request in naira and refreshes authoritative balance');
    await click('View details'); await wait(`document.querySelector('dialog[open]')?.innerText.includes('new-withdrawal')`);
    await check(`__calls.some(item => item.url === '/api/payouts/withdrawals/new-withdrawal')`, 'withdrawal detail loads its dedicated endpoint');
    await click('Close'); await click('Cancel request'); await click('Go back');
    await check(`!__writes.some(item => item.endpoint.endsWith('/cancel'))`, 'backing out of cancellation sends no request');
    await click('Cancel request'); await click('Confirm cancellation');
    await wait(`document.body.innerText.includes('Cancellation request accepted') && !document.body.innerText.includes('Refreshing...')`);
    await check(`__writes.some(item => item.endpoint === 'withdrawals/new-withdrawal/cancel') && document.body.innerText.includes('15,000.50')`, 'pending withdrawal cancellation refreshes history and balance');
    await evaluate(`window.__failWrite = true`); await input('input[inputmode="decimal"]', '500'); await click('Review withdrawal'); await click('Confirm withdrawal');
    await wait(`document.body.innerText.includes('earlier payout action needs review') && !document.querySelector('dialog[open]')`);
    await check(`[...document.querySelectorAll('button')].find(item => item.textContent === 'Review withdrawal').disabled && sessionStorage.getItem('alpha.payout-review.v1:seller-preview') === '1'`, 'uncertain request blocks additional actions and persists review state');
    await send('Page.reload'); await wait(`document.body.innerText.includes('15,000.50') && !document.body.innerText.includes('Refreshing...')`);
    await check(`document.body.innerText.includes('earlier payout action needs review')`, 'reload does not replay or unlock an uncertain request');
    await click('Refresh payouts'); await wait(`!document.body.innerText.includes('earlier payout action needs review') && !document.body.innerText.includes('Refreshing...')`);
    await check(`sessionStorage.getItem('alpha.payout-review.v1:seller-preview') === null`, 'explicit successful refresh clears review lock');
    await evaluate(`window.__available = undefined; window.__history = []`); await click('Refresh payouts'); await wait(`document.body.innerText.includes('No withdrawals on this page.')`);
    await check(`document.body.innerText.includes('Not reported') && [...document.querySelectorAll('button')].find(item => item.textContent === 'Review withdrawal').disabled`, 'missing balance stays unknown and empty history is explicit');
    await evaluate(`window.__summaryFail = true`); await click('Refresh payouts'); await wait(`document.body.innerText.includes('Balance: Preview unavailable')`);
    await check(`[...document.querySelectorAll('button')].find(item => item.textContent === 'Review withdrawal').disabled`, 'balance failures disable withdrawal');
    await evaluate(`window.__summaryFail = false; window.__available = 15000.5; window.__account = null; window.__account404 = true`); await click('Refresh payouts'); await wait(`document.body.innerText.includes('No payout account saved')`);
    await input('select', '002'); await input('input[pattern]', '0987654321'); await click('Verify account'); await wait(`document.body.innerText.includes('Verified Seller')`); await click('Save payout account');
    await check(`![...document.querySelectorAll('dialog[open] button')].find(item => item.textContent === 'Confirm bank account').disabled`, 'first bank can be saved when account lookup reports no saved account'); await click('Go back');
    await evaluate(`window.__account404 = false; window.__account = { account_number: '0123456789', bank_name: 'Preview Bank', account_name: 'Preview Seller' }; window.__history = Array.from({ length: 21 }, (_, index) => ({ id: 'page-' + index, amount: 100, status: 'paid' }));`);
    await click('Refresh payouts'); await wait(`document.body.innerText.includes('page-19')`); await click('Next'); await wait(`document.body.innerText.includes('Page 2') && document.body.innerText.includes('page-20')`);
    await check(`__calls.some(item => item.url.includes('offset=20')) && !document.body.innerText.includes('page-19')`, 'history pagination uses API offset');
    await click('Previous'); await wait(`document.body.innerText.includes('page-19')`);
    await screenshot('.admin-preview-payouts-desktop.png');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await check(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`, 'mobile fits viewport with scrollable history');
    await screenshot('.admin-preview-payouts-mobile.png');
    await evaluate(`localStorage.setItem('alpha.auth', JSON.stringify({ access_token: 'other-token', user: { id: 'other-seller', role: 'seller' } })); window.__summaryFail = true; window.dispatchEvent(new Event('alpha-auth-updated'));`);
    await wait(`document.body.innerText.includes('Balance: Preview unavailable')`);
    await check(`!document.body.innerText.includes('15,000.50')`, 'account switch clears previous available balance');
    await send('Page.navigate', { url: 'http://127.0.0.1:3011/vendor/payments?buyer=1' }); await wait(`document.body.innerText.includes('Sign in with your seller account')`);
    await check(`!__calls.some(item => item.url.startsWith('/api/payouts/'))`, 'non-seller screen does not load payout data');
    assert.deepEqual(errors, []); console.log(checks + ' payout browser checks passed.');
  } finally { await send('Page.close').catch(() => {}); socket.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
