// Local browser regression with synthetic seller data; no live backend writes.
const assert = require('node:assert/strict');
const previewUrl = process.env.ALPHA_PREVIEW_URL || 'http://127.0.0.1:3011';
const chromeUrl = process.env.ALPHA_CHROME_URL || 'http://127.0.0.1:9228';
async function main() {
  const target = await (await fetch(chromeUrl + '/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0; const pending = new Map(), errors = [];
  socket.onmessage = event => { const value = JSON.parse(event.data); if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text); if (pending.has(value.id)) { const p = pending.get(value.id); pending.delete(value.id); if (value.error) p.reject(new Error(value.error.message)); else p.resolve(value.result); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
  async function wait(expression) { const start = Date.now(); while (Date.now() - start < 90000) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 150)); } throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText.slice(-2000)')); }
  async function input(selector, value) { await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true})); })()`); }
  const fixture = `
    localStorage.setItem('alpha.auth', JSON.stringify({access_token:'synthetic-seller-token',user:{id:'seller-1',role:'seller',first_name:'Seller',status:'active'}}));
    const realFetch=window.fetch.bind(window); window.__writes=[];window.__uploads=0;
    const product={id:'product-1',name:'Chair',slug:'chair',basePrice:5000,stock:3,shortDescription:'An actual chair',categoryId:'category-1',productTypeId:'type-1',brandId:'brand-1',sellerId:'seller-1',media:{cover:'https://images.example/old-cover.png',images:['https://images.example/old-image.png'],video:'https://images.example/old-video.mp4'},attributes:[{attribute_id:'attribute-1',attribute_value_id:'value-1'}]};
    window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:input.url;if(!url.startsWith('/api/'))return realFetch(input,init);
      if(url.startsWith('/api/user/profile'))return Response.json({data:JSON.parse(localStorage.getItem('alpha.auth')).user});
      if(url.startsWith('/api/products/locations'))return Response.json({data:window.__noCities?[]:[{id:'city-lagos',name:'Lagos',type:'city'}],meta:{total:window.__noCities?0:1}});
      if(url.startsWith('/api/seller/catalog')){const p=new URL(url,location.origin).searchParams;const resource=p.get('resource');if(p.get('id'))return Response.json({data:{id:'attribute-1',values:[{id:'value-1',name:'Oak'},{id:'value-2',name:'Walnut'}]}});const data={categories:[{id:'category-1',name:'Furniture'}],'product-types':[{id:'type-1',name:'Physical'}],brands:[{id:'brand-1',name:'Workshop'}],attributes:[{id:'attribute-1',name:'Wood'}]};return Response.json({data:data[resource]||[]});}
      if(url==='/api/upload/file'){__uploads++;if(window.__failUpload)return Response.json({message:'Failed to upload file'},{status:500});return Response.json({data:{file:{fileUrl:'https://images.example/new-cover.png'}}});}
      if(url.startsWith('/api/seller/products/')){if(init.method==='PUT'){__writes.push(JSON.parse(init.body));return Response.json({data:product});}return Response.json({data:product});}
      if(url==='/api/seller/products'&&init.method==='POST'){const created=JSON.parse(init.body);__writes.push(created);sessionStorage.setItem('seller-created-product',JSON.stringify(created));sessionStorage.setItem('seller-created-upload-count',String(__uploads));return Response.json({data:{id:'created-product'}},{status:201});}
      return Response.json({data:[]});
    };
  `;
  try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Page.addScriptToEvaluateOnNewDocument', { source: fixture });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: previewUrl + '/vendor/products/product-1/edit' });
    await wait(`document.querySelector('input[name="name"]')?.value==='Chair'&&document.querySelector('select[name="brand"]')?.selectedOptions[0]?.textContent==='Workshop'`);
    assert.equal(await evaluate(`document.querySelector('select[name="category"]').value==='category-1'&&document.querySelector('select[name="type"]').value==='type-1'&&!document.body.innerText.includes('Brand A')`), true);
    console.log('PASS editor uses real category, type and brand references and preserves selected IDs');
    await wait(`[...document.querySelectorAll('option')].some(o=>o.textContent==='Oak')`);
    assert.equal(await evaluate(`[...document.querySelectorAll('select')].some(s=>s.value==='value-1'&&s.selectedOptions[0].textContent==='Oak')`), true);
    console.log('PASS existing variant IDs resolve to actual backend choices');
    await input('input[name="name"]','Updated chair');
    await evaluate(`document.querySelector('input[type="file"]').files=(()=>{const dt=new DataTransfer();dt.items.add(new File(['image'],'cover.png',{type:'image/png'}));return dt.files;})();document.querySelector('input[type="file"]').dispatchEvent(new Event('change',{bubbles:true}));`);
    await evaluate(`document.querySelector('form.create-form').requestSubmit()`); await wait(`__writes.length===1&&document.body.innerText.includes('Product updated successfully.')`);
    assert.equal(await evaluate(`__uploads===1&&__writes[0].name==='Updated chair'&&__writes[0].brandId==='brand-1'&&__writes[0].media.cover==='https://images.example/new-cover.png'&&__writes[0].media.images[0]==='https://images.example/old-image.png'&&__writes[0].media.video==='https://images.example/old-video.mp4'&&__writes[0].attributes[0].attribute_value_id==='value-1'`), true);
    console.log('PASS photo edit preserves existing gallery, video and attributes in one save');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const overflow = await evaluate(`JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(el).position!=='fixed').slice(0,12).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width}))})`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`), true, overflow);
    console.log('PASS seller editor fits mobile viewport');
    await send('Page.navigate', { url: previewUrl + '/vendor/products/create' + (process.env.ALPHA_TEST_MAPS ? '?maps=1' : '') });
    await wait(`document.querySelector('select[name="brand"]')&&!document.querySelector('select[name="brand"]').disabled&&[...document.querySelector('select[name="brand"]').options].some(o=>o.text==='Workshop')`);
    assert.equal(await evaluate(`document.querySelector('input[name="brandName"]').maxLength`), 150);
    await input('input[name="brandName"]','  Acme  ');
    await input('select[name="brand"]','brand-1');
    assert.equal(await evaluate(`document.querySelector('select[name="brand"]').value==='brand-1'&&!document.body.innerText.includes('Brand selection is temporarily disabled')`), true);
    assert.equal(await evaluate(`document.querySelector('input[name="brandName"]').disabled && document.querySelector('#product-brand-name-help').textContent.includes('Select No brand')`), true);
    console.log('PASS seller creation allows choosing a real brand');
    await input('select[name="brand"]','');
    assert.equal(await evaluate(`document.querySelector('input[name="brandName"]').disabled`), false);
    assert.equal(await evaluate(`document.querySelector('input[name="brandName"]').value`), '  Acme  ');
    await evaluate(`document.querySelector('form.create-form').requestSubmit()`);
    await wait(`document.body.innerText.includes('Product name is required.')`);
    assert.equal(await evaluate('__writes.length'), 0);
    await input('input[name="name"]','Minimal Chair');
    await input('select[name="category"]','category-1');
    await input('select[name="type"]','type-1');
    await input('input[name="basePrice"]','5000');
    await evaluate(`document.querySelector('form.create-form').requestSubmit()`);
    await wait(`document.body.innerText.includes('Product description is required.')`);
    assert.equal(await evaluate('__writes.length'), 0);
    await input('textarea[name="shortDescription"]','A simple chair for everyday use.');
    await evaluate(`document.querySelector('form.create-form').requestSubmit()`);
    await wait(`document.body.innerText.includes('Select a product city.')`);
    assert.equal(await evaluate('__uploads===0&&__writes.length===0'), true);
    await wait(`!!document.querySelector('#product-city option[value="city-lagos"]')`);
    await evaluate(`document.querySelector('form.create-form').requestSubmit()`);
    await wait(`document.body.innerText.includes('Select a product city.')`);
    assert.equal(await evaluate('__uploads'), 0);
    await input('#product-city', 'city-lagos');
    assert.equal(await evaluate(`!document.querySelector('input[placeholder="e.g. 12B"]')&&!document.querySelector('textarea[name="location"]')&&!document.body.innerText.includes('Choose product location on map')`), true);
    await evaluate(`document.querySelector('form.create-form').requestSubmit()`);
    await wait(`document.body.innerText.includes('Add at least one product image.')`);
    assert.equal(await evaluate('__writes.length'), 0);
    assert.equal(await evaluate('__uploads'), 0);
    console.log('PASS missing description, location or product image blocks creation before any upload or write');
    await evaluate(`const photoInput=document.querySelector('input[type="file"][multiple]');photoInput.files=(()=>{const files=new DataTransfer();files.items.add(new File(['image'],'chair.png',{type:'image/png'}));return files.files;})();photoInput.dispatchEvent(new Event('change',{bubbles:true}));`);
    await evaluate(`window.__failUpload=true;document.querySelector('form.create-form').requestSubmit()`);
    await wait(`document.body.innerText.includes('chair.png')&&document.body.innerText.includes('(500)')&&document.body.innerText.includes('Failed to upload file')`);
    assert.equal(await evaluate('__writes.length'), 0);
    console.log('PASS upload failure identifies the file and status and prevents product creation');
    await evaluate(`window.__failUpload=false;window.__uploads=0`);
    await evaluate(`document.querySelector('form.create-form').requestSubmit()`);
    await wait(`sessionStorage.getItem('seller-created-product')`);
    const created = await evaluate(`JSON.parse(sessionStorage.getItem('seller-created-product'))`);
    assert.equal(created.name, 'Minimal Chair');
    assert.equal(created.slug, 'minimal-chair');
    assert.equal(created.sellerId, 'seller-1');
    assert.equal(created.basePrice, 5000);
    assert.equal(created.categoryId, 'category-1');
    assert.equal(created.productTypeId, 'type-1');
    assert.equal(created.shortDescription, 'A simple chair for everyday use.');
    assert.equal(created.location, 'Lagos');
    assert.equal(created.locationId, 'city-lagos');
    for (const key of ['address','latitude','longitude']) assert.equal(Object.hasOwn(created,key), false);
    assert.equal(created.brandName, 'Acme');
    assert.equal(created.media.images.length, 1);
    assert.equal(await evaluate(`sessionStorage.getItem('seller-created-upload-count')`), '1');
    assert.equal(['brandId','stock','tags','discounts','attributes'].every(key=>!Object.hasOwn(created,key)), true);
    console.log('PASS seller can create with a trimmed typed brand name and gallery photo while unused optional details stay omitted');
    await send('Page.navigate', { url: previewUrl + '/vendor/products/create' });
    await wait(`!!document.querySelector('#product-city option[value="city-lagos"]')`);
    await evaluate(`window.__noCities=true;[...document.querySelectorAll('button')].find(button=>button.textContent==='Refresh cities').click()`);
    await wait(`document.body.innerText.includes('No product cities are available.')`);
    assert.equal(await evaluate(`document.getElementById('product-city').disabled&&__uploads===0&&__writes.length===0`), true);
    await evaluate(`window.__noCities=false;[...document.querySelectorAll('button')].find(button=>button.textContent==='Refresh cities').click()`);
    await wait(`!document.getElementById('product-city').disabled`);
    console.log('PASS empty city list is explained and explicit refresh recovers the selector');
    assert.deepEqual(errors, []); console.log('9 seller product browser checks passed.');
  } finally { socket.close(); await fetch(chromeUrl + '/json/close/' + target.id).catch(()=>{}); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
