// Synthetic Google geocoding and application API responses; no real orders.
const assert = require('node:assert/strict');

async function main() {
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0, checks = 0;
  const pending = new Map();
  socket.onmessage = event => { const message = JSON.parse(event.data), request = pending.get(message.id); if (request) { pending.delete(message.id); if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
  async function wait(expression) { const start = Date.now(); while (Date.now() - start < 30000) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Timed out: ' + expression); }
  async function check(expression, label) { assert.equal(await evaluate(expression), true, label); checks++; console.log('PASS ' + label); }
  async function field(label, value) { await evaluate(`(()=>{const input=[...document.querySelectorAll('label')].find(label=>label.firstChild?.textContent.trim()===${JSON.stringify(label)})?.querySelector('input,textarea');if(!input)throw new Error('Missing field');Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const selected = `document.body.innerText.includes('Delivery location selected.')`;
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('alpha.auth',JSON.stringify({access_token:'lookup-test',user:{id:'lookup-buyer',role:'buyer'}}));
      localStorage.setItem('alpha_cart_v1:lookup-buyer',JSON.stringify({items:[{id:'product-1',name:'Test product',price:10000,qty:1}]}));
      sessionStorage.removeItem('alpha.pending-checkout.v1:lookup-buyer');
      window.__lookups=[];window.__calls=[];window.__delay=false;window.__ambiguous=false;window.__denied=false;window.__queued=[];
      const result=()=>({types:__ambiguous?['route']:['street_address'],geometry:{location_type:__ambiguous?'APPROXIMATE':'ROOFTOP',location:{lat:()=>6.6,lng:()=>3.4}}});
      window.google={maps:{Map:class{},Marker:class{},Geocoder:class{geocode(request,callback){__lookups.push(request);const finish=()=>callback([result()],__denied?'REQUEST_DENIED':'OK');if(__delay)__queued.push(finish);else setTimeout(finish,10);}}}};
      Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){success({coords:{latitude:7.2,longitude:4.5}});}}});
      const realFetch=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:input.url;if(!url.startsWith('/api/'))return realFetch(input,init);__calls.push({url,body:init.body?JSON.parse(init.body):null});
        if(url==='/api/user/profile')return Response.json({data:{id:'lookup-buyer',role:'buyer'}});
        if(url==='/api/buyer/orders')return Response.json({data:{id:'order-1'}},{status:201});
        if(url==='/api/user/orders/order-1')return Response.json({data:{id:'order-1',buyer_id:'lookup-buyer',subtotal:10000,delivery_fee:1500,total_amount:11500}});
        return Response.json({data:[]});};
    ` });
    await send('Page.navigate', { url: 'http://127.0.0.1:3011/dashboard/checkout' });
    await wait(`!!document.querySelector('textarea[autocomplete="street-address"]')`);
    await field('House number', '12B'); await field('Street name', 'Example Street'); await field('LGA', 'Eti-Osa');
    await pause(1200);
    await check(`__lookups.length===0`, 'incomplete structured address does not trigger Google lookup');
    await field('State', 'Lagos');
    await wait(selected);
    await check(`__lookups.length===1&&__lookups[0].address==='12B Example Street, Eti-Osa, Lagos, Nigeria'`, 'house, street, LGA and state form one precise address lookup');
    await check(`!__calls.some(call=>call.url==='/api/buyer/orders')`, 'locating the typed address creates no order');
    await evaluate(`window.__delay=true`); await field('State', 'Ogun');
    await check(`!(${selected})`, 'editing a structured field clears the previous coordinates');
    await wait(`__queued.length===1`);
    await field('Full delivery address', '30 New Street, Ikeja, Lagos');
    await evaluate(`__queued.shift()()`); await pause(100);
    await check(`!(${selected})`, 'late geocoding response cannot restore coordinates for an old address');
    await wait(`__queued.length===1`);
    await evaluate(`__queued.shift()();window.__delay=false`); await wait(selected);
    await evaluate(`window.__ambiguous=true`); await field('Full delivery address', 'Broad Street, Lagos');
    await wait(`document.body.innerText.includes('exact delivery location on the map')`);
    await check(`!(${selected})`, 'ambiguous address requires an exact map point');
    await evaluate(`window.__ambiguous=false;window.__denied=true`); await field('Full delivery address', '40 Example Street, Lagos');
    await wait(`document.body.innerText.includes("couldn't locate this address automatically")`);
    await check(`!![...document.querySelectorAll('button')].find(button=>button.textContent==='Retry address lookup')`, 'Google service failure leaves a retry and manual location fallback');
    await evaluate(`window.__denied=false;[...document.querySelectorAll('button')].find(button=>button.textContent==='Retry address lookup').click()`); await wait(selected);
    await evaluate(`window.__delay=true`); await field('Full delivery address', '50 Example Street, Lagos'); await wait(`__queued.length===1`);
    await evaluate(`localStorage.setItem('alpha.auth',JSON.stringify({access_token:'other-token',user:{id:'other-buyer',role:'buyer'}}));__queued.shift()()`);
    await wait(`document.body.innerText.includes('Your account changed')`);
    await check(`!(${selected})`, 'response from an earlier account cannot select coordinates');
    await evaluate(`localStorage.setItem('alpha.auth',JSON.stringify({access_token:'lookup-test',user:{id:'lookup-buyer',role:'buyer'}}));window.__delay=false`);
    await field('Full delivery address', '60 Example Street, Lagos'); await wait(selected);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await check(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`, 'structured address fields fit a mobile screen');
    await evaluate(`document.querySelector('input[type=checkbox]').click();[...document.querySelectorAll('button')].find(button=>button.textContent==='Review order').click()`);
    await wait(`__calls.some(call=>call.url==='/api/buyer/orders')`);
    await check(`(()=>{const body=__calls.find(call=>call.url==='/api/buyer/orders').body;return body.dropoff_address==='60 Example Street, Lagos'&&body.dropoff_lat===6.6&&body.dropoff_lng===3.4})()`, 'checkout sends geocoded latitude and longitude to the backend with the address');
    console.log(checks + ' address lookup browser checks passed.');
  } finally { await send('Page.close').catch(() => {}); socket.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
