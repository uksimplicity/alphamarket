// Synthetic browser checks only. No authenticated backend requests are sent.
const assert = require('node:assert/strict');
const preview = process.env.ALPHA_PREVIEW_URL || 'http://127.0.0.1:3011';
const chrome = process.env.ALPHA_CHROME_URL || 'http://127.0.0.1:9228';

async function main() {
  const target = await (await fetch(chrome + '/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text);
    if (pending.has(value.id)) { const promise = pending.get(value.id); pending.delete(value.id); if (value.error) promise.reject(new Error(value.error.message)); else promise.resolve(value.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression) {
    const start = Date.now();
    while (Date.now() - start < 45000) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'));
  }
  async function input(selector, value) {
    await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  }
  const click = text => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(text)}).click()`);
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('alpha.auth',JSON.stringify({access_token:'synthetic-admin-token',user:{id:'admin-1',role:'admin',status:'active',first_name:'Admin'}}));
      window.__locations=[];window.__writes=[];window.__fail=false;
      const realFetch=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{
        const url=typeof input==='string'?input:input.url;
        if(!url.startsWith('/api/'))return realFetch(input,init);
        if(url.startsWith('/api/admin/ad-locations')){
          if(init.method==='POST'||init.method==='PUT'){
            const body=JSON.parse(init.body);__writes.push({url,body,method:init.method});
            if(__fail)return Response.json({error:'Synthetic save failure'},{status:500});
            if(init.method==='POST')__locations.push({...body,id:'city-'+__writes.length,is_active:true});
            else __locations.find(row=>url.endsWith('/'+row.id)).is_active=body.is_active;
            return Response.json({success:true,data:__locations.at(-1)},{status:init.method==='POST'?201:200});
          }
          return Response.json({success:true,data:__locations});
        }
        if(url.startsWith('/api/user/profile'))return Response.json({data:JSON.parse(localStorage.getItem('alpha.auth')).user});
        return Response.json({data:[]});
      };
    ` });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: preview + '/admin/locations' });
    await wait(`document.body.innerText.includes('No locations yet.')&&!document.querySelector('input[maxlength="150"]').disabled`);
    console.log('PASS empty directory explains how to enable product creation');
    await input('input[maxlength="150"]', '  Warri  ');
    await click('Add active location');
    await wait(`document.querySelector('[role="status"]')?.textContent.includes('Warri added.')`);
    assert.equal(await evaluate(`__writes.length===1&&__writes[0].body.name==='Warri'&&__writes[0].body.type==='city'&&__locations[0].is_active===true`), true);
    console.log('PASS creating a city sends one write and refreshes saved records');
    await click('Deactivate');
    await wait(`document.querySelector('[role="status"]')?.textContent==='Warri deactivated.'`);
    await click('Activate');
    await wait(`document.querySelector('[role="status"]')?.textContent==='Warri activated.'`);
    assert.equal(await evaluate('__writes.length'), 3);
    console.log('PASS existing inactive cities can be activated without creating duplicates');
    await input('input[maxlength="150"]', 'Lagos');
    await evaluate('window.__fail=true');
    await click('Add active location');
    await wait(`document.querySelector('[role="alert"]')?.textContent.includes('Refresh locations before saving again.')`);
    assert.equal(await evaluate(`document.querySelector('input[maxlength="150"]').value==='Lagos'&&[...document.querySelectorAll('button')].find(b=>b.textContent==='Add active location').disabled&&__writes.length===4`), true);
    await click('Refresh locations');
    await wait(`!document.querySelector('input[maxlength="150"]').disabled`);
    assert.equal(await evaluate(`document.querySelector('input[maxlength="150"]').value`), 'Lagos');
    console.log('PASS failed writes retain drafts and require refresh without replay');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'), true);
    assert.deepEqual(errors, []);
    console.log('PASS locations page fits a mobile viewport without runtime errors');
  } finally { await send('Page.close').catch(() => {}); socket.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
