// Read-only production probes. No account, data, AI job, or activity is created.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const site = 'https://hansearch-web.pages.dev';
const api = 'https://trtpgahsnuddenmxuazq.supabase.co';
const apikey = 'sb_publishable_N_NBrRMNfUDwfCodR-nZ6g_KCFEZiw1';
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
const localIndex = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const asset = localIndex.match(/src="([^"]+\.js)"/)[1];
const html = await request(`${site}/?account-release-check=1`);
assert.equal(html.status, 200);
assert((await html.text()).includes(asset), 'Production must reference the current account-gate bundle');
const bundle = await request(new URL(asset, site));
assert.equal(bundle.status, 200);
const localBundle = await readFile(new URL(`..${asset}`, import.meta.url), 'utf8');
assert.equal((await bundle.text()).trimEnd(), localBundle.trimEnd(), 'Production bundle must match the built source');
const denied = async (url, options) => {
  const response = await request(url, options);
  assert([401, 403].includes(response.status), `Anonymous request was not denied: ${url} (${response.status})`);
};
await denied(`${api}/rest/v1/info?select=id&limit=1`, { headers: { apikey } });
await denied(`${api}/rest/v1/rpc/hansearch_account_statistics`, {
  method: 'POST', headers: { apikey, 'Content-Type': 'application/json' }, body: '{}',
});
await denied(`${api}/rest/v1/rpc/hansearch_ai_snapshot`, {
  method: 'POST', headers: { apikey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_token: 'synthetic-invalid-token-never-used-by-any-server', p_offset: 0, p_limit: 1 }),
});
await denied('https://hansearch-web.karis830519.workers.dev/api/ai/jobs', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
});
console.log('PASS: current production bundle; anonymous data, statistics and AI denied; invalid sync token denied; no records created');

