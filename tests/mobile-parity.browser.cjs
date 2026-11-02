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
  async function input(selector, value) { await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing input'); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`); }
  async function labelled(label, value) { const selector = await evaluate(`(() => { const labels = [...document.querySelectorAll('label')]; const el = labels.find(l => l.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector('input,textarea'); if (!el) throw new Error('Missing labelled input'); el.dataset.qaField = ${JSON.stringify(label)}; return '[data-qa-field=' + JSON.stringify(${JSON.stringify(label)}) + ']'; })()`); await input(selector, value); }
  async function screenshot(name) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.resolve(__dirname, '..', name), Buffer.from(shot.data, 'base64')); }
  const fixtures = `
    if (!sessionStorage.getItem('parity-initialized')) {
      localStorage.setItem('alpha.auth',JSON.stringify({access_token:'parity-buyer-token',user:{id:'buyer-parity',role:'buyer',first_name:'Buyer',last_name:'One'}}));
      for (const key of Object.keys(localStorage)) if (key.startsWith('alpha.local.v1:') && (key.endsWith(':buyer-parity') || key.endsWith(':other-parity'))) localStorage.removeItem(key);
      sessionStorage.setItem('parity-initialized','1');
    }
    window.__calls=[]; window.__failSend=false; window.__gpsCalls=0;
    window.__slowProfile=new URLSearchParams(location.search).has('slow');
    const actualFetch=window.fetch.bind(window);
    const current=()=>JSON.parse(localStorage.getItem('alpha.auth')||'null');
    const peer=()=>current()?.user.role==='seller'?{id:'buyer-parity',name:'Buyer One',role:'buyer'}:{id:'seller-parity',name:'Seller One',role:'seller'};
    const rows=()=>JSON.parse(sessionStorage.getItem('parity-chat-rows')||'[]');
    const thread=()=>({id:'thread-1',peer:peer(),last_message:rows().at(-1)?.text||'',updated_at:new Date().toISOString()});
    window.__appendReply=()=>{const list=rows();list.push({id:'reply-'+list.length,client_id:'seller-reply-'+list.length,sender_id:'seller-parity',text:'Yes, this is available.',sequence:list.length+1,created_at:new Date().toISOString()});sessionStorage.setItem('parity-chat-rows',JSON.stringify(list));};
    window.__gpsPoint={latitude:7.1,longitude:4.2};
    window.__geocodeCalls=[];
    window.__geocodeStatus="OK";
    window.google = { maps: {
      Geocoder: class {
        geocode(request, callback) {
          window.__geocodeCalls.push(request.address);
          setTimeout(() => callback([{ types: ["street_address"], geometry: { location_type: "ROOFTOP", location: { lat: () => 6.6, lng: () => 3.4 } } }], window.__geocodeStatus), 20);
        }
      },
      Map: class {
        setCenter() {}
        addListener() { return { remove() {} }; }
      },
      Marker: class {
        setPosition() {}
        setVisible() {}
        setMap() {}
        addListener() { return { remove() {} }; }
      },
    } };
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){window.__gpsCalls++;if(window.__delayGps){window.__finishGps=()=>success({coords:{latitude:10,longitude:5,accuracy:8}});return;}setTimeout(()=>success({coords:{...window.__gpsPoint,accuracy:8}}),20);}}});
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:input.url;
      if(!url.startsWith('/api/'))return actualFetch(input,init);
      const body=init.body?JSON.parse(init.body):null;
      __calls.push({url,method:init.method||'GET',body});
      if(url.startsWith('/api/user/profile')){
        const user={...current()?.user};if(new URLSearchParams(location.search).has('unapproved'))user.role='buyer';
        if(window.__slowProfile)return new Promise(resolve=>{window.__releaseProfile=()=>{window.__slowProfile=false;resolve(Response.json({data:user}));};});
        return Response.json({data:user});
      }
      if(url==='/api/chat/session')return Response.json({user:{id:current().user.id,name:current().user.role==='seller'?'Seller One':'Buyer One',role:current().user.role}});
      if(url==='/api/chat/sellers')return Response.json({sellers:[{id:'seller-parity',name:'Seller One',role:'seller'}]});
      if(url==='/api/chat/conversations'&&init.method==='POST'){sessionStorage.setItem('parity-thread','1');return Response.json({conversation:thread()});}
      if(url==='/api/chat/conversations')return Response.json({conversations:sessionStorage.getItem('parity-thread')?[thread()]:[]});
      if(url.startsWith('/api/chat/conversations/thread-1/messages')){
        if(init.method==='POST'){
          if(window.__failSend)return Response.json({error:'Connection interrupted.'},{status:502});
          const list=rows();let message=list.find(m=>m.client_id===body.client_id&&m.sender_id===current().user.id);
          if(!message){message={id:'message-'+list.length,client_id:body.client_id,sender_id:current().user.id,text:body.text,sequence:list.length+1,created_at:new Date().toISOString()};list.push(message);sessionStorage.setItem('parity-chat-rows',JSON.stringify(list));}
          return Response.json({message});
        }
        const after=Number(new URL(url,location.origin).searchParams.get('after')||0);return Response.json({messages:rows().filter(m=>m.sequence>after),has_more:false});
      }
      if(url==='/api/buyer/orders')return Response.json({data:{id:'new-order'}},{status:201});
      if(url==='/api/payments/initialize')return Response.json({error:'Intentional QA payment stop.'},{status:503});
      if(url.startsWith('/api/user/orders'))return Response.json({data:{orders:[{id:'delivered-order',buyer_id:current()?.user.id,status:'delivered',payment_status:'paid',escrow_status:'released',items:[{product_id:'chair',product_name:'Chair',quantity:1}],total_amount:2500}]}});
      if(url.startsWith('/api/products/public'))return Response.json({data:{products:[],total:0,limit:24,offset:0}});
      return Response.json({data:[]});
    };
  `;
  try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Page.addScriptToEvaluateOnNewDocument', { source: fixtures });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/dashboard/addresses?slow=1');
    await wait(`typeof __releaseProfile==='function'`);
    await check(`!document.querySelector('h1')?.textContent.includes('Address Book') && !!document.querySelector('[aria-label="Loading page"]')`,'private workspace waits for backend session verification');
    await evaluate('__releaseProfile()'); await wait(`document.querySelector('h1')?.textContent==='Address Book'`);
    await click('Add address'); await labelled('Full delivery address','Lekki gate'); await labelled('Delivery phone','08012345678');
    await check(`!document.body.innerText.match(/latitude|longitude|coordinates/i)`,'address editor does not expose coordinate fields');
    await check('__gpsCalls===0', 'typed address save does not request location permission');

    await evaluate(`[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Make default')).querySelector('input').click()`);
    await click('Save address'); await wait(`document.body.innerText.includes('Home · Default')`);
    await check(`!document.body.innerText.includes('6.6, 3.4')&&!document.body.innerText.match(/latitude|longitude/i)`,'saved addresses do not display raw coordinates');
    await check(`__geocodeCalls.includes('Lekki gate') && __gpsCalls===0`, 'typed address saves using automatic lookup without GPS');
    await click('Edit'); await labelled('Full delivery address','Updated Lekki gate');
    await evaluate('window.__geocodeStatus="ZERO_RESULTS"'); await click('Save address');
    await wait(`document.querySelector('[role="alert"]')?.innerText.includes('city and state')`);
    await check(`document.querySelector('textarea').value==='Updated Lekki gate'`, 'failed lookup retains the typed address');
    await evaluate('window.__geocodeStatus="OK"'); await click('Save address');
    await wait(`!document.querySelector('textarea')`);
    await check(`__geocodeCalls.filter(a=>a==='Updated Lekki gate').length===2`, 'editing an address clears its previous point and permits lookup retry');
    await navigate('/dashboard/addresses'); await wait(`document.body.innerText.includes('Updated Lekki gate')`);
    await check(`document.body.innerText.includes('Home · Default')`,'saved address, edited details and default persist across reopening');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await check(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`,'mobile address book fits viewport'); await screenshot('.admin-preview-web-parity-addresses-mobile.png');
    await navigate('/dashboard/notifications'); await wait(`!!document.querySelector('input[aria-label="Sound"]')&&!document.querySelector('input[aria-label="Sound"]').disabled`);
    await aria('Sound'); await navigate('/dashboard/notifications'); await wait(`document.querySelector('input[aria-label="Sound"]')?.checked`);
    await check(`!document.body.innerText.includes('Firebase')&&!document.body.innerText.includes('not connected')`,'notification choices persist without developer setup warnings');
    await evaluate(`localStorage.setItem('alpha_cart_v1:buyer-parity',JSON.stringify({items:[{id:'chair',name:'Chair',price:2500,qty:2}]}));`);
    await navigate('/dashboard/checkout'); await wait(`!!document.querySelector('textarea[autocomplete="street-address"]')`);
    await check(`document.querySelector('textarea[autocomplete="street-address"]').value===''`,'default address is not silently applied to checkout');
    await click('Saved addresses'); await wait(`document.querySelector('dialog[open]')?.innerText.includes('Updated Lekki gate')`); await click('Use address'); await wait(`!document.querySelector('dialog[open]')`);
    await check(`document.querySelector('textarea[autocomplete="street-address"]').value==='Updated Lekki gate'&&document.querySelector('input[autocomplete="tel"]').value==='08012345678'`,'selected address and phone populate checkout');
    await check(`!document.body.innerText.match(/latitude|longitude|coordinates/i)`,'checkout keeps coordinates internal');
    await evaluate('window.__gpsCalls=0');
    await click('Choose delivery location'); await wait(`!!document.querySelector('dialog[open]')`); await check(`__gpsCalls===0`,'opening the picker does not request GPS');
    await check(`!document.querySelector('dialog[open] input[type="number"]')&&!document.querySelector('dialog[open]').innerText.match(/latitude|longitude|coordinates/i)`,'shared picker has no numeric coordinate input or readout');
    await click('Use my location'); await wait(`!document.querySelector('dialog[open]').innerText.includes('Finding location...')`);
    await check(`document.querySelector('dialog[open]').innerText.includes('Location selected.')`,'GPS selection waits for explicit confirmation');
    await click('Use this delivery point'); await wait(`!document.querySelector('dialog[open]')`);
    await evaluate('window.__gpsPoint={latitude:8,longitude:4.2}');
    await click('Choose delivery location'); await click('Use my location'); await wait(`!document.querySelector('dialog[open]').innerText.includes('Finding location...')`); await click('Cancel');
    await check(`document.body.innerText.includes('Delivery location selected.')`,'cancelling the picker preserves the confirmed delivery location');
    await click('Choose delivery location'); await evaluate('window.__delayGps=true'); await click('Use my location'); await click('Cancel'); await evaluate('__finishGps()');
    await check(`!document.querySelector('dialog[open]')&&document.body.innerText.includes('Delivery location selected.')`,'late GPS results cannot reopen a cancelled picker');
    await evaluate(`document.querySelector('input[type="checkbox"]').click()`); await click('Pay Now'); await wait(`document.body.innerText.includes('Intentional QA payment stop.')`);
    await check(`(()=>{const request=__calls.find(c=>c.url==='/api/buyer/orders');return request.body.dropoff_address==='Updated Lekki gate'&&request.body.dropoff_lat===7.1&&request.body.dropoff_lng===4.2&&request.body.dropoff_contact==='08012345678';})()`,'reviewed coordinates and saved address reach the existing order request');
    await navigate('/dashboard/orders'); await wait(`document.body.innerText.includes('Leave review')`); await click('Leave review'); await wait(`!!document.querySelector('dialog[open]')`); await aria('4 stars'); await input('dialog textarea','Arrived safely'); await click('Save draft'); await wait(`!document.querySelector('dialog[open]')`); await click('Leave review');
    await wait(`document.querySelector('dialog textarea')?.value==='Arrived safely'`); await check(`document.querySelector('dialog').innerText.includes('not published')&&document.querySelector('[aria-label="4 stars"]').getAttribute('aria-pressed')==='true'`,'review text and rating reopen as an unpublished draft'); await aria('Close review');
    await navigate('/dashboard/messages'); await wait(`document.querySelector('button')&&document.body.innerText.includes('Seller One')`);
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Seller One')).click()`); await wait(`!!document.querySelector('#chat-message')`);
    await input('#chat-message','Is this available?'); await evaluate('window.__failSend=true'); await click('Send'); await wait(`document.body.innerText.includes('Connection interrupted.')`);
    await check(`document.querySelector('#chat-message').value==='Is this available?'&&document.querySelectorAll('article').length===0`,'failed chat sends retain text without adding a successful message bubble');
    await evaluate('window.__failSend=false'); await click('Retry send'); await wait(`document.querySelector('#chat-message').value===''&&document.querySelectorAll('article').length===1`);
    await check(`(()=>{const calls=__calls.filter(c=>c.method==='POST'&&c.url.endsWith('/messages'));return calls.length===2&&calls[0].body.client_id===calls[1].body.client_id;})()`,'chat retries reuse the same message identifier');
    await evaluate('__appendReply()'); await wait(`document.body.innerText.includes('Yes, this is available.')`); await check(`document.querySelectorAll('article').length===2`,'polling receives the seller reply without duplicate bubbles');
    await check(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`,'mobile conversation fits viewport'); await screenshot('.admin-preview-web-parity-chat-mobile.png');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }); await screenshot('.admin-preview-web-parity-chat-desktop.png');
    await evaluate(`localStorage.setItem('alpha.auth',JSON.stringify({access_token:'other-token',user:{id:'other-parity',role:'buyer',first_name:'Other'}}));window.dispatchEvent(new Event('alpha-auth-updated'));`); await wait(`!document.body.innerText.includes('Is this available?')`);
    await navigate('/dashboard/addresses'); await wait(`document.body.innerText.includes('No saved addresses yet.')`); await check(`!document.body.innerText.includes('Updated Lekki gate')`,'account switch cannot reveal another account address book');
    await navigate('/dashboard/notifications'); await wait(`!!document.querySelector('input[aria-label="Sound"]')&&!document.querySelector('input[aria-label="Sound"]').disabled`); await check(`!document.querySelector('input[aria-label="Sound"]').checked`,'notification choices are separate for the second account');
    await evaluate(`localStorage.setItem('alpha.auth',JSON.stringify({access_token:'seller-token',user:{id:'seller-parity',role:'seller',first_name:'Seller',last_name:'One'}}));window.dispatchEvent(new Event('alpha-auth-updated'));`);
    await navigate('/vendor/messages'); await wait(`document.body.innerText.includes('Buyer One')`); await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Buyer One')).click()`); await wait(`!!document.querySelector('#chat-message')`);
    await input('#chat-message','Thank you for your enquiry.'); await click('Send'); await wait(`document.querySelector('#chat-message').value===''`); await check(`document.body.innerText.includes('Thank you for your enquiry.')`,'seller workspace can open the buyer conversation and reply'); await screenshot('.admin-preview-web-parity-seller-chat.png');
    await navigate('/vendor/messages?unapproved=1'); await wait(`document.body.innerText.includes('approved by the service')`); await check(`!document.querySelector('#chat-message')&&!document.querySelector('nav[aria-label="Seller navigation"]')`,'saved seller role cannot bypass the server-reported buyer role');
    await evaluate(`localStorage.removeItem('alpha.auth');window.dispatchEvent(new Event('alpha-auth-updated'));`); await wait(`document.body.innerText.includes('Please sign in')`); await check(`!document.body.innerText.includes('Thank you for your enquiry.')`,'logout removes private chat content');
    assert.deepEqual(errors, []); console.log(checks + ' web parity browser checks passed.');
  } finally { await send('Page.close').catch(() => {}); socket.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
