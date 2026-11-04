const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { JSDOM } = require(process.env.JSDOM_MODULE || 'jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://hansearch-web.pages.dev' });
global.window=dom.window; global.document=dom.window.document; global.localStorage=dom.window.localStorage;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true}); global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
function load(file,mocks={}) {
  const name=path.resolve(file),m=new Module(name,module); m.filename=name; m.paths=Module._nodeModulePaths(process.cwd());
  const original=m.require.bind(m); m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:original(id);
  m._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,name);
  return m.exports;
}
const profile={id:'member',username:'worker',role:'member',status:'approved'};
const account={'./components/AccountGate':{useAccount:()=>({profile,signOut:async()=>{}})}};
const highlight={HighlightText:({text})=>text};
const {AIAnswerPanel}=load('src/components/AIAnswerPanel.tsx',{'./HighlightText':highlight});
let calls=[],saveCalls=[];
const jobs=[];
const blank=()=>null;
const components=Object.fromEntries(['ScrollToTop','AccountAdmin','AccountPassword','QuickTags','ItemCard','DataModal','SettingsModal','HelpModal','ImageLightbox'].map(name=>[`./components/${name}`,{[name]:blank}]));
const supabase={getDefaultConfig:()=>({url:'https://example.test',anonKey:'public',tableName:'info'}),fetchAllItems:async()=>[{id:1,키워드:'분류',키워드2:'제목',내용:'자료'}]};
const {App}=load('src/App.tsx',{
  ...components,...account,
  './lib/supabase':supabase,'./lib/accounts':{recordSearch:async()=>{}},
  './utils/helpers':{getStoredFavorites:()=>[],getStoredTags:()=>[],parseCategories:()=>[],saveStoredFavorites(){},saveStoredTags(){}},
  './lib/savedAiAnswers':{fetchSavedAiAnswer:async()=>null,saveAiAnswer:async(q,a)=>{saveCalls.push([q,a]);return {id:2,키워드:'AI 검증답변',키워드2:q,내용:a};}},
  './lib/localAi':{clearStoredAiToken(){},runAISearch:(q,status,options)=>new Promise((resolve,reject)=>{calls.push([q,options.mode||'auto']);jobs.push({q,status,options,resolve,reject});})},
  './components/Header':{Header:({children})=>React.createElement('header',null,children)},
  './components/SearchBar':{SearchFilters:blank,SearchBar:props=>React.createElement('div',null,
    React.createElement('button',{onClick:()=>props.onChangeQuery('포스 전원')},'질문 입력'),
    React.createElement('button',{onClick:props.onAiSearchSubmit},'AI 검색'),
    React.createElement('button',{onClick:props.onSearchSubmit},'일반 검색'))},
  './components/AIAnswerPanel':{AIAnswerPanel},
});
const container=document.getElementById('root');let root=createRoot(container);
const click=async text=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,`missing ${text}`);await act(async()=>b.click());};
const resolve=async(index,value)=>act(async()=>jobs[index].resolve({query:jobs[index].q,results:[],synced_count:1,...value}));
(async()=>{
  await act(async()=>root.render(React.createElement(App)));
  await click('질문 입력');await click('AI 검색');
  assert(container.textContent.includes('인터넷에서 추가 확인'),'available before internal answer finishes');
  await click('인터넷에서 추가 확인');assert.deepEqual(calls,[['포스 전원','auto'],['포스 전원','web']]);
  await resolve(0,{summary:'내부 자료 확인 답변',coverage:'partial',protocol_version:2});
  const web={status:'complete',summary:'외부 점검 방법 [웹 자료 1]',sources:[{number:1,title:'제조사 안내',url:'https://example.com/manual',body_checked:true,evidence_quote:'실제 본문에 있는 점검 안내'}]};
  await resolve(1,{web});
  assert(container.textContent.includes('내부 자료 확인 답변'));assert(container.textContent.includes('외부 점검 방법'));assert(container.textContent.includes('https://example.com/manual'));
  assert(container.textContent.includes('본문 확인'));assert.equal(container.querySelector('blockquote').textContent,'실제 본문에 있는 점검 안내');
  // Saving the web answer retains source URLs, with the existing correction flow.
  await act(async()=>[...container.querySelectorAll('button')].filter(b=>b.textContent==='답변 수정·저장')[1].click());
  assert(container.querySelector('textarea').value.includes('https://example.com/manual'));
  await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert(saveCalls[0][1].includes('https://example.com/manual'));assert(container.textContent.includes('저장된 수정 답변'));
  await click('AI 검색');const previous=jobs.length-1;
  await click('일반 검색');assert(jobs[previous].options.signal.aborted);
  await resolve(previous,{summary:'늦게 도착한 이전 답변'});assert(!container.textContent.includes('늦게 도착한 이전 답변'));
  await act(async()=>root.unmount());

  // Lazy comments, safe text, author-only editing, master deletion, and no mount-time fetch on cards.
  let fetches=0,remoteTotal=3;const reported=[];const report=total=>reported.push(total);
  const comment={id:'c1',info_id:1,author_id:'someone-else',author_username:'other',body:'<script>unsafe()</script>',created_at:'date',updated_at:null};
  const {ItemComments}=load('src/components/ItemComments.tsx',{
    './AccountGate':{useAccount:()=>({profile})},'./HighlightText':highlight,
    '../utils/helpers':{formatDate:x=>x},'../lib/comments':{fetchComments:async()=>{fetches++;return {comments:[comment],total:remoteTotal};},deleteComment:async()=>{}},
  });
  const {ItemCard}=load('src/components/ItemCard.tsx',{
    './ItemComments':{ItemComments},'./HighlightText':highlight,
    '../utils/helpers':{formatDate:x=>x,parseImageUrls:()=>[],parseCategories:()=>[],normalizeContentText:x=>x},
  });
  root=createRoot(container);
  await act(async()=>root.render(React.createElement(ItemCard,{item:{id:1,키워드:'',키워드2:'제목',내용:'내용'},commentCount:3,onCommentCountChange:(_id,total)=>report(total),searchQuery:'',isFavorite:false})));
  assert.equal(fetches,0);assert(container.querySelector('[aria-label="댓글 3개 보기"]'), 'Count visible before comments are loaded');
  await act(async()=>container.querySelector('[aria-label="댓글 3개 보기"]').click());assert.equal(fetches,1);
  assert.equal(reported.at(-1),3);
  const section=container.querySelector('section');assert.equal(section.querySelector('script'),null);assert(section.textContent.includes('<script>'));
  assert(![...section.querySelectorAll('button')].some(b=>b.textContent==='수정'||b.textContent==='삭제'));
  profile.role='master';await act(async()=>root.render(React.createElement(ItemComments,{infoId:1,onTotalChange:report})));
  assert([...container.querySelectorAll('button')].some(b=>b.textContent==='삭제'));assert(![...container.querySelectorAll('button')].some(b=>b.textContent==='수정'));
  comment.author_id=profile.id;await click('새로고침');await click('수정');assert.equal(container.querySelector('textarea[aria-label="댓글 수정"]').value,comment.body);
  await click('취소');remoteTotal=5;await click('새로고침');assert.equal(reported.at(-1),5);
  window.confirm=()=>true;await click('삭제');assert.equal(reported.at(-1),4,'Delete immediately updates parent count');
  await act(async()=>root.unmount());dom.window.close();
  console.log('PASS: manual web during analysis, internal answer preserved, cited corrections saved, stale results suppressed, lazy comments and author/master controls');
})().catch(error=>{console.error(error);process.exit(1);});
