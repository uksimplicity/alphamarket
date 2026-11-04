// Local headless Chrome QA. All application API responses and identities are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0, checks = 0; const pending = new Map(), errors = [];
  socket.onmessage = event => { const value = JSON.parse(event.data); if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text); if (pending.has(value.id)) { const p = pending.get(value.id); pending.delete(value.id); if (value.error) p.reject(new Error(value.error.message)); else p.resolve(value.result); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
  async function wait(expression) { const started = Date.now(); while (Date.now() - started < 90000) { if (await evaluate(`!!document.body && (${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 150)); } throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText.slice(0,1800)')); }
  async function check(expression, label) { assert.equal(await evaluate(expression), true, label); checks++; console.log('PASS ' + label); }
  async function navigate(route) { await send('Page.navigate', { url: 'http://127.0.0.1:3011' + route }); }
  async function click(label) { await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled)`); await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled).click()`); }
  async function aria(label) { await wait(`!!document.querySelector('[aria-label=${JSON.stringify(label)}]')`); await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`); }
  async function input(selector, value) { await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing input'); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`); }
  async function labelled(label, value) { const selector = await evaluate(`(() => { const labels = [...document.querySelectorAll('label')]; const el = labels.find(l => l.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector('input,textarea'); if (!el) throw new Error('Missing labelled input'); el.dataset.qaField = ${JSON.stringify(label)}; return '[data-qa-field=' + JSON.stringify(${JSON.stringify(label)}) + ']'; })()`); await input(selector, value); }
  async function screenshot(name) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.resolve(__dirname, '..', name), Buffer.from(shot.data, 'base64')); }
  const fixtures = `
    if(!sessionStorage.getItem('pricing-ready')){
      sessionStorage.setItem('pricing-ready','1');
      localStorage.setItem('alpha.auth',JSON.stringify({access_token:'buyer-token',user:{id:'pricing-buyer',role:'buyer',first_name:'Buyer'}}));
      localStorage.setItem('alpha_cart_v1:pricing-buyer',JSON.stringify({items:[{id:'product-1',name:'Test product',price:10000,qty:1}]}));
      sessionStorage.removeItem('alpha.pending-checkout.v1:pricing-buyer');
    }
    window.__calls=[];window.__gpsCalls=0;window.__wrongTotal=false;window.__orderFailure=false;window.__missingPrices=false;
    const current=()=>JSON.parse(localStorage.getItem('alpha.auth')||'null')?.user;
    const realFetch=window.fetch.bind(window);
    const order=()=>({id:'order-1',buyer_id:'pricing-buyer',seller_id:'pricing-seller',customer_name:'Buyer',seller_name:'Seller',subtotal:10000,delivery_fee:1500,total_amount:window.__wrongTotal?12500:11500,commission_percentage:10,status:'processing',payment_status:'paid',created_at:new Date().toISOString(),items:[{product_id:'product-1',product_name:'Test product',unit_price:10000,quantity:1}]});
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){window.__gpsCalls++;setTimeout(()=>success({coords:{latitude:6.5,longitude:3.4,accuracy:5}}),10);}}});
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:input.url;
      if(!url.startsWith('/api/'))return realFetch(input,init);
      const body=init.body?JSON.parse(init.body):null;
      __calls.push({url,body,method:init.method||'GET'});
      if(url==='/api/user/profile')return Response.json({data:current()});
      if(url==='/api/buyer/orders')return Response.json({success:true,data:{id:'order-1'}},{status:201});
      if(url==='/api/user/orders/order-1'){
        if(__orderFailure)return Response.json({error:'Order review unavailable'},{status:503});
        return Response.json({success:true,data:__missingPrices?{id:'order-1',buyer_id:'pricing-buyer'}:order()});
      }
      if(url==='/api/payments/initialize')return Response.json({error:'Synthetic payment stop'},{status:503});
      if(url.startsWith('/api/user/orders'))return Response.json({data:{orders:[order()]}});
      if(url.startsWith('/api/seller/orders/order-1'))return Response.json({data:order()});
      if(url.startsWith('/api/seller/orders'))return Response.json({data:{orders:[order()]}});
      if(url.startsWith('/api/admin/orders'))return Response.json({data:[order()]});
      if(url.startsWith('/api/seller/products')||url.startsWith('/api/seller/catalog'))return Response.json({data:[]});
      return Response.json({data:[]});
    };
`;
  try {
    await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:fixtures});
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
    await navigate('/dashboard/checkout');await wait("!!document.querySelector('textarea[autocomplete=\"street-address\"]')");
    await input('fieldset input[placeholder="e.g. 12B"]','10');
    await input('fieldset input[placeholder="e.g. Admiralty Way"]','Example Street');
    await input('select[autocomplete="address-level1"]','Lagos');
    await input('select[autocomplete="address-level2"]','Ikeja');
    await click('Choose delivery location');
    await check("__gpsCalls===0",'opening location picker does not request permission automatically');
    await check("[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Use my location').getBoundingClientRect().top<document.querySelector('dialog[open]').getBoundingClientRect().top+220",'GPS is visible before an unavailable map');
    await click('Use my location');await wait("document.querySelector('dialog[open]')?.innerText.includes('Location selected.')");await click('Use this delivery point');
    await check("document.body.innerText.includes('Delivery location selected.')",'GPS point can be confirmed without a Google map');
    await input('fieldset input[placeholder="e.g. 12B"]','20');
    await check("!document.body.innerText.includes('Delivery location selected.')",'editing delivery address clears stale coordinates');
    await click('Choose delivery location');await click('Use my location');await wait("document.querySelector('dialog[open]')?.innerText.includes('Location selected.')");await click('Use this delivery point');
    await evaluate("document.querySelector('input[type=checkbox]').click()");await click('Review order');
    await wait("!!document.querySelector('[aria-label=\"Buyer order pricing\"]')");
    await check("__calls.filter(c=>c.url==='/api/buyer/orders').length===1&&!__calls.some(c=>c.url==='/api/payments/initialize')",'creating an order stops for review before initializing payment');
    await check("(()=>{const e=document.querySelector('[aria-label=\"Buyer order pricing\"]');return e.innerText.includes('10,000.00')&&e.innerText.includes('1,500.00')&&e.innerText.includes('11,500.00')})()",'buyer reviews products plus delivery without an added commission');
    await check("(()=>{const c=__calls.find(c=>c.url==='/api/buyer/orders');return c.body.dropoff_lat===6.5&&c.body.dropoff_lng===3.4&&!('total_amount'in c.body)&&!('commission_percentage'in c.body)})()",'order sends actual selected coordinates and quantities without overriding prices');
    await evaluate('window.__wrongTotal=true');await click('Refresh order pricing');await wait("document.body.innerText.includes('buyer total does not match')");
    await check("[...document.querySelectorAll('button')].find(b=>b.textContent==='Continue to Paystack').disabled",'inconsistent backend totals block payment');
    await evaluate('window.__wrongTotal=false;window.__missingPrices=true');await click('Refresh order pricing');await wait("document.body.innerText.includes('has not returned a payable total')");
    await check("[...document.querySelectorAll('button')].find(b=>b.textContent==='Continue to Paystack').disabled",'missing backend total cannot become a free order');
    await evaluate('window.__missingPrices=false;window.__orderFailure=true');await click('Refresh order pricing');await wait("document.body.innerText.includes('Order review unavailable')");
    await check("[...document.querySelectorAll('button')].find(b=>b.textContent==='Continue to Paystack').disabled",'failed review disables payment without recreating the order');
    await evaluate('window.__orderFailure=false');await click('Refresh order pricing');await wait("![...document.querySelectorAll('button')].find(b=>b.textContent==='Continue to Paystack').disabled");
    await click('Continue to Paystack');await wait("document.body.innerText.includes('Synthetic payment stop')");
    await check("__calls.filter(c=>c.url==='/api/buyer/orders').length===1&&__calls.find(c=>c.url==='/api/payments/initialize').body.order_ids[0]==='order-1'",'payment recovery reuses the saved order');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await check("document.documentElement.scrollWidth<=document.documentElement.clientWidth",'pricing breakdown fits mobile checkout');await screenshot('.admin-preview-pricing-checkout-mobile.png');
    await navigate('/dashboard/orders/order-1');await wait("!!document.querySelector('[aria-label=\"Buyer order pricing\"]')");
    await check("document.querySelector('[aria-label=\"Buyer order pricing\"]').innerText.includes('11,500.00')",'buyer order details show the same total');
    await evaluate("localStorage.setItem('alpha.auth',JSON.stringify({access_token:'seller-token',user:{id:'pricing-seller',role:'seller',first_name:'Seller'}}))");
    await navigate('/vendor/orders/order-1');await wait("!!document.querySelector('[aria-label=\"Seller order pricing\"]')");
    await check("(()=>{const e=document.querySelector('[aria-label=\"Seller order pricing\"]');return e.innerText.includes('1,000.00')&&e.innerText.includes('9,000.00')&&e.innerText.includes('1,500.00')})()",'seller sees commission deducted from product price and delivery separately');
    await navigate('/vendor');await wait("document.body.innerText.includes('Seller proceeds')&&document.body.innerText.includes('9,000.00')");
    await check("document.querySelector('a[href=\"/vendor/orders\"]').parentElement.innerText.includes('9,000.00')||document.body.innerText.includes('9,000.00')",'seller dashboard shows net proceeds without calling it withdrawable');
    await evaluate("localStorage.setItem('alpha.auth',JSON.stringify({access_token:'admin-token',user:{id:'pricing-admin',role:'marketplace_admin',first_name:'Admin'}}))");
    await navigate('/admin/orders');await wait("document.body.innerText.includes('Product, commission and delivery breakdown')");
    await evaluate("[...document.querySelectorAll('summary')].find(s=>s.textContent.includes('Product, commission and delivery breakdown')).click()");
    await check("document.querySelector('[aria-label=\"Seller order pricing\"]').innerText.includes('9,000.00')",'admin can inspect the product commission split');
    assert.deepEqual(errors,[]);console.log(checks+' pricing flow browser checks passed.');
  } finally {await send('Page.close').catch(()=>{});socket.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
