import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyPreviewAssets } from '../scripts/verify-preview-assets.mjs';

function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'fitnesspilot-preview-check-'));
  const directory = join(root, 'preview-v101');
  mkdirSync(directory);
  const put = (file, contents) => writeFileSync(join(directory, file), contents);
  put('index.html', 'FITNESSPILOT V15.11 PREVIEW<link href="./theme.css"><script src="./app.js"></script>');
  put('manifest.webmanifest', JSON.stringify({name: 'FitnessPilot V15.11 Preview'}));
  put('sw.js', "const CACHE = 'fitnesspilot-preview-v1511-test'; const ASSETS = ['./index.html', './theme.css', './app.js', './lib.js', './manifest.webmanifest', './core.js'];");
  put('app.js', "import { sum } from './lib.js'; console.log(sum(1, 1));");
  put('lib.js', 'export const sum = (a, b) => a + b;');
  put('core.js', "export const STORAGE_KEY = 'fitnesspilot.preview.v101.v1';");
  put('theme.css', 'body { font: inherit; }');
  try {callback({root, put});} finally {rmSync(root, {recursive:true, force:true});}
}

test('complete disposable preview asset graph passes', () => {
  fixture(({root}) => {
    const result = verifyPreviewAssets(root);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.version, 'V15.11');
    assert.equal(result.checkedModules, 2);
  });
});

test('missing offline asset fails closed', () => {
  fixture(({root,put}) => {
    put('sw.js', "const CACHE = 'fitnesspilot-preview-v1511-test'; const ASSETS = ['./index.html', './missing.js'];");
    const result = verifyPreviewAssets(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(s => s.includes('Missing precache asset: missing.js')));
  });
});

test('stale cache version is rejected', () => {
  fixture(({root,put}) => {
    put('sw.js', "const CACHE = 'fitnesspilot-preview-v1510-old'; const ASSETS = ['./index.html', './theme.css', './app.js', './lib.js', './manifest.webmanifest', './core.js'];");
    assert.ok(verifyPreviewAssets(root).errors.some(s => s.includes('cache version differs')));
  });
});

test('unprecached imported module is rejected', () => {
  fixture(({root,put}) => {
    put('sw.js', "const CACHE = 'fitnesspilot-preview-v1511-test'; const ASSETS = ['./index.html', './theme.css', './app.js', './manifest.webmanifest', './core.js'];");
    assert.ok(verifyPreviewAssets(root).errors.some(s => s.includes('App module not precached: lib.js')));
  });
});

test('manifest and banner disagreeing fails', () => {
  fixture(({root,put}) => {
    put('manifest.webmanifest', JSON.stringify({name:'FitnessPilot V15.10 Preview'}));
    assert.ok(verifyPreviewAssets(root).errors.some(s => s.includes('Manifest version differs')));
  });
});

test('three-part release banners and cache naming are accepted', () => {
  fixture(({root,put}) => {
    put('index.html', 'FITNESSPILOT V15.11.1 PREVIEW<link href="./theme.css"><script src="./app.js"></script>');
    put('manifest.webmanifest', JSON.stringify({name:'FitnessPilot V15.11.1 Preview'}));
    put('sw.js', "const CACHE = 'fitnesspilot-preview-v15111-test'; const ASSETS = ['./index.html', './theme.css', './app.js', './lib.js', './manifest.webmanifest', './core.js'];");
    const result = verifyPreviewAssets(root);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.version, 'V15.11.1');
  });
});
