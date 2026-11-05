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
const {AIAnswerPanel,formatAiAnswer}=load('src/components/AIAnswerPanel.tsx',{'./HighlightText':actualHighlight});
const inlineAnswer='예상 원인: 장치 설정 오류. 확인 방법: 연결 확인. 처리 순서: 1. 장치 타입(01, 02, 03) 확인 [341254]. 2. 리더기 연결 확인 [341151]. 3. AS 접수 고려 [341206].';
const formattedAnswer=formatAiAnswer(inlineAnswer);
assert(formattedAnswer.includes('\n\n확인 방법:'));
assert(formattedAnswer.includes('\n\n처리 순서:\n1.'));
assert(formattedAnswer.includes('\n\n2. 리더기'));
assert(formattedAnswer.includes('\n\n3. AS'));
assert(formattedAnswer.includes('(01, 02, 03) 확인 [341254]'));
assert.equal(formatAiAnswer(formattedAnswer),formattedAnswer,'Formatting a saved answer again must not add blank lines');
assert.equal(formatAiAnswer('버전 1.2, https://example.com/1.2, [341254]'), '버전 1.2, https://example.com/1.2, [341254]');
let calls=[],saveCalls=[];
const jobs=[];
const scrolls=[];window.scrollTo=options=>scrolls.push(options);
const focusedScrolls=[];window.HTMLElement.prototype.scrollIntoView=function(){focusedScrolls.push(this.dataset.commentId);};
const navigationRequests=[];
const jumpNotice={id:'jump',info_id:77,comment_id:'oldreply',info_title:'알림 대상 자료',actor_username:'other',kind:'reply',created_at:'date',read_at:null};
const blank=()=>null;
const components=Object.fromEntries(['ScrollToTop','AccountAdmin','AccountPassword','QuickTags','ItemCard','DataModal','SettingsModal','HelpModal','ImageLightbox'].map(name=>[`./components/${name}`,{[name]:blank}]));
const supabase={getDefaultConfig:()=>({url:'https://example.test',anonKey:'public',tableName:'info'}),fetchAllItems:async()=>[{id:1,키워드:'분류',키워드2:'제목',내용:'자료'}]};
const {App}=load('src/App.tsx',{
  ...components,...account,
  './lib/supabase':supabase,'./lib/accounts':{recordSearch:async()=>{}},
  './lib/notifications':{fetchNotificationContext:notification=>new Promise((resolve,reject)=>navigationRequests.push({notification,resolve,reject}))},
  './utils/helpers':{getStoredFavorites:()=>[],getStoredTags:()=>[],parseCategories:()=>[],saveStoredFavorites(){},saveStoredTags(){}},
  './lib/savedAiAnswers':{fetchSavedAiAnswer:async()=>null,saveAiAnswer:async(q,a)=>{saveCalls.push([q,a]);return {id:2,키워드:'AI 검증답변',키워드2:q,내용:a};}},
  './lib/localAi':{clearStoredAiToken(){},runAISearch:(q,status,options)=>new Promise((resolve,reject)=>{calls.push([q,options.mode||'auto']);jobs.push({q,status,options,resolve,reject});})},
  './components/Header':{Header:({children,onGoHome,onToggleFilters,onOpenNotification})=>React.createElement('header',null,
    React.createElement('button',{onClick:onGoHome},'홈'),React.createElement('button',{onClick:onToggleFilters},'옵션'),React.createElement('button',{onClick:()=>onOpenNotification(jumpNotice)},'알림 자료 열기'),children)},
  './components/ItemCard':{ItemCard:props=>React.createElement('article',{'data-item':props.item.id,'data-thread':props.notificationThreadId,'data-target':props.notificationComment?.id},props.item.키워드2,props.item.내용)},
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
  await click('질문 입력');await click('일반 검색');await click('알림 자료 열기');
  assert(container.textContent.includes('해당 자료와 댓글을 불러오는 중'));
  await act(async()=>navigationRequests[0].resolve({item:{id:77,키워드:'분류',키워드2:'알림 대상 자료',내용:'알림 대상 글의 전체 내용'},threadId:'parent77',comment:{id:'oldreply',parent_id:'parent77',info_id:77,body:'찾아갈 답글'}}));
  assert(container.textContent.includes('알림 대상 글의 전체 내용'));
  assert.equal(container.querySelectorAll('article[data-item]').length,1,'Notification navigation shows the target article despite previous search/filter state');
  assert.equal(container.querySelector('article[data-item]').dataset.thread,'parent77');
  assert.equal(container.querySelector('article[data-item]').dataset.target,'oldreply');
  await click('전체 자료 보기');assert(!container.textContent.includes('알림에서 연 자료'));
  await click('알림 자료 열기');await click('홈');
  await act(async()=>navigationRequests[1].resolve({item:{id:77,키워드2:'뒤늦게 도착한 알림 자료',내용:'늦은 본문'},threadId:'parent77',comment:{id:'oldreply'}}));
  assert(!container.textContent.includes('뒤늦게 도착한 알림 자료'),'Late navigation cannot overwrite home');
  await click('알림 자료 열기');await act(async()=>navigationRequests[2].reject(new Error('삭제되었거나 확인할 수 없는 자료·댓글입니다.')));
  assert(container.querySelector('[role="alert"]').textContent.includes('삭제되었거나'));
  assert.equal(container.querySelectorAll('article[data-item]').length,0,'Missing targets do not expose a stale cached article');
  await act(async()=>root.unmount());
  root=createRoot(container);
  let consultationSave;
  await act(async()=>root.render(React.createElement(AIAnswerPanel,{result:{query:'바코드기 정상작동 안됨',summary:inlineAnswer,results:[],synced_count:1,consultation_status:{status:'ok',files:1,count:545,matches:0}},onSave:async()=>{}})));
  assert(container.textContent.includes('미검증 상담 참고 · 관련 사례 0건'));
  assert(container.textContent.includes('상담 기록 545건'));
  assert(container.textContent.includes('\n\n2. 리더기'));
  await act(async()=>root.render(React.createElement(AIAnswerPanel,{result:{query:'포스 전원',summary:'정식 자료 답변',results:[],synced_count:0,consultation_summary:'미검증 상담 참고: 연결 점검 기록이 있습니다.',consultations:[{source:'2026/2026-10.xlsx',sheet:'Sheet1',row:3,memo:'포스 전원 문의',action:'전원 연결 점검 안내'}]},onSave:async(q,a)=>{consultationSave=[q,a];}})));
  assert(container.textContent.includes('미검증 상담 참고 (1)'));
  assert.equal(container.querySelector('details').open,false,'Unverified raw consultation records start collapsed');
  assert(container.querySelector('details').textContent.includes('Sheet1 3행'));
  await click('답변 수정·저장');
  await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert(consultationSave[1].includes('미검증 상담 참고 · 해결 확인 아님'));
  assert(consultationSave[1].includes('2026/2026-10.xlsx'));
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
  let fetches=0,replyFetches=0,remoteTotal=3;const reported=[];const report=total=>reported.push(total);let replyRows=[];const addedCalls=[],replyOffsets=[];
  const comment={id:'c1',info_id:1,parent_id:null,author_id:'someone-else',author_username:'other',body:'<script>unsafe()</script>',created_at:'date',updated_at:null};
  const commentApi={
    fetchComments:async()=>{fetches++;return {comments:[comment],total:remoteTotal,rootTotal:1};},
    fetchReplies:async(_info,_parent,offset=0)=>{replyFetches++;replyOffsets.push(offset);return {comments:replyRows.slice(offset,offset+30),total:replyRows.length};},
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
  assert.equal(replyFetches,1,'Reply checks start only after opening article comments');
  assert(!container.querySelector('[aria-label="답글 목록"]'),'Empty reply groups stay collapsed');
  await click('답글 0개 보기·작성');assert.equal(replyFetches,1,'Opening the empty composer reuses the check');
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

  const oldReply={...comment,id:'oldreply',parent_id:'c1',body:'알림에서 바로 찾아갈 오래된 답글'};
  replyRows=[oldReply];
  root=createRoot(container);const checksBeforeOpen=replyFetches;
  await act(async()=>root.render(React.createElement(ItemCard,{item:{id:1,키워드:'',키워드2:'일반 자료',내용:'본문'},commentCount:3,searchQuery:'',isFavorite:false})));
  assert.equal(replyFetches,checksBeforeOpen,'Closed article comments do not fetch replies');
  await act(async()=>container.querySelector('[aria-label="댓글 3개 보기"]').click());
  assert(container.querySelector('[aria-label="답글 목록"]').textContent.includes(oldReply.body),'Existing replies open with their parent comments');
  const checked=replyFetches;await click('답글 1개 접기');assert(!container.querySelector('[aria-label="답글 목록"]'));
  await click('답글 1개 보기·작성');assert.equal(replyFetches,checked,'Manual collapse/reopen uses loaded replies');
  await act(async()=>root.unmount());
  replyRows=[...Array.from({length:35},(_,i)=>({...comment,id:'page-reply-'+i,parent_id:'c1',body:'일반 답글 '+i})),oldReply];remoteTotal=37;
  root=createRoot(container);
  await act(async()=>root.render(React.createElement(ItemCard,{item:{id:1,키워드:'',키워드2:'알림 글 전체 제목',내용:'알림 글 전체 본문'},notificationThreadId:'c1',notificationComment:oldReply,commentCount:37,onCommentCountChange:(_id,n)=>report(n),searchQuery:'',isFavorite:false})));
  assert(container.textContent.includes('알림 글 전체 본문'));
  assert(container.querySelector('[aria-label="댓글 37개 접기"]'));
  assert(container.textContent.includes(oldReply.body),'A notified reply beyond page one is shown immediately');
  assert.equal(document.activeElement.dataset.commentId,'oldreply');assert.equal(focusedScrolls.at(-1),'oldreply');
  assert.equal(replyOffsets.at(-1),0);
  await click('이 자료의 모든 댓글 보기');await click('알림의 댓글로 돌아가기');
  assert.equal(document.activeElement.dataset.commentId,'oldreply');
  await click('답글 더 보기');assert.equal(replyOffsets.at(-1),30,'The pinned reply must not advance the pagination offset');
  assert.equal(container.querySelectorAll('[data-comment-id="oldreply"]').length,1,'No duplicate target after loading its normal page');
  await act(async()=>root.render(React.createElement(ItemCard,{item:{id:1,키워드:'',키워드2:'알림 글 전체 제목',내용:'알림 글 전체 본문'},notificationThreadId:'c1',notificationComment:comment,commentCount:37,onCommentCountChange:(_id,n)=>report(n),searchQuery:'',isFavorite:false})));
  assert.equal(document.activeElement.dataset.commentId,'c1','Root comment notifications focus the root comment');
  await act(async()=>root.unmount());

  let unread=2,notificationFetches=0,readIds=[],holdReads=false;const readWaiters=[];const notice={id:'n1',info_id:1,comment_id:'reply1',actor_username:'other',info_title:'자료 제목',kind:'reply',created_at:'date',read_at:null};
  const {NotificationBell}=load('src/components/NotificationBell.tsx',{
    '../lib/notifications':{fetchUnreadCount:async()=>unread,fetchNotifications:async()=>{notificationFetches++;return {notifications:[notice,{...notice,id:'n2'}].map(row=>({...row,read_at:readIds.includes(row.id)?'date':null})),total:2};},
      markNotificationRead:async id=>{if(holdReads)await new Promise(resolve=>readWaiters.push(resolve));readIds.push(id);unread--;},markNotificationsRead:async ids=>{readIds.push(...ids);unread-=ids.length;},
      },
    '../utils/helpers':{formatDate:x=>x,normalizeContentText:x=>x},'./HighlightText':highlight,
    './ItemComments':{ItemComments:props=>React.createElement('p',{'data-thread':props.threadId||'all'},'알림의 댓글')},
  });
  const opened=[];
  root=createRoot(container);await act(async()=>root.render(React.createElement(NotificationBell,{onOpenNotification:notification=>opened.push(notification)})));
  assert.equal(notificationFetches,0,'Only unread count is fetched before opening the bell');
  await act(async()=>container.querySelector('[aria-label="알림 2개 안 읽음"]').click());assert.equal(notificationFetches,1);
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes('other님이 내 댓글에 답글')).click());
  assert.deepEqual(readIds,['n1']);assert.equal(opened[0].comment_id,'reply1');assert.equal(opened[0].info_id,1);
  assert.equal(container.querySelector('dialog'),null,'Notification clicks navigate in the main app');
  await act(async()=>container.querySelector('[aria-label="알림 1개 안 읽음"]').click());
  await click('표시된 알림 읽음');assert.equal(unread,0);
  await act(async()=>container.querySelector('[aria-label="알림 0개 안 읽음"]').click());
  unread=2;readIds.length=0;holdReads=true;
  await act(async()=>container.querySelector('[title="알림"]').click());
  await act(async()=>[...container.querySelectorAll('button')].filter(b=>b.textContent.includes('other님이 내 댓글에 답글'))[0].click());
  await act(async()=>container.querySelector('[title="알림"]').click());
  const secondNotice=[...container.querySelectorAll('button')].filter(b=>b.textContent.includes('other님이 내 댓글에 답글'))[1];
  assert(!secondNotice.disabled,'Read marking cannot block navigation to another notification');
  await act(async()=>secondNotice.click());assert.equal(opened.at(-1).id,'n2');
  await act(async()=>readWaiters.forEach(resolve=>resolve()));
  await act(async()=>root.unmount());dom.window.close();
  console.log('PASS: manual web during analysis, internal answer preserved, cited corrections saved, stale results suppressed, lazy comments and author/master controls');
})().catch(error=>{console.error(error);process.exit(1);});
