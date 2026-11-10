// Synthetic identities and API responses only. No backend settings are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function main() {
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0, checks = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text);
    if (pending.has(value.id)) { const task = pending.get(value.id); pending.delete(value.id); value.error ? task.reject(Error(value.error.message)) : task.resolve(value.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression) {
    const start = Date.now();
    while (Date.now() - start < 60000) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'));
  }
  async function check(expression, label) { assert.equal(await evaluate(expression), true, label); checks++; console.log('PASS ' + label); }
  const fixture = `
    const user={id:'settings-test-admin',role:'super_admin',first_name:'Test',last_name:'Admin',status:'active'};
    localStorage.setItem('alpha.auth',JSON.stringify({access_token:'synthetic-admin-token',user}));
    const setting=(key,value,type,extra={})=>({key,value,type,description:({marketplace_commission_rate:'Percentage added to the seller base price when a product is created or its price changes.',escrow_timeout_hours:'Hours after delivery for the buyer to confirm receipt or raise an issue before automatic release.'})[key]||'Configure this platform rule.',default_value:value,...extra});
    window.__settings=[setting('marketplace_commission_rate','5','percent',{min:0,max:100,unit:'%'}),setting('rider_commission_rate','15','percent',{min:0,max:100,unit:'%'}),setting('escrow_timeout_hours','12','integer',{min:1,max:1440,unit:'hours'}),setting('min_withdrawal_amount','10','number',{min:0,unit:'NGN'}),setting('delivery_fee_recipient','platform','choice',{options:['rider','platform']}),setting('max_delivery_distance_km','100','number',{min:0,unit:'km'}),...['local','nearby','city','regional','long_haul'].flatMap((band,index)=>[setting('delivery_base_fee_'+band,String((index+1)*500),'number',{min:0,unit:'NGN'}),setting('delivery_per_km_'+band,'50','number',{min:0,unit:'NGN/km'})]),setting('delivery_min_fee','500','number',{min:0,unit:'NGN'}),setting('delivery_max_fee','50000','number',{min:1,unit:'NGN'}),setting('ride_refund_destination','wallet','choice',{options:['wallet','card']})];
    window.__calls=[];window.__failSave=false;window.__mismatch=false;
    const realFetch=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:input.url;
      if(!url.startsWith('/api/'))return realFetch(input,init);
      __calls.push({url,method:init.method||'GET',body:init.body});
      if(url==='/api/user/profile')return Response.json({data:user});
      if(url==='/api/admin/platform-settings'){
        if(init.method==='PUT'){
          await new Promise(resolve=>setTimeout(resolve,250));
          if(__failSave)throw Error('Synthetic connection loss');
          const body=JSON.parse(init.body);
          if(!__mismatch)__settings.find(row=>row.key===body.key).value=body.value;
          return Response.json({success:true});
        }
        return Response.json({success:true,data:__settings});
      }
      return Response.json({data:[]});
    };
  `;
  async function edit(key, value) {
    await evaluate(`(()=>{const input=document.getElementById('setting-${key}');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  }
  const submit = key => evaluate(`document.getElementById('setting-${key}').closest('form').querySelector('button[type=submit]').click()`);
  const formText = key => `document.getElementById('setting-${key}').closest('form').innerText`;
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fixture });
    await send('Page.navigate', { url: 'http://127.0.0.1:3011/admin/platform-settings' });
    await wait("document.querySelectorAll('form input[type=number]').length===17");
    await check("document.querySelectorAll('form select').length===2&&!document.querySelector('input[placeholder=admin_id]')", 'all numeric and choice settings are directly editable without an admin ID');
    await edit('marketplace_commission_rate', '101');
    await wait(`${formText('marketplace_commission_rate')}.includes('100 or less')`);
    await check("document.getElementById('setting-marketplace_commission_rate').closest('form').querySelector('button[type=submit]').disabled", 'out-of-range percentages cannot be saved');
    await edit('escrow_timeout_hours', '12.5');
    await wait(`${formText('escrow_timeout_hours')}.includes('whole number')`);
    await check("!__calls.some(c=>c.method==='PUT')", 'invalid edits never send an update');
    await edit('escrow_timeout_hours', '24');
    await edit('marketplace_commission_rate', '7.5');
    await submit('marketplace_commission_rate');
    await submit('marketplace_commission_rate');
    await wait(`${formText('marketplace_commission_rate')}.includes('updated successfully')`);
    await check("__calls.filter(c=>c.method==='PUT').length===1&&JSON.parse(__calls.find(c=>c.method==='PUT').body).value==='7.5'", 'decimal percentages save once and are verified by read-back');
    await check("document.getElementById('setting-escrow_timeout_hours').value==='24'", 'saving one setting preserves other unsaved edits');
    await evaluate("(()=>{const select=document.getElementById('setting-delivery_fee_recipient');select.value='rider';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await submit('delivery_fee_recipient');
    await wait(`${formText('delivery_fee_recipient')}.includes('updated successfully')`);
    await check("__settings.find(s=>s.key==='delivery_fee_recipient').value==='rider'", 'choice fields save the selected backend option');
    await edit('rider_commission_rate', '0');
    await submit('rider_commission_rate');
    await wait(`${formText('rider_commission_rate')}.includes('updated successfully')`);
    await check("__settings.find(s=>s.key==='rider_commission_rate').value==='0'", 'zero remains a valid saved commission');
    await evaluate('window.__failSave=true');
    await submit('escrow_timeout_hours');
    await wait("document.body.innerText.includes('Your edits have been kept')");
    await check("document.getElementById('setting-escrow_timeout_hours').value==='24'&&document.getElementById('setting-escrow_timeout_hours').disabled", 'uncertain saves keep edits and block further writes');
    await evaluate("window.__failSave=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh saved values').click()");
    await wait("!document.getElementById('setting-escrow_timeout_hours').disabled");
    await check("document.getElementById('setting-escrow_timeout_hours').value==='24'", 'explicit refresh recovers safely without discarding the draft');
    await evaluate('window.__mismatch=true');
    await submit('escrow_timeout_hours');
    await wait("document.body.innerText.includes('saved value could not be verified')");
    await check("!document.body.innerText.includes('Escrow release window updated successfully')", 'a mismatched read-back never reports a successful save');
    await evaluate("window.__mismatch=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh saved values').click()");
    await wait("!document.getElementById('setting-escrow_timeout_hours').disabled");
    await send('Page.captureScreenshot', { format: 'png' }).then(result => fs.writeFileSync('.admin-preview-settings-desktop.png', Buffer.from(result.data, 'base64')));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await new Promise(resolve => setTimeout(resolve, 600)); // Let responsive sidebar transitions finish.
    await check('document.documentElement.scrollWidth<=window.innerWidth', 'mobile layout fits without horizontal overflow');
    await send('Page.captureScreenshot', { format: 'png' }).then(result => fs.writeFileSync('.admin-preview-settings-mobile.png', Buffer.from(result.data, 'base64')));
    assert.deepEqual(errors, []);
    console.log(checks+' platform settings browser checks passed.');
  } finally { await send('Page.close').catch(()=>{}); socket.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
