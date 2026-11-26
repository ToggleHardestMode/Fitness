import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardMetricSnapshot } from '../preview-v101/metric-selectors.js';
import { dashboardInsights, insightsMarkup } from '../preview-v101/dashboard-insights.js';
import { dashboardHtml } from './dashboard-fixture.mjs';
import { FOOD_KEY } from '../preview-v101/food-diary-core.js';

const monday = '2026-10-26', today = '2026-10-28';
const log = (date, kg, extra = {}) => ({date, templateId: 'a', exerciseIndex: 0, set: 1, kg, reps: 8,
  rpe: 7, technique: 'controlled', ...extra});
const meal = (id, date, kcal, extra = {}) => ({id, date, name: 'Fixture', occasion: 'meal',
  servings: 1, kcal, protein: 20, carbs: 10, fat: 0, ...extra});
const fixture = () => ({
  state: {templates: [
    {id: 'a', name: 'Upper', exercises: [{name: 'Press <A>', muscle: 'Chest', sets: 2}]},
    {id: 'b', name: 'Archive', exercises: [{name: 'Press <A>', muscle: 'Chest', sets: 2}]}
  ], assignments: {0: 'a'}, symptomLogs: [], logs: [
    log('2026-10-19', 10), log(monday, 12), log('2026-10-31', 99),
    log('2026-10-19', 50, {templateId: 'b'})
  ], metrics: [
    {date: '2026-10-19', weight: 92, recovery: 4}, {date: '2026-10-21', weight: 90, recovery: 4},
    {date: monday, weight: 89, recovery: 3}, {date: today, weight: 90, recovery: 3}
  ]},
  diary: {version: 1, entries: [
    meal('food-001', '2026-10-19', 300), meal('food-002', '2026-10-20', 300),
    meal('food-003', '2026-10-21', 300), meal('food-004', monday, 200),
    meal('food-005', '2026-10-27', 200), meal('food-006', today, 200, {protein: null})
  ]}
});
const report = ({state, diary}, anchor = monday) =>
  dashboardInsights(state, dashboardMetricSnapshot(state, diary, anchor, today), today);

test('cross-data insights compare matched weekdays and exact exercise identity without mutation', () => {
  const f = fixture(), before = structuredClone(f), r = report(f);
  assert.equal(r.training.current, 1);
  assert.equal(r.training.previous, 2);
  assert.equal(r.weight.change, -1.5);
  assert.equal(r.loads.length, 1);
  assert.equal(r.loads[0].change, 2);
  assert.equal(r.loads[0].current.date, monday);
  assert.equal(r.food.nutrients.kcal.change, -100);
  assert.equal(r.food.nutrients.protein, null);
  assert.equal(r.food.nutrients.fat.change, 0);
  assert.equal(r.recovery.dueDates, 1);
  assert.deepEqual(r.recovery.missingNextDayDates, [monday]);
  assert.deepEqual(f, before);
  const html = insightsMarkup(r, String);
  assert.match(html, /Lower recorded weight with higher matched exercise load/);
  assert.match(html, /Press &lt;A&gt;/);
  assert.match(html, /not proof of muscle gain/);
  assert.doesNotMatch(html, /Press <A>/);
});

test('mismatched effort, repetitions, technique or set identity suppress load comparison', () => {
  for (const changes of [{rpe: null}, {rpe: 8}, {reps: 9}, {technique: ''},
    {technique: 'unstable'}, {difficulty: 'too_hard'}, {set: 2}, {kind: 'warmup'}, {kg: 0}]) {
    const f = fixture();
    Object.assign(f.state.logs[1], changes);
    assert.equal(report(f).loads.length, 0, JSON.stringify(changes));
  }
  const f = fixture();
  f.state.templates[0].exercises[0].repUnit = 'seconds_per_side';
  assert.equal(report(f).loads.length, 0);
});

test('sparse and unavailable evidence does not fabricate comparisons', () => {
  const f = fixture();
  f.state.metrics = f.state.metrics.filter(m => m.date !== today);
  f.diary.entries = f.diary.entries.filter(m => m.date !== today);
  const r = report(f);
  assert.equal(r.weight.change, null);
  assert.equal(r.food.nutrients.kcal, null);
  assert.equal(r.recovery.currentCount, 1);
  assert.doesNotMatch(insightsMarkup(r, String), /Lower recorded weight with higher matched exercise load/);
  f.diary = null;
  assert.equal(report(f).food.coverage, null);
  assert.equal(report(f, '2026-11-02').status, 'future_period');
});

test('next-day coverage measures dates, not clinical clearance, and excludes today', () => {
  const f = fixture();
  f.state.logs.push(log(today, 12));
  f.state.symptomLogs.push({date: monday, timepoint: 'next_day'});
  const r = report(f);
  assert.equal(r.recovery.dueDates, 1);
  assert.deepEqual(r.recovery.missingNextDayDates, []);
  assert.match(insightsMarkup(r, String), /No causal conclusions/);
});

test('Dashboard renders actual insight period, preserves links and handles bad diary', () => {
  const f = fixture();
  // Dashboard fixture needs valid legacy log labels for strongest-sets display.
  f.state.logs = f.state.logs.map(l => ({...l, exerciseName: 'Press', muscle: 'Chest'}));
  const options = {day: today, selection: {selectedWeekStart: monday}, storage: {[FOOD_KEY]: JSON.stringify(f.diary)}};
  const html = dashboardHtml(f.state, options);
  assert.match(html, /aria-label="Recorded insights"/);
  assert.match(html, /2026-10-26 – 2026-10-28 compared with 2026-10-19 – 2026-10-21/);
  assert.match(html, /Lower recorded weight with higher matched exercise load/);
  assert.match(dashboardHtml(f.state, {...options, storage: {[FOOD_KEY]: '{bad'}}), /Food Diary unavailable/);
});
