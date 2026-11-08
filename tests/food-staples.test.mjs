import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LABELLED_PROTEIN_PIECE } from '../preview-v101/food-staples.js';
import { EMPTY_DIARY, saveEntry, totalsForDate } from '../preview-v101/food-diary-core.js';

const logFor = servings => saveEntry(EMPTY_DIARY(), {
  ...LABELLED_PROTEIN_PIECE,
  id: 'staple-test-001',
  date: '2026-11-06',
  servings,
});

test('label values are per piece, not for six pieces', () => {
  assert.deepEqual(
    ['kcal', 'protein', 'carbs', 'fat'].map(key => LABELLED_PROTEIN_PIECE[key]),
    [73, 14.6, 2.2, 0.6],
  );
  assert.equal(LABELLED_PROTEIN_PIECE.servings, 6);
  assert.equal(LABELLED_PROTEIN_PIECE.name.length <= 80, true);
});

test('logging six pieces uses the existing diary portion multiplier once', () => {
  const diary = logFor(6);
  const totals = totalsForDate(diary, '2026-11-06');
  assert.equal(totals.count, 1);
  assert.equal(totals.nutrients.kcal.value, 438);
  assert.ok(Math.abs(totals.nutrients.protein.value - 87.6) < 1e-10);
  assert.ok(Math.abs(totals.nutrients.carbs.value - 13.2) < 1e-10);
  assert.ok(Math.abs(totals.nutrients.fat.value - 3.6) < 1e-10);
  assert.equal(totalsForDate(diary, '2026-11-05').count, 0);
  assert.equal(EMPTY_DIARY().entries.length, 0);
});

test('three-piece prefill nutrition remains derived from per-piece values', () => {
  const diary = logFor(3);
  const totals = totalsForDate(diary, '2026-11-06');
  assert.equal(totals.count, 1);
  assert.equal(totals.nutrients.kcal.value, 219);
  assert.ok(Math.abs(totals.nutrients.protein.value - 43.8) < 1e-10);
  assert.ok(Math.abs(totals.nutrients.carbs.value - 6.6) < 1e-10);
  assert.ok(Math.abs(totals.nutrients.fat.value - 1.8) < 1e-10);
  assert.equal(LABELLED_PROTEIN_PIECE.servings, 6, 'existing six-piece choice must not change');
  assert.equal(totalsForDate(EMPTY_DIARY(), '2026-11-06').count, 0);
});

test('both quick-add buttons bind to prefill only, without a save', () => {
  const html = readFileSync(new URL('../preview-v101/food-diary.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../preview-v101/food-diary.js', import.meta.url), 'utf8');
  assert.ok(html.includes('id="fd-staple-six"'));
  assert.ok(html.includes('id="fd-staple-three"'));
  assert.ok(js.includes("'fd-staple-six').addEventListener('click',()=>prefillStaple(6))"));
  assert.ok(js.includes("'fd-staple-three').addEventListener('click',()=>prefillStaple(3))"));
  const prefillBody = js.split('function prefillStaple(servings){')[1]?.split("\n  }")[0] ?? '';
  assert.ok(prefillBody);
  assert.doesNotMatch(prefillBody, /persist\(|saveEntry\(/);
});

test('quantity remains editable: one piece logs one serving only', () => {
  const totals = totalsForDate(logFor(1), '2026-11-06');
  assert.equal(totals.nutrients.kcal.value, 73);
  assert.equal(totals.nutrients.protein.value, 14.6);
});

test('offline shell precaches the imported food-staples module', () => {
  const sw = readFileSync(new URL('../preview-v101/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /'\.\/food-staples\.js'/);
});
