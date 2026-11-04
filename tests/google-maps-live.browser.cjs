// Uses the configured Google Maps service with a synthetic local buyer identity.
// No orders, payments, account changes or device location requests are submitted.
const assert = require('node:assert/strict');

async function main() {
  const origin = process.env.MAPS_SMOKE_ORIGIN || 'http://localhost:3011';
  const parsedOrigin = new URL(origin);
  assert.ok(['localhost', '127.0.0.1'].includes(parsedOrigin.hostname), 'Use a local preview origin for this synthetic identity check.');
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const requests = new Map(), mapErrors = new Set(), geocodingErrors = new Set();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.consoleAPICalled') {
      for (const argument of message.params.args) {
        // Record error codes only: Google diagnostics can contain the API key.
        const code = String(argument.value || '').match(/Google Maps JavaScript API error:\s*(\w+)/)?.[1];
        if (code) mapErrors.add(code);
        const diagnostic = String(argument.value || '');
        if (/geocod/i.test(diagnostic)) {
          if (/not authorized to use this API/i.test(diagnostic)) geocodingErrors.add('The API project or key is not authorized to use Geocoding API.');
          if (/billing/i.test(diagnostic)) geocodingErrors.add('Google reports a billing configuration issue.');
          if (/referer|referrer/i.test(diagnostic)) geocodingErrors.add('Google reports a website restriction issue.');
        }
      }
    }
    const request = requests.get(message.id);
    if (request) { requests.delete(message.id); if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; requests.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error('Browser evaluation failed.');
    return result.result.value;
  }
  async function wait(expression) {
    const started = Date.now();
    while (Date.now() - started < 30000) {
      if (await evaluate(expression)) return;
      if (mapErrors.size) throw new Error('Google Maps configuration: ' + [...mapErrors].join(', '));
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Map check timed out; verify network access and allowed website origins.');
  }
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('alpha.auth', JSON.stringify({access_token:'maps-smoke-token',user:{id:'maps-smoke-buyer',role:'buyer'}}));
      sessionStorage.removeItem('alpha.pending-checkout.v1:maps-smoke-buyer');
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.startsWith('/api/')) return Response.json({data:url==='/api/user/profile'?{id:'maps-smoke-buyer',role:'buyer'}:[]});
        return realFetch(input, init);
      };
    ` });
    await send('Page.navigate', { url: parsedOrigin.origin + '/dashboard/checkout' });
    const choose = `[...document.querySelectorAll('button')].find(button=>button.textContent==='Choose delivery location')`;
    await wait(`!!(${choose})`); await evaluate(`${choose}.click()`);
    await wait(`!!document.querySelector('dialog[open] .gm-style')`);
    // Google authorization errors can arrive after the map constructor succeeds.
    await new Promise(resolve => setTimeout(resolve, 5000));
    assert.equal(mapErrors.size, 0, 'Google Maps authorization: ' + [...mapErrors].join(', '));
    assert.equal(await evaluate(`document.querySelector('dialog[open]').innerText.includes('Click the map or drag the pin')`), true);
    const rect = await evaluate(`(()=>{const r=document.querySelector('[aria-label="Delivery map"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...rect, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...rect, button: 'left', clickCount: 1 });
    await wait(`document.querySelector('dialog[open]')?.innerText.includes('Location selected.')`);
    await evaluate(`[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='Use this delivery point').click()`);
    await wait(`!document.querySelector('dialog[open]')`);
    assert.equal(await evaluate(`document.body.innerText.includes('Delivery location selected.')`), true);
    console.log('PASS live map loads, accepts a clicked point and confirms delivery location on ' + parsedOrigin.origin + '.');
    const geocoding = await evaluate(`new Promise(resolve => {
      const timer = setTimeout(() => resolve({status:'TIMEOUT'}), 15000);
      new google.maps.Geocoder().geocode({address:'2 Kofo Abayomi Street, Victoria Island, Lagos, Nigeria',region:'ng'}, (results,status) => {
        clearTimeout(timer);
        const point=results?.[0]?.geometry?.location;
        resolve({status,validCoordinates:!!point&&Number.isFinite(point.lat())&&Number.isFinite(point.lng())});
      });
    })`);
    assert.equal(geocoding.status, 'OK', 'Live geocoding failed: ' + geocoding.status + '. ' + [...geocodingErrors].join(' ') + ' Check Geocoding API activation and website key API restrictions.');
    assert.equal(geocoding.validCoordinates, true, 'Live geocoding must return latitude and longitude.');
    console.log('PASS live Google Geocoding API converts a typed Lagos street address to coordinates.');
  } finally {
    await send('Page.close').catch(() => {}); socket.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
