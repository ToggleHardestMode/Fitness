import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { previewVersion, cacheVersionToken, cacheName, loadedAssets } from './preview-version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'preview-v101');
const read = filename => readFileSync(resolve(root, filename), 'utf8');

test('adventurer appears before progress only on Dashboard', () => {
  const app = read('app.js');
  const start = app.indexOf('function dashboardAdventurer()');
  const dashboard = app.indexOf('function dashboard()');
  assert.ok(start >= 0 && dashboard > start);
  assert.match(app, /\$\{dashboardAdventurer\(\)\}\$\{gildedSummary/);
  assert.equal((app.match(/\$\{dashboardAdventurer\(\)\}/g) ?? []).length, 1);
  assert.match(app.slice(start, dashboard), /dashboardWalkerBanner\(walkerDataUrl\)/);
});

test('graphic is accessible, internal, and cannot capture touch controls', () => {
  const art = read('adventurer-idle.svg');
  const css = read('dashboard-walker.css');
  const app = read('app.js');
  assert.match(art, /<svg[^>]+viewBox=/);
  assert.match(art, /moustached fantasy adventurer/);
  assert.doesNotMatch(art, /<script|(?:href|src)=["']https?:\/\//i);
  assert.match(css, /pointer-events:none/);
  assert.match(read('dashboard-walker.js'), /fp-walker-stage/);
});

test('small iPhone and reduced-motion users retain a stable banner', () => {
  const css = read('dashboard-walker.css');
  const art = read('adventurer-idle.svg');
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /\.fp-walker-sprite\{display:none\}/);
  assert.match(art, /prefers-reduced-motion:reduce/);
});

test('versioned preview caches all new assets',() => {
  const worker = read('sw.js');
  const page = read('index.html');
  const version = previewVersion();
  assert.ok(cacheName().includes(cacheVersionToken(version)), 'cache name carries the banner version');
  for (const file of ['adventurer-idle.svg','dashboard-walker.css']) {
    assert.match(worker, new RegExp("'\\./" + file.replaceAll('.', '\\.') + "'"));
  }
  assert.match(page, /href="\.\/dashboard-walker\.css"/);
  assert.equal(JSON.parse(read('manifest.webmanifest')).name, `FitnessPilot ${version} Preview`);
  const missing = loadedAssets().filter(file => !worker.includes("'./" + file + "'"));
  assert.deepEqual(missing, [], 'every asset and module the preview loads must be precached');
});
