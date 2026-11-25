import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyTrainingAnalysis } from '../preview-v101/training-analytics.js';
import { trainingAnalyticsPanel } from '../preview-v101/training-analytics-ui.js';

const monday = '2026-10-19';
const thursday = '2026-10-22';
const saturday = '2026-10-24';
const template = (id, name, sets) => ({
  id, name, exercises: [{ name: 'Press', muscle: 'Chest', sets }]
});
const log = (date, templateId, set) => ({
  date, templateId, exerciseIndex: 0, set, kg: 10, reps: 8
});
const fixture = () => ({
  templates: [template('b', 'Upper B', 10), template('a', 'Upper A', 3)],
  assignments: { 3: 'b' }, symptomLogs: [],
  logs: Array.from({ length: 10 }, (_, i) => log(saturday, 'b', i + 1))
});
const row = (html, day) => {
  const match = html.match(new RegExp('<strong>' + day + '</strong><div class="score">([^<]*)</div>'));
  assert.ok(match, 'missing row: ' + day);
  return match[1];
};

test('unscheduled training leads with actual sets and leaves Thursday assigned', () => {
  const state = fixture();
  state.logs.push({ ...state.logs[0] }, { ...log(saturday, 'a', 1), kind: 'warmup' });
  const before = structuredClone(state);
  const report = weeklyTrainingAnalysis(state, monday);
  const html = trainingAnalyticsPanel(state, monday, saturday);
  assert.equal(row(html, 'Sat'), '10 sets logged · No workout scheduled');
  assert.equal(row(html, 'Thu'), '0 sets logged · Upper B: 0 of 10 planned · No assigned sets recorded');
  assert.equal(row(html, 'Sun'), '0 sets logged · No workout scheduled');
  assert.equal(report.completed, 10);
  assert.equal(report.assignedCompleted, 0);
  assert.equal(report.offPlan, 10);
  assert.equal(report.days[3].templateId, 'b');
  assert.match(html, /Recorded sets<\/div><div class="kpi-value">10<\/div>/);
  assert.match(html, /scheduled sets use today's saved weekday assignments, not a historical schedule snapshot/);
  assert.deepEqual(state, before);
});

test('mixed training shows actual total first and preserves the assignment breakdown', () => {
  const state = fixture();
  state.logs.push(log(thursday, 'b', 1), log(thursday, 'a', 1));
  const report = weeklyTrainingAnalysis(state, monday);
  const html = trainingAnalyticsPanel(state, monday, saturday);
  assert.equal(row(html, 'Thu'), '2 sets logged · Upper B: 1 of 10 planned · Some assigned sets logged · 1 off-plan');
  assert.equal(report.completed, 12);
  assert.equal(report.assignedCompleted, 1);
  assert.equal(report.offPlan, 11);
});

test('one working set is singular and assigned workout names are escaped', () => {
  const state = fixture();
  state.templates[0].name = 'Upper <B>';
  state.logs.push(log(thursday, 'b', 1));
  const html = trainingAnalyticsPanel(state, monday, saturday);
  assert.equal(row(html, 'Thu'), '1 set logged · Upper &lt;B&gt;: 1 of 10 planned · Some assigned sets logged');
});
