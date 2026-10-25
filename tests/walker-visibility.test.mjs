import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../preview-v101/'+name, import.meta.url),'utf8');

test('fallback is visible until avatar successfully loads',()=>{
  const css=read('dashboard-walker.css');
  assert.match(css,/\.fp-walker-still\{display:block/);
  assert.match(css,/\.fp-walker-sprite\.is-ready\{opacity:1\}/);
});
test('dashboard emits useful avatar status for a decoding failure',()=>{
  const app=read('app.js');
  assert.match(app,/function inspectWalkerDisplay\(\)/);
  assert.match(app,/image\.naturalWidth>0/);
  assert.match(app,/Character could not be displayed; fallback shown/);
  assert.match(read('dashboard-walker.js'),/id="walker-render-status"/);
});
