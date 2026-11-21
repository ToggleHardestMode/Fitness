import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {cacheName, cacheVersionToken, previewVersion} from './preview-version.mjs';

const sw=readFileSync(new URL('../preview-v101/sw.js', import.meta.url),'utf8');
const scope='https://example.test/Fitness/preview-v101/';
function mockWorker(cacheKeys = []) {
  const handlers={};
  const shell=new Response('<html>cached FitnessPilot preview</html>',{status:200,headers:{'content-type':'text/html'}});
  const matchCalls=[];
  const installs=[];
  const deleted=[];
  const caches={
    match:async request=>{
      const url=String(typeof request==='string'?request:request.url);
      matchCalls.push(url);
      return url===scope+'index.html'?shell:undefined;
    },
    open:async name=>({addAll:async assets=>{installs.push({name,assets:Array.from(assets)});},put:async()=>{}}),
    keys:async()=>cacheKeys,
    delete:async name=>{deleted.push(name);}
  };
  const self={location:{origin:'https://example.test'},registration:{scope},
    addEventListener:(name,cb)=>{handlers[name]=cb;},skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  runInNewContext(sw,{self,caches,fetch:async()=>{throw Error('Offline');},Response,URL,Promise});
  return {handlers,matchCalls,shell,installs,deleted};
}
function request(url,mode='navigate'){
  return {url,mode,method:'GET'};
}
function send(worker,req){
  let handled;
  worker.handlers.fetch({request:req,respondWith:p=>{handled=p;},waitUntil:()=>{}});
  return handled;
}
function waitForLifecycle(handler){
  let work;
  handler({waitUntil:pending=>{work=pending;}});
  assert.equal(typeof work?.then,'function');
  return work;
}
test('offline cache-busted preview navigation falls back to cached shell',async()=>{
  const w=mockWorker();
  const result=await send(w,request(scope+'?v=24'));
  assert.equal(result,w.shell);
  assert.ok(w.matchCalls.includes(scope+'index.html'));
});
test('offline nested preview navigation uses same cached shell',async()=>{
  const w=mockWorker();
  assert.equal(await send(w,request(scope+'history?v=24')),w.shell);
});
test('offline asset miss never masquerades as the app shell',async()=>{
  const w=mockWorker();
  const response=await send(w,request(scope+'missing.js','no-cors'));
  assert.equal(response.type,'error');
  assert.equal(w.matchCalls.includes(scope+'index.html'),false);
});
test('other-origin requests are not intercepted',()=>{
  const w=mockWorker();
  assert.equal(send(w,request('https://other.test/file')),undefined);
});
test('install caches recovery checks and activation only deletes obsolete preview caches',async()=>{
  const active=cacheName();
  const oldPreview='fitnesspilot-preview-v1-obsolete';
  const w=mockWorker([active,oldPreview,'fitnesspilot-web-v1','other-cache']);
  await waitForLifecycle(w.handlers.install);
  assert.equal(w.installs.length,1);
  assert.equal(w.installs[0].name,active);
  assert.match(w.installs[0].name,/^fitnesspilot-preview-v\d+-[a-z0-9-]+$/);
  assert.ok(w.installs[0].name.includes(cacheVersionToken(previewVersion())));
  assert.ok(w.installs[0].assets.includes('./recovery-check.js'));
  await waitForLifecycle(w.handlers.activate);
  assert.deepEqual(w.deleted,[oldPreview]);
});
