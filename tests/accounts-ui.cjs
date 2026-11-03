const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {JSDOM}=require(process.env.JSDOM_MODULE || 'jsdom');
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://hansearch-web.pages.dev'});
global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks){const name=path.resolve(file),m=new Module(name,module);m.filename=name;m.paths=Module._nodeModulePaths(process.cwd());const original=m.require.bind(m);m.require=id=>id in mocks?mocks[id]:original(id);m._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,name);return m.exports;}
let callback,profile=null,networkError=false;
const client={auth:{onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}};},getSession:async()=>({data:{session:null}}),signOut:async()=>({error:null})}};
const {AccountGate}=load('src/components/AccountGate.tsx',{'../lib/accounts':{accountClient:()=>client,readProfile:async()=>{if(networkError)throw new Error('offline');return profile;}}});
const {koreaDateRange,accountEmail}=load('src/lib/accounts.ts',{'./supabase':{}});
assert.equal(accountEmail(' ＭＡＳＴＥＲ '),'master@login.hansearch.invalid');assert.throws(()=>accountEmail('user@example.com'));
assert.deepEqual(koreaDateRange('2026-11-02','2026-11-02'),{p_start:'2026-11-01T15:00:00.000Z',p_end:'2026-11-02T15:00:00.000Z'});
assert.throws(()=>koreaDateRange('2026-11-03','2026-11-01'));
const {AccountPassword}=load('src/components/AccountPassword.tsx',{'../lib/accounts':{accountClient:()=>client}});
assert(renderToStaticMarkup(React.createElement(AccountPassword,{onClose(){}})).includes('minLength="8"'));
const blank=()=>null;
const {ItemCard}=load('src/components/ItemCard.tsx',{
 'react':{...React,default:React},
 './HighlightText':{HighlightText:({text})=>text},
 'lucide-react':Object.fromEntries(['Star','Edit3','Trash2','Copy','Check','Image'].map(name=>[name,blank])),
 '../utils/helpers':{formatDate:value=>value,parseImageUrls:()=>[],parseCategories:()=>[],normalizeContentText:value=>value,copyToClipboard:async()=>true},
});
const cardProps={item:{id:1,키워드:'분류',키워드2:'제목',내용:'내용',created_by_username:'creator',updated_by_username:'lasteditor',last_edited_at:'2026-11-03'},searchQuery:'',isFavorite:false,onToggleFavorite(){},onEdit(){},onDelete(){},onOpenImage(){}};
const cardHtml=renderToStaticMarkup(React.createElement(ItemCard,cardProps));
assert(cardHtml.includes('등록자: creator'));assert(cardHtml.includes('최종 수정자: lasteditor'));
assert.equal(cardHtml.match(/최종 수정자/g).length,1);
assert(!renderToStaticMarkup(React.createElement(ItemCard,{...cardProps,item:{...cardProps.item,updated_by_username:null}})).includes('최종 수정자'));
(async()=>{
 const container=document.getElementById('root'),root=createRoot(container);
 await act(async()=>{root.render(React.createElement(AccountGate,null,React.createElement('p',null,'PROTECTED_RECORDS')));});
 assert(container.textContent.includes('로그인'));assert(!container.textContent.includes('PROTECTED_RECORDS'));
 await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent==='새 계정 가입 신청').click();});
 assert.equal(container.querySelector('input[type="password"]').minLength,8);assert(container.textContent.includes('비밀번호: 8자 이상'));
 await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent==='로그인으로 돌아가기').click();});
 const id='11111111-1111-4111-8111-111111111111';
 profile={id,username:'worker1',status:'pending',role:'member'};
 await act(async()=>{callback('SIGNED_IN',{user:{id,user_metadata:{role:'master',status:'approved'}}});});
 assert(container.textContent.includes('가입 승인 대기'));assert(!container.textContent.includes('PROTECTED_RECORDS'));
 profile={...profile,status:'approved'};
 await act(async()=>{window.dispatchEvent(new window.Event('focus'));});assert(container.textContent.includes('PROTECTED_RECORDS'));
 networkError=true;
 await act(async()=>{window.dispatchEvent(new window.Event('focus'));});assert(!container.textContent.includes('PROTECTED_RECORDS'));assert(container.textContent.includes('승인 상태를 확인할 수 없습니다'));
 networkError=false;profile={...profile,status:'deleted'};
 await act(async()=>{window.dispatchEvent(new window.Event('focus'));});assert(!container.textContent.includes('PROTECTED_RECORDS'));
 await act(async()=>{callback('SIGNED_OUT',null);});assert(container.textContent.includes('로그인'));assert(!container.textContent.includes('PROTECTED_RECORDS'));
 await act(async()=>{root.unmount();});dom.window.close();
 console.log('PASS: login gate, pending approval, metadata cannot grant access, approved access, fail-closed profile errors, deletion and logout unmount data, and KST date bounds');
})().catch(err=>{console.error(err);process.exit(1);});

