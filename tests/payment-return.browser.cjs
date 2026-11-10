// All API responses and account/payment identities in this check are synthetic.
const assert = require('node:assert/strict');

async function main() {
  const origin = 'http://127.0.0.1:3011';
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0, checks = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text);
    if (pending.has(value.id)) {
      const task = pending.get(value.id); pending.delete(value.id);
      if (value.error) task.reject(new Error(value.error.message)); else task.resolve(value.result);
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
    const start = Date.now();
    while (Date.now() - start < 60000) {
      if (await evaluate(`!!document.body && (${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'));
  }
  async function check(expression, label) {
    assert.equal(await evaluate(expression), true, label); checks++; console.log('PASS ' + label);
  }
  const fixture = `
    const testReference=new URL(location.href).searchParams.get('reference');
    const buyer={id:'return-buyer',role:'buyer',first_name:'Test'};
    const cart=[{id:'test-product',name:'Test product',price:9000,qty:1}];
    localStorage.setItem('alpha.auth',JSON.stringify({access_token:'return-test-token',user:buyer}));
    localStorage.setItem('alpha_cart_v1:return-buyer',JSON.stringify({items:cart}));
    sessionStorage.removeItem('alpha.last-paid-checkout.v1:return-buyer');
    sessionStorage.removeItem('alpha.pending-checkout.v1:return-buyer');
    if(testReference!=='qa-no-session')sessionStorage.setItem('alpha.pending-checkout.v1:return-buyer',JSON.stringify({buyerId:buyer.id,orderIds:['return-order'],cartKey:JSON.stringify(cart),submitted:true,reference:testReference==='qa-mismatch'?'qa-original':testReference}));
    window.__calls=[];
    const realFetch=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:input.url;
      if(!url.startsWith('/api/'))return realFetch(input,init);
      __calls.push({url,method:init.method||'GET'});
      if(url==='/api/user/profile')return Response.json({data:buyer});
      if(url.startsWith('/api/payments/callback?'))return Response.json({verification_requested:true});
      if(url==='/api/user/orders/return-order')return Response.json({data:{ID:'return-order',BuyerID:buyer.id,PaymentStatus:testReference==='qa-paid'?'paid':'pending'}});
      return Response.json({data:[]});
    };
  `;
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fixture });
    await send('Page.navigate', { url: origin + '/payment-processing?reference=qa-paid' });
    await wait("document.body.innerText.includes('Payment confirmed by the backend')");
    await check("location.pathname==='/dashboard/checkout/payment'&&new URL(location.href).searchParams.get('reference')==='qa-paid'", 'backend return path reaches the existing status page with its reference');
    await check("__calls.some(c=>c.url==='/api/payments/callback?reference=qa-paid')&&__calls.some(c=>c.url==='/api/user/orders/return-order')", 'confirmation verifies the callback and reads the saved order status');
    await check("!sessionStorage.getItem('alpha.pending-checkout.v1:return-buyer')&&!!sessionStorage.getItem('alpha.last-paid-checkout.v1:return-buyer')&&JSON.parse(localStorage.getItem('alpha_cart_v1:return-buyer')).items.length===0", 'confirmed payment completes saved checkout and clears the submitted cart');
    await send('Page.navigate', { url: origin + '/payment-processing?reference=qa-pending' });
    await wait("document.body.innerText.includes('Payment has not been confirmed yet')");
    await check("!document.body.innerText.includes('Payment confirmed by the backend')&&!!sessionStorage.getItem('alpha.pending-checkout.v1:return-buyer')&&JSON.parse(localStorage.getItem('alpha_cart_v1:return-buyer')).items.length===1", 'callback success cannot confirm a pending order or clear its cart');
    await send('Page.navigate', { url: origin + '/payment-processing?reference=qa-mismatch' });
    await wait("document.body.innerText.includes('does not match the saved checkout')");
    await check("!__calls.some(c=>c.url.startsWith('/api/payments/')||c.url.startsWith('/api/user/orders/'))", 'a mismatched reference cannot verify another checkout');
    await send('Page.navigate', { url: origin + '/payment-processing?reference=qa-no-session' });
    await wait("document.body.innerText.includes('No saved payment was found')");
    await check("!__calls.some(c=>c.url.startsWith('/api/payments/')||c.url.startsWith('/api/user/orders/'))&&!![...document.querySelectorAll('a')].find(a=>a.textContent==='View my orders')", 'missing browser checkout shows order recovery without manufacturing payment success');
    assert.deepEqual(errors, []);
    console.log(checks + ' payment return browser checks passed.');
  } finally {
    await send('Page.close').catch(() => {}); socket.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
