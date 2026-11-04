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
    if (!sessionStorage.getItem('production-chat-ready')) { sessionStorage.setItem('production-chat-ready','1'); sessionStorage.removeItem('production-chat-rows'); sessionStorage.removeItem('production-thread'); localStorage.setItem('alpha.auth',JSON.stringify({access_token:'buyer-token',user:{id:'buyer-chat',role:'buyer',first_name:'Buyer'}})); }
    window.__calls=[];window.__failSend=false;window.__closed=false;
    const realFetch=window.fetch.bind(window);
    const current=()=>JSON.parse(localStorage.getItem('alpha.auth')||'null')?.user;
    const rows=()=>JSON.parse(sessionStorage.getItem('production-chat-rows')||'[]');
    const thread=()=>({id:'thread-1',type:'product',status:window.__closed?'closed':'open',context_id:'product-1',participants:[{user_id:'buyer-chat',role:'buyer',name:'Buyer Chat'},{user_id:'seller-chat',role:'seller',name:'Seller Chat'}],last_message_preview:rows().at(-1)?.body||'',last_message_at:rows().at(-1)?.created_at||'2026-11-04T10:00:00Z',created_at:'2026-11-04T10:00:00Z',unread_count:1});
    window.__older=()=>{const old=Array.from({length:35},(_,i)=>({id:'old-'+i,conversation_id:'thread-1',sender_id:'seller-chat',type:'text',body:'Earlier '+i,created_at:new Date(Date.UTC(2026,0,1,0,i)).toISOString()}));sessionStorage.setItem('production-chat-rows',JSON.stringify([...old,...rows()]));};
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:input.url;
      if(!url.startsWith('/api/'))return realFetch(input,init);
      const body=init.body?JSON.parse(init.body):undefined;
      __calls.push({url,method:init.method||'GET',body});
      if(url==='/api/user/profile')return Response.json({data:current()});
      if(url==='/api/chat/conversations'&&init.method==='POST'){sessionStorage.setItem('production-thread','1');return Response.json({success:true,data:thread()},{status:201});}
      if(url.startsWith('/api/chat/conversations?'))return Response.json({success:true,data:sessionStorage.getItem('production-thread')&&current().id!=='other-chat'?[thread()]:[],meta:{limit:20,offset:0,total:sessionStorage.getItem('production-thread')&&current().id!=='other-chat'?1:0}});
      if(url==='/api/chat/conversations/thread-1')return Response.json({success:true,data:thread()});
      if(url==='/api/chat/conversations/thread-1/read')return Response.json({success:true});
      if(url.startsWith('/api/chat/conversations/thread-1/messages')){
        if(init.method==='POST'){
          if(window.__failSend)return Response.json({success:false,error:'Connection interrupted.'},{status:502});
          const all=rows(),message={id:'sent-'+all.length,conversation_id:'thread-1',sender_id:current().id,sender_role:current().role,type:'text',body:body.body,created_at:new Date().toISOString()};
          all.push(message);sessionStorage.setItem('production-chat-rows',JSON.stringify(all));return Response.json({success:true,data:message},{status:201});
        }
        const query=new URL(url,location.origin).searchParams,before=query.get('before');
        return Response.json({success:true,data:rows().filter(m=>!before||m.created_at<before).slice().reverse().slice(0,30)});
      }
      return Response.json({data:[]});
    };
`;
  try {
    await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:fixtures});
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate('/dashboard/messages?productId=product-1&product=Test%20product');
    await wait("document.body.innerText.includes('Message seller')");
    await check("!__calls.some(c=>c.method==='POST')",'opening product messages does not create or send automatically');
    await click('Message seller');await wait("!!document.querySelector('#chat-message') && !document.querySelector('#chat-message')?.closest('form').querySelector('button[type=submit]').disabled");
    await check("__calls.some(c=>c.url==='/api/chat/conversations'&&c.body.type==='product'&&c.body.context_id==='product-1')",'starts a product conversation with its real context ID');
    await input('#chat-message','Is this available?');await evaluate('window.__failSend=true');await click('Send');
    await wait("document.body.innerText.includes('Connection interrupted.')");
    await check("document.querySelector('#chat-message').value==='Is this available?'&&document.querySelectorAll('article').length===0",'failed send retains the draft without inventing a delivered bubble');
    await check("document.querySelector('#chat-message')?.closest('form').querySelector('button[type=submit]').disabled && __calls.filter(c=>c.url.endsWith('/messages')&&c.method==='POST').length===1",'uncertain send waits for history review instead of replaying');
    await evaluate('window.__failSend=false');await click('I checked the history');await click('Send');
    await wait("document.querySelector('#chat-message').value===''&&document.querySelectorAll('article').length===1");
    await check("__calls.filter(c=>c.url.endsWith('/messages')&&c.method==='POST').every(c=>c.body.body==='Is this available?'&&!('client_id'in c.body))",'text sends use the backend body contract');
    await wait("__calls.some(c=>c.url.endsWith('/read'))");
    await check("document.querySelector('article[data-mine=true]')?.innerText.includes('Is this available?')",'acknowledged history renders outgoing messages and saves read status');
    await evaluate('__older()');await aria('Refresh messages');
    // Reopen the thread so the initial latest page exposes explicit older pagination.
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await aria('Back to conversations');await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Seller Chat')).click()");
    await wait("document.body.innerText.includes('Load older messages')");await click('Load older messages');
    await wait("document.body.innerText.includes('Earlier 0')");
    await check("__calls.some(c=>c.url.includes('before='))&&document.querySelectorAll('article').length===36",'older history uses timestamp pagination and keeps all unique messages');
    await check("document.documentElement.scrollWidth<=document.documentElement.clientWidth",'mobile chat fits the viewport');
    await screenshot('.admin-preview-production-chat-mobile.png');
    await evaluate('window.__closed=true');await aria('Refresh messages');await wait("document.body.innerText.includes('This conversation is read-only.')");
    await check("!document.querySelector('#chat-message')",'closed conversations disable composing');
    await evaluate("localStorage.setItem('alpha.auth',JSON.stringify({access_token:'other-token',user:{id:'other-chat',role:'buyer',first_name:'Other'}}));window.dispatchEvent(new Event('alpha-auth-updated'))");
    await wait("!document.body.innerText.includes('Earlier 0')");
    await check("!document.querySelector('article')",'account switching removes private message history');
    await evaluate("window.__closed=false;localStorage.setItem('alpha.auth',JSON.stringify({access_token:'seller-token',user:{id:'seller-chat',role:'seller',first_name:'Seller'}}));window.dispatchEvent(new Event('alpha-auth-updated'))");
    await navigate('/vendor/messages');
    // The new document fixture signs in as buyer; switch to seller after navigation.
    await wait("document.querySelector('h1')?.innerText==='Messages' || document.body.innerText.includes('approved by the service')");
    await evaluate("localStorage.setItem('alpha.auth',JSON.stringify({access_token:'seller-token',user:{id:'seller-chat',role:'seller',first_name:'Seller'}}));window.dispatchEvent(new Event('alpha-auth-updated'))");
    await wait("document.body.innerText.includes('Buyer Chat')");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Buyer Chat')).click()");
    await wait("!!document.querySelector('#chat-message')");
    await input('#chat-message','Seller reply');await click('Send');await wait("[...document.querySelectorAll('article[data-mine=true]')].some(m=>m.innerText.includes('Seller reply'))");
    await check("document.body.innerText.includes('Seller reply')",'seller inbox reads the backend conversation and sends a reply');
    await check("!__calls.some(c=>c.url==='/api/chat/session')",'messaging no longer registers a presentation session');
    assert.deepEqual(errors,[]);console.log(checks+' production chat browser checks passed.');
  } finally {await send('Page.close').catch(()=>{});socket.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
