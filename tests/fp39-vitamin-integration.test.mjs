import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {previewVersion,cacheVersionToken,cacheName} from './preview-version.mjs';
const root=new URL('../preview-v101/',import.meta.url);
const read=filename=>readFileSync(new URL(filename,root),'utf8');

test('FP-39 is loaded last on all four preview screens, without new network or external fonts',()=>{
 for(const page of ['index.html','nutrition.html','nutrition-cheatsheet.html','food-diary.html']){
  const html=read(page),marker='<link rel="stylesheet" href="./fp39-dark-fantasy.css">';
  assert.equal(html.split(marker).length,2,page+' must contain exactly one FP-39 stylesheet');
  // index.html: V15.22.0/V15.22.2 deliberately append two scoped feature stylesheets after FP-39
  // (#main .sj-journey / .fp-floating-rest, no selectors shared with FP-39). Any other stylesheet after FP-39 fails.
  const scopedAfter=page==='index.html'?['./strength-journey-visual.css','./floating-rest.css']:[];
  const after=[...html.slice(html.indexOf(marker)+marker.length).matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
  assert.deepEqual(after,scopedAfter,page+' must load FP-39 last (apart from the scoped allowlist)');
  assert.match(html,/FITNESSPILOT V\d+\.\d+\.\d+ PREVIEW/);
  if(page==='index.html')assert.ok(html.includes('FITNESSPILOT '+previewVersion()+' PREVIEW'));
 }
 const theme=read('fp39-dark-fantasy.css');
 assert.match(theme,/prefers-reduced-motion/);
 assert.doesNotMatch(theme,/@import|url\(https?:/i);
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
 for(const file of ['fp39-dark-fantasy.css','vitamin-units.js','vitamin-reference-ui.js']){
  assert.ok(existsSync(new URL(file,root)),file+' missing');
  assert.ok(sw.includes("'./"+file+"'"),file+' not precached');
 }
 assert.equal(JSON.parse(read('manifest.webmanifest')).name,`FitnessPilot ${previewVersion()} Preview`);
});
