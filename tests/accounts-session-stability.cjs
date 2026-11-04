const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require(process.env.JSDOM_MODULE || 'jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://hansearch-web.pages.dev' });
global.window = dom.window; global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
function load(file, mocks) {
  const name = path.resolve(file), m = new Module(name, module);
  m.filename = name; m.paths = Module._nodeModulePaths(process.cwd());
  const original = m.require.bind(m);
  m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  m._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText, name);
  return m.exports;
}
const id = '11111111-1111-4111-8111-111111111111';
const session = { user: { id }, access_token: 'synthetic-token-a' };
let authChanged, clients = 0, fetches = 0, profileReads = 0;
let profile = { id, username: 'master', role: 'master', status: 'approved' };
let read = async () => profile;
const supabase = load('src/lib/supabase.ts', { '@supabase/supabase-js': { createClient() {
  clients++;
  return { auth: {
    onAuthStateChange(fn) { authChanged = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    getSession: async () => ({ data: { session } }),
    signOut: async () => ({ error: null }),
  }, from() { return { select(columns) { assert.equal(columns, '*, _comment_counts:info_comments(count)'); return { order: async () => {
    fetches++; return { data: [{ id: 1, 키워드: '분류', 키워드2: '보호된 자료', 내용: '내용', _comment_counts: [{ count: 3 }] }], error: null };
  } }; } }; } };
} } });
const accounts = { accountClient: () => supabase.getSupabaseClient(),
  readProfile: async () => { profileReads++; return read(); }, recordSearch: async () => {} };
const gate = load('src/components/AccountGate.tsx', { '../lib/accounts': accounts });
const empty = () => null;
const appMocks = {
  './lib/supabase': supabase, './lib/accounts': accounts,
  './components/AccountGate': gate,
  './utils/helpers': { getStoredFavorites: () => [], getStoredTags: () => [], parseCategories: value => [value] },
  './lib/localAi': { clearStoredAiToken() {} }, './lib/savedAiAnswers': {},
  './lib/notifications': {},
  'lucide-react': { AlertTriangle: empty, Plus: empty, SearchX: empty, Loader2: empty },
};
for (const name of ['AccountAdmin', 'AccountPassword', 'QuickTags', 'DataModal', 'SettingsModal', 'HelpModal', 'ImageLightbox', 'AIAnswerPanel', 'ScrollToTop']) {
  appMocks[`./components/${name}`] = { [name]: empty };
}
appMocks['./components/Header'] = { Header: ({ children }) => children };
appMocks['./components/ItemCard'] = { ItemCard: ({item,commentCount,onCommentCountChange}) => React.createElement('div',null,
  React.createElement('p',null,'보호된 자료'),React.createElement('button',{'aria-label':'댓글 개수 변경',onClick:()=>onCommentCountChange(item.id,4)},`댓글 ${commentCount}`)) };
appMocks['./components/SearchBar'] = {
  SearchFilters: empty,
  SearchBar: ({ query, onChangeQuery }) => React.createElement('div', null,
    React.createElement('input', { 'aria-label': '검색어', value: query, readOnly: true }),
    React.createElement('button', { onClick: () => onChangeQuery('작성 중인 검색어') }, '입력')),
};
const { App } = load('src/App.tsx', appMocks);
(async () => {
  const container = document.getElementById('root'), root = createRoot(container);
  await act(async () => root.render(React.createElement(gate.AccountGate, null, React.createElement(App))));
  assert(container.textContent.includes('보호된 자료'));
  assert(container.textContent.includes('댓글 3'), 'Initial counts come from the same data query');
  await act(async () => container.querySelector('[aria-label="댓글 개수 변경"]').click());
  assert(container.textContent.includes('댓글 4'));
  assert.equal(clients, 1, 'Mounting App must retain the client used by AccountGate');
  const connection = supabase.getSupabaseClient();
  supabase.saveConfig(supabase.getDefaultConfig());
  assert.equal(supabase.getSupabaseClient(), connection, 'Saving identical settings must preserve Auth subscriptions');
  await act(async () => [...container.querySelectorAll('button')].find(button=>button.textContent==='입력').click());
  assert(container.textContent.includes('댓글 4'), 'Typing must not reset comment counts');
  const input = container.querySelector('input'), initialReads = profileReads, initialFetches = fetches;
  assert.equal(input.value, '작성 중인 검색어');
  for (let i = 0; i < 20; i++) {
    await act(async () => authChanged('SIGNED_IN', { ...session, user: { id } }));
    assert.equal(container.querySelector('input'), input, 'Repeated SIGNED_IN must not remount App');
  }
  assert.equal(profileReads, initialReads, 'Identical session notifications must not restart profile verification');
  assert.equal(fetches, initialFetches, 'Identical notifications must not reload records');
  const pending = [];
  read = () => new Promise(resolve => pending.push(resolve));
  await act(async () => authChanged('TOKEN_REFRESHED', { ...session, access_token: 'synthetic-token-b' }));
  assert.equal(container.querySelector('input'), input, 'Token refresh must preserve the same user view while checking');
  assert.equal(input.value, '작성 중인 검색어');
  await act(async () => pending.shift()(profile));
  assert.equal(container.querySelector('input'), input);
  await act(async () => window.dispatchEvent(new window.Event('focus')));
  await act(async () => window.dispatchEvent(new window.Event('focus')));
  const older = pending.shift(), newer = pending.shift();
  await act(async () => newer({ ...profile, status: 'deleted' }));
  assert(!container.textContent.includes('보호된 자료'));
  await act(async () => older(profile));
  assert(!container.textContent.includes('보호된 자료'), 'A stale approved response must not override a newer revocation');
  read = async () => profile;
  await act(async () => authChanged('TOKEN_REFRESHED', { ...session, access_token: 'synthetic-token-c' }));
  assert(container.textContent.includes('보호된 자료'));
  read = () => new Promise(resolve => pending.push(resolve));
  await act(async () => authChanged('SIGNED_IN', { user: { id: '22222222-2222-4222-8222-222222222222' }, access_token: 'other-user-token' }));
  assert(!container.textContent.includes('보호된 자료'), 'Changing account must immediately hide the previous user view');
  await act(async () => pending.shift()(null));
  await act(async () => root.unmount());
  dom.window.close();
  console.log('PASS: real App/client stability, repeated sign-in events, token-refresh state preservation, latest revocation, and account switching');
})().catch(error => { console.error(error); process.exit(1); });
