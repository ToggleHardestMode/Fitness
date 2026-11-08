import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Dashboard shortcut reads Nutrition and opens the nutrition page', () => {
  const source = readFileSync(new URL('../preview-v101/app.js', import.meta.url), 'utf8');
  const quickLinks = source.match(/<nav class="fp-top-nutrition"[^>]*>[\s\S]*?<\/nav>/)?.[0];
  assert.ok(quickLinks, 'Dashboard Nutrition quick-link navigation missing');
  assert.match(quickLinks, /href="\.\/nutrition\.html">Nutrition<\/a>/);
  assert.doesNotMatch(quickLinks, />Food<\/a>/);
});
