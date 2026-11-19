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

test('graphic is accessible, internal, and cannot capture touch controls', () => {
  const art = read('adventurer-idle.svg');
  const css = read('pages.css');
  assert.match(art, /<svg[^>]+viewBox=/);
  assert.match(art, /moustached fantasy adventurer/);
  assert.doesNotMatch(art, /<script|(?:href|src)=["']https?:\/\//i);
  assert.match(css, /\.fp-walker-stage\s*\{[^}]*pointer-events\s*:\s*none\s*;/);
  assert.match(read('dashboard-walker.js'), /fp-walker-stage/);
});

test('small iPhone and reduced-motion users retain a stable banner', () => {
  const css = read('pages.css');
  const art = read('adventurer-idle.svg');
  assert.match(css, /@media\s*\(max-width\s*:\s*390px\)\s*\{\s*\.fp-walker-banner\s*\{/);
  assert.match(css, /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{\s*\.fp-walker-platform\s*\{/);
  assert.doesNotMatch(css, /\.fp-walker-sprite\s*\{[^}]*display\s*:\s*none\b/);
  assert.match(art, /prefers-reduced-motion:reduce/);
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
