import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../preview-v101/'+name, import.meta.url),'utf8');

test('Dashboard has exactly one character image and a separate platform',()=>{
  const markup=read('dashboard-walker.js');
  assert.equal((markup.match(/<img /g)||[]).length,1);
  assert.match(markup,/src="\.\/adventurer-idle\.svg"/);
  assert.match(markup,/fp-walker-platform/);
  assert.doesNotMatch(markup,/fp-walker-still/);
});
test('replace same image after preload, fallback on decode failure',()=>{
  const app=read('app.js');
  assert.match(app,/function inspectWalkerDisplay\(\)/);
  assert.match(app,/const probe=new Image\(\)/);
  assert.match(app,/image\.src=src/);
  assert.match(app,/image\.src=generic/);
  assert.match(app,/Personal image could not be displayed/);
  assert.doesNotMatch(app,/\.fp-walker-still/);
});
test('Reduce Motion uses the same image with a private still PNG',()=>{
  const app=read('app.js'),css=read('dashboard-walker.css');
  assert.match(app,/createWalkerStill\(selected\)\.then\(png=>/);
  assert.match(app,/useAvatar\(png,/);
  assert.doesNotMatch(css,/fp-walker-still/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
