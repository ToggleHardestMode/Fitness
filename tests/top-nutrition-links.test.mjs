import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src = name => readFileSync(new URL('../preview-v101/'+name, import.meta.url),'utf8');

test('dashboard places top Nutrition and Cheatsheet links directly below heading',()=>{
  const app=src('app.js');
  const dashboard=app.match(/function dashboard\(\) \{[\s\S]*?(?=\nfunction rangeSummary\()/);
  assert.ok(dashboard,'dashboard source exists');
  const code=dashboard[0];
  const marker='\x24{shellHeading()}<nav class="fp-top-nutrition"';
  assert.ok(code.includes(marker),'links appear immediately after heading');
  const nav=code.match(/<nav class="fp-top-nutrition"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav,'has semantic navigation');
  assert.match(nav[0],/aria-label="Nutrition quick links"/);
  assert.match(nav[1],/<a class="btn fp-top-nutrition-link" href="\.\/nutrition\.html">Nutrition<\/a>/);
  assert.match(nav[1],/<a class="btn secondary fp-top-nutrition-link" href="\.\/nutrition-cheatsheet\.html">Cheatsheet<\/a>/);
  assert.ok(code.indexOf('fp-top-nutrition')<code.indexOf('dashboardAdventurer()'),'buttons are above dashboard art');
});
test('responsive style provides two touch-friendly shortcuts',()=>{
 const css=src('fp39-dark-fantasy.css');
 assert.match(css,/\.fp-top-nutrition\s*\{\s*display:grid/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.fp-top-nutrition \.fp-top-nutrition-link\s*\{[^}]*min-height:48px/);
 assert.match(css,/@media\(min-width:700px\)/);
});
test('existing nutrition destinations remain real and cached in V15.20.1',()=>{
 const sw=src('sw.js'),app=src('app.js');
 for(const page of ['nutrition.html','nutrition-cheatsheet.html']){
   assert.match(sw,new RegExp("'\\.\\/"+page.replace('.','\\.')+"'"));
   assert.ok(src(page).includes('FITNESSPILOT V15.20.1 PREVIEW'));
 }
 assert.match(src('index.html'),/FITNESSPILOT V15\.20\.1 PREVIEW/);
 assert.match(src('manifest.webmanifest'),/FitnessPilot V15\.20\.1 Preview/);
 assert.match(sw,/fitnesspilot-preview-v15201-top-nutrition-v53/);
 assert.match(app,/Open Food Diary/);
});
