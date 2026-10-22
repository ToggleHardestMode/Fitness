import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const sw=readFileSync(new URL('../preview-v101/sw.js', import.meta.url),'utf8');
const scope='https://example.test/Fitness/preview-v101/';
function mockWorker() {
  const handlers={};
  const shell=new Response('<html>cached FitnessPilot preview</html>',{status:200,headers:{'content-type':'text/html'}});
  const matchCalls=[];
  const caches={
    match:async request=>{
      const url=String(typeof request==='string'?request:request.url);
      matchCalls.push(url);
      return url===scope+'index.html'?shell:undefined;
    },
    open:async()=>({addAll:async()=>{},put:async()=>{}}),
    keys:async()=>[]
  };
  const self={location:{origin:'https://example.test'},registration:{scope},
    addEventListener:(name,cb)=>{handlers[name]=cb;}};
  runInNewContext(sw,{self,caches,fetch:async()=>{throw Error('Offline');},Response,URL,Promise});
  return {handlers,matchCalls,shell};
}
function request(url,mode='navigate'){
  return {url,mode,method:'GET'};
}
function send(worker,req){
  let handled;
  worker.handlers.fetch({request:req,respondWith:p=>{handled=p;},waitUntil:()=>{}});
  return handled;
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
test('the preview service worker uses a dedicated cache namespace',()=>{
  assert.match(sw,/fitnesspilot-preview-v155-recovery-v24/);
  assert.match(sw,/startsWith\('fitnesspilot-preview-'\)/);
  assert.match(sw,/'\.\/recovery-check\.js'/);
});
