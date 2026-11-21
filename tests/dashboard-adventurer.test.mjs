import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { dashboardHtml } from './dashboard-fixture.mjs';
import { previewVersion, cacheVersionToken, cacheName, loadedAssets } from './preview-version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'preview-v101');
const read = filename => readFileSync(resolve(root, filename), 'utf8');

test('adventurer appears before progress only on Dashboard', () => {
  const html = dashboardHtml({}, { selection: { walkerDataUrl: "data:image/webp;base64,UklGRsynthetic" } });
  const walker = html.indexOf('class="fp-walker-banner"');
  const progress = html.indexOf('class="v151-gold-summary"');
  assert.ok(walker >= 0 && progress > walker);
  assert.match(html, /Checking character display…/);
  assert.equal((html.match(/class="fp-walker-banner"/g) ?? []).length, 1);
});

test('default avatar asset has accessible metadata and no script or external links', () => {
  const art = read('adventurer-idle.svg');
  assert.match(art, /<svg[^>]+viewBox=/);
  assert.match(art, /moustached fantasy adventurer/);
  assert.doesNotMatch(art, /<script|(?:href|src)=["']https?:\/\//i);
});

test('default SVG includes a reduced-motion rule', () => {
  assert.match(read('adventurer-idle.svg'), /prefers-reduced-motion:reduce/);
});

test('versioned preview caches all new assets',() => {
  const worker = read('sw.js');
  const page = read('index.html');
  const version = previewVersion();
  assert.ok(cacheName().includes(cacheVersionToken(version)), 'cache name carries the banner version');
  for (const file of ['adventurer-idle.svg','pages.css']) {
    assert.match(worker, new RegExp("'\\./" + file.replaceAll('.', '\\.') + "'"));
  }
  assert.match(page, /href="\.\/pages\.css"/);
  assert.equal(JSON.parse(read('manifest.webmanifest')).name, `FitnessPilot ${version} Preview`);
  const missing = loadedAssets().filter(file => !worker.includes("'./" + file + "'"));
  assert.deepEqual(missing, [], 'every asset and module the preview loads must be precached');
});
