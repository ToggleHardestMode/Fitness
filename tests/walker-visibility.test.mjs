import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardWalkerBanner } from '../preview-v101/dashboard-walker.js';
const read = name => readFileSync(new URL('../preview-v101/'+name, import.meta.url),'utf8');

test('Dashboard has exactly one character image and a separate platform',()=>{
  const markup=dashboardWalkerBanner();
  assert.equal((markup.match(/<img /g)||[]).length,1);
  assert.match(markup,/src="\.\/adventurer-idle\.svg"/);
  assert.match(markup,/fp-walker-platform/);
  assert.doesNotMatch(markup,/fp-walker-still/);
});
test('avatar uses an off-DOM image probe before replacing the single sprite',()=>{
  const app=read('actions.js');
  assert.match(app,/function inspectWalkerDisplay\(\)/);
  assert.match(app,/const probe\s*=\s*new Image\(\)/);
  assert.doesNotMatch(app,/\.fp-walker-still/);
  assert.doesNotMatch(read('pages.css'),/fp-walker-still/);
});
