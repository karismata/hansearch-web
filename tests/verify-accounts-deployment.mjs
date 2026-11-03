// Read-only probes: every registration input is rejected before any user is created.
import assert from 'node:assert/strict';
const endpoint = 'https://trtpgahsnuddenmxuazq.supabase.co/functions/v1/accounts';
async function post(body, origin = 'https://hansearch-web.pages.dev') {
  return fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
}
const options = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://hansearch-web.pages.dev' }, signal: AbortSignal.timeout(30000) });
assert.equal(options.status, 200);
assert.equal(options.headers.get('access-control-allow-origin'), 'https://hansearch-web.pages.dev');
const anonymous = await post({ action: 'delete', user_id: '00000000-0000-0000-0000-000000000000' });
assert.equal(anonymous.status, 401, await anonymous.text());
const reserved = await post({ action: 'register', username: 'master', password: 'validation-only-password' });
assert.equal(reserved.status, 400, await reserved.text());
const foreign = await post({ action: 'register', username: 'master' }, 'https://example.com');
assert.equal(foreign.status, 403, await foreign.text());
console.log('PASS: deployed CORS, anonymous admin denial, reserved master registration, and foreign-origin denial; no test accounts created');

