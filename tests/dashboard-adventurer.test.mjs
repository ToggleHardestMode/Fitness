import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'preview-v101');
const read = filename => readFileSync(resolve(root, filename), 'utf8');

test('adventurer appears before progress only on Dashboard', () => {
  const app = read('app.js');
  const start = app.indexOf('function dashboardAdventurer()');
  const dashboard = app.indexOf('function dashboard()');
  assert.ok(start >= 0 && dashboard > start);
  assert.match(app, /return `\$\{shellHeading\(\)\}\$\{dashboardAdventurer\(\)\}\$\{gildedSummary/);
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

test('versioned preview caches all new assets', () => {
  const worker = read('sw.js');
  const page = read('index.html');
  assert.match(page, /FITNESSPILOT V15\.15\.2 PREVIEW/);
  assert.match(worker, /fitnesspilot-preview-v15151-walker-fix-v41/);
  for (const file of ['adventurer-idle.svg','dashboard-walker.css']) {
    assert.match(worker, new RegExp("'\\./" + file.replaceAll('.', '\\.') + "'"));
  }
  assert.match(page, /href="\.\/dashboard-walker\.css"/);
  assert.equal(JSON.parse(read('manifest.webmanifest')).name, 'FitnessPilot V15.15.1 Preview');
});
