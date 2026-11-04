// Read-only deployed API checks. Credentials and tokens never enter the report.
const fs = require('node:fs');
const path = require('node:path');
const base = 'https://marketplace.archintell.com/api/v1';
const accountFile = process.env.ALPHA_TEST_ACCOUNTS_FILE || path.join(__dirname, 'live-accounts.local.json');
const reportFile = path.resolve(__dirname, '../.next/live-api-report.json');
const admins = new Set(['marketplace_admin', 'rider_admin', 'super_admin', 'admin']);
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const unwrap = payload => record(payload.data ?? payload);
const fields = payload => Object.keys(unwrap(payload));
async function request(route, token, body) {
  const response = await fetch(`${base}${route}`, {
    method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  return { status: response.status, payload };
}
async function main() {
  const report = { checkedAt: new Date().toISOString(), base, checks: [], blockers: [] };
  const add = (check, expected, actual, extra = {}) => {
    const passed = expected.includes(actual);
    report.checks.push({ check, expected, actual, passed, ...extra });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${check}: ${actual}`);
  };
  for (const offset of [0, 2]) {
    const result = await request(`/products/public?limit=2&offset=${offset}`);
    const data = unwrap(result.payload);
    add(`public catalog offset ${offset}`, [200], result.status, { fields: fields(result.payload), rows: Array.isArray(data.products) ? data.products.length : null, total: data.total ?? null, offset: data.offset ?? null, limit: data.limit ?? null });
    add(`public catalog pagination shape ${offset}`, [true], Array.isArray(data.products) && data.limit === 2 && data.offset === offset && typeof data.total === 'number');
  }
  const protectedRoutes = ['/user/orders?limit=1', '/seller/products?limit=1', '/admin/orders?limit=1', '/admin/escrows/pending?limit=1', '/admin/escrows/timed-out?limit=1', '/payouts/summary', '/marketplace/grpc/riders/available?lat=6.5244&lng=3.3792&limit=1'];
  for (const route of protectedRoutes) for (const token of [undefined, 'alpha-invalid-token']) {
    const result = await request(route, token);
    add(`${route}: ${token ? 'invalid token' : 'no token'}`, [401], result.status);
  }
  const accounts = fs.existsSync(accountFile) ? JSON.parse(fs.readFileSync(accountFile, 'utf8')).accounts : [];
  if (!accounts.length) report.blockers.push('No local verified test accounts are configured.');
  for (const account of accounts) {
    const login = await request('/auth/login', undefined, { email: account.email, password: account.password });
    const data = unwrap(login.payload), token = data.access_token;
    if (login.status !== 200 || !token) {
      const reason = typeof login.payload.error === 'string' ? login.payload.error : 'Authentication unavailable';
      report.blockers.push(`${account.role}: login ${login.status}: ${reason}`);
      console.log(`BLOCKED ${account.role}: login ${login.status}: ${reason}`);
      continue;
    }
    add(`${account.role}: authenticated role`, [account.role], data.user?.role);
    const profile = await request('/user/profile', token);
    add(`${account.role}: own profile`, [200], profile.status, { fields: fields(profile.payload) });
    for (const route of ['/admin/orders?limit=1', '/admin/escrows/pending?limit=20', '/admin/escrows/timed-out?limit=20']) {
      const result = await request(route, token);
      add(`${account.role}: ${route}`, admins.has(account.role) ? [200] : [403, 404], result.status, { fields: result.status === 200 ? fields(result.payload) : [] });
      if (admins.has(account.role) && route.includes('escrows') && result.status === 200) {
        const data = unwrap(result.payload), rows = Array.isArray(result.payload.data) ? result.payload.data : data.escrows ?? data.items;
        const categories = Array.isArray(rows) ? [...new Set(rows.map(row => row.category ?? row.source ?? row.type ?? 'not_reported'))] : [];
        report.checks.push({ check: `${account.role}: escrow category observations`, categories, recordFields: Array.isArray(rows) && rows.length ? Object.keys(rows[0]) : [], passed: Array.isArray(rows) });
        if (!Array.isArray(rows) || !rows.length) report.blockers.push(`${account.role}: ${route} has no escrow records to establish category coverage.`);
      }
    }
    if (account.role === 'buyer' || account.role === 'seller') {
      const orders = await request('/user/orders?limit=20', token);
      add(`${account.role}: own orders`, [200], orders.status, { fields: fields(orders.payload) });
    }
    if (account.role === 'seller') {
      const products = await request('/seller/products?limit=20', token);
      add('seller: own products', [200], products.status, { fields: fields(products.payload) });
    }
  }
  report.blockers.push('Payment, delivery confirmation, escrow release/reversal and withdrawals require verified accounts, test inventory and confirmation of a test payment environment. This script performs no business mutations.');
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(`Report: ${reportFile}`);
  if (report.checks.some(check => !check.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
