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
    localStorage.setItem('alpha.auth',JSON.stringify({access_token:'admin-token',user:{id:'admin-preview',role:'marketplace_admin',first_name:'Admin'}}));
    window.__saved=null;window.__failSave=false;window.__calls=[];
    const realFetch=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:input.url;
      if(!url.startsWith('/api/'))return realFetch(input,init);
      const body=init.body?JSON.parse(init.body):null;
      __calls.push({url,body,method:init.method||'GET',authorization:init.headers?.Authorization});
      if(url.startsWith('/api/admin/commission-setting')){
        if(init.method==='PUT'){
          if(__failSave)return Response.json({error:'Save could not be confirmed.'},{status:502});
          __saved=body.percentage;return Response.json({success:true});
        }
        return Response.json({percentage:__saved});
      }
      if(url.startsWith('/api/admin/commissions'))return Response.json({error:'Commission records temporarily unavailable'},{status:503});
      return Response.json({success:true,data:[]});
    };
`;
  try {
    await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:fixtures});
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate('/admin/commissions');await wait("!!document.querySelector('#commission-percentage')");
    await check("document.querySelector('#commission-percentage').value===''&&document.body.innerText.includes('Not set')&&!__calls.some(c=>c.method==='PUT')",'no default percentage or automatic setting write');
    await input('#commission-percentage','101');
    await check("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save percentage').disabled",'percentages above 100 cannot be saved');
    await input('#commission-percentage','7.5');await click('Save percentage');
    await wait("document.body.innerText.includes('Commission percentage saved.')");
    await check("__saved===7.5&&document.body.innerText.includes('7.5%')",'admin chooses and reads back an arbitrary percentage');
    await check("__calls.some(c=>c.method==='PUT'&&c.url.endsWith('?admin_id=admin-preview')&&c.authorization==='Bearer admin-token'&&c.body.percentage===7.5)",'save uses signed-in admin ID and token');
    await wait("document.body.innerText.includes('Commission records temporarily unavailable')");
    await check("!!document.querySelector('#commission-percentage')",'percentage editor remains available when record listing fails');
    await evaluate('window.__failSave=true');await input('#commission-percentage','12');await click('Save percentage');
    await wait("document.body.innerText.includes('Save could not be confirmed.')");
    await check("document.querySelector('#commission-percentage').value==='12'&&[...document.querySelectorAll('button')].find(b=>b.textContent==='Save percentage').disabled",'failed save preserves the draft and blocks replay');
    await evaluate('window.__failSave=false');await click('Refresh saved percentage');
    await wait("![...document.querySelectorAll('button')].find(b=>b.textContent==='Save percentage').disabled");
    await input('#commission-percentage','0');await click('Save percentage');await wait("document.body.innerText.includes('Commission percentage saved.')");
    await check("__saved===0&&document.querySelector('#commission-percentage').value==='0'&&document.body.innerText.includes('0%')",'zero is a valid saved rate');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await wait("document.querySelector('[aria-label=\"Admin navigation\"]').getBoundingClientRect().right<=0");
    await check("document.documentElement.scrollWidth<=document.documentElement.clientWidth&&document.querySelector('#commission-percentage').getBoundingClientRect().left>=0",'admin percentage form fits a mobile screen');
    await screenshot('.admin-preview-commission-percentage-mobile.png');
    assert.deepEqual(errors,[]);console.log(checks+' commission browser checks passed.');
  } finally {await send('Page.close').catch(()=>{});socket.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
