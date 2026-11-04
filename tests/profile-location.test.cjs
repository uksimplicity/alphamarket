const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./support/load-ts.cjs');
const original = { window: global.window, localStorage: global.localStorage, fetch: global.fetch };
const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
let calls;
beforeEach(() => {
  load.reset(); calls = [];
  const values = new Map([['alpha.auth', JSON.stringify({access_token:'profile-token',user:{id:'seller-1',role:'seller'}})]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) };
  global.window = Object.assign(new EventTarget(), { localStorage: storage }); global.localStorage = storage;
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api/v1';
  global.fetch = async (url, init = {}) => { calls.push({url,init}); return Response.json({success:true,data:{id:'seller-1',role:'seller',latitude:'6.6',longitude:'3.4'}}); };
});
afterEach(() => { Object.assign(global, original); if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase; });

test('seller address update includes its confirmed coordinates and signed-in account ID', async () => {
  const client = load('src/components/auth/profileClient.ts');
  await client.updateCurrentUserProfile({address:'12 Example Street, Ikeja, Lagos, Nigeria',latitude:6.6,longitude:3.4});
  assert.deepEqual(JSON.parse(calls[0].init.body), {address:'12 Example Street, Ikeja, Lagos, Nigeria',latitude:6.6,longitude:3.4,user_id:'seller-1'});
  const saved = await client.fetchCurrentUserProfile();
  assert.equal(saved.latitude, 6.6); assert.equal(saved.longitude, 3.4);
});
test('missing, invalid and zero pickup coordinates are never submitted', async () => {
  const client = load('src/components/auth/profileClient.ts');
  for (const value of [{latitude:0,longitude:0},{latitude:6.5},{longitude:3.4},{latitude:NaN,longitude:3.4},{latitude:91,longitude:3.4}]) await assert.rejects(client.updateCurrentUserProfile(value), /valid pickup location/);
  assert.equal(calls.length,0);
});
test('profile coordinates come only from the backend, never browser address cache', async () => {
  localStorage.setItem('alpha.profile.address',JSON.stringify({userKey:'seller-1',address:'Cached address',latitude:6.6,longitude:3.4}));
  global.fetch = async () => Response.json({data:{id:'seller-1'}});
  const saved = await load('src/components/auth/profileClient.ts').fetchCurrentUserProfile();
  assert.equal(saved.latitude,null); assert.equal(saved.longitude,null);
});
test('uncertain profile writes are forwarded once without fallback replay', async () => {
  global.fetch = async (url,init) => { calls.push({url,init}); return Response.json({error:'Uncertain update'},{status:500}); };
  const route = load('src/app/api/user/profile/route.ts');
  const response = await route.PUT(new Request('https://web.example/api/user/profile',{method:'PUT',headers:{Authorization:'Bearer profile-token','Content-Type':'application/json'},body:JSON.stringify({latitude:6.6,longitude:3.4})}));
  assert.equal(response.status,500); assert.equal(calls.length,1); assert.equal(calls[0].url,'https://backend.example/api/v1/user/profile');
});
