import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {previewVersion,cacheVersionToken,cacheName} from './preview-version.mjs';
const root=new URL('../preview-v101/',import.meta.url);
const read=filename=>readFileSync(new URL(filename,root),'utf8');

test('preview keeps the Fantasy Codex cascade and workout-only styles scoped',()=>{
 const workoutLinks=['./tokens.css','./base.css','./theme.css','./components.css','./pages.css'];
 for(const page of ['index.html','nutrition.html','nutrition-cheatsheet.html','food-diary.html']){
  const html=read(page);
  const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
  const workout=page==='index.html';
  assert.equal(/<html[^>]*\bdata-workout-preview\b/.test(html),workout,page);
  if(workout){
   assert.deepEqual(links,workoutLinks);
   assert.ok(html.includes('FITNESSPILOT '+previewVersion()+' PREVIEW'));
  }else{
   assert.equal(links.filter(link=>link==='./theme.css').length,1,page);
   assert.equal(links.filter(link=>link==='./pages.css').length,1,page);
   assert.equal(links.at(-1),'./pages.css',page+' must load the shared Fantasy Codex rules last');
  }
  assert.match(html,/FITNESSPILOT V\d+\.\d+\.\d+ PREVIEW/);
 }
 const pages=read('pages.css');
 const fantasy=pages.indexOf('/* Fantasy Codex refinements */');
 const journey=pages.indexOf('/* Strength Journey visuals */');
 const timer=pages.indexOf('/* Floating rest timer */');
 assert.ok(fantasy>0 && journey>fantasy && timer>journey);
 assert.match(pages.slice(fantasy,journey),/prefers-reduced-motion/);
 assert.match(pages.slice(journey,timer),/^:where\(\[data-workout-preview\]\) #main \.sj-journey\s*\{/m);
 assert.match(pages.slice(timer),/^:where\(\[data-workout-preview\]\) \.fp-floating-rest\s*\{/m);
 assert.doesNotMatch(pages+read('theme.css'),/@import|url\(https?:/i);
});
test('vitamin UI has separate reference-standard picker and source-aware converter',()=>{
 const page=read('nutrition-cheatsheet.html');
 for(const id of ['vitamin-standard','vitamin-table-body','vitamin-convert-form','vitamin-method','vitamin-input','vitamin-result'])
  assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(page,/vitamin-reference-ui\.js/);
 assert.match(page,/not dosing instructions/);
 const ui=read('vitamin-reference-ui.js');
 assert.match(ui,/from '\.\/vitamin-units\.js'/);
});
test('isolated cache contains new style and vitamin modules with synchronized preview version',()=>{
 const sw=read('sw.js');
 assert.ok(cacheName().includes(cacheVersionToken(previewVersion())),'cache name carries the banner version');
 for(const file of ['theme.css','pages.css','vitamin-units.js','vitamin-reference-ui.js']){
  assert.ok(existsSync(new URL(file,root)),file+' missing');
  assert.ok(sw.includes("'./"+file+"'"),file+' not precached');
 }
 assert.equal(JSON.parse(read('manifest.webmanifest')).name,`FitnessPilot ${previewVersion()} Preview`);
});
