// Browser regression with synthetic responses only. No live Ads or wallet mutations.
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
    const task = pending.get(value.id);
    if (task) { pending.delete(value.id); if (value.error) task.reject(new Error(value.error.message)); else task.resolve(value.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression) {
    const started = Date.now();
    while (Date.now() - started < 60000) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 150)); }
    throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText.slice(-2200)'));
  }
  async function input(selector, value) {
    await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)throw new Error('Missing input: '+${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  }
  async function labelInput(label, value) {
    await evaluate(`(() => { const row=[...document.querySelectorAll('label')].find(el=>el.textContent.trim().startsWith(${JSON.stringify(label)}));const el=row?.querySelector('input,select,textarea');if(!el)throw new Error('Missing label: '+${JSON.stringify(label)});Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  }
  async function click(text) {
    await evaluate(`(() => {const el=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!el)throw new Error('Missing button: '+${JSON.stringify(text)});el.click();})()`);
  }
  async function navigate(path, role) {
    if (role) await evaluate(`sessionStorage.setItem('__adsRole',${JSON.stringify(role)})`);
    await send('Page.navigate', { url: preview + path });
    await wait(`Boolean(window.__adsState && window.__adsPath===${JSON.stringify(path)} && location.pathname===${JSON.stringify(path)} && document.querySelector('h1'))`);
  }
  const fixture = `
    (()=>{
      window.__adsPath=location.pathname;const role=sessionStorage.getItem('__adsRole')||'public';
      if(role==='public')localStorage.removeItem('alpha.auth');
      else localStorage.setItem('alpha.auth',JSON.stringify({access_token:'synthetic-ads-token',user:{id:'qa-owner',role,first_name:'QA',last_name:'Poster',status:'active'}}));
      const base={owner_id:'qa-owner',poster_role:'seller',description:'A useful chair',base_price:'5000',stock:3,category_id:'category-one',category:{id:'category-one',name:'Furniture'},location_id:'area-one',location:{id:'area-one',name:'Ikeja'},product_type_id:'type-one',address:'12 Allen Avenue, Ikeja, Lagos, Nigeria',is_active:true,media:{cover:'',images:[],video:''},created_at:'2026-11-14T08:00:00Z',updated_at:'2026-11-14T08:00:00Z'};
      const initial={balance:1000,fee:100,ads:['pending','approved','rejected','changes_requested','suspended'].map(status=>({...base,id:'ad-'+status,name:status+' Chair',moderation_status:status,moderation_note:status==='rejected'?'Please correct the photo':'Review note'})),plans:[{id:'plan-one',name:'Featured week',type:'featured',price:'40',duration_days:7,is_active:true,category_ids:[],location_ids:[]}],promotions:[],fees:[{id:'default-fee',category_id:null,amount:100,is_active:true}],logs:[{id:'log-one',product_id:'ad-rejected',action:'rejected',reason:'Please correct the photo',created_at:'2026-11-14T09:00:00Z'}],writes:[]};
      const state=JSON.parse(sessionStorage.getItem('__adsFixture')||JSON.stringify(initial));window.__adsState=state;
      const persist=()=>sessionStorage.setItem('__adsFixture',JSON.stringify(state));window.__saveAdsState=persist;
      const categories=[{id:'category-one',name:'Furniture',is_active:true}];const locations=[{id:'state-one',name:'Lagos',type:'state'},{id:'area-one',name:'Ikeja',type:'city',parent_id:'state-one'}];
      const json=(data,status=200,meta)=>Response.json({success:true,data,...(meta?{meta}:{})},{status});
      const fail=(error,status=400)=>Response.json({success:false,error},{status});
      const realFetch=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{
        const raw=typeof input==='string'?input:input.url;const url=new URL(raw,location.origin);const path=url.pathname,method=init.method||'GET',params=url.searchParams;
        if(!path.startsWith('/api/'))return realFetch(input,init);
        const body=typeof init.body==='string'?JSON.parse(init.body):{};const offset=Number(params.get('offset')||0),limit=Number(params.get('limit')||20);
        const list=items=>json(items.slice(offset,offset+limit),200,{total:items.length,limit,offset});
        if(method!=='GET'){state.writes.push({path,method,body});persist();}
        if(path==='/api/user/profile')return json(JSON.parse(localStorage.getItem('alpha.auth')||'{}').user||{});
        if(path==='/api/wallet/balance')return json({balance:state.balance});
        if(path.startsWith('/api/wallet/transactions'))return list([]);
        if(path==='/api/ads/categories')return list(categories);
        if(path==='/api/ads/locations'||path==='/api/seller/locations')return list(locations);
        if(path==='/api/admin/categories/raw')return Response.json({categories});
        if(path==='/api/seller/catalog'){const resource=params.get('resource');return json(resource==='product-types'?[{id:'type-one',name:'Physical',category_id:'category-one'}]:resource==='categories'?categories:[]);}
        if(path==='/api/seller/products/validate-city')return json({success:true});
        if(path==='/api/upload/file')return json({file:{url:'https://images.example/photo.png'}});
        if(path==='/api/ads/promotion-types')return json([{type:'featured',label:'Featured'},{type:'premium',label:'Premium'},{type:'vip',label:'VIP'}]);
        if(path==='/api/ads'||path==='/api/ads/promoted')return list(state.ads.filter(ad=>ad.moderation_status==='approved'&&!ad.deleted_at&&(path!=='/api/ads/promoted'||ad.is_promoted)));
        if(path.startsWith('/api/ads/'))return json(state.ads.find(ad=>ad.id===path.split('/').pop()&&ad.moderation_status==='approved')||{});
        if(path==='/api/my-ads/posting-fee'||path==='/api/admin/ads/fees/quote')return json({amount:state.fee});
        if(path==='/api/my-ads'&&method==='POST'){if(state.balance<state.fee)return fail('Wallet balance too low',402);state.balance-=state.fee;const ad={...base,...body,base_price:String(body.basePrice),id:'ad-created',name:body.name,moderation_status:'pending'};state.ads.push(ad);persist();return json(ad,201);}
        if(path==='/api/my-ads'||path==='/api/admin/ads'){let ads=state.ads.filter(ad=>params.get('include_deleted')==='true'||!ad.deleted_at);if(params.get('status'))ads=ads.filter(ad=>ad.moderation_status===params.get('status'));return list(ads);}
        if(path==='/api/admin/ads/stats')return json({ads:Object.fromEntries(['pending','approved','rejected','changes_requested','suspended'].map(status=>[status,state.ads.filter(ad=>ad.moderation_status===status).length]))});
        if(path==='/api/admin/ads/moderation-logs')return list(state.logs);
        if(path==='/api/admin/ads/fees')return json(state.fees);
        if(path.startsWith('/api/admin/ads/fees/')){const category=path.includes('/categories/')?path.split('/').pop():null;state.fees=state.fees.filter(fee=>fee.category_id!==category);if(method!=='DELETE')state.fees.push({id:'fee-'+(category||'default'),category_id:category,...body});persist();return json({});}
        if(path==='/api/admin/promotion-plans'){if(method==='POST'){state.plans.push({id:'plan-new',...body});persist();return json(state.plans.at(-1),201);}return json(state.plans);}
        if(path.startsWith('/api/admin/promotion-plans/')){const plan=state.plans.find(plan=>plan.id===path.split('/').pop());if(method==='DELETE'){plan.is_active=false;persist();return json({});}if(method==='PUT'){Object.assign(plan,body);persist();}return json(plan);}
        if(path==='/api/admin/ad-promotions')return list(state.promotions);
        if(path.startsWith('/api/admin/ad-promotions/')){const promotion=state.promotions.find(item=>item.id===path.split('/')[4]);if(promotion)promotion.status='cancelled';persist();return json({});}
        if(path.startsWith('/api/my-ads/')||path.startsWith('/api/admin/ads/')){
          const admin=path.startsWith('/api/admin/'),parts=path.split('/'),adId=admin?parts[4]:parts[3],action=admin?parts[5]:parts[4];const ad=state.ads.find(ad=>ad.id===adId);if(!ad)return fail('Ad not found',404);
          if(action==='history'||action==='moderation-logs')return list(state.logs.filter(log=>log.product_id===adId));
          if(action==='promotion-plans')return json(state.plans.filter(plan=>plan.is_active));
          if(action==='promotions'&&method==='GET')return list(state.promotions.filter(promotion=>promotion.product_id===adId));
          if(action==='promotions'){const plan=state.plans.find(plan=>plan.id===body.plan_id);if(ad.moderation_status!=='approved')return fail('Only published ads may be promoted');if(!plan||state.balance<Number(plan.price))return fail('Insufficient funds',402);state.balance-=Number(plan.price);state.promotions.push({id:'promotion-new',product_id:adId,type:plan.type,plan:{name:plan.name},price:plan.price,status:'active',starts_at:'2026-11-14T10:00:00Z',ends_at:'2026-11-21T10:00:00Z'});ad.is_promoted=true;persist();return json({},201);}
          if(method==='PUT'){if(admin){if(body.name)ad.name=body.name;if(body.description!==undefined)ad.description=body.description;}else{if(body.name)ad.name=body.name;if(body.shortDescription!==undefined)ad.description=body.shortDescription;if(['approved','changes_requested'].includes(ad.moderation_status))ad.moderation_status='pending';}if(body.media)ad.media=body.media;ad.updated_at=new Date().toISOString();persist();return json(ad);}
          if(method==='DELETE'){ad.deleted_at=new Date().toISOString();persist();return json({});}
          if(method==='POST'){if(action==='resubmit'){if(ad.moderation_status==='rejected'){if(state.balance<state.fee)return fail('Wallet balance too low',402);state.balance-=state.fee;}ad.moderation_status='pending';}else if(action==='approve')ad.moderation_status='approved';else if(action==='reject'){ad.moderation_status='rejected';state.balance+=state.fee;}else if(action==='request-changes')ad.moderation_status='changes_requested';else if(action==='suspend'){ad.previous_status=ad.moderation_status;ad.moderation_status='suspended';}else if(action==='unsuspend')ad.moderation_status=ad.previous_status||'approved';state.logs.unshift({id:'log-'+state.logs.length,product_id:adId,action,reason:body.reason||body.note,created_at:new Date().toISOString()});persist();return json(ad);}
          return json(ad);
        }
        return json([]);
      };
    })();
  `;
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fixture });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/ads');
    await wait(`document.body.innerText.includes('approved Chair')`);
    assert.equal(await evaluate(`localStorage.getItem('alpha.auth')===null&&!document.body.innerText.includes('pending Chair')`), true);
    console.log('PASS public Ads browsing works without login and shows approved results');

    await navigate('/dashboard/my-ads', 'buyer');
    await wait(`document.body.innerText.includes('rejected Chair')`);
    assert.equal(await evaluate(`document.body.innerText.includes('My Ads')&&Boolean(document.querySelector('a[href="/dashboard/my-ads/create"]'))`), true);
    console.log('PASS buyers have a separate My Ads list with all moderation statuses');

    await navigate('/dashboard/my-ads/create', 'buyer');
    await wait(`Boolean(document.querySelector('select[name="category"] option[value="category-one"]'))`);
    await input('input[name="name"]', 'Buyer ad'); await input('select[name="category"]', 'category-one');
    await wait(`document.body.innerText.includes('Posting fee:')`);
    await evaluate(`__adsState.balance=20;__saveAdsState()`); await click('Refresh fee and balance');
    await wait(`document.body.innerText.includes('wallet balance is too low')`);
    assert.equal(await evaluate(`document.querySelector('button.btn-save').disabled&&Boolean(document.querySelector('a[href="/dashboard/wallet"]'))`), true);
    await evaluate(`__adsState.balance=1000;__saveAdsState()`); await click('Refresh fee and balance');
    await wait(`!document.querySelector('button.btn-save').disabled`);
    await input('select[name="type"]', 'type-one'); await input('input[name="basePrice"]', '5000');
    await input('textarea[name="shortDescription"]', 'A buyer posted chair');
    await wait(`Boolean(document.querySelector('select[name="locationId"] option[value="area-one"]'))`);
    await input('select[name="locationId"]', 'area-one'); await input('input[name="houseNumber"]', '12');
    await input('input[name="street"]', 'Allen Avenue'); await input('select[name="state"]', 'Lagos'); await input('select[name="lga"]', 'Ikeja');
    await evaluate(`(()=>{const el=document.querySelector('input[type="file"]');const data=new DataTransfer();data.items.add(new File(['photo'],'chair.png',{type:'image/png'}));el.files=data.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await click('Submit for review'); await wait(`location.pathname==='/dashboard/my-ads'`);
    const created = await evaluate(`JSON.parse(sessionStorage.getItem('__adsFixture')).writes.find(write=>write.path==='/api/my-ads'&&write.method==='POST').body`);
    assert.equal(created.locationId, 'area-one'); assert.equal(created.address, '12 Allen Avenue, Ikeja, Lagos, Nigeria');
    assert.equal(['status','isPublished','sellerId','location'].some(key=>Object.hasOwn(created,key)), false);
    console.log('PASS buyer posting checks wallet affordability and submits the documented pending-ad payload');

    await navigate('/dashboard/my-ads/ad-rejected', 'buyer');
    await wait(`document.body.innerText.includes('Please correct the photo')&&document.body.innerText.includes('Posting fee:')`);
    await click('Resubmit for review'); await wait(`Boolean(document.querySelector('dialog[open]'))`); await click('Confirm resubmit');
    await wait(`document.querySelector('h1')?.parentElement?.querySelector('span')?.textContent==='pending'`);
    assert.equal(await evaluate(`__adsState.writes.filter(write=>write.path==='/api/my-ads/ad-rejected/resubmit').length`), 1);
    console.log('PASS rejected ads show feedback and re-check posting fees before one resubmission');

    await navigate('/dashboard/my-ads/ad-approved', 'buyer');
    await wait(`document.body.innerText.includes('Featured week')`);
    await click('Review purchase'); await wait(`Boolean(document.querySelector('dialog[open]'))`); await click('Pay from wallet');
    await wait(`__adsState.promotions.length===1&&!document.querySelector('dialog[open]')`);
    assert.deepEqual(await evaluate(`__adsState.writes.find(write=>write.path==='/api/my-ads/ad-approved/promotions').body`), { plan_id: 'plan-one' });
    await wait(`Boolean([...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Edit ad'))`);
    await click('Edit ad'); await labelInput('Title', 'Updated approved chair'); await click('Save changes');
    await wait(`document.querySelector('h1')?.parentElement?.querySelector('span')?.textContent==='pending'`);
    assert.deepEqual(await evaluate(`__adsState.writes.find(write=>write.path==='/api/my-ads/ad-approved'&&write.method==='PUT').body`), { name: 'Updated approved chair' });
    console.log('PASS approved ads can buy wallet promotions and content edits return them to review');

    await navigate('/vendor/my-ads', 'seller'); await wait(`document.body.innerText.includes('Updated approved chair')`);
    assert.equal(await evaluate(`Boolean(document.querySelector('a[href="/vendor/products"]'))&&Boolean(document.querySelector('a[href="/vendor/my-ads/create"]'))`), true);
    console.log('PASS seller My Ads is separate from the existing Products navigation');

    await navigate('/admin/ads', 'marketplace_admin'); await wait(`document.body.innerText.includes('pending Chair')`);
    await navigate('/admin/ads/ad-pending', 'marketplace_admin'); await wait(`Boolean([...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='approve'))`);
    await click('approve'); await input('dialog[open] textarea', 'Ready to publish'); await click('Confirm approve');
    await wait(`document.querySelector('h1')?.parentElement?.querySelector('span')?.textContent==='approved'`);
    await click('suspend'); await labelInput('Suspension', 'duration'); await labelInput('Hours', '24'); await input('dialog[open] textarea', 'Verify the address'); await click('Confirm suspend');
    await wait(`document.querySelector('h1')?.parentElement?.querySelector('span')?.textContent==='suspended'`);
    assert.equal(await evaluate(`__adsState.writes.find(write=>write.path==='/api/admin/ads/ad-pending/suspend').body.duration_hours`), 24);
    await click('unsuspend'); await click('Confirm unsuspend'); await wait(`document.querySelector('h1')?.parentElement?.querySelector('span')?.textContent==='approved'`);
    console.log('PASS admins can approve, temporarily suspend and unsuspend an ad with audit notes');

    await navigate('/admin/ads/ad-created', 'marketplace_admin'); await wait(`Boolean([...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='reject'))`);
    await click('reject'); await input('dialog[open] textarea', 'Please improve the listing photo'); await click('Confirm reject');
    await wait(`document.querySelector('h1')?.parentElement?.querySelector('span')?.textContent==='rejected'`);
    assert.equal(await evaluate(`__adsState.writes.find(write=>write.path==='/api/admin/ads/ad-created/reject').body.reason`), 'Please improve the listing photo');
    console.log('PASS admin rejection submits the poster-facing reason through the refund-capable backend action');

    await navigate('/admin/ads/fees', 'marketplace_admin'); await wait(`document.body.innerText.includes('₦100.00')&&Boolean(document.querySelector('option[value="category-one"]'))`);
    await labelInput('Fee scope', 'category'); await wait(`document.querySelector('form select')?.value==='category'&&document.querySelectorAll('form select').length===2`); await labelInput('Category', 'category-one'); await labelInput('Fee (NGN)', '250'); await click('Save posting fee');
    await wait(`__adsState.fees.some(fee=>fee.category_id==='category-one'&&fee.amount===250)`);
    await click('Remove override'); await click('Confirm removal'); await wait(`!__adsState.fees.some(fee=>fee.category_id==='category-one')`);
    console.log('PASS admin fee overrides can be saved and removed without changing the default fee');

    await navigate('/admin/promotion-plans', 'marketplace_admin'); await wait(`document.body.innerText.includes('Featured week')`);
    await click('Create plan'); await labelInput('Name', 'VIP week'); await labelInput('Type', 'vip'); await labelInput('Price (NGN)', '150'); await labelInput('Duration (days)', '7');
    await evaluate(`(()=>{const labels=[...document.querySelectorAll('label')];for(const title of ['Category targeting','Location targeting']){const select=labels.find(el=>el.textContent.startsWith(title)).querySelector('select');select.options[0].selected=true;select.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    await click('Save plan'); await wait(`__adsState.plans.some(plan=>plan.name==='VIP week')`);
    const plan = await evaluate(`__adsState.writes.find(write=>write.path==='/api/admin/promotion-plans'&&write.method==='POST').body`);
    assert.equal(plan.type,'vip'); assert.equal(plan.duration_days,7); assert.deepEqual(plan.category_ids,['category-one']); assert.equal(plan.location_ids.length,1);
    console.log('PASS admins can create targeted VIP promotion plans through the documented plan API');

    await navigate('/admin/ad-promotions', 'marketplace_admin'); await wait(`document.body.innerText.includes('Featured week')`);
    await click('Cancel promotion'); await labelInput('Reason', 'Promotion stopped by administrator');
    await evaluate(`document.querySelector('form input[type="checkbox"]').click()`); await click('Confirm cancellation');
    await wait(`__adsState.promotions[0].status==='cancelled'`);
    assert.deepEqual(await evaluate(`__adsState.writes.find(write=>write.path==='/api/admin/ad-promotions/promotion-new/cancel').body`), { reason:'Promotion stopped by administrator',refund:true });
    console.log('PASS purchased promotion cancellation includes the explicit unused-share refund choice');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`),true);
    await navigate('/dashboard/my-ads', 'buyer'); await wait(`document.body.innerText.includes('Updated approved chair')`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`),true);
    await navigate('/admin/ads/history', 'marketplace_admin'); await wait(`document.body.innerText.includes('Verify the address')`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`),true);
    console.log('PASS Ads lists, admin history and promotion management fit a mobile viewport');
    assert.deepEqual(errors, []);
    console.log('12 Ads browser scenarios passed. All mutations used synthetic responses.');
  } finally { socket.close(); await fetch(chrome + '/json/close/' + target.id).catch(()=>{}); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
