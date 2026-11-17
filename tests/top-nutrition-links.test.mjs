import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewVersion,cacheVersionToken,cacheName} from './preview-version.mjs';
import { dashboardHtml } from './dashboard-fixture.mjs';
const src = name => readFileSync(new URL('../preview-v101/'+name, import.meta.url),'utf8');

test('dashboard places top Nutrition and Cheatsheet links directly below heading',()=>{
  const html = dashboardHtml();
  assert.match(html, /^<div class="header-row">FitnessPilot<\/div><nav class="fp-top-nutrition"/);
  const nav = html.match(/<nav class="fp-top-nutrition"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'has semantic navigation');
  assert.match(nav[0], /aria-label="Nutrition quick links"/);
  assert.match(nav[1], /<a class="btn fp-top-nutrition-link" href="\.\/nutrition\.html">Nutrition<\/a>/);
  assert.match(nav[1], /<a class="btn secondary fp-top-nutrition-link" href="\.\/nutrition-cheatsheet\.html">Cheatsheet<\/a>/);
  assert.ok(html.indexOf('fp-top-nutrition') < html.indexOf('fp-walker-banner'), 'buttons are above dashboard art');
});
test('responsive style provides two touch-friendly shortcuts',()=>{
 const css=src('fp39-dark-fantasy.css');
 assert.match(css,/\.fp-top-nutrition\s*\{\s*display:grid/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.fp-top-nutrition \.fp-top-nutrition-link\s*\{[^}]*min-height:48px/);
 assert.match(css,/@media\(min-width:700px\)/);
});
test('existing nutrition destinations remain real and cached with a synchronized preview version',()=>{
 const sw=src('sw.js');
 for(const page of ['nutrition.html','nutrition-cheatsheet.html']){
   assert.match(sw,new RegExp("'\\.\\/"+page.replace('.','\\.')+"'"));
   assert.match(src(page),/FITNESSPILOT V\d+\.\d+\.\d+ PREVIEW/);
 }
 const version=previewVersion();
 assert.equal(JSON.parse(src('manifest.webmanifest')).name,`FitnessPilot ${version} Preview`);
 assert.ok(cacheName().includes(cacheVersionToken(version)));
 assert.match(dashboardHtml(), /href="\.\/food-diary\.html">Open Food Diary →<\/a>/);
});
