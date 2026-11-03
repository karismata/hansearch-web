// Explicit opt-in only: creates ONE temporary pending member. Record the emitted
// UUID and remove only that test user's Auth identity and reserved name afterward.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
if (process.env.HANSEARCH_RUN_LIVE_SIGNUP !== '1') throw new Error('Set HANSEARCH_RUN_LIVE_SIGNUP=1 and arrange test-user cleanup first');
const api = 'https://trtpgahsnuddenmxuazq.supabase.co';
const apikey = 'sb_publishable_N_NBrRMNfUDwfCodR-nZ6g_KCFEZiw1';
const username = `qa_signup_${randomBytes(8).toString('hex')}`;
const password = `Aa1!${randomBytes(3).toString('base64url')}`;
console.log(JSON.stringify({ test_user: username, cleanup_required_if_created: true }));
const post = (path, body, extra = {}) => fetch(`${api}${path}`, {
  method: 'POST', headers: { apikey, 'Content-Type': 'application/json', ...extra },
  body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
});
assert.equal(password.length, 8);
const registration = await post('/functions/v1/accounts', { action: 'register', username, password }, { Origin: 'https://hansearch-web.pages.dev' });
assert.equal(registration.status, 201, await registration.text());
const login = await post('/auth/v1/token?grant_type=password', { email: `${username}@login.hansearch.invalid`, password });
assert.equal(login.status, 200);
const session = await login.json();
console.log(JSON.stringify({ created_user_id: session.user.id, test_user: username }));
const headers = { apikey, Authorization: `Bearer ${session.access_token}` };
try {
  const profileResponse = await fetch(`${api}/rest/v1/member_profiles?select=role,status`, { headers, signal: AbortSignal.timeout(30000) });
  assert.equal(profileResponse.status, 200);
  assert.deepEqual(await profileResponse.json(), [{ role: 'member', status: 'pending' }]);
  const records = await fetch(`${api}/rest/v1/info?select=id&limit=1`, { headers, signal: AbortSignal.timeout(30000) });
  assert.equal(records.status, 200); assert.deepEqual(await records.json(), []);
  const approval = await post('/rest/v1/rpc/hansearch_approve_account', { p_id: session.user.id }, { Authorization: headers.Authorization });
  assert([401,403].includes(approval.status));
  console.log('PASS: live 8-character signup and sign-in, pending member profile, denied data access and denied self-approval');
} finally {
  await fetch(`${api}/auth/v1/logout`, { method: 'POST', headers, signal: AbortSignal.timeout(30000) });
}

