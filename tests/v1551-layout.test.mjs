import test from 'node:test';
import assert from 'node:assert/strict';
import { volumeBarsMarkup } from '../preview-v101/volume-bars.js';

const week = (volumes) => volumes.map(loadVolume => ({loadVolume}));

test('zero-volume days have baseline marks, not tall empty bars', () => {
  const html = volumeBarsMarkup(week([0, 0, 0, 0, 0, 0, 0]));
  assert.equal((html.match(/class="bar-zero"/g) || []).length, 7);
  assert.equal((html.match(/class="bar"/g) || []).length, 0);
  assert.doesNotMatch(html, /height:111px/);
});

test('only actual positive volume creates proportional bars', () => {
  const html = volumeBarsMarkup(week([0, 0, 250, 1000, 0, 0, 0]));
  assert.equal((html.match(/class="bar-zero"/g) || []).length, 5);
  assert.equal((html.match(/class="bar"/g) || []).length, 2);
  assert.match(html, /title="Wed: 250 kg·reps"><span class="bar" style="height:28px"/);
  assert.match(html, /title="Thu: 1,000 kg·reps"><span class="bar" style="height:111px"/);
});

test('zero kg work, missing volume and nonfinite values never inflate volume', () => {
  const html = volumeBarsMarkup(week([0, undefined, NaN, -1, Infinity, 100, 0]));
  assert.equal((html.match(/class="bar"/g) || []).length, 1);
  assert.match(html, /title="Fri: 0 kg·reps"/);
});

test('invalid weekly data is rejected rather than displayed inaccurately', () => {
  assert.throws(() => volumeBarsMarkup([]), /seven daily records/);
});
