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
test('existing nutrition destinations remain real and cached with a synchronized preview version',()=>{
 const sw=src('sw.js');
 for(const page of ['nutrition.html','nutrition-cheatsheet.html']){
   assert.match(sw,new RegExp("'\\.\\/"+page.replace('.','\\.')+"'"));
   assert.match(src(page),/FITNESSPILOT V\d+\.\d+\.\d+ PREVIEW/);
 }
 const version=previewVersion();
 assert.equal(JSON.parse(src('manifest.webmanifest')).name,`FitnessPilot ${version} Preview`);
 assert.ok(cacheName().includes(cacheVersionToken(version)));
 const nutrition = dashboardHtml().match(/<section\b[^>]*><div class="card-head"><div><h2>Nutrition & Weight Journey<\/h2>.*?<\/section>/s);
 assert.ok(nutrition, 'has the nutrition summary card');
 assert.match(nutrition[0], /href="\.\/food-diary\.html">Open Food Diary →<\/a>/);
});

test('daily Food Diary is a direct primary Dashboard shortcut immediately beside Nutrition', () => {
  const html = dashboardHtml();
  const nav = html.match(/<nav class="fp-top-nutrition"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const links = [...nav.matchAll(/<a class="([^"]+)" href="([^"]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(links.map(link => link[3]), ['Nutrition', 'Food Diary', 'Cheatsheet']);
  assert.equal(links[1][1], 'btn fp-top-nutrition-link');
  assert.equal(links[1][2], './food-diary.html');
  assert.match(src('food-diary.html'), /id="fd-date"/);
  assert.ok(src('sw.js').includes("'./food-diary.html'"));
});
