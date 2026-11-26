import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardMetricSnapshot, selectedWeekFoodSummary } from '../preview-v101/metric-selectors.js';
import { selectedWeekFoodSummary as chartSummary } from '../preview-v101/food-diary-chart.js';
import { metricDefinition } from '../preview-v101/metric-dictionary.js';
import { dashboardHtml } from './dashboard-fixture.mjs';
import { FOOD_KEY } from '../preview-v101/food-diary-core.js';

const monday = '2026-10-26', today = '2026-10-28';
const log = (date, set, extra = {}) => ({date, templateId: 'a', exerciseIndex: 0, set, kg: 10, reps: 8, ...extra});
const food = (id, date, extra = {}) => ({id, date, name: 'Fixture', occasion: 'meal', servings: 2,
  kcal: 100, protein: 10, carbs: 20, fat: 0, ...extra});
const fixture = () => ({
  state: {
    templates: [{id: 'a', name: 'Upper', exercises: [{name: 'Press', muscle: 'Chest', sets: 3}]}],
    assignments: {0: 'a'}, symptomLogs: [],
    logs: [log('2026-10-19', 1), log('2026-10-24', 1), log(monday, 1), log(monday, 1),
      log(monday, 2, {kind: 'warmup'}), log(today, 1), log('2026-10-31', 1)],
    metrics: [{date: '2026-10-19', weight: 91}, {date: '2026-10-21', weight: 89},
      {date: monday, weight: 89, calories: 2000, protein: 120, sleep: 0, recovery: 3},
      {date: today, weight: 88}, {date: '2026-10-31', weight: 80}]
  },
  diary: {version: 1, entries: [food('food-001', monday), food('food-002', today, {protein: null}),
    food('food-003', '2026-10-31', {kcal: 1000}), food('food-004', '2026-10-19')]}
});

test('full selected week retains saved records; comparison matches elapsed weekdays and excludes later dates', () => {
  const {state, diary} = fixture(), before = structuredClone({state, diary});
  const r = dashboardMetricSnapshot(state, diary, monday, today);
  assert.equal(r.selected.training.savedSets.value, 3);
  assert.equal(r.trainingReport.completed, 3);
  assert.equal(r.comparison.current.training.savedSets.value, 2);
  assert.equal(r.comparison.current.training.loggedDays.value, 2);
  assert.equal(r.comparison.previous.training.savedSets.value, 1);
  assert.equal(r.comparison.current.periodDays, 3);
  assert.equal(r.comparison.previous.to, '2026-10-21');
  assert.equal(r.comparison.current.training.offPlanSets, 1);
  assert.equal(r.comparison.weightChange, -1.5);
  assert.equal(r.selected.food.nutrients.kcal.total, 2400);
  assert.equal(r.comparison.current.food.nutrients.kcal.total, 400);
  assert.equal(r.comparison.current.foodMetrics.protein.average, 20);
  assert.equal(r.comparison.current.foodMetrics.protein.unknownFoods, 1);
  assert.equal(r.comparison.current.foodMetrics.fat.value, 0);
  assert.equal(r.selected.manual.calories.value, 2000);
  assert.equal(r.selected.manual.sleep.value, 0);
  assert.equal(r.selected.manual.recovery.observations, 1);
  assert.deepEqual({state, diary}, before);
  assert.deepEqual(r.selected.food, selectedWeekFoodSummary(diary, monday));
  assert.equal(chartSummary, selectedWeekFoodSummary);
  for (const m of Object.values(r.selected.foodMetrics)) assert.equal(metricDefinition(m.id).unit, m.unit);
});

test('future week has no comparison; historical week compares seven days; sparse weights suppress delta', () => {
  const {state, diary} = fixture();
  assert.equal(dashboardMetricSnapshot(state, diary, '2026-11-02', today).comparison, null);
  const historical = dashboardMetricSnapshot(state, diary, '2026-10-19', today);
  assert.equal(historical.comparison.current.periodDays, 7);
  assert.equal(historical.comparison.weightChange, null);
  state.metrics = state.metrics.filter(m => m.date !== today);
  assert.equal(dashboardMetricSnapshot(state, diary, monday, today).comparison.weightChange, null);
});

test('unavailable diary differs from empty diary and does not suppress training; unknown is not zero', () => {
  const {state} = fixture();
  const missing = dashboardMetricSnapshot(state, null, monday, today);
  assert.equal(missing.selected.food, null);
  assert.equal(missing.selected.foodMetrics, null);
  assert.equal(missing.selected.training.savedSets.value, 3);
  const empty = dashboardMetricSnapshot(state, {version: 1, entries: []}, monday, today);
  assert.equal(empty.selected.food.recordedDays, 0);
  assert.equal(empty.selected.foodMetrics.kcal.value, null);
  assert.equal(empty.selected.foodMetrics.kcal.status, 'not_logged');
  assert.equal(empty.selected.manual.protein.value, 120);
  const html = dashboardHtml(state, {day: today, selection: {selectedWeekStart: monday}, storage: {[FOOD_KEY]: '{bad'}});
  assert.match(html, /Food Diary data could not be read/);
  assert.match(html, /3 saved set\(s\)/);
});

test('dates are validated and duplicate weight dates fail instead of inflating evidence', () => {
  const {state, diary} = fixture();
  assert.throws(() => dashboardMetricSnapshot(state, diary, '2026-02-30', today), /Invalid calendar date/);
  assert.throws(() => dashboardMetricSnapshot(state, diary, monday, 'invalid'), /YYYY-MM-DD/);
  state.metrics.push({date: monday, weight: 90});
  assert.throws(() => dashboardMetricSnapshot(state, diary, monday, today), /Duplicate weight/);
});
