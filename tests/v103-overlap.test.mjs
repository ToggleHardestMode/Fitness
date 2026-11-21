import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addWorkouts, emptyState, parseWorkouts } from '../preview-v101/core.js';
import { V102_CSV, V102_VERSION } from '../preview-v101/v102-data.js';
import { V103_COEFFICIENTS_CSV, V103_CSV, v103Templates } from '../preview-v101/v103-data.js';
import { parseV103Coefficients, validateV103Mapping, weeklyV102Overlap, weeklyV103Overlap } from '../preview-v101/v102-overlap.js';
import { createExerciseVersion } from '../preview-v101/template-version.js';
import { v103OverlapPanel } from '../preview-v101/v102-overlap-ui.js';

const monday = '2026-11-16';

function scheduled() {
  let nextId = 0;
  const { state } = addWorkouts(emptyState(), v103Templates(), false, () => `v103-overlap-${++nextId}`);
  state.assignments = Object.fromEntries(state.templates.map(t => [t.day, t.id]));
  return state;
}

test('embedded V10.3 coefficients match the canonical CSV and four versioned templates', () => {
  const source = readFileSync(new URL('../templates/V10.3_Overlap_Coefficients.csv', import.meta.url), 'utf8');
  assert.equal(V103_COEFFICIENTS_CSV, source);
  const coefficients = parseV103Coefficients();
  assert.equal(coefficients.size, 27);
  assert.equal(validateV103Mapping(v103Templates(), coefficients), true);
});

test('planned V10.3 weekly dose matches hand-calculated direct and indirect equivalents', () => {
  const state = scheduled();
  const before = structuredClone(state);
  const report = weeklyV103Overlap(state, monday);
  // Direct sets are counted once; indirect sets are the sum of the CSV's half-weight contributions.
  const expected = {
    Chest: [8, 0], Lats: [10, 0], 'Upper Back': [1, 4], 'Front Delts': [2, 4],
    'Side Delts': [6, 1], 'Rear Delts': [2, 3.5], Biceps: [4, 5.5], Triceps: [4, 5],
    Quads: [6, 0], Hamstrings: [2, 0], Glutes: [4, 4], Calves: [4, 0], Core: [3, 0]
  };
  assert.deepEqual(report.planned, Object.fromEntries(Object.entries(expected).map(([region, [direct, indirect]]) =>
    [region, { direct, indirect, equivalents: direct + indirect }])));
  assert.deepEqual([report.physicalPlanned, report.physicalLogged, report.unmapped], [56, 0, 0]);
  assert.deepEqual(state, before);
});

test('V10.3 counts each valid working set once and keeps the scheduled version separate from logged versions', () => {
  const state = scheduled();
  const v103 = state.templates.find(t => t.day === 0);
  const [legacy] = parseWorkouts(V102_CSV);
  state.templates.push({ ...legacy, id: 'v102-overlap-legacy', sourceVersion: V102_VERSION });
  state.assignments = { 0: 'v102-overlap-legacy' };
  const set = { date: monday, templateId: v103.id, exerciseIndex: 0, set: 1, kg: 20, reps: 10 };
  state.logs = [set, { ...set }, { ...set, set: 2, kind: 'warmup' }, { ...set, set: 3, isWarmup: true },
    { ...set, set: 4 }, { ...set, date: '2026-11-15' }, { ...set, templateId: 'v102-overlap-legacy' }];
  const v103Report = weeklyV103Overlap(state, monday);
  assert.deepEqual([v103Report.physicalPlanned, v103Report.physicalLogged], [0, 1]);
  assert.equal(v103Report.logged.Chest.direct, 1);
  assert.equal(v103Report.logged.Triceps.indirect, 0.5);
  assert.equal(v103Report.logged['Front Delts'].indirect, 0.5);
  const v102Report = weeklyV102Overlap(state, monday);
  assert.deepEqual([v102Report.physicalPlanned, v102Report.physicalLogged], [17, 1]);
  assert.equal(v102Report.logged.Chest.direct, 1);
});

test('a custom V10.3-derived workout and an unmatched canonical exercise receive no inherited weights', () => {
  const state = scheduled();
  const upper = state.templates.find(t => t.day === 0);
  const original = upper.exercises[0];
  const { state: withCustom, template } = createExerciseVersion(
    state, upper.id, 0, { ...original, rest: original.rest + 5 }, () => 'b112-custom');
  assert.equal(template.exercises[0].name, original.name);
  withCustom.assignments = { 0: template.id };
  const log = { date: monday, templateId: template.id, exerciseIndex: 0, set: 1, kg: 20, reps: 10 };
  withCustom.logs = [log];
  const custom = weeklyV103Overlap(withCustom, monday);
  assert.deepEqual([custom.physicalPlanned, custom.physicalLogged, custom.unmapped], [0, 0, 0]);

  upper.exercises[0].name = 'Unmatched test exercise';
  state.assignments = { 0: upper.id };
  state.logs = [{ ...log, templateId: upper.id }];
  const unmatched = weeklyV103Overlap(state, monday);
  assert.deepEqual([unmatched.physicalPlanned, unmatched.physicalLogged, unmatched.unmapped], [14, 0, 4]);
  assert.equal(unmatched.logged.Chest.direct, 0);
});

test('an exact V10.3 generic CSV import appears in overlap without rewriting its version or logs', () => {
  let nextId = 0;
  const { state } = addWorkouts(emptyState(), parseWorkouts(V103_CSV), false, () => `v103-csv-${++nextId}`);
  const upper = state.templates.find(template => template.day === 0);
  state.assignments = { 0: upper.id };
  state.logs = [{ date: monday, templateId: upper.id, exerciseIndex: 0, set: 1, kg: 20, reps: 10 }];
  const before = structuredClone(state);
  const report = weeklyV103Overlap(state, monday);
  assert.deepEqual([report.physicalPlanned, report.physicalLogged], [17, 1]);
  assert.match(v103OverlapPanel(state, monday), /17 physical sets planned/);
  assert.deepEqual(state, before);
  assert.equal(upper.sourceVersion, undefined);

  upper.exercises[0].rest += 5;
  const edited = weeklyV103Overlap(state, monday);
  assert.deepEqual([edited.physicalPlanned, edited.physicalLogged], [0, 0]);
  assert.equal(v103OverlapPanel({ ...state, templates: [upper] }, monday), '');
});
