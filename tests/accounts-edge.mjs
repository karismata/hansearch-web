import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const master='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
let actor=null,role='member',targetRole='member',targetStatus='approved',limited=false,deleteFails=false,createError=null,permitError=null,ops=[];
const mockClient={auth:{getUser:async()=>({data:{user:actor?{id:actor}:null},error:actor?null:new Error('unauthorized')}),admin:{
 createUser:async body=>{ops.push(['create',body]);return {error:createError};},
 deleteUser:async id=>{ops.push(['delete',id]);return {error:deleteFails?new Error('failure'):null};},
 updateUserById:async(id,body)=>{ops.push(['password',id,body]);return {error:null};}
}},from:()=>({select:()=>({eq:(_field,id)=>({single:async()=>({data:id===actor?{id,role,status:'approved'}:{id,role:targetRole,status:targetStatus}})})})}),
 rpc:async(name,args)=>{ops.push([name,args]);return {data:name==='hansearch_signup_allowed'?!limited:null,error:name==='hansearch_prepare_signup'?permitError:null};}};
globalThis.__accountTestClient=mockClient;
const mock='data:text/javascript;base64,'+Buffer.from('export const createClient=()=>globalThis.__accountTestClient;').toString('base64');
let handler;
globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test-service-key',SUPABASE_ANON_KEY:'test-public-key'})[name]},serve:fn=>{handler=fn;}};
const source=ts.transpileModule(await readFile(new URL('../supabase/functions/accounts/index.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'npm:@supabase/supabase-js@2.112.4'",JSON.stringify(mock));
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const call=body=>handler(new Request('https://example.test/functions/v1/accounts',{method:'POST',headers:{Origin:'https://hansearch-web.pages.dev',Authorization:'Bearer test-only'},body:JSON.stringify(body)}));
assert.equal((await call({action:'register',username:'master',password:'test-password-123'})).status,400);
assert.equal((await call({action:'register',username:'worker1',password:'short'})).status,400);
assert.equal((await call({action:'register',username:'worker1',password:'abcdefg'})).status,400);
assert.equal((await call({action:'register',username:'worker1',password:'Abcd123!'})).status,201);
const created=ops.find(x=>x[0]==='create')[1];assert.equal(created.email,'worker1@login.hansearch.invalid');assert.equal(created.email_confirm,true);
const prepared=ops.find(x=>x[0]==='hansearch_prepare_signup')[1];
assert.equal(prepared.p_id,created.id); assert.equal(prepared.p_username,'worker1');
assert.equal(created.password.length,8); assert.equal(created.app_metadata,undefined);
assert.equal(ops.at(-1)[0],'hansearch_cancel_signup');assert.equal(ops.at(-1)[1].p_id,created.id);
createError={code:'email_exists',status:422};ops=[];
assert.equal((await call({action:'register',username:'duplicate',password:'Abcd123!'})).status,409);
assert.equal(ops.at(-1)[0],'hansearch_cancel_signup');createError=null;
permitError={code:'23505'};ops=[];
assert.equal((await call({action:'register',username:'retired',password:'Abcd123!'})).status,409);
assert(!ops.some(x=>x[0]==='create'));permitError=null;
limited=true;assert.equal((await call({action:'register',username:'worker2',password:'test-password-123'})).status,429);limited=false;
assert.equal((await call({action:'delete',user_id:member})).status,401);
actor=master;role='member';assert.equal((await call({action:'delete',user_id:member})).status,403);
role='master';assert.equal((await call({action:'delete',user_id:master})).status,400);
assert.equal((await call({action:'reset_password',user_id:member,password:'1234567'})).status,400);
assert.equal((await call({action:'reset_password',user_id:member,password:'Abcd123!'})).status,200);
targetRole='master';assert.equal((await call({action:'delete',user_id:member})).status,403);targetRole='member';
ops=[];assert.equal((await call({action:'delete',user_id:member})).status,200);assert.equal(ops[0][0],'hansearch_prepare_account_deletion');assert.equal(ops[1][0],'delete');
deleteFails=true;assert.equal((await call({action:'delete',user_id:member})).status,503);deleteFails=false;
targetStatus='deleted';assert.equal((await call({action:'reset_password',user_id:member,password:'test-password-123'})).status,400);
delete globalThis.Deno;delete globalThis.__accountTestClient;
console.log('PASS: reserved master ID, signup limits, master-only actions, self/master deletion protection, disable-before-delete, and failed cleanup reporting');

