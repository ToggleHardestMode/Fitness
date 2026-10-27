import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../preview-v101/',import.meta.url);
const read=filename=>readFileSync(new URL(filename,root),'utf8');

test('FP-39 is loaded last on all four preview screens, without new network or external fonts',()=>{
 for(const page of ['index.html','nutrition.html','nutrition-cheatsheet.html','food-diary.html']){
  const html=read(page),marker='<link rel="stylesheet" href="./fp39-dark-fantasy.css">';
  assert.equal(html.split(marker).length,2,page+' must contain exactly one FP-39 stylesheet');
  const lastCss=html.lastIndexOf('<link rel="stylesheet"');
  assert.equal(html.indexOf(marker),lastCss,page+' must load FP-39 last');
  assert.match(html,/FITNESSPILOT V15\.20\.0 PREVIEW/);
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
 assert.match(sw,/fitnesspilot-preview-v15200-/);
 for(const file of ['fp39-dark-fantasy.css','vitamin-units.js','vitamin-reference-ui.js']){
  assert.ok(existsSync(new URL(file,root)),file+' missing');
  assert.ok(sw.includes("'./"+file+"'"),file+' not precached');
 }
 assert.match(read('manifest.webmanifest'),/FitnessPilot V15\.20\.0 Preview/);
});
