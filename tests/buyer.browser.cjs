// Local QA: Next :3011 and dedicated Chrome CDP :9228. All application API traffic is synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const target = await (await fetch('http://127.0.0.1:9228/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0, checks = 0; const pending = new Map(), errors = [];
  socket.onmessage = event => { const value = JSON.parse(event.data); if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text); if (value.id && pending.has(value.id)) { const item = pending.get(value.id); pending.delete(value.id); value.error ? item.reject(new Error(value.error.message)) : item.resolve(value.result); } };
  const send = (method, params = {}) => new Promise((resolve,reject) => { const id = ++serial; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params})); });
  async function evaluate(expression) { const r = await send('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
  async function wait(expression) { const start = Date.now(); while (Date.now()-start < 60000) { if (await evaluate('!!document.body && ('+expression+')')) return; await new Promise(r => setTimeout(r,140)); } throw new Error('Timed out: '+expression); }
  async function check(expression,label) { assert.equal(await evaluate(expression),true,label); checks++; console.log('PASS '+label); }
  async function click(label) { await wait(`!![...document.querySelectorAll('button')].find(item => item.textContent.trim() === ${JSON.stringify(label)} && !item.disabled)`); await evaluate(`([...document.querySelectorAll('button')].find(item => item.textContent.trim() === ${JSON.stringify(label)} && !item.disabled)).click()`); }
  async function aria(label) { await wait(`!!document.querySelector('[aria-label=${JSON.stringify(label)}]')`); await evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`); }
  async function input(selector,value) { await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`); }
  async function screenshot(name,full = false) { if (full) { const metrics = await send('Page.getLayoutMetrics'); const r = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}});fs.writeFileSync(path.resolve(__dirname,'..',name),Buffer.from(r.data,'base64')); } else { const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.resolve(__dirname,'..',name),Buffer.from(r.data,'base64')); } }
  async function navigate(url) { await send('Page.navigate',{url:'http://127.0.0.1:3011'+url}); }
  const fixtures = `
    if (!sessionStorage.getItem('alpha-buyer-test-initialized')) { localStorage.removeItem('alpha_cart_v1:buyer-preview'); localStorage.removeItem('alpha.saved-products.v1:buyer-preview'); localStorage.removeItem('alpha.saved-products.v1:other-buyer'); sessionStorage.setItem('alpha-buyer-test-initialized','1'); }
    const options = new URLSearchParams(location.search);
    localStorage.setItem('alpha.auth', JSON.stringify({access_token:'synthetic-buyer',user:{id:'buyer-preview',role:'buyer',first_name:'Amara',last_name:'Okafor'}}));
    window.__calls=[]; window.__empty=options.has('empty'); window.__fail=options.has('failure');
    const names=['Everyday Headphones','Urban Trainers','Home Accent Chair','Hydrating Serum','Everyday Backpack','Smart Watch','Desk Audio System','Studio Speakers','Travel Bag','Cotton Shirt','Wireless Microphone','Studio Speakers 12'];
    const images=['photo-1505740420928-5e560c06d30e','photo-1542291026-7eec264c27ff','photo-1505691938895-1758d7feb511','photo-1585238342028-4bbc7c0f0cb5','photo-1509769375558-7c1fefe0f0de','photo-1523275335684-37898b6baf30'];
    window.__products=(options.has('pages')?Array.from({length:125},(_,index)=>index===124?'Future find':('Catalog find '+index)):names).map((name,index)=>({id:'live-'+index,name,base_price:2500+index*500,stock:index===1?0:5,status:'published',description:'Thoughtfully chosen for your everyday. Real product details from the seller.',category:index===2?'Home & living':index===3?'Beauty':index===1||index===4||index===5||index===8||index===9?'Style':'Electronics',image:'https://images.unsplash.com/'+images[index%images.length]+'?auto=format&fit=crop&w=650&q=80',media:index===0?{images:['https://images.unsplash.com/'+images[0]+'?auto=format&fit=crop&w=650&q=80','https://images.unsplash.com/'+images[5]+'?auto=format&fit=crop&w=650&q=80']}:undefined,seller:{name:'The Everyday Store',slug:'everyday-store'}}));
    __products[0].location='Ikeja, Lagos';
    __products[1].seller.location='Wuse 2, Abuja';
    __products[2].seller.location='A long seller location in the Central Business District, Victoria Island, Lagos';
    if(options.has('seller-names')) __products.slice(0,3).forEach((product,index)=>{product.seller={...product.seller,id:'directory-'+index,name:undefined};product.seller_id='directory-'+index;});
    const realFetch=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{
      const url=typeof input==='string'?input:input.url;
      if(!url.startsWith('/api/'))return realFetch(input,init);
      __calls.push({url,method:init.method||'GET'});
      if(url==='/api/chat/sellers') {
        if(options.has('seller-directory-failure')) return Response.json({error:'Directory unavailable'},{status:503});
        return Response.json({sellers:init.headers?.Authorization?.includes('other-token')?[]:[{id:'directory-0',name:'Verified First Seller',role:'seller'},{id:'directory-1',name:'Verified Second Seller',role:'seller'}]});
      }
      if(url.startsWith('/api/products/public/')) { const id=decodeURIComponent(url.split('/').pop()); const item=__products.find(product=>product.id===id); return item?Response.json({data:{...item,seller:{...item.seller,name:item.seller.name||'Marketplace seller'},title:item.name,price:String(item.base_price),preview:false,images:item.media?.images||[],rating:'',reviews:'0'}}):Response.json({error:'Missing'},{status:404}); }
      if(url.startsWith('/api/products/public')) { const query=new URL(url,location.origin).searchParams,offset=Number(query.get('offset')||0),limit=Number(query.get('limit')||24),search=(query.get('search')||'').toLowerCase(); const rows=__empty?[]:__products.filter(product=>product.name.toLowerCase().includes(search)); return __fail||window.__failMore&&offset>0?Response.json({error:'Unavailable'},{status:503}):Response.json({success:true,data:{products:rows.slice(offset,offset+limit),total:rows.length,offset,limit}}); }

      if(url.startsWith('/api/user/profile'))return Response.json({data:init.headers?.Authorization?.includes('other-token')?{id:'other-buyer',role:'buyer',first_name:'New',email:'other@example.test'}:{id:'buyer-preview',role:'buyer',first_name:'Amara',last_name:'Okafor',email:'preview@example.test'}});
      if(url.startsWith('/api/user/orders')) { if(init.headers?.Authorization?.includes('other-token'))return Response.json({data:{orders:[]}}); return Response.json({data:{orders:[{id:'order-in-transit',buyer_id:'buyer-preview',status:'shipped',payment_status:'paid',total_amount:2500,created_at:'2026-10-29T10:00:00Z',seller_name:'The Everyday Store',items:[{product_id:'live-0',product_name:'Everyday Headphones',quantity:1}]},{id:'order-delivered',buyer_id:'buyer-preview',status:'delivered',payment_status:'paid',total_amount:4000,created_at:'2026-10-27T10:00:00Z',items:[{product_id:'live-1',product_name:'Previous good find',quantity:1}]}]}}); }
      return Response.json({data:[]});
    };
  `;
  try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Page.addScriptToEvaluateOnNewDocument',{source:fixtures});
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    if (!process.argv.includes('--seller-names-only')) {
    await navigate('/dashboard/home');
    await wait(`document.body.innerText.includes('Welcome back, Amara') && document.querySelectorAll('article').length===8`);
    await check(`document.querySelector('article [aria-label="Seller location: Ikeja, Lagos"]')?.textContent==='Ikeja, Lagos' && document.querySelector('article [aria-label="Seller location: Wuse 2, Abuja"]')?.textContent==='Wuse 2, Abuja'`,'seller locations are visible directly on product cards');
    await check(`document.querySelector('article [aria-label="Seller location: Location not provided"]')!==null`,'missing seller locations are stated without invented addresses');
    await check(`document.querySelectorAll('header[role="banner"]').length<=1 && document.querySelectorAll('nav[aria-label="Account navigation"] a[aria-current="page"]').length===1`,'dashboard has one active account navigation and a consistent shell');
    await check(`document.body.innerText.includes('order') && document.body.innerText.includes('Everyday Headphones') && document.body.innerText.includes('Payment received')`,'real order activity is visible');
    await check(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`,'desktop dashboard fits viewport');
    await wait(`Array.from(document.images).some(image => image.src.includes('/buyer/buyer-style.jpg') && image.complete && image.naturalWidth > 0)`);
    await screenshot('.admin-preview-buyer-dashboard-desktop.png');
    await click('Discover more'); await wait(`document.querySelectorAll('article').length===12`); await check(`document.querySelectorAll('article').length===12`,'discover more reveals additional unique listings');
    await click('Style'); await wait(`document.querySelector('button[aria-pressed="true"]').textContent==='Style'`); await check(`[...document.querySelectorAll('article')].every(item=>item.innerText.includes('STYLE'))`,'collection filter changes visible products');
    await input('input[aria-label="Search your finds"]','No matching find'); await wait(`document.body.innerText.includes('No finds just yet.')`); await check(`document.querySelectorAll('article').length===0`,'search has an honest empty state');
    await click('Explore all finds'); await wait(`document.querySelectorAll('article').length===8`);
    await input('select[aria-label="Sort products"]','price-down'); await wait(`document.querySelector('article').innerText.includes('Studio Speakers 12')`); await check(`document.querySelector('article').innerText.includes('8,000.00')`,'price sort orders the results');
    await input('select[aria-label="Sort products"]','featured'); await wait(`document.querySelector('article').innerText.includes('Everyday Headphones')`);
    await aria('Save Everyday Headphones'); await wait(`document.querySelector('[aria-label="Unsave Everyday Headphones"]')?.getAttribute('aria-pressed')==='true'`); await check(`JSON.parse(localStorage.getItem('alpha.saved-products.v1:buyer-preview')).length===1`,'saving updates this account storage');
    await navigate('/dashboard/wishlist'); await wait(`document.body.innerText.includes('Saved for a little later.') && document.querySelectorAll('article').length===1`); await check(`document.body.innerText.includes('Everyday Headphones')`,'saved product persists across navigation');
    await aria('Unsave Everyday Headphones'); await wait(`document.body.innerText.includes('Make room for your favourites.')`); await check(`document.querySelectorAll('article').length===0`,'unsaving updates the saved-items screen');
    await navigate('/dashboard/home'); await wait(`document.querySelectorAll('article').length===8`);
    await aria('Add Everyday Headphones to cart'); await wait(`document.querySelector('dialog[open]')?.innerText.includes('Added to your bag.')`); await check(`JSON.parse(localStorage.getItem('alpha_cart_v1:buyer-preview')).items.find(item=>item.id==='live-0').qty===1`,'live item adds to the existing cart');
    await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27}); await wait(`!document.querySelector('dialog[open]')`); await check(`document.body.innerText.includes('1 item')`,'cart dialog closes with Escape and dashboard count updates');
    await navigate('/products/live-0'); await wait(`document.querySelector('h1')?.textContent==='Everyday Headphones'`);
    await check(`!document.body.innerText.includes('08071234567') && !document.body.innerText.includes('Industrial touch panel') && !document.body.innerText.includes('30 views')`,'product detail removes fabricated specifications, phone and view count');
    await aria('View product image 2'); await check(`document.querySelector('[aria-label="View product image 2"]').getAttribute('aria-pressed')==='true'`,'real gallery thumbnails select images');
    await aria('Enlarge image of Everyday Headphones'); await wait(`document.querySelector('dialog[open]')!==null`); await check(`document.querySelector('dialog[open] img')!==null`,'gallery opens native image dialog'); await aria('Close enlarged image');
    await aria('Increase quantity'); await aria('Increase quantity'); await click('Add to bag'); await wait(`document.querySelector('dialog[open]')?.innerText.includes('Added to your bag.')`); await check(`JSON.parse(localStorage.getItem('alpha_cart_v1:buyer-preview')).items.find(item=>item.id==='live-0').qty===4`,'selected quantity reaches the cart'); await click('Keep exploring');
    await click('Ask the seller a question'); await wait(`document.querySelector('dialog[open]')?.innerText.includes("Open Messages to choose the seller")`); await check(`!document.querySelector('dialog[open] input') && !__calls.some(item=>/chat|message|conversation/.test(item.url))`,'an unlinked listing offers the seller directory without inventing a recipient or sending a message'); await click('Continue browsing');
    await screenshot('.admin-preview-buyer-product-desktop.png');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true}); await check(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`,'mobile product detail fits viewport'); await screenshot('.admin-preview-buyer-product-mobile.png');
    await navigate('/products/urban-runner-sneakers'); await wait(`document.querySelector('h1')?.textContent==='Urban Runner Sneakers'`); await check(`[...document.querySelectorAll('button')].find(item=>item.textContent==='Preview item').disabled && !document.body.innerText.includes('Rated 4.7')`,'catalog example cannot masquerade as purchasable seller stock');
    await navigate('/dashboard/home'); await wait(`document.querySelectorAll('article').length===8`); await check(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`,'mobile dashboard fits viewport'); await screenshot('.admin-preview-buyer-dashboard-mobile.png');
    await check(`document.querySelector('article [aria-label="Seller location: Ikeja, Lagos"]')?.getBoundingClientRect().width > 0`,'seller locations remain visible on mobile cards');
    await evaluate(`document.querySelector('article').scrollIntoView({block:'center'})`);
    await screenshot('.admin-preview-buyer-seller-location-mobile.png');
    await evaluate(`localStorage.setItem('alpha.auth',JSON.stringify({access_token:'other-token',user:{id:'other-buyer',role:'buyer',first_name:'New'}}));window.dispatchEvent(new Event('alpha-auth-updated'));`); await wait(`!document.body.innerText.includes('Previous good find')`); await check(`!document.querySelector('[aria-label="Unsave Everyday Headphones"]')`,'account change clears previous saved items and order activity');
    await navigate('/dashboard/home?empty=1'); await wait(`document.body.innerText.includes('Collection preview') && document.querySelectorAll('article').length===8`); await check(`!document.querySelector('button[aria-label^="Add "]')`,'empty public catalog shows clearly labelled non-purchasable previews');
    await navigate('/dashboard/home?failure=1'); await wait(`document.body.innerText.includes("We couldn't load the latest listings.")`); await check(`document.querySelector('[role="alert"]')!==null && document.body.innerText.includes('Collection previews are shown below.')`,'catalog failure is visible rather than presented as live data');
    await navigate('/dashboard/home?pages=1'); await wait(`document.querySelectorAll('article').length===8`);
    for(let index=0;index<13;index++) { await click('Discover more'); await wait(`document.querySelectorAll('article').length>=${Math.min(8+(index+1)*8,125)}`); }
    await check(`document.querySelectorAll('article').length===112 && __calls.some(call=>call.url.includes('offset=96'))`,'catalog fetches later server pages beyond the first 100 listings');
    await input('input[aria-label="Search your finds"]','Future find'); await wait(`document.querySelectorAll('article').length===1 && document.querySelector('article').innerText.includes('Future find')`);
    await check(`__calls.some(call=>call.url.includes('search=Future+find')&&call.url.includes('offset=0'))`,'search queries the backend and resets pagination');
    await navigate('/products/live-124?pages=1'); await wait(`document.querySelector('h1')?.textContent==='Future find'`);
    await check(`__calls.some(call=>call.url==='/api/products/public/live-124')`,'product links use public ID lookup');
    await navigate('/dashboard/home?pages=1'); await wait(`document.querySelectorAll('article').length===8`);
    await click('Discover more'); await wait(`document.querySelectorAll('article').length===16`); await click('Discover more'); await wait(`document.querySelectorAll('article').length===24`);
    await evaluate('window.__failMore=true'); await click('Discover more'); await wait(`document.querySelector('[role="alert"]') && document.querySelectorAll('article').length===24`);
    await check(`document.querySelector('article').innerText.includes('Catalog find 0')`,'failed later page keeps the already loaded catalog');
    await evaluate('window.__failMore=false'); await click('Try again'); await wait(`document.querySelectorAll('article').length===32`);
    await check(`new Set([...document.querySelectorAll('article')].map(item=>item.querySelector('a[href^="/products/"]').getAttribute('href'))).size===32`,'retry appends unique product IDs without duplicating previous pages');
    }
    await navigate('/dashboard/home?seller-names=1');
    await wait(`document.querySelectorAll('article').length===8 && document.querySelector('article').innerText.includes('Verified First Seller')`);
    await check(`document.querySelectorAll('article')[1].innerText.includes('Verified Second Seller') && document.querySelectorAll('article')[2].innerText.includes('Marketplace seller') && document.querySelectorAll('article')[3].innerText.includes('The Everyday Store')`,'seller names match exact account IDs while unknown IDs and existing catalog names stay intact');
    await check(`__calls.filter(call=>call.url==='/api/chat/sellers').length===1 && !__calls.some(call=>call.url.startsWith('/api/chat/')&&call.method!=='GET')`,'cards share one read-only directory lookup without creating a chat session or conversation');
    await evaluate(`localStorage.setItem('alpha.auth',JSON.stringify({access_token:'other-token',user:{id:'other-buyer',role:'buyer',first_name:'New'}}));window.dispatchEvent(new Event('alpha-auth-updated'));`);
    await wait(`document.querySelector('article')?.innerText.includes('Marketplace seller') && __calls.filter(call=>call.url==='/api/chat/sellers').length>=2`);
    await check(`!document.querySelector('article').innerText.includes('Verified First Seller')`,'account switching does not retain another buyer session directory');
    await navigate('/products/live-0?seller-names=1');
    await wait(`document.querySelector('h1')?.textContent==='Everyday Headphones' && document.body.innerText.includes('Verified First Seller')`);
    await check(`__calls.filter(call=>call.url==='/api/chat/sellers').length===1`,'product details resolve the seller name without requiring a dashboard query provider');
    await navigate('/dashboard/home?seller-names=1&seller-directory-failure=1');
    await wait(`document.querySelectorAll('article').length===8 && __calls.some(call=>call.url==='/api/chat/sellers')`);
    await check(`document.querySelector('article').innerText.includes('Marketplace seller') && document.querySelector('button[aria-label="Add Everyday Headphones to cart"]')!==null`,'directory failure preserves available products and cart actions');
    assert.deepEqual(errors,[]); console.log(checks+' buyer browser checks passed.');
  } finally { await send('Page.close').catch(()=>{}); socket.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
