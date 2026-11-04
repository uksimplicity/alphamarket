// Explicitly invoked setup: creates one account per documented role, never retries registration.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const output = path.resolve(__dirname, 'live-accounts.local.json');
const base = 'https://marketplace.archintell.com/api/v1';
const roles = ['buyer', 'seller', 'rider_app_customer', 'rider', 'marketplace_admin', 'rider_admin', 'super_admin'];

async function main() {
  if (fs.existsSync(output)) throw new Error('A credentials file already exists. Reuse the existing accounts instead of creating duplicates.');
  const run = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  const document = { base, run, accounts: roles.map(role => ({ role, email: `alpha.qa.${run}.${role}@example.test`, password: crypto.randomBytes(24).toString('base64url') + '!aA7', registration: 'not_attempted' })) };
  const save = () => fs.writeFileSync(output, JSON.stringify(document, null, 2) + '\n', { mode: 0o600 });
  save();
  for (const account of document.accounts) {
    account.registration = 'submitted'; save();
    try {
      const response = await fetch(`${base}/auth/register`, {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: account.email, password: account.password, role: account.role, first_name: 'Alpha QA', last_name: account.role.replaceAll('_', ' ') }),
      });
      const payload = await response.json();
      account.registrationStatus = response.status;
      account.registration = response.ok && payload.success !== false ? 'accepted' : 'rejected_or_uncertain';
      account.registrationMessage = typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : '';
    } catch { account.registration = 'uncertain'; }
    save();
    // Login is a separate operation. A failed registration response can follow a database write.
    try {
      const response = await fetch(`${base}/auth/login`, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }) });
      const payload = await response.json();
      const data = payload.data ?? payload;
      account.loginStatus = response.status;
      account.canLogin = response.ok && !!data.access_token;
      account.actualRole = data.user?.role ?? null;
      account.loginMessage = typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : '';
    } catch { account.canLogin = false; account.loginMessage = 'Login response unavailable.'; }
    save();
    console.log(JSON.stringify({ role: account.role, email: account.email, registration: account.registration, registrationStatus: account.registrationStatus, canLogin: account.canLogin, loginStatus: account.loginStatus, actualRole: account.actualRole, message: account.canLogin ? '' : account.loginMessage || account.registrationMessage }));
  }
  console.log(`Credentials saved locally: ${output}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
