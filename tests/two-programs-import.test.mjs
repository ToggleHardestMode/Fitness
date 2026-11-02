import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyState, STARTER_CSV, UNIFIED_UL_CSV, parseWorkouts, addWorkouts, recordSets, validateBackup } from '../preview-v101/core.js';
import { V102_CSV } from '../preview-v101/v102-data.js';

const source = readFileSync(new URL('../preview-v101/app.js', import.meta.url), 'utf8');
const helper = source.match(/function twoProgramTemplates\(\) \{[\s\S]*?\n\}/)?.[0];
const ids = prefix => { let n = 0; return () => prefix + ++n; };
const both = () => {
  assert.ok(helper, 'The Plan action must use the tested two-program helper');
  const run = new Function('parseWorkouts', 'UNIFIED_UL_CSV', 'v102Templates',
    helper + '\nreturn twoProgramTemplates();');
  return run(parseWorkouts, UNIFIED_UL_CSV, () => parseWorkouts(V102_CSV));
};

test('one-click Plan action is visible and uses opt-in, non-scheduling import', () => {
  assert.match(source, /data-action="two-programs-add"/);
  assert.match(source, /if\(act==='two-programs-add'\)/);
  assert.match(source, /addWorkouts\(state,twoProgramTemplates\(\),false\)/);
});

test('the two preserved programs are eight sessions with correct set counts and PT flags', () => {
  const templates = both();
  assert.deepEqual(templates.map(t => [t.day, t.exercises.reduce((sum, e) => sum + e.sets, 0)]),
    [[0,21],[1,18],[3,24],[4,19],[0,17],[1,13],[3,21],[4,11]]);
  assert.deepEqual(templates.filter(t => t.requiresClinicalReview).map(t => t.day), [1,4,1,4]);
  assert.deepEqual(templates[0].exercises[0].setTargets,
    [{min:5,max:8},{min:8,max:12},{min:8,max:12}]);
  assert.equal(templates[7].exercises.find(e => e.name.includes('Side Plank')).repUnit, 'seconds_per_side');
});

test('add both preserves existing records and schedule; second add makes no duplicates', () => {
  const starter = addWorkouts(emptyState(), parseWorkouts(STARTER_CSV), true, ids('old-')).state;
  const before = recordSets(starter, {
    date: '2026-10-19', templateId: starter.templates[0].id, exerciseIndex: 0,
    entries: [{completed:true,kg:24,reps:10,rpe:8,rest:90,notes:'fixture',tempo:''},
      {completed:false},{completed:false}]
  }, ids('log-')).state;
  const original = structuredClone(before);
  const first = addWorkouts(before, both(), false, ids('new-'));
  assert.equal(first.added, 8);
  assert.equal(first.skipped, 0);
  assert.equal(first.state.templates.length, 12);
  assert.deepEqual(first.state.assignments, original.assignments);
  assert.deepEqual(first.state.logs, original.logs);
  assert.deepEqual(first.state.metrics, original.metrics);
  assert.deepEqual(before, original);
  assert.deepEqual(validateBackup(first.state), first.state);
  const second = addWorkouts(first.state, both(), false, ids('repeat-'));
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 8);
  assert.deepEqual(second.state, first.state);
});
