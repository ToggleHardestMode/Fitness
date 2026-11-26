import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardHtml } from './dashboard-fixture.mjs';
import { dashboardMetricSnapshot } from '../preview-v101/metric-selectors.js';
import { dashboardInsights, weeklyInsightsMarkup } from '../preview-v101/dashboard-insights.js';
import { FOOD_KEY } from '../preview-v101/food-diary-core.js';

const today = '2026-10-28', monday = '2026-10-26';
const state = {templates: [], logs: [], assignments: {}, metrics: [{date: monday, weight: 90}], symptomLogs: []};
const diary = {version: 1, entries: [
  {id: 'fixture001', date: monday, name: 'Synthetic', occasion: 'meal', servings: 2, kcal: 100, protein: null, carbs: 0, fat: 5},
  {id: 'fixture002', date: '2026-10-31', name: 'Later date', occasion: 'meal', servings: 1, kcal: 9000, protein: 20, carbs: 30, fat: 40}
]};
const render = (rawDiary, anchor = monday) => {
  const snap = dashboardMetricSnapshot(state, rawDiary, anchor, today);
  return weeklyInsightsMarkup(snap, dashboardInsights(state, snap, today), String);
};

test('weekly insights precede detailed reports and use the sole existing week controls', () => {
  const html = dashboardHtml(state, {day: today, selection: {selectedWeekStart: monday}, storage: {[FOOD_KEY]: JSON.stringify(diary)}});
  const at = text => html.indexOf(text);
  assert.ok(at('aria-label="Nutrition quick links"') < at('aria-label="Choose training week"'));
  assert.ok(at('aria-label="Choose training week"') < at('aria-label="Weekly insights"'));
  assert.ok(at('aria-label="Weekly insights"') < at('aria-label="Workout backup status"'));
  assert.ok(at('aria-label="Weekly insights"') < at('aria-label="Recorded insights"'));
  for (const action of ['week-current', 'week-prev', 'week-next', 'week-latest'])
    assert.equal(html.split('data-action="' + action + '"').length - 1, 1);
  assert.match(html, /Nutrition & Weight Journey/);
});

test('compact tiles use elapsed values and disclose coverage, unknowns and recorded zero', () => {
  const html = render(diary);
  assert.match(html, /2026-10-26 – 2026-10-28 vs 2026-10-19 – 2026-10-21/);
  assert.match(html, /Calories<\/span><strong>200 <small>kcal\/day/);
  assert.match(html, /Protein<\/span><strong>Unknown/);
  assert.match(html, /Carbs<\/span><strong>0 <small>g\/day/);
  assert.match(html, /1\/3 dates with values/);
  assert.match(html, /comparison unavailable/);
  assert.match(html, /Food diary dates<\/strong><span>1\/3/);
  assert.doesNotMatch(html, /9000|9200/);
});

test('unavailable diary and empty diary stay distinct; future weeks have no comparison tiles', () => {
  assert.match(render(null), /Calories<\/span><strong>Unavailable/);
  assert.match(render({version: 1, entries: []}), /Calories<\/span><strong>Not logged/);
  const future = render(diary, '2026-11-02');
  assert.match(future, /No elapsed dates/);
  assert.doesNotMatch(future, /fp-intelligence-tile/);
});
