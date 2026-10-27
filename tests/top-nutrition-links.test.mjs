import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=name=>readFileSync(new URL('../preview-v101/'+name,import.meta.url),'utf8');

test('Nutrition and Cheatsheet are separate standalone top-level Dashboard shortcuts',()=>{
 const app=src('app.js');
 const dashboard=app.match(/function dashboard\(\) \{[\s\S]*?(?=\nfunction rangeSummary\()/);
 assert.ok(dashboard,'Dashboard source should exist');
 const code=dashboard[0];
 assert.ok(code.includes('${shellHeading()}<a class="fp-top-feature-link fp-top-feature-nutrition"'),'Nutrition immediately follows heading');
 assert.doesNotMatch(code,/fp-top-nutrition|Nutrition quick links/,'paired quick link group removed');
 const nutrition=code.match(/<a class="fp-top-feature-link fp-top-feature-nutrition"[^>]*>[\s\S]*?<\/a>/);
 const cheatsheet=code.match(/<a class="fp-top-feature-link fp-top-feature-cheatsheet"[^>]*>[\s\S]*?<\/a>/);
 assert.ok(nutrition,'standalone Nutrition anchor present');
 assert.ok(cheatsheet,'standalone Cheatsheet anchor present');
 assert.match(nutrition[0],/href="\.\/nutrition\.html"/);
 assert.match(nutrition[0],/<strong>Nutrition<\/strong>/);
 assert.match(cheatsheet[0],/href="\.\/nutrition-cheatsheet\.html"/);
 assert.match(cheatsheet[0],/<strong>Cheatsheet<\/strong>/);
 assert.ok(code.indexOf('fp-top-feature-nutrition')<code.indexOf('fp-top-feature-cheatsheet'),'each independent in intended order');
 assert.ok(code.indexOf('fp-top-feature-cheatsheet')<code.indexOf('dashboardAdventurer()'),'both are above avatar');
});
test('buttons occupy distinct mobile rows with 66px minimum touch surfaces',()=>{
 const css=src('fp39-dark-fantasy.css');
 assert.match(css,/\.fp-top-feature-link\s*\{[\s\S]*?display:grid/);
 assert.match(css,/\.fp-top-feature-link\s*\{[\s\S]*?min-height:66px/);
 assert.match(css,/\.fp-top-feature-nutrition\{margin-top:16px/);
 assert.match(css,/\.fp-top-feature-cheatsheet\{[\s\S]*?margin-top:10px/);
 assert.match(css,/:focus-visible\{outline:3px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(css,/\.fp-top-nutrition\{/);
});
test('both independent destinations are available offline and version labels match',()=>{
 const sw=src('sw.js');
 for(const page of ['nutrition.html','nutrition-cheatsheet.html']){
  assert.ok(sw.includes("'./"+page+"'"),page+' must be cached');
  assert.match(src(page),/FITNESSPILOT V15\.20\.2 PREVIEW/);
 }
 assert.match(src('index.html'),/FITNESSPILOT V15\.20\.2 PREVIEW/);
 assert.match(src('manifest.webmanifest'),/FitnessPilot V15\.20\.2 Preview/);
 assert.match(sw,/fitnesspilot-preview-v15202-separate-shortcuts-v54/);
 assert.match(src('app.js'),/Open Food Diary/);
});
