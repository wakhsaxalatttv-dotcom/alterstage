import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {createSerpApiProbe} from '../server/ingestion/serpapi.js';
import {createApp} from '../server/app.js';
const env = {SERPAPI_API_KEY:'test-only-never-a-real-secret'};
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('SerpApi never calls network without key',async()=>{
 const p=createSerpApiProbe({env:{},fetcher:()=>assert.fail('network')});
 assert.equal((await p.run()).status,'not_configured');
});
test('SerpApi fixed French query, safe diagnostics and quota protection',async()=>{
 let calls=0;
 const p=createSerpApiProbe({env,fetcher:async(url,options)=>{
  calls++;
  const u=new URL(url);
  assert.equal(u.origin,'https://serpapi.com');
  assert.equal(u.pathname,'/search.json');
  assert.equal(u.searchParams.get('api_key'),env.SERPAPI_API_KEY);
  assert.equal(u.searchParams.get('engine'),'google_jobs');
  assert.equal(u.searchParams.get('location'),'France');
  assert.equal(u.searchParams.get('gl'),'fr');
  assert.equal(options.redirect,'manual');
  return json({jobs_results:[{title:'Exemple fictif',description:'contact@example.org',apply_options:[{link:'https://example.org/job'}]}],search_metadata:{json_endpoint:url}});
 }});
 const r=await p.run();
 assert.equal(r.status,'success');
 assert.equal(r.resultCount,1);
 assert.equal(r.withApplicationLinks,1);
 assert.ok(!JSON.stringify(r).includes(env.SERPAPI_API_KEY));
 assert.ok(!JSON.stringify(r).includes('contact@example.org'));
 assert.ok(!JSON.stringify(r).includes('Exemple fictif'));
 assert.equal((await p.run()).status,'limited');
 assert.equal(calls,1);
});
test('SerpApi handles rejected keys, quotas, API errors and network exceptions without leaking secrets',async()=>{
 for(const code of [401,403,429]){
  const r=await createSerpApiProbe({env,fetcher:async()=>json({error:env.SERPAPI_API_KEY},code)}).run();
  assert.equal(r.status,'error');assert.equal(r.httpStatus,code);
  assert.ok(!JSON.stringify(r).includes(env.SERPAPI_API_KEY));
 }
 for(const fetcher of [async()=>json({error:env.SERPAPI_API_KEY}),async()=>{throw new Error(env.SERPAPI_API_KEY)}]){
  const r=await createSerpApiProbe({env,fetcher}).run();
  assert.equal(r.status,'error');assert.ok(!JSON.stringify(r).includes(env.SERPAPI_API_KEY));
 }
 const empty=await createSerpApiProbe({env,fetcher:async()=>json({search_information:{jobs_results_state:'Fully empty'}})}).run();
 assert.equal(empty.status,'success');assert.equal(empty.resultCount,0);
});
test('SerpApi endpoints are private, persist only diagnostics and create no offers',async()=>{
 const folder=await mkdtemp('/tmp/serpapi-test-');
 const token='x'.repeat(40);
 const app=createApp({folder,adminToken:token,serpApiOptions:{env,fetcher:async()=>json({jobs_results:[]})}});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(base+'/api/admin/serpapi')).status,401);
  const headers={Authorization:`Bearer ${token}`};
  const status=await (await fetch(base+'/api/admin/serpapi',{headers})).json();
  assert.equal(status.configured,true);
  const result=await (await fetch(base+'/api/admin/serpapi/test',{method:'POST',headers})).json();
  assert.equal(result.status,'success');
  assert.equal(app.locals.store.db.prepare('SELECT count(*) AS n FROM offers').get().n,0);
  assert.equal(app.locals.store.runs().find(r=>r.sourceId==='serpapi-test').diagnostic.resultCount,0);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  app.locals.store.db.close();await rm(folder,{recursive:true,force:true});
 }
});
