const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.localStorage=dom.window.localStorage;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
function load(file,mocks={}){const name=path.resolve(file),m=new Module(name,module);m.filename=name;m.paths=Module._nodeModulePaths(process.cwd());const original=m.require.bind(m);m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:original(id);m._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,name);return m.exports;}
let now=100000,calls=0,defer=false;const realNow=Date.now;Date.now=()=>now;
let source=[{id:1,키워드:'일반',키워드2:'기존 가상 자료',내용:'기존 내용'}];const pending=[];
const added={id:2,키워드:'공통',키워드2:'가상 지점 설치 기록',내용:'다른 기기에서 올린 내용'};
const fetchAllItems=async()=>{calls++;return defer?new Promise((resolve,reject)=>pending.push({resolve,reject})):structuredClone(source);};
const blank=()=>null;
const mocks=Object.fromEntries(['ScrollToTop','AccountAdmin','AccountPassword','QuickTags','SettingsModal','HelpModal','ImageLightbox','AIAnswerPanel'].map(n=>[`./components/${n}`,{[n]:blank}]));
const h=React.createElement;
function Editor({isOpen,onClose,onSave,categoryList}){
  const [draft,setDraft]=React.useState('');
  React.useEffect(()=>setDraft(''),[isOpen,categoryList]);
  return isOpen?h('div',{'data-editor':true},h('output',null,draft),h('button',{onClick:()=>setDraft('작성 중인 원문')},'본문 작성'),h('button',{onClick:onClose},'편집 닫기'),h('button',{onClick:()=>void onSave({키워드:'공통',키워드2:'새로 저장한 가상 자료',내용:draft}).then(onClose)},'저장')):null;
}
const {App}=load('src/App.tsx',{
 ...mocks,'./lib/androidBack':load('src/lib/androidBack.ts'),
 './components/AccountGate':{useAccount:()=>({profile:{id:'synthetic-user',username:'tester',role:'member',status:'approved'},signOut:async()=>{}})},
 './lib/supabase':{getDefaultConfig:()=>({url:'https://example.test',anonKey:'public',tableName:'info'}),fetchAllItems,insertItem:async value=>{const item={id:3,...value};source=[...source,item];return item;}},
 './lib/accounts':{recordSearch:async()=>{}},'./lib/notifications':{},'./lib/localAi':{clearStoredAiToken(){}},'./lib/savedAiAnswers':{},
 './utils/helpers':{getStoredFavorites:()=>[],getStoredTags:()=>[],parseCategories:value=>[value],saveStoredFavorites(){},saveStoredTags(){}},
 './components/Header':{Header:p=>h('header',null,p.children,h('button',{onClick:p.onRefresh},'목록 새로고침'),h('button',{onClick:p.onToggleFilters},'옵션'))},
 './components/SearchBar':{SearchBar:p=>h('div',null,h('input',{'aria-label':'검색어',readOnly:true,value:p.query}),h('button',{onClick:()=>p.onChangeQuery('가상 지점')},'검색어 작성'),h('button',{onClick:()=>p.onChangeQuery('')},'검색어 지우기'),h('button',{onClick:p.onSearchSubmit},'검색'),h('button',{onClick:p.onAddData},'데이터 추가')),SearchFilters:p=>h('div',{'data-category':p.selectedCategory},h('button',{onClick:()=>p.onChangeCategory('공통')},'공통 선택'),h('button',{onClick:()=>p.onChangeCategory('')},'전체 선택'))},
 './components/DataModal':{DataModal:Editor},'./components/ItemCard':{ItemCard:({item})=>h('article',{'data-id':item.id},item.키워드2,item.내용)},
});
window.scrollTo=()=>{};
const container=document.getElementById('root'),root=createRoot(container);
const click=async text=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,`Missing ${text}`);await act(async()=>b.click());};
const resolve=async(index,rows)=>act(async()=>pending[index].resolve(structuredClone(rows)));
(async()=>{
 await act(async()=>root.render(h(App)));assert.equal(calls,1);assert(container.querySelector('[data-id="1"]'));
 source.push(added);defer=true;
 await click('검색어 작성');await click('검색');await click('검색');
 assert.equal(calls,2,'Repeated searches coalesce while the same list request is pending');
 assert(container.textContent.includes('최신 자료 확인 중'));
 assert(!container.querySelector('[data-id="2"]'));
 const input=container.querySelector('input');
 await resolve(0,source);
 assert(container.querySelector('[data-id="2"]'),'A record from another device becomes searchable without a full reload');
 assert.equal(container.querySelector('input'),input);assert.equal(input.value,'가상 지점');
 await click('옵션');await click('공통 선택');
 now+=31000;
 await act(async()=>{window.dispatchEvent(new window.Event('focus'));document.dispatchEvent(new window.Event('visibilitychange'));});
 assert.equal(calls,3,'Focus and visibility do not duplicate a request');
 await click('데이터 추가');await click('본문 작성');
 await resolve(1,[...source,{id:4,키워드:'새 분류',키워드2:'다른 가상 자료'}]);
 assert.equal(container.querySelector('output').textContent,'작성 중인 원문','An in-flight snapshot cannot reset the open editor');
 const before=calls;now+=31000;await act(async()=>window.dispatchEvent(new window.Event('focus')));assert.equal(calls,before,'No automatic refresh while editing');
 await click('편집 닫기');assert.equal(calls,before+1,'The deferred snapshot is refreshed when editing closes');
 await resolve(2,source);assert.equal(container.querySelector('[data-category]').dataset.category,'공통');assert.equal(input.value,'가상 지점');
 await click('전체 선택');await click('검색어 지우기');await click('검색'); // request 3, old snapshot
 await click('데이터 추가');await click('본문 작성');await click('저장'); // request 4 after committed local mutation
 assert(container.querySelector('[data-id="3"]'));
 await resolve(3,[source[0]]);assert(container.querySelector('[data-id="3"]'),'A pre-save response cannot remove a newly saved row');
 await resolve(4,source);assert(container.querySelector('[data-id="3"]'));
 await click('검색'); // request 5
 await click('목록 새로고침'); // request 6 supersedes request 5
 const newer=source.map(row=>row.id===1?{...row,내용:'최신 서버 내용'}:row);
 await resolve(6,newer);await resolve(5,source);
 assert(container.textContent.includes('최신 서버 내용'),'An older response cannot overwrite a newer manual refresh');
 await click('검색'); // request 7
 const log=console.error;console.error=()=>{};
 try{await act(async()=>pending[7].reject(new Error('synthetic offline')));}finally{console.error=log;}
 assert(container.textContent.includes('이전에 불러온 목록'));
 assert(container.textContent.includes('최신 서버 내용'),'Network errors retain the current records');
 await act(async()=>window.dispatchEvent(new window.Event('online')));
 await resolve(8,newer);assert(!container.textContent.includes('이전에 불러온 목록'));
 const finalCalls=calls;await act(async()=>root.unmount());
 now+=31000;window.dispatchEvent(new window.Event('focus'));assert.equal(calls,finalCalls);
 Date.now=realNow;dom.window.close();
 console.log('PASS: cross-device search refresh, focus coalescing, editor preservation, mutation/version guards, cached offline results, and cleanup');
})().catch(error=>{Date.now=realNow;console.error(error);process.exit(1);});
