import assert from 'node:assert/strict';
import worker, { AIQueue } from '../src/worker.js';
import { approvedMember } from '../src/lib/memberAuth.js';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const jwt = `header.${Buffer.from(JSON.stringify({sub:id,role:'master'})).toString('base64url')}.signature`;
const req = new Request('https://example.test', { headers: { Authorization:`Bearer ${jwt}` } });
let calls=0;
assert.equal(await approvedMember(new Request('https://example.test'),{},async()=>{calls++;}),null);assert.equal(calls,0);
assert.equal(await approvedMember(req,{},async()=>new Response('{}',{status:401})),null);
assert.equal(await approvedMember(req,{},async()=>Response.json([{id,status:'pending',role:'member'}])),null);
assert.equal(await approvedMember(req,{},async()=>Response.json([{id:other,status:'approved',role:'member'}])),null);
assert.equal((await approvedMember(req,{},async(url,init)=>{
 assert.equal(new URL(url).searchParams.get('id'),`eq.${id}`);assert.equal(init.headers.Authorization,`Bearer ${jwt}`);
 return Response.json([{id,status:'approved',role:'member'}]);
})).id,id);
const map=new Map();let alarm=null;
const queue=new AIQueue({storage:{get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k),getAlarm:async()=>alarm,setAlarm:async n=>{alarm=n;},list:async({prefix})=>new Map([...map].filter(([k])=>k.startsWith(prefix)))}});
const env={AI_ACCESS_TOKEN:'test-only-shared-token-at-least-32-chars',AI_QUEUE:{idFromName:()=>1,get:()=>queue}};
const make=(path,headers={},body)=>new Request(`https://hansearch-web.karis830519.workers.dev${path}`,{method:body?'POST':'GET',headers:{Origin:'https://hansearch-web.pages.dev',...headers},body:body?JSON.stringify(body):undefined});
const originalFetch=globalThis.fetch;let approved=true;
globalThis.fetch=async()=>Response.json([{id,status:approved?'approved':'deleted',role:'member'}]);
try {
 let r=await worker.fetch(make('/api/ai/jobs',{}, {query:'질문'}),env);assert.equal(r.status,403);
 r=await worker.fetch(make('/api/ai/jobs',{Authorization:`Bearer ${jwt}`,'X-HanSearch-User':other},{query:'질문'}),env);
 assert.equal(r.status,202);const job=await r.json();assert.equal(map.get(`job:${job.id}`).ownerId,id);
 const stolen=await queue.fetch(new Request(`https://internal/jobs/${job.id}`,{headers:{'X-HanSearch-User':other}}));assert.equal(stolen.status,404);
 r=await worker.fetch(make(`/api/ai/jobs/${job.id}`,{Authorization:`Bearer ${jwt}`}),env);assert.equal(r.status,200);
 approved=false;r=await worker.fetch(make(`/api/ai/jobs/${job.id}`,{Authorization:`Bearer ${jwt}`}),env);assert.equal(r.status,403);
 r=await worker.fetch(make('/api/ai/agent/next'),env);assert.equal(r.status,401);
 r=await worker.fetch(make('/api/ai/agent/next',{Authorization:`Bearer ${env.AI_ACCESS_TOKEN}`}),env);assert.equal(r.status,200);assert.equal((await r.json()).id,job.id);
 globalThis.fetch=async()=>{throw new Error('offline');};r=await worker.fetch(make('/api/ai/jobs',{Authorization:`Bearer ${jwt}`},{query:'질문'}),env);assert.equal(r.status,503);
} finally {globalThis.fetch=originalFetch;}
console.log('PASS: approved-session enforcement, JWT verification delegation, owner spoof/read isolation, revoked account denial, and independent Mac agent authentication');
