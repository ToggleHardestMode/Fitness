import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBackup} from '../preview-v101/core.js';
import {recommendNextExercise} from '../preview-v101/strength-journey.js';
import {manualProgression} from '../preview-v101/manual-progression.js';
import {expectedSetCount, setActiveSets, validateActiveSets} from '../preview-v101/active-sets.js';
import {activeSetsPanel, activeSetsLabel} from '../preview-v101/active-sets-ui.js';
import {resetTrackingData} from '../preview-v101/tracking-reset.js';

const template = {id:'syn', name:'Synthetic Day', day:0, exercises:[
  {name:'Synthetic Press', muscle:'Chest', sets:3, min:8, max:12, rest:90},
  {name:'Synthetic Row', muscle:'Back', sets:2, min:8, max:12, rest:90}]};
const row = (date, set, kg, reps, rpe = 7, extra = {}) => ({id:`${date}-${set}`, date, templateId:'syn', exerciseIndex:0,
  set, kg, reps, rpe, rest:90, notes:'', tempo:'', ...extra});
const observations = date => ['before', 'after', 'next_day'].map(timepoint => ({
  id:`${date}-${timepoint}`, date, timepoint, templateId:'syn', exerciseIndex:0, severity:0,
  tingling:false, numbness:false, functionChange:'none', location:'none', side:'none', notes:''}));
// Two sessions at top of range, two sets each, while the plan says three sets.
const build = () => ({
  version:1, templates:[structuredClone(template)], assignments:{},
  logs:[row('2026-10-30', 1, 12, 12), row('2026-10-30', 2, 12, 12), row('2026-11-01', 1, 12, 12), row('2026-11-01', 2, 12, 12)],
  symptomLogs:[...observations('2026-10-30'), ...observations('2026-11-01')],
  metrics:[{date:'2026-11-03', recovery:5}], reminder:{hour:18, minute:30, lead:0}, progressionStepKg:2
});
const choice = {date:'2026-11-03', templateId:'syn', exerciseIndex:0};

test('without active sets, a two-set history against a three-set plan still holds as incomplete', () => {
  const plan = recommendNextExercise(build(), choice);
  assert.equal(plan.status, 'hold');
  assert.match(plan.reason, /incomplete working sets/);
  assert.equal(expectedSetCount(build(), 'syn', 0), 3);
});

test('active sets below the plan let comparable sessions progress using sets 1..active only', () => {
  const state = {...build(), activeSets:{'syn|0':2}};
  const plan = recommendNextExercise(state, choice);
  assert.equal(plan.status, 'load');
  assert.deepEqual(plan.targets, [{set:1, kg:14, reps:8}, {set:2, kg:14, reps:8}]);
  assert.equal(plan.sampleSessions, 2);
});

test('rep progression and hold targets cover only sets 1..active', () => {
  const state = {...build(), activeSets:{'syn|0':2}};
  for (const entry of state.logs.filter(l => l.date === '2026-11-01')) entry.reps = 10;
  const rep = recommendNextExercise(state, choice);
  assert.equal(rep.status, 'rep');
  assert.deepEqual(rep.targets, [{set:1, kg:12, reps:11}, {set:2, kg:12, reps:11}]);
  state.logs.find(l => l.date === '2026-11-01' && l.set === 2).rpe = 9;
  const held = recommendNextExercise(state, choice);
  assert.equal(held.status, 'hold');
  assert.deepEqual(held.targets.map(t => t.set), [1, 2]);
});

test('logged sets above the active count are ignored for progression', () => {
  const state = {...build(), activeSets:{'syn|0':2}};
  const baseline = recommendNextExercise(state, choice);
  state.logs.push(row('2026-11-01', 3, 30, 1, 10, {technique:'unstable', difficulty:'too_hard'}));
  assert.deepEqual(recommendNextExercise(state, choice), baseline);
  // A session containing only ignored sets does not count as a session.
  state.logs.push(row('2026-11-02', 3, 50, 5));
  assert.deepEqual(recommendNextExercise(state, choice), baseline);
});

test('previous-session completeness is also checked against the active count', () => {
  const state = {...build(), activeSets:{'syn|0':2}};
  state.logs = state.logs.filter(l => !(l.date === '2026-10-30' && l.set === 2));
  const plan = recommendNextExercise(state, choice);
  assert.equal(plan.status, 'hold');
  assert.match(plan.reason, /One complete top-of-range session is not enough/);
  const incomplete = {...build(), activeSets:{'syn|0':2}};
  incomplete.logs = incomplete.logs.filter(l => !(l.date === '2026-11-01' && l.set === 2));
  assert.match(recommendNextExercise(incomplete, choice).reason, /incomplete working sets/);
});

test('an active count equal to the plan behaves exactly like no active sets; other gates still apply', () => {
  const full = build();
  full.logs.push(row('2026-10-30', 3, 12, 12), row('2026-11-01', 3, 12, 12));
  const withKey = {...structuredClone(full), activeSets:{'syn|0':3}};
  assert.deepEqual(recommendNextExercise(withKey, choice), recommendNextExercise(full, choice));
  assert.equal(recommendNextExercise(full, choice).status, 'load');
  const gated = {...build(), activeSets:{'syn|0':2}, metrics:[]};
  assert.equal(recommendNextExercise(gated, choice).status, 'hold');
  const pt = {...build(), activeSets:{'syn|0':2}};
  pt.templates[0].requiresClinicalReview = true;
  assert.equal(recommendNextExercise(pt, choice).status, 'pt-review');
});

test('manual progression is unchanged by active sets', () => {
  const plain = build(), withKey = {...build(), activeSets:{'syn|0':2}};
  for (const set of [1, 2, 3]) {
    const input = {date:'2026-11-03', templateId:'syn', exerciseIndex:0, set};
    assert.deepEqual(manualProgression(withKey, input), manualProgression(plain, input));
  }
});

test('invalid active-set keys and values are rejected without repair', () => {
  const bad = value => ({...build(), activeSets:value});
  assert.throws(() => validateBackup(bad({'missing|0':1})), /missing workout/);
  assert.throws(() => validateBackup(bad({'syn|9':1})), /missing exercise/);
  assert.throws(() => validateBackup(bad({'syn|00':1})), /invalid active-set key/);
  assert.throws(() => validateBackup(bad({'syn':1})), /invalid active-set key/);
  assert.throws(() => validateBackup(bad({'syn|0':0})), /from 1 to the planned 3/);
  assert.throws(() => validateBackup(bad({'syn|0':4})), /from 1 to the planned 3/);
  assert.throws(() => validateBackup(bad({'syn|1':3})), /from 1 to the planned 2/);
  assert.throws(() => validateBackup(bad({'syn|0':1.5})), /whole number/);
  assert.throws(() => validateBackup(bad({'syn|0':'2'})), /whole number/);
  assert.throws(() => validateBackup(bad([])), /invalid active-set list/);
  assert.throws(() => validateBackup(bad(null)), /invalid active-set list/);
  const original = bad({'syn|0':9}), copy = structuredClone(original);
  assert.throws(() => validateActiveSets(original));
  assert.deepEqual(original, copy);
  assert.doesNotThrow(() => validateBackup(bad({'syn|0':3, 'syn|1':1})));
});

test('changing active sets is manual, confirmed, and never touches logs', () => {
  const state = build(), before = structuredClone(state);
  assert.throws(() => setActiveSets(state, {templateId:'syn', exerciseIndex:0, count:2}), /explicit confirmation/);
  const lowered = setActiveSets(state, {templateId:'syn', exerciseIndex:0, count:2}, {confirmed:true});
  assert.deepEqual(state, before);
  assert.deepEqual(lowered.activeSets, {'syn|0':2});
  assert.deepEqual(lowered.logs, before.logs);
  assert.deepEqual(lowered.symptomLogs, before.symptomLogs);
  const restored = setActiveSets(lowered, {templateId:'syn', exerciseIndex:0, count:3}, {confirmed:true});
  assert.equal(Object.hasOwn(restored, 'activeSets'), false);
  assert.throws(() => setActiveSets(state, {templateId:'syn', exerciseIndex:0, count:4}, {confirmed:true}), /from 1 to 3/);
  assert.throws(() => setActiveSets(state, {templateId:'syn', exerciseIndex:0, count:0}, {confirmed:true}), /from 1 to 3/);
  assert.throws(() => setActiveSets(state, {templateId:'nope', exerciseIndex:0, count:1}, {confirmed:true}), /existing workout exercise/);
});

test('Train shows "Doing X of Y planned sets" only when active is below plan', () => {
  const state = {...build(), activeSets:{'syn|0':2}};
  assert.equal(activeSetsLabel(state, 'syn', 0), 'Doing 2 of 3 planned sets');
  assert.equal(activeSetsLabel(state, 'syn', 1), '');
  assert.equal(activeSetsLabel(build(), 'syn', 0), '');
  const panel = activeSetsPanel(state, {templateId:'syn', exerciseIndex:0});
  assert.match(panel, /Doing 2 of 3 planned sets/);
  assert.match(panel, /data-action="active-sets-change"/);
  assert.match(panel, /<option value="2" selected>2 of 3<\/option>/);
  assert.doesNotMatch(activeSetsPanel(build(), {templateId:'syn', exerciseIndex:0}), /Doing \d of/);
});

test('backup round-trips with active sets; an old backup without the field validates unchanged', () => {
  const state = {...build(), activeSets:{'syn|0':2}};
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state))), state);
  const old = build();
  const checked = validateBackup(old);
  assert.equal(Object.hasOwn(checked, 'activeSets'), false);
  assert.deepEqual(checked, old);
});

test('reset keeps active sets because they are configuration, not tracking records', () => {
  const state = {...build(), activeSets:{'syn|0':2}};
  const {nextState} = resetTrackingData(state, {apply:true});
  assert.deepEqual(nextState.activeSets, {'syn|0':2});
  assert.deepEqual(nextState.logs, []);
});
