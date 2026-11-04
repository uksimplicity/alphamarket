// Isolated browser with synthetic profile/geocoding responses; no live writes.
const assert = require('node:assert/strict');
async function main() {
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank',{method:'PUT'})).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let serial=0, checks=0; const pending=new Map();
  socket.onmessage=event=>{const message=JSON.parse(event.data),request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;}
  async function wait(expression){const start=Date.now();while(Date.now()-start<30000){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Timed out: '+expression);}
  async function check(expression,label){assert.equal(await evaluate(expression),true,label);checks++;console.log('PASS '+label);}
  async function click(text){await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled)`);await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled).click()`);}
  async function field(label,value){await evaluate(`(()=>{const el=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent.trim()===${JSON.stringify(label)})?.querySelector('input,select');if(!el)throw Error('Missing field');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  try{
    await send('Page.enable');await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`
      localStorage.setItem('alpha.auth',JSON.stringify({access_token:'seller-location-token',user:{id:'seller-location',role:'seller',status:'active'}}));
      localStorage.removeItem('alpha.profile.address');
      window.__writes=[];window.__discardPoint=false;
      window.__profile={id:'seller-location',role:'seller',status:'active',first_name:'Seller',email:'seller@example.test',phone:'08012345678',address:'Old address',city:'Ikeja',state:'Lagos',country:'Nigeria',latitude:0,longitude:0};
      window.google={maps:{Map:class{},Marker:class{},Geocoder:class{geocode(request,callback){setTimeout(()=>callback([{types:['street_address'],geometry:{location_type:'ROOFTOP',location:{lat:()=>6.6,lng:()=>3.4}}}],'OK'),10);}}}};
      const realFetch=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:input.url;if(!url.startsWith('/api/'))return realFetch(input,init);
        if(url==='/api/user/profile'){
          if(init.method==='PUT'){const body=JSON.parse(init.body);__writes.push(body);Object.assign(__profile,body);if(__discardPoint){__profile.latitude=0;__profile.longitude=0;}return Response.json({success:true});}
          return Response.json({data:__profile});
        }
        return Response.json({data:[]});};
    `});
    await send('Page.navigate',{url:'http://127.0.0.1:3011/vendor/profile'});
    await wait(`document.body.innerText.includes('Primary Address')`);await click('Edit');
    await click('Save address');await wait(`document.body.innerText.includes('Locate your pickup address')`);
    await check(`__writes.length===0`,'zero pickup location cannot be saved as a valid seller address');
    await field('House number','12B');await field('Street name','Example Street');await field('State','Lagos');
    await click('Save address');await wait(`document.body.innerText.includes('select the pickup state and local government area')`);
    await check(`__writes.length===0`,'incomplete state/LGA details cannot be saved');
    await field('LGA','Ikeja');
    await wait(`document.body.innerText.includes('Pickup location selected.')`);
    await check(`document.querySelector('textarea[autocomplete="street-address"]').readOnly`,'seller pickup address is generated from its editable fields');
    await click('Save address');await wait(`document.body.innerText.includes('Address updated successfully.')`);
    await check(`__writes.length===1&&__writes[0].latitude===6.6&&__writes[0].longitude===3.4&&__writes[0].address==='12B Example Street, Ikeja, Lagos, Nigeria'`,'seller profile saves the exact pickup coordinates with the address');
    await click('Edit');
    await check(`document.body.innerText.includes('Pickup location selected.')&&document.querySelector('select[autocomplete="address-level1"]').value==='Lagos'`,'saved pickup location and dropdown values survive reopening');
    await field('House number','14');
    await check(`!document.body.innerText.includes('Pickup location selected.')`,'editing the seller address clears its old pickup point');
    await wait(`document.body.innerText.includes('Pickup location selected.')`);
    await evaluate(`window.__discardPoint=true`);await click('Save address');
    await wait(`document.body.innerText.includes('saved pickup location could not be confirmed')`);
    await check(`!!document.querySelector('textarea[autocomplete="street-address"]')&&__writes.length===2`,'missing backend coordinate persistence never reports success or automatically retries');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await check(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`,'seller location editor fits mobile width');
    console.log(checks+' seller pickup profile browser checks passed.');
  }finally{await send('Page.close').catch(()=>{});socket.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
