import test from 'node:test';
import assert from 'node:assert/strict';
import { applyWalkerFile } from '../preview-v101/dashboard-walker-apply.js';
import { WALKER_KEY } from '../preview-v101/dashboard-walker.js';

const file={name:'sprite.webp',type:'image/webp',size:70344};
const raw='data:image/webp;base64,UklGRgAA';

test('explicit apply changes only the separate avatar preference',async()=>{
  const stored=new Map([['fitnesspilot.preview.v101.v1','{"templates":[{"id":"keep"}]}']]);
  const adapter={setItem(k,v){stored.set(k,v)}};
  const result=await applyWalkerFile(file,adapter,async()=>raw);
  assert.equal(result,raw);
  assert.equal(stored.get(WALKER_KEY),raw);
  assert.equal(stored.get('fitnesspilot.preview.v101.v1'),'{"templates":[{"id":"keep"}]}');
});
test('malformed image cannot write to browser storage',async()=>{
  let count=0;
  const storage={setItem(){count++}};
  await assert.rejects(applyWalkerFile(file,storage,async()=> 'data:image/svg+xml;base64,PHN2Zz4='));
  await assert.rejects(applyWalkerFile({...file,name:'sprite.svg'},storage,async()=>raw));
  assert.equal(count,0);
});
test('failed storage keeps caller state untouched and fails visibly',async()=>{
  const storage={setItem(){throw Error('QuotaExceededError')}};
  await assert.rejects(applyWalkerFile(file,storage,async()=>raw),/QuotaExceededError/);
});
