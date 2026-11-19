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
  const app=read('actions.js');
  assert.match(app,/function inspectWalkerDisplay\(\)/);
  assert.match(app,/const probe\s*=\s*new Image\(\)/);
  assert.match(app,/image\.src\s*=\s*src/);
  assert.match(app,/image\.src\s*=\s*generic/);
  assert.match(app,/Personal image could not be displayed/);
  assert.doesNotMatch(app,/\.fp-walker-still/);
});
test('Reduce Motion uses the same image with a private still PNG',()=>{
  const app=read('actions.js'),css=read('pages.css');
  assert.match(app,/createWalkerStill\(selected\)\s*\.then\(\(png\)\s*=>/);
  assert.match(app,/useAvatar\(png,/);
  assert.doesNotMatch(css,/fp-walker-still/);
  assert.match(css,/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{\s*:where\(\[data-workout-preview\]\)\s+\.fp-walker-platform\s*\{/);
});
