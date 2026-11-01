// Synthetic reset responses only: no real password is changed.
const assert = require('node:assert/strict');
async function main() {
  const target = await (await fetch('http://127.0.0.1:9234/json/new?about:blank', {method:'PUT'})).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let serial=0;const pending=new Map(),errors=[];
  socket.onmessage=event=>{const value=JSON.parse(event.data);if(value.method==='Runtime.exceptionThrown')errors.push(value.params.exceptionDetails.text);if(pending.has(value.id)){const p=pending.get(value.id);pending.delete(value.id);value.error?p.reject(new Error(value.error.message)):p.resolve(value.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;}
  async function wait(expression){const deadline=Date.now()+30000;while(Date.now()<deadline){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Timed out: '+expression);}
  const input=async(placeholder,value)=>evaluate(`(()=>{const el=document.querySelector('input[placeholder="'+${JSON.stringify(placeholder)}+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  try {
    await send('Page.enable');await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`
      localStorage.removeItem('alpha.auth');sessionStorage.setItem('pendingResetEmail','seller@example.test');
      window.__resetWrites=[];window.__holdReset=false;
      const realFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{
        const url=typeof input==='string'?input:input.url;
        if(url==='/api/auth/reset-password'){
          __resetWrites.push(JSON.parse(init.body));
          if(__holdReset)return new Promise(resolve=>{window.__completeReset=()=>resolve(Response.json({success:true}));});
          return Response.json({error:'Invalid OTP'},{status:400});
        }
        if(url.startsWith('/api/'))return Response.json({data:[]});
        return realFetch(input,init);
      };`});
    await send('Page.navigate',{url:'http://127.0.0.1:3014/reset-password'});
    await wait(`Boolean(document.querySelector('input[placeholder="OTP code"]'))`);
    await input('OTP code','12abc');
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Continue').click()`);
    await wait(`document.body.innerText.includes('valid OTP containing only digits')`);
    assert.equal(await evaluate('__resetWrites.length'),0);
    assert.equal(await evaluate(`Boolean(document.querySelector('input[placeholder="New password"]'))`),false);
    console.log('PASS malformed OTP is blocked before reset submission');
    await input('OTP code',' 001234 ');
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Continue').click()`);
    await wait(`Boolean(document.querySelector('input[placeholder="New password"]'))`);
    await input('New password','Synthetic#Password1');await input('Confirm password','Synthetic#Password1');
    await evaluate(`document.querySelector('form').requestSubmit()`);
    await wait(`document.body.innerText.includes('Invalid OTP')`);
    const body=await evaluate('__resetWrites[0]');
    assert.deepEqual(body,{email:'seller@example.test',new_password:'Synthetic#Password1',otp:'001234'});
    console.log('PASS seller reset sends OTP as a string and preserves leading zeros');
    assert.equal(await evaluate(`document.querySelector('input[placeholder="New password"]').value`),'Synthetic#Password1');
    await evaluate(`__holdReset=true;document.querySelector('form').requestSubmit()`);
    await wait(`Boolean(document.querySelector('button[type="submit"]')?.disabled&&window.__completeReset)`);
    await evaluate(`document.querySelector('form').requestSubmit()`);
    assert.equal(await evaluate('__resetWrites.length'),2);
    await evaluate('__completeReset()');
    await wait(`document.body.innerText.includes('Password updated. Please sign in.')`);
    console.log('PASS backend errors remain visible and pending reset requests cannot be duplicated');
    assert.deepEqual(errors,[]);
  } finally {await send('Page.close');socket.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
