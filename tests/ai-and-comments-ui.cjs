const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { JSDOM } = require(process.env.JSDOM_MODULE || 'jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://hansearch-web.pages.dev', pretendToBeVisual:true });
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
const actualHighlight=load('src/components/HighlightText.tsx',{'../utils/helpers':{normalizeContentText:x=>x}});
const {AIAnswerPanel}=load('src/components/AIAnswerPanel.tsx',{'./HighlightText':actualHighlight});
let calls=[],saveCalls=[];
const jobs=[];
const scrolls=[];window.scrollTo=options=>scrolls.push(options);
const blank=()=>null;
const components=Object.fromEntries(['ScrollToTop','AccountAdmin','AccountPassword','QuickTags','ItemCard','DataModal','SettingsModal','HelpModal','ImageLightbox'].map(name=>[`./components/${name}`,{[name]:blank}]));
const supabase={getDefaultConfig:()=>({url:'https://example.test',anonKey:'public',tableName:'info'}),fetchAllItems:async()=>[{id:1,키워드:'분류',키워드2:'제목',내용:'자료'}]};
const {App}=load('src/App.tsx',{
  ...components,...account,
  './lib/supabase':supabase,'./lib/accounts':{recordSearch:async()=>{}},
  './utils/helpers':{getStoredFavorites:()=>[],getStoredTags:()=>[],parseCategories:()=>[],saveStoredFavorites(){},saveStoredTags(){}},
  './lib/savedAiAnswers':{fetchSavedAiAnswer:async()=>null,saveAiAnswer:async(q,a)=>{saveCalls.push([q,a]);return {id:2,키워드:'AI 검증답변',키워드2:q,내용:a};}},
  './lib/localAi':{clearStoredAiToken(){},runAISearch:(q,status,options)=>new Promise((resolve,reject)=>{calls.push([q,options.mode||'auto']);jobs.push({q,status,options,resolve,reject});})},
  './components/Header':{Header:({children,onGoHome,onToggleFilters})=>React.createElement('header',null,
    React.createElement('button',{onClick:onGoHome},'홈'),React.createElement('button',{onClick:onToggleFilters},'옵션'),children)},
  './components/SearchBar':{SearchFilters:props=>React.createElement('div',{'data-filters':true,'data-category':props.selectedCategory,'data-sort':props.sortOption,'data-favorites':props.showOnlyFavorites},
    React.createElement('button',{onClick:()=>props.onChangeCategory('분류')},'분류 선택'),
    React.createElement('button',{onClick:()=>props.onChangeSort('oldest')},'오래된순'),
    React.createElement('button',{onClick:props.onToggleFavorites},'즐겨찾기 선택')),SearchBar:props=>React.createElement('div',null,
    React.createElement('input',{'aria-label':'검색어',value:props.query,readOnly:true}),
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
  assert.equal(container.querySelector('details').open,false,'Sources and raw evidence start collapsed');
  const sourceLink=container.querySelector('a[href="https://example.com/manual"]');
  assert(sourceLink && !sourceLink.closest('details'),'Reference links stay visible outside the collapsed raw excerpts');
  assert.equal(sourceLink.target,'_blank');
  // Saving the web answer retains source URLs, with the existing correction flow.
  await act(async()=>[...container.querySelectorAll('button')].filter(b=>b.textContent==='답변 수정·저장')[1].click());
  assert(container.querySelector('textarea').value.includes('https://example.com/manual'));
  await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert(saveCalls[0][1].includes('https://example.com/manual'));assert(container.textContent.includes('저장된 수정 답변'));
  await click('AI 검색');const previous=jobs.length-1;
  await click('일반 검색');assert(jobs[previous].options.signal.aborted);
  await resolve(previous,{summary:'늦게 도착한 이전 답변'});assert(!container.textContent.includes('늦게 도착한 이전 답변'));
  await click('옵션');await click('분류 선택');await click('오래된순');await click('즐겨찾기 선택');
  await click('AI 검색');const homeInternal=jobs.length-1;
  await click('인터넷에서 추가 확인');const homeWeb=jobs.length-1;
  await click('홈');
  assert(jobs[homeInternal].options.signal.aborted && jobs[homeWeb].options.signal.aborted);
  assert.equal(container.querySelector('[aria-label="검색어"]').value,'');
  assert.equal(container.querySelector('[data-filters]').dataset.category,'');
  assert.equal(container.querySelector('[data-filters]').dataset.sort,'latest');
  assert.equal(container.querySelector('[data-filters]').dataset.favorites,'false');
  assert.deepEqual(scrolls.at(-1),{top:0,left:0,behavior:'auto'});
  await resolve(homeInternal,{summary:'홈 이동 뒤의 이전 AI 답변'});
  await resolve(homeWeb,{web:{status:'complete',summary:'홈 이동 뒤의 이전 웹 답변',sources:[]}});
  assert(!container.textContent.includes('홈 이동 뒤의 이전'),'Home cannot be overwritten by in-flight AI/web results');
  await act(async()=>root.unmount());

  root=createRoot(container);
  const legacy='본문 자료를 읽었지만 한주AI가 해결 방법 정리를 완료하지 못했습니다. [웹 자료 1] 본문 발췌 (해결 방법 검증 전) ' + '장황한 페이지 원문 '.repeat(100);
  await act(async()=>root.render(React.createElement(AIAnswerPanel,{variant:'web',result:{query:'포스 전원',summary:legacy,web:{status:'error',sources:[]}},onSave:async()=>{}})));
  const detail=container.querySelector('details');
  assert.equal(detail.open,false);
  assert(!detail.previousElementSibling.textContent.includes('장황한 페이지 원문'),'Legacy raw dumps stay out of the visible summary');
  assert(detail.textContent.includes('장황한 페이지 원문'),'Full legacy text remains available on demand');
  await act(async()=>root.unmount());

  root=createRoot(container);
  const snippetWeb={status:'complete',summary:'검색 요약 참고·원문 미확인\n1. 용지 장착 상태를 확인하세요.',evidence_level:'snippet',sources:[{number:1,title:'프린터 점검',url:'https://example.com/printer',body_checked:false,body_excerpt:'용지 장착 상태를 확인하세요.'}]};
  await act(async()=>root.render(React.createElement(AIAnswerPanel,{variant:'web',result:{query:'프린터',summary:snippetWeb.summary,web:snippetWeb},onSave:async()=>{}})));
  assert(container.textContent.includes('인터넷 검색 요약 참고 · 원문 미확인'));
  assert(container.textContent.includes('검색 요약만 확인'));
  assert(!container.querySelector('a[href="https://example.com/printer"]').closest('details'));
  assert.equal(container.querySelector('details').open,false);
  await act(async()=>root.unmount());

  // Lazy comments, safe text, author-only editing, master deletion, and no mount-time fetch on cards.
  let fetches=0,replyFetches=0,remoteTotal=3;const reported=[];const report=total=>reported.push(total);let replyRows=[];const addedCalls=[];
  const comment={id:'c1',info_id:1,parent_id:null,author_id:'someone-else',author_username:'other',body:'<script>unsafe()</script>',created_at:'date',updated_at:null};
  const commentApi={
    fetchComments:async()=>{fetches++;return {comments:[comment],total:remoteTotal,rootTotal:1};},
    fetchReplies:async()=>{replyFetches++;return {comments:replyRows,total:replyRows.length};},
    fetchCommentTotal:async()=>remoteTotal,
    addComment:async(infoId,body,parentId)=>{addedCalls.push([infoId,body,parentId]);const added={...comment,id:'reply1',parent_id:parentId,author_id:profile.id,body};replyRows=[added,...replyRows];remoteTotal++;return added;},
    editComment:async(id,body)=>({...comment,id,body,updated_at:'date'}),
    deleteComment:async(id)=>{remoteTotal--;replyRows=replyRows.filter(row=>row.id!==id);},
  };
  const {CommentEntry}=load('src/components/CommentEntry.tsx',{'./AccountGate':{useAccount:()=>({profile})},'./HighlightText':highlight,'../utils/helpers':{formatDate:x=>x},'../lib/comments':commentApi});
  const {CommentReplies}=load('src/components/CommentReplies.tsx',{'./AccountGate':{useAccount:()=>({profile})},'./CommentEntry':{CommentEntry},'../lib/comments':commentApi});
  const {ItemComments}=load('src/components/ItemComments.tsx',{
    './AccountGate':{useAccount:()=>({profile})},'./CommentEntry':{CommentEntry},'./CommentReplies':{CommentReplies},'../lib/comments':commentApi,
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
  assert.equal(replyFetches,0,'Replies stay lazy');
  await click('답글 보기·작성');assert.equal(replyFetches,1);
  const replyInput=container.querySelector('textarea[aria-label="답글 내용"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(replyInput,'현장에서 확인한 답글');replyInput.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>replyInput.closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.deepEqual(addedCalls[0],[1,'현장에서 확인한 답글','c1']);assert.equal(reported.at(-1),4);
  assert(container.querySelector('[aria-label="답글 목록"]').textContent.includes('현장에서 확인한 답글'));
  window.confirm=()=>true;
  await act(async()=>[...container.querySelector('[data-comment-id="reply1"]').querySelectorAll('button')].find(b=>b.textContent==='삭제').click());
  assert.equal(reported.at(-1),3,'Reply deletion updates the total badge');
  profile.role='master';await act(async()=>root.render(React.createElement(ItemComments,{infoId:1,onTotalChange:report})));
  assert([...container.querySelectorAll('button')].some(b=>b.textContent==='삭제'));assert(![...container.querySelectorAll('button')].some(b=>b.textContent==='수정'));
  comment.author_id=profile.id;await click('새로고침');await click('수정');assert.equal(container.querySelector('textarea[aria-label="댓글 수정"]').value,comment.body);
  await click('취소');remoteTotal=5;await click('새로고침');assert.equal(reported.at(-1),5);
  window.confirm=()=>true;await click('삭제');assert.equal(reported.at(-1),4,'Delete immediately updates parent count');
  await act(async()=>root.unmount());

  window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  let unread=2,notificationFetches=0,readIds=[];const notice={id:'n1',info_id:1,comment_id:'reply1',actor_username:'other',info_title:'자료 제목',kind:'reply',created_at:'date',read_at:null};
  const {NotificationBell}=load('src/components/NotificationBell.tsx',{
    '../lib/notifications':{fetchUnreadCount:async()=>unread,fetchNotifications:async()=>{notificationFetches++;return {notifications:[notice,{...notice,id:'n2'}].map(row=>({...row,read_at:readIds.includes(row.id)?'date':null})),total:2};},
      markNotificationRead:async id=>{readIds.push(id);unread--;},markNotificationsRead:async ids=>{readIds.push(...ids);unread-=ids.length;},
      fetchNotificationContext:async()=>({item:{id:1,키워드2:'자료 제목',내용:'자료 내용'},threadId:'c1'})},
    '../utils/helpers':{formatDate:x=>x,normalizeContentText:x=>x},'./HighlightText':highlight,
    './ItemComments':{ItemComments:props=>React.createElement('p',{'data-thread':props.threadId||'all'},'알림의 댓글')},
  });
  root=createRoot(container);await act(async()=>root.render(React.createElement(NotificationBell)));
  assert.equal(notificationFetches,0,'Only unread count is fetched before opening the bell');
  await act(async()=>container.querySelector('[aria-label="알림 2개 안 읽음"]').click());assert.equal(notificationFetches,1);
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes('other님이 내 댓글에 답글')).click());
  assert.deepEqual(readIds,['n1']);assert(container.querySelector('dialog[open]'));assert.equal(container.querySelector('[data-thread]').dataset.thread,'c1');
  await click('이 자료의 모든 댓글 보기');assert.equal(container.querySelector('[data-thread]').dataset.thread,'all');
  await act(async()=>container.querySelector('[aria-label="알림 자료 닫기"]').click());assert.equal(document.body.style.overflow,'');
  await act(async()=>container.querySelector('[aria-label="알림 1개 안 읽음"]').click());
  await click('표시된 알림 읽음');assert.equal(unread,0);
  await act(async()=>root.unmount());dom.window.close();
  console.log('PASS: manual web during analysis, internal answer preserved, cited corrections saved, stale results suppressed, lazy comments and author/master controls');
})().catch(error=>{console.error(error);process.exit(1);});
