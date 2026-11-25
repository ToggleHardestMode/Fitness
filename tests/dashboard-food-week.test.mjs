import test from 'node:test';
import assert from 'node:assert/strict';
import { FOOD_KEY } from '../preview-v101/food-diary-core.js';
import { selectedWeekFoodSummary, selectedWeekFoodMarkup, readFoodDiaryChart } from '../preview-v101/food-diary-chart.js';
import { dashboardHtml } from './dashboard-fixture.mjs';

const monday = '2026-10-26';
const meal = (id, date, changes = {}) => ({
  id, date, name: 'Synthetic meal', occasion: 'meal', servings: 1,
  kcal: 100, protein: 10, carbs: 20, fat: 5, ...changes
});
const diary = {version: 1, entries: [
  meal('food-001', '2026-10-25', {kcal: 9999}),
  meal('food-002', monday, {servings: 2, protein: null, fat: 0}),
  meal('food-003', monday, {kcal: null, protein: 15, carbs: null, fat: null}),
  meal('food-004', '2026-11-01', {kcal: 300, protein: 0, carbs: null, fat: null}),
  meal('food-005', '2026-11-02', {kcal: 7777})
]};

test('selected week uses saved portions once, nutrient-specific known days and inclusive boundaries', () => {
  const before = structuredClone(diary);
  const r = selectedWeekFoodSummary(diary, monday);
  assert.deepEqual([r.start, r.end, r.recordedDays, r.foodCount], [monday, '2026-11-01', 2, 3]);
  assert.deepEqual(r.nutrients, {
    kcal: {total: 500, average: 250, knownDays: 2, unknownFoods: 1},
    protein: {total: 15, average: 7.5, knownDays: 2, unknownFoods: 1},
    carbs: {total: 40, average: 40, knownDays: 1, unknownFoods: 2},
    fat: {total: 0, average: 0, knownDays: 1, unknownFoods: 2}
  });
  assert.deepEqual(diary, before);
  const html = selectedWeekFoodMarkup(r);
  assert.match(html, /2\/7 days with food entries/);
  assert.match(html, /≥ 500 kcal/);
  assert.match(html, /Avg: ≥ 7.5 g/);
  assert.match(html, /≥ 0 g/);
  assert.match(html, /Manual check-ins are separate/);
});

test('no entries, all unknown and explicit zero remain distinct', () => {
  const empty = selectedWeekFoodSummary({version: 1, entries: []}, monday);
  assert.equal(empty.nutrients.kcal.total, null);
  assert.match(selectedWeekFoodMarkup(empty), /Not logged/);
  const unknown = selectedWeekFoodSummary({version: 1, entries: [
    meal('food-006', monday, {kcal: null, protein: 0, carbs: null, fat: null})
  ]}, monday);
  const html = selectedWeekFoodMarkup(unknown);
  assert.match(html, /Unknown/);
  assert.match(html, /<div class="score">0 g/);
  assert.equal(unknown.nutrients.kcal.average, null);
  assert.equal(unknown.nutrients.protein.average, 0);
  assert.throws(() => selectedWeekFoodSummary(diary, '2026-10-27'), /Monday/);
});

test('Dashboard changes macro summary and chart end when the selected week changes', () => {
  const storage = {[FOOD_KEY]: JSON.stringify(diary)};
  const options = {day: '2026-11-05', storage};
  const previous = dashboardHtml({}, {...options, selection: {selectedWeekStart: monday}});
  const current = dashboardHtml({}, {...options, selection: {selectedWeekStart: '2026-11-02'}});
  assert.match(previous, /Selected week · 2026-10-26 – 2026-11-01/);
  assert.match(previous, /28 days ending 2026-11-01/);
  assert.match(previous, /≥ 500 kcal/);
  assert.doesNotMatch(previous, /7,777 kcal/);
  assert.match(current, /Selected week · 2026-11-02 – 2026-11-08/);
  assert.match(current, /28 days ending 2026-11-08/);
  assert.match(current, /7,777 kcal/);
  assert.match(current, /Weekly averages · not derived from Food Diary/);
});

test('selected week handles corrupt storage without writing or reporting false zero', () => {
  let writes = 0;
  const html = readFoodDiaryChart({getItem: () => '{broken', setItem: () => writes++}, '2026-11-05', monday);
  assert.match(html, /could not be read/);
  assert.doesNotMatch(html, /0\/7 days with food entries/);
  assert.equal(writes, 0);
});
