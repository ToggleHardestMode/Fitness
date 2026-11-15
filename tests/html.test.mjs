import test from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../preview-v101/html.js';

test('esc replaces all five HTML-sensitive characters in text and quoted attributes', () => {
  assert.equal(esc(`Tom & <Ana> "Sam's"`), 'Tom &amp; &lt;Ana&gt; &quot;Sam&#39;s&quot;');
});

test('esc preserves empty and non-string values used by preview views', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(0), '0');
  assert.equal(esc(false), 'false');
});
